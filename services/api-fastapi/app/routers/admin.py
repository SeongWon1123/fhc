from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.database import get_optional_supabase
from app.fallback import (
    SAMPLE_CLOTHING_FEED,
    SAMPLE_MEMBERS,
    list_coaches as fallback_list_coaches,
    sample_admin_bookings,
)


router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin_key(x_admin_key: str | None) -> None:
    if not settings.is_production:
        return
    if settings.is_placeholder(settings.admin_api_key):
        raise HTTPException(status_code=503, detail="Admin API key is not configured")
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Admin API key required")


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


async def _supabase_overview() -> dict | None:
    supabase = get_optional_supabase()
    if supabase is None:
        return None

    try:
        coaches_result = (
            supabase.table("profiles")
            .select("id, full_name, role, coach_details(*)")
            .eq("role", "coach")
            .limit(100)
            .execute()
        )
        members_result = (
            supabase.table("profiles")
            .select("id, email, full_name, fitness_goal, created_at")
            .eq("role", "user")
            .limit(100)
            .execute()
        )
        bookings_result = (
            supabase.table("bookings")
            .select(
                "id, scheduled_at, status, amount, price, session_type, "
                "profiles!bookings_user_id_fkey(full_name, email), "
                "coach:profiles!bookings_coach_id_fkey(full_name, email)"
            )
            .order("scheduled_at", desc=True)
            .limit(100)
            .execute()
        )
        clothing_result = (
            supabase.table("clothing_recommendations")
            .select("id, sport_category, items")
            .order("created_at", desc=True)
            .limit(25)
            .execute()
        )
    except Exception:
        return None

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
        "members": [_format_member(row) for row in members_result.data or []],
        "bookings": bookings,
        "clothing_items": clothing_items,
    }


@router.get("/overview")
async def get_admin_overview(x_admin_key: str | None = Header(default=None)):
    _require_admin_key(x_admin_key)

    overview = await _supabase_overview()
    if overview is not None:
        return overview

    if not settings.demo_fallback_enabled:
        raise HTTPException(status_code=503, detail="Admin overview data store unavailable")

    return {
        "source": "demo-fallback",
        "coaches": [_format_coach(row) for row in fallback_list_coaches()],
        "members": [_format_member(row) for row in SAMPLE_MEMBERS],
        "bookings": sample_admin_bookings(),
        "clothing_items": SAMPLE_CLOTHING_FEED,
    }
