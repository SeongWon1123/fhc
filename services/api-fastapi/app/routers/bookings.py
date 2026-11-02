import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from httpx import HTTPError
from postgrest.exceptions import APIError

from app.config import settings
from app.database import get_optional_supabase
from app.dependencies import get_current_user
from app.fallback import (
    DEMO_USER_ID,
    create_booking as fallback_create_booking,
    list_bookings as fallback_list_bookings,
    update_booking_status as fallback_update_booking_status,
)
from app.models.booking import BookingCreate, BookingResponse, BookingStatusUpdate, ReviewCreate
from app.services.booking_events import publish_booking_change
from app.services.notifications import notify_booking, notify_review
from app.services.booking_rules import (
    BookingConflictError,
    BookingPermissionError,
    ensure_booking_update,
)


router = APIRouter(prefix="/bookings", tags=["bookings"])


def _using_demo_user(current_user) -> bool:
    return settings.demo_fallback_enabled and str(current_user.id) == str(DEMO_USER_ID)


def _database_error(exc: APIError | HTTPError) -> HTTPException:
    if isinstance(exc, APIError) and exc.code == "23P01":
        return HTTPException(status_code=409, detail="Time slot already booked")
    return HTTPException(status_code=503, detail="Booking data store unavailable")


@router.post("", response_model=BookingResponse)
@router.post("/", response_model=BookingResponse, include_in_schema=False)
async def create_booking(
    booking: BookingCreate,
    request: Request,
    response: Response,
    current_user=Depends(get_current_user),
):
    scheduled_at = booking.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if scheduled_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Booking time must be in the future")
    if str(booking.coach_id) == str(current_user.id):
        raise HTTPException(status_code=422, detail="Cannot book yourself as coach")
    if _using_demo_user(current_user):
        try:
            response.headers["X-Booking-Notification"] = "skipped"
            return fallback_create_booking(booking.model_dump(mode="json"), current_user.id)
        except BookingConflictError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Booking data store unavailable")
    try:
        coaches = (
            supabase.table("coach_details")
            .select("*")
            .eq("id", str(booking.coach_id))
            .limit(1)
            .execute()
        )
        if not coaches.data:
            raise HTTPException(status_code=404, detail="Coach not found")
        coach = coaches.data[0]
        if coach.get("is_verified") is not True:
            raise HTTPException(status_code=404, detail="Coach not found")
        profiles = (
            supabase.table("profiles")
            .select("*")
            .eq("id", str(booking.coach_id))
            .limit(1)
            .execute()
        )
        if not profiles.data or profiles.data[0].get("role") != "coach":
            raise HTTPException(status_code=404, detail="Coach not found")
        availability = coach.get("weekly_availability")
        if isinstance(availability, dict):
            start = booking.scheduled_at.astimezone(ZoneInfo("Asia/Seoul"))
            weekdays = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
            if start.minute != 0 or start.second != 0 or start.microsecond != 0 or any(
                slot.strftime("%H:00") not in availability.get(weekdays[slot.weekday()], [])
                for slot in (
                    start + timedelta(hours=hour)
                    for hour in range((booking.duration_minutes + 59) // 60)
                )
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Requested time is outside the coach's availability",
                )
        meeting_url = (
            f"https://meet.fitconnect.kr/{uuid4().hex[:8]}"
            if booking.session_type == "online"
            else None
        )
        # The database exclusion constraint arbitrates concurrent and overlapping
        # pending/confirmed inserts; a separate SELECT cannot make this atomic.
        result = supabase.table("bookings").insert({
            "user_id": str(current_user.id),
            "coach_id": str(booking.coach_id),
            "gym_id": coach.get("gym_id"),
            "scheduled_at": booking.scheduled_at.isoformat(),
            "duration_minutes": booking.duration_minutes,
            "session_type": booking.session_type.value,
            "status": "pending",
            "price": int(coach["base_price"]) * booking.duration_minutes // 60,
            "meeting_url": meeting_url,
            "notes": booking.notes,
        }).execute()
    except (APIError, HTTPError) as exc:
        raise _database_error(exc) from exc

    saved = result.data[0]
    notify_booking(saved, str(current_user.id))
    response.headers["X-Booking-Notification"] = await publish_booking_change(
        str(saved["id"]), request.headers.get("authorization", ""), settings.bff_internal_url
    )
    return saved


@router.get("/my")
async def get_my_bookings(
    current_user=Depends(get_current_user),
    role: str = Query("user", pattern="^(user|coach)$"),
):
    if _using_demo_user(current_user):
        return fallback_list_bookings(current_user.id, role)
    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Booking data store unavailable")
    try:
        if role == "coach":
            query = supabase.table("bookings").select(
                "*, profiles!bookings_user_id_fkey(full_name, avatar_url)"
            ).eq("coach_id", str(current_user.id))
        else:
            query = supabase.table("bookings").select(
                "*, profiles!bookings_coach_id_fkey(full_name, avatar_url, coach_details(specialty)), "
                "reviews(id, rating, content)"
            ).eq("user_id", str(current_user.id))
        return query.order("scheduled_at", desc=True).execute().data or []
    except (APIError, HTTPError) as exc:
        raise _database_error(exc) from exc


@router.post("/{booking_id}/review")
async def create_review(
    booking_id: UUID,
    review: ReviewCreate,
    current_user=Depends(get_current_user),
):
    supabase = None if _using_demo_user(current_user) else get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Review data store unavailable")
    try:
        rows = (
            supabase.table("bookings").select("id, user_id, coach_id, status")
            .eq("id", str(booking_id)).limit(1).execute()
        )
        if not rows.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking = rows.data[0]
        if str(booking["user_id"]) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Only the booking member can review")
        if booking["status"] != "completed":
            raise HTTPException(status_code=409, detail="Only completed bookings can be reviewed")
        saved = supabase.table("reviews").insert({
            "booking_id": str(booking_id),
            "user_id": str(current_user.id),
            "coach_id": str(booking["coach_id"]),
            "rating": review.rating,
            "content": (review.content or "").strip() or None,
        }).execute()
        ratings = [
            row["rating"]
            for row in supabase.table("reviews").select("rating")
            .eq("coach_id", str(booking["coach_id"])).execute().data or []
        ]
        supabase.table("coach_details").update({
            "rating": round(sum(ratings) / len(ratings), 2) if ratings else 0,
            "review_count": len(ratings),
        }).eq("id", str(booking["coach_id"])).execute()
    except APIError as exc:
        if exc.code == "23505":
            raise HTTPException(status_code=409, detail="Booking already reviewed") from exc
        raise HTTPException(status_code=503, detail="Review data store unavailable") from exc
    except HTTPError as exc:
        raise HTTPException(status_code=503, detail="Review data store unavailable") from exc
    notify_review(saved.data[0])
    return saved.data[0]


@router.patch("/{booking_id}/status")
async def update_booking_status(
    booking_id: UUID,
    update: BookingStatusUpdate,
    request: Request,
    response: Response,
    current_user=Depends(get_current_user),
):
    try:
        if _using_demo_user(current_user):
            result = fallback_update_booking_status(booking_id, current_user.id, update)
            if result is None:
                raise HTTPException(status_code=404, detail="Booking not found")
            response.headers["X-Booking-Notification"] = "skipped"
            return result

        supabase = get_optional_supabase()
        if supabase is None:
            raise HTTPException(status_code=503, detail="Booking data store unavailable")
        rows = supabase.table("bookings").select("*").eq("id", str(booking_id)).limit(1).execute()
        if not rows.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking = rows.data[0]
        ensure_booking_update(booking, str(current_user.id), update)
        result = (
            supabase.table("bookings")
            .update(update.model_dump(exclude_unset=True))
            .eq("id", str(booking_id))
            .eq("status", booking["status"])
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=409, detail="Booking changed; refresh and retry")
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except BookingConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (APIError, HTTPError) as exc:
        raise _database_error(exc) from exc

    saved = result.data[0]
    if saved["status"] == "completed":
        try:
            # head=True returns a zero count with postgrest-py 0.18 against the live API.
            completed = (
                supabase.table("bookings").select("id", count="exact")
                .eq("coach_id", str(saved["coach_id"]))
                .eq("status", "completed").execute()
            )
            if completed.count is None:
                raise ValueError("Completed booking count missing")
            supabase.table("coach_details").update({
                "booking_count": completed.count,
            }).eq("id", str(saved["coach_id"])).execute()
        except Exception:
            logging.getLogger(__name__).warning("Completed booking count refresh failed")
    notify_booking(saved, str(current_user.id))
    response.headers["X-Booking-Notification"] = await publish_booking_change(
        str(saved["id"]), request.headers.get("authorization", ""), settings.bff_internal_url
    )
    return saved
