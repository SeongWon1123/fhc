from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from httpx import HTTPError
from postgrest.exceptions import APIError

from app.database import get_optional_supabase
from app.services.operator_access import OperatorScope, get_operator


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/access")
async def get_operator_access(scope: OperatorScope = Depends(get_operator)):
    return {"role": scope.role, "gym_ids": scope.gym_ids}


def _format_coach(row: dict) -> dict:
    details = row.get("coach_details") or {}
    if isinstance(details, list):
        details = details[0] if details else {}
    return {
        "id": row.get("id"),
        "name": details.get("name") or row.get("full_name") or "Unnamed coach",
        "specialty": ", ".join(details.get("specialty") or []),
        "rating": float(details.get("rating") or 0),
        "booking_count": int(details.get("booking_count") or 0),
        "is_verified": bool(details.get("is_verified")),
        "location": details.get("location") or "Online",
        "base_price": int(details.get("base_price") or 0),
    }


def _format_member(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "email": row.get("email") or "",
        "name": row.get("full_name") or row.get("email") or "Unnamed member",
        "fitness_goal": row.get("fitness_goal") or "Not set",
        "join_date": row.get("created_at") or "",
    }


async def _supabase_overview(scope: OperatorScope) -> dict:
    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Admin overview data store unavailable")
    if scope.role == "gym_owner" and not scope.gym_ids:
        return {
            "source": "supabase", "coaches": [], "coach_applications": [],
            "members": [], "bookings": [], "clothing_items": [],
        }

    try:
        coach_query = supabase.table("profiles").select(
            "id, full_name, role, coach_details!inner(*)"
        ).eq("role", "coach")
        member_query = (
            supabase.table("profiles")
            .select("id, email, full_name, fitness_goal, created_at")
            .eq("role", "user")
        )
        booking_query = (
            supabase.table("bookings")
            .select(
                "id, scheduled_at, status, amount, price, session_type, "
                "profiles!bookings_user_id_fkey(full_name, email), "
                "coach:profiles!bookings_coach_id_fkey(full_name, email)"
            )
            .order("scheduled_at", desc=True)
        )
        clothing_query = (
            supabase.table("clothing_recommendations")
            .select("id, sport_category, items, profiles!inner(gym_id)")
            .order("created_at", desc=True)
        )
        if scope.role == "gym_owner":
            gym_ids = list(scope.gym_ids)
            coach_query = coach_query.in_("coach_details.gym_id", gym_ids)
            member_query = member_query.in_("gym_id", gym_ids)
            booking_query = booking_query.in_("gym_id", gym_ids)
            clothing_query = clothing_query.in_("profiles.gym_id", gym_ids)
        coaches_result = coach_query.limit(100).execute()
        members_result = member_query.limit(100).execute()
        bookings_result = booking_query.limit(100).execute()
        clothing_result = clothing_query.limit(25).execute()
        # Pending applications have no gym yet, so only global admins review them.
        applications_result = (
            supabase.table("profiles")
            .select("id, full_name, role, coach_details!inner(*)")
            .eq("role", "user")
            .limit(100)
            .execute()
            if scope.role == "admin"
            else None
        )
    except (APIError, HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Admin overview data store unavailable") from exc

    bookings = []
    for row in bookings_result.data or []:
        member = row.get("profiles") or {}
        coach = row.get("coach") or {}
        if isinstance(member, list):
            member = member[0] if member else {}
        if isinstance(coach, list):
            coach = coach[0] if coach else {}
        bookings.append(
            {
                "id": row.get("id"),
                "user_name": member.get("full_name") or member.get("email") or "Member",
                "coach_name": coach.get("full_name") or coach.get("email") or "Coach",
                "scheduled_at": row.get("scheduled_at"),
                "status": row.get("status"),
                "amount": int(row.get("amount") or row.get("price") or 0),
                "session_type": row.get("session_type") or "online",
            }
        )

    clothing_items = []
    for row in clothing_result.data or []:
        for index, item in enumerate(row.get("items") or []):
            clothing_items.append(
                {
                    "id": f"{row.get('id')}-{index}",
                    "sport": row.get("sport_category") or "Training",
                    "category": item.get("category") or item.get("type") or "Item",
                    "item": item.get("name") or item.get("title") or "Recommendation",
                    "price": int(item.get("price") or 0),
                }
            )

    return {
        "source": "supabase",
        "coaches": [_format_coach(row) for row in coaches_result.data or []],
        "coach_applications": [
            _format_coach(row)
            for row in (applications_result.data if applications_result else None) or []
        ],
        "members": [_format_member(row) for row in members_result.data or []],
        "bookings": bookings,
        "clothing_items": clothing_items,
    }


@router.get("/overview")
async def get_admin_overview(scope: OperatorScope = Depends(get_operator)):
    return await _supabase_overview(scope)


def _load_application(scope: OperatorScope, coach_id: UUID):
    if scope.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Coach data store unavailable")
    profile = (
        supabase.table("profiles").select("id, role")
        .eq("id", str(coach_id)).limit(1).execute()
    )
    details = (
        supabase.table("coach_details").select("id")
        .eq("id", str(coach_id)).limit(1).execute()
    )
    if not profile.data or not details.data:
        raise HTTPException(status_code=404, detail="Coach application not found")
    return supabase, profile.data[0]["role"]


@router.post("/coaches/{coach_id}/approve")
async def approve_coach(coach_id: UUID, scope: OperatorScope = Depends(get_operator)):
    try:
        supabase, role = _load_application(scope, coach_id)
        if role not in {"user", "coach"}:
            raise HTTPException(status_code=409, detail="Operator accounts cannot become coaches")
        supabase.table("profiles").update({"role": "coach"}).eq("id", str(coach_id)).execute()
        supabase.table("coach_details").update({"is_verified": True}).eq("id", str(coach_id)).execute()
    except (APIError, HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Coach data store unavailable") from exc
    return {"id": str(coach_id), "role": "coach", "is_verified": True}


@router.post("/coaches/{coach_id}/reject")
async def reject_coach_application(coach_id: UUID, scope: OperatorScope = Depends(get_operator)):
    try:
        supabase, role = _load_application(scope, coach_id)
        if role != "user":
            raise HTTPException(status_code=409, detail="Only pending applications can be rejected")
        supabase.table("coach_details").delete().eq("id", str(coach_id)).execute()
    except (APIError, HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Coach data store unavailable") from exc
    return {"id": str(coach_id), "rejected": True}
