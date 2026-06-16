from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.database import get_optional_supabase
from app.dependencies import get_current_user
from app.fallback import (
    DEMO_USER_ID,
    create_booking as fallback_create_booking,
    list_bookings as fallback_list_bookings,
    update_booking_status as fallback_update_booking_status,
)
from app.models.booking import BookingCreate, BookingResponse, BookingStatusUpdate


router = APIRouter(prefix="/bookings", tags=["bookings"])


def _using_demo_user(current_user) -> bool:
    return settings.demo_fallback_enabled and str(getattr(current_user, "id", "")) == str(
        DEMO_USER_ID
    )


@router.post("", response_model=BookingResponse)
@router.post("/", response_model=BookingResponse, include_in_schema=False)
async def create_booking(
    booking: BookingCreate,
    current_user=Depends(get_current_user),
):
    booking_data = booking.model_dump(mode="json")
    supabase = None if _using_demo_user(current_user) else get_optional_supabase()

    if supabase is None:
        if not settings.demo_fallback_enabled:
            raise HTTPException(status_code=503, detail="Booking data store unavailable")
        try:
            return fallback_create_booking(booking_data, current_user.id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    try:
        coach_result = (
            supabase.table("coach_details")
            .select("base_price")
            .eq("id", str(booking.coach_id))
            .single()
            .execute()
        )
        if not coach_result.data:
            raise HTTPException(status_code=404, detail="Coach not found")

        existing = (
            supabase.table("bookings")
            .select("id")
            .eq("coach_id", str(booking.coach_id))
            .eq("scheduled_at", booking.scheduled_at.isoformat())
            .eq("status", "confirmed")
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="Time slot already booked")

        price = int(coach_result.data["base_price"])
        meeting_url = (
            f"https://meet.fitconnect.kr/{uuid4().hex[:8]}"
            if booking.session_type == "online"
            else None
        )
        result = (
            supabase.table("bookings")
            .insert(
                {
                    "user_id": str(current_user.id),
                    "coach_id": str(booking.coach_id),
                    "scheduled_at": booking.scheduled_at.isoformat(),
                    "duration_minutes": booking.duration_minutes,
                    "session_type": booking.session_type.value,
                    "status": "pending",
                    "price": price * booking.duration_minutes // 60,
                    "meeting_url": meeting_url,
                    "notes": booking.notes,
                }
            )
            .execute()
        )
        return result.data[0]
    except HTTPException:
        raise
    except Exception:
        if settings.demo_fallback_enabled:
            return fallback_create_booking(booking_data, current_user.id)
        raise HTTPException(status_code=503, detail="Booking data store unavailable")


@router.get("/my")
async def get_my_bookings(
    current_user=Depends(get_current_user),
    role: str = Query("user", pattern="^(user|coach)$"),
):
    supabase = None if _using_demo_user(current_user) else get_optional_supabase()
    if supabase is None:
        if not settings.demo_fallback_enabled:
            raise HTTPException(status_code=503, detail="Booking data store unavailable")
        return fallback_list_bookings(current_user.id, role)

    try:
        if role == "coach":
            query = (
                supabase.table("bookings")
                .select("*, profiles!bookings_user_id_fkey(full_name, avatar_url)")
                .eq("coach_id", str(current_user.id))
            )
        else:
            query = (
                supabase.table("bookings")
                .select(
                    "*, profiles!bookings_coach_id_fkey(full_name, avatar_url, coach_details(specialty))"
                )
                .eq("user_id", str(current_user.id))
            )
        result = query.order("scheduled_at", desc=True).execute()
        return result.data or []
    except Exception:
        if settings.demo_fallback_enabled:
            return fallback_list_bookings(current_user.id, role)
        raise HTTPException(status_code=503, detail="Booking data store unavailable")


@router.patch("/{booking_id}/status")
async def update_booking_status(
    booking_id: UUID,
    update: BookingStatusUpdate,
    current_user=Depends(get_current_user),
):
    supabase = None if _using_demo_user(current_user) else get_optional_supabase()
    if supabase is None:
        if not settings.demo_fallback_enabled:
            raise HTTPException(status_code=503, detail="Booking data store unavailable")
        try:
            booking = fallback_update_booking_status(
                booking_id,
                current_user.id,
                update.status,
                update.coach_notes,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc))
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return booking

    try:
        booking = supabase.table("bookings").select("*").eq("id", str(booking_id)).single().execute()
        if not booking.data:
            raise HTTPException(status_code=404, detail="Booking not found")

        is_coach = str(current_user.id) == booking.data["coach_id"]
        is_user = str(current_user.id) == booking.data["user_id"]
        if not (is_coach or is_user):
            raise HTTPException(status_code=403, detail="Not authorized")

        update_data = {"status": update.status}
        if update.coach_notes:
            update_data["coach_notes"] = update.coach_notes

        result = supabase.table("bookings").update(update_data).eq("id", str(booking_id)).execute()
        return result.data[0]
    except HTTPException:
        raise
    except Exception:
        if settings.demo_fallback_enabled:
            try:
                booking = fallback_update_booking_status(
                    booking_id,
                    current_user.id,
                    update.status,
                    update.coach_notes,
                )
            except PermissionError as exc:
                raise HTTPException(status_code=403, detail=str(exc))
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            return booking
        raise HTTPException(status_code=503, detail="Booking data store unavailable")
