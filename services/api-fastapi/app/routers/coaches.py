from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.database import get_optional_supabase
from app.dependencies import get_current_user
from app.fallback import get_coach, list_coaches as fallback_list_coaches, matched_coaches
from app.models.coach import CoachDetailUpdate
from app.services.coach_matching import get_matched_coaches
from app.services.review_display import mask_review_author


router = APIRouter(prefix="/coaches", tags=["coaches"])


def _fallback_list_response(
    specialty: str | None,
    location: str | None,
    min_rating: float | None,
    max_price: int | None,
    limit: int,
    offset: int,
) -> dict:
    coaches = fallback_list_coaches(
        specialty=specialty,
        location=location,
        min_rating=min_rating,
        max_price=max_price,
        limit=limit,
        offset=offset,
    )
    return {"coaches": coaches, "total": len(coaches), "source": "demo-fallback"}


@router.get("", include_in_schema=False)
@router.get("/")
async def list_coaches(
    specialty: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None),
    max_price: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    supabase = get_optional_supabase()
    if supabase is None:
        if settings.demo_fallback_enabled:
            return _fallback_list_response(
                specialty, location, min_rating, max_price, limit, offset
            )
        raise HTTPException(status_code=503, detail="Coach data store unavailable")

    try:
        query = supabase.table("profiles").select(
            "id, full_name, avatar_url, role, coach_details!inner(*)"
        ).eq("role", "coach")
        if specialty:
            query = query.contains("coach_details.specialty", [specialty])
        if location:
            query = query.ilike("coach_details.location", f"%{location}%")
        if min_rating is not None:
            query = query.gte("coach_details.rating", min_rating)
        if max_price is not None:
            query = query.lte("coach_details.base_price", max_price)

        result = query.range(offset, offset + limit - 1).execute()
        coaches = result.data or []
        return {"coaches": coaches, "total": len(coaches), "source": "supabase"}
    except Exception:
        if settings.demo_fallback_enabled:
            return _fallback_list_response(
                specialty, location, min_rating, max_price, limit, offset
            )
        raise HTTPException(status_code=503, detail="Coach data store unavailable")


@router.get("/recommended")
async def get_recommended_coaches(limit: int = Query(10, ge=1, le=50)):
    supabase = get_optional_supabase()
    if supabase is None:
        if settings.demo_fallback_enabled:
            return matched_coaches(limit)
        raise HTTPException(status_code=503, detail="Coach data store unavailable")

    try:
        result = (
            supabase.table("profiles")
            .select("id, full_name, avatar_url, role, coach_details!inner(*)")
            .eq("role", "coach")
            .eq("coach_details.is_verified", True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception:
        if settings.demo_fallback_enabled:
            return matched_coaches(limit)
        raise HTTPException(status_code=503, detail="Coach data store unavailable")


@router.get("/matched")
async def get_ai_matched_coaches(
    current_user=Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50),
):
    try:
        matched = await get_matched_coaches(str(current_user.id), limit)
    except Exception:
        raise HTTPException(status_code=503, detail="Coach data store unavailable")
    return {"coaches": matched}


@router.get("/me/details")
async def get_my_coach_details(current_user=Depends(get_current_user)):
    supabase = get_optional_supabase()
    if supabase is None:
        if settings.demo_fallback_enabled:
            return {"role": "user", "details": None}
        raise HTTPException(status_code=503, detail="Coach data store unavailable")

    try:
        profile = (
            supabase.table("profiles").select("role")
            .eq("id", str(current_user.id)).limit(1).execute()
        )
        details = (
            supabase.table("coach_details").select("*")
            .eq("id", str(current_user.id)).limit(1).execute()
        )
    except Exception:
        raise HTTPException(status_code=503, detail="Coach data store unavailable")
    role = profile.data[0]["role"] if profile.data else "user"
    return {"role": role, "details": details.data[0] if details.data else None}


@router.get("/{coach_id}")
async def get_coach_detail(coach_id: UUID):
    supabase = get_optional_supabase()
    if supabase is not None:
        try:
            result = (
                supabase.table("profiles")
                .select(
                    "id, full_name, avatar_url, role, coach_details(*), "
                    "reviews!reviews_coach_id_fkey(id, rating, content, created_at, "
                    "profiles!reviews_user_id_fkey(full_name))"
                )
                .eq("id", str(coach_id))
                .eq("role", "coach")
                .single()
                .execute()
            )
            if result.data:
                result.data["reviews"] = [
                    {
                        "id": review["id"],
                        "rating": review["rating"],
                        "content": review.get("content"),
                        "created_at": review["created_at"],
                        "author": mask_review_author((review.get("profiles") or {}).get("full_name")),
                    }
                    for review in sorted(
                        result.data.get("reviews") or [],
                        key=lambda review: review["created_at"],
                        reverse=True,
                    )[:20]
                ]
                return result.data
        except Exception:
            if not settings.demo_fallback_enabled:
                raise HTTPException(status_code=503, detail="Coach data store unavailable")

    coach = get_coach(coach_id)
    if coach and settings.demo_fallback_enabled:
        return coach
    raise HTTPException(status_code=404, detail="Coach not found")


@router.put("/me/details")
async def update_coach_details(
    update: CoachDetailUpdate,
    current_user=Depends(get_current_user),
):
    supabase = get_optional_supabase()
    if supabase is None:
        if settings.demo_fallback_enabled:
            return [{"id": str(current_user.id), **update.model_dump(exclude_none=True)}]
        raise HTTPException(status_code=503, detail="Coach data store unavailable")

    try:
        result = (
            supabase.table("coach_details")
            .upsert({"id": str(current_user.id), **update.model_dump(exclude_none=True)})
            .execute()
        )
        return result.data
    except Exception:
        if settings.demo_fallback_enabled:
            return [{"id": str(current_user.id), **update.model_dump(exclude_none=True)}]
        raise HTTPException(status_code=503, detail="Coach data store unavailable")
