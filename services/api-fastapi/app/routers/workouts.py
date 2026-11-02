from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from httpx import HTTPError
from postgrest.exceptions import APIError

from app.config import settings
from app.database import get_optional_supabase
from app.dependencies import get_current_user
from app.fallback import DEMO_USER_ID
from app.models.workout import WorkoutLogCreate

router = APIRouter(prefix="/workouts", tags=["workouts"])

# Deliberately mutable, process-local records for the explicit demo identity.
_demo_logs: list[dict] = []


def _using_demo_user(current_user) -> bool:
    return settings.demo_fallback_enabled and str(current_user.id) == str(DEMO_USER_ID)


@router.post("", status_code=201)
async def create_workout(
    log: WorkoutLogCreate,
    current_user=Depends(get_current_user),
):
    row = {
        "user_id": str(current_user.id),
        "sport_category": log.sport_category,
        "workout_type": log.sport_category,
        "duration": log.duration_minutes,
        "calories_burned": log.calories_burned,
        "data": {"memo": log.memo},
    }
    if _using_demo_user(current_user):
        saved = {
            **row,
            "id": str(uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _demo_logs.insert(0, saved)
        return saved

    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Workout data store unavailable")
    try:
        result = supabase.table("workout_logs").insert(row).execute()
    except (APIError, HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Workout data store unavailable") from exc
    if not result.data:
        raise HTTPException(status_code=503, detail="Workout data store unavailable")
    return result.data[0]


@router.get("")
async def list_workouts(
    current_user=Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
):
    if _using_demo_user(current_user):
        return [row for row in _demo_logs if row["user_id"] == str(current_user.id)][:limit]

    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Workout data store unavailable")
    try:
        result = (
            supabase.table("workout_logs")
            .select("*")
            .eq("user_id", str(current_user.id))
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except (APIError, HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Workout data store unavailable") from exc
    return result.data or []


@router.delete("/{workout_id}")
async def delete_workout(
    workout_id: UUID,
    current_user=Depends(get_current_user),
):
    if _using_demo_user(current_user):
        row = next(
            (
                row for row in _demo_logs
                if row["id"] == str(workout_id) and row["user_id"] == str(current_user.id)
            ),
            None,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Workout not found")
        _demo_logs.remove(row)
        return {"deleted": True}

    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Workout data store unavailable")
    try:
        result = (
            supabase.table("workout_logs")
            .delete()
            .eq("id", str(workout_id))
            .eq("user_id", str(current_user.id))
            .execute()
        )
    except (APIError, HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Workout data store unavailable") from exc
    if not result.data:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"deleted": True}
