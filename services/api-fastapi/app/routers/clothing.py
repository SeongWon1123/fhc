from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.database import get_optional_supabase
from app.dependencies import get_current_user
from app.services.clothing_service import (
    get_clothing_recommendations,
    normalize_sport_category,
)


router = APIRouter(prefix="/clothing", tags=["clothing"])


@router.get("/recommendations")
async def clothing_recommendations(
    sport_category: str = Query("gym", description="Sport category or alias"),
    current_user=Depends(get_current_user),
):
    normalized_category = normalize_sport_category(sport_category)
    try:
        items = await get_clothing_recommendations(
            str(current_user.id),
            normalized_category,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {
        "sport_category": normalized_category,
        "items": items,
    }


@router.post("/click/{recommendation_id}")
async def track_clothing_click(
    recommendation_id: str,
    current_user=Depends(get_current_user),
):
    supabase = get_optional_supabase()
    if supabase is None:
        if not settings.demo_fallback_enabled:
            raise HTTPException(
                status_code=503,
                detail="Clothing recommendation data store unavailable",
            )
        return {"status": "tracked", "source": "demo-fallback"}

    try:
        result = supabase.table("clothing_recommendations").update(
            {"clicked_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", recommendation_id).eq("user_id", str(current_user.id)).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Recommendation not found")
        return {"status": "tracked", "source": "supabase"}
    except HTTPException:
        raise
    except Exception:
        if not settings.demo_fallback_enabled:
            raise HTTPException(
                status_code=503,
                detail="Clothing recommendation data store unavailable",
            )
        return {"status": "tracked", "source": "demo-fallback"}
