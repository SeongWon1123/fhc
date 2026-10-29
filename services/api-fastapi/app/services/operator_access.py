from typing import Literal

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from httpx import HTTPError
from postgrest.exceptions import APIError
from pydantic import BaseModel, ConfigDict

from app.database import get_optional_supabase
from app.dependencies import bearer, get_current_user


class OperatorScope(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: str
    role: Literal["admin", "gym_owner"]
    gym_ids: tuple[str, ...] = ()


async def get_operator(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
) -> OperatorScope:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    user = await get_current_user(credentials)
    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Operator data store unavailable")
    try:
        profiles = (
            supabase.table("profiles").select("id, role")
            .eq("id", str(user.id)).limit(1).execute()
        )
        if not profiles.data or profiles.data[0]["role"] not in {"admin", "gym_owner"}:
            raise HTTPException(status_code=403, detail="Operator access required")
        if profiles.data[0]["role"] == "admin":
            return OperatorScope(user_id=str(user.id), role="admin")
        gyms = (
            supabase.table("gyms").select("id")
            .eq("owner_id", str(user.id)).eq("is_active", True).execute()
        )
        return OperatorScope(
            user_id=str(user.id),
            role="gym_owner",
            gym_ids=tuple(str(gym["id"]) for gym in gyms.data or []),
        )
    except (APIError, HTTPError) as exc:
        raise HTTPException(status_code=503, detail="Operator data store unavailable") from exc
