from fastapi import APIRouter, Depends, HTTPException
from gotrue.errors import AuthError
from httpx import HTTPError
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_optional_supabase
from app.dependencies import get_current_user
from app.fallback import DEMO_USER_ID
from app.services import account_deletion
from app.services.account_deletion import delete_account

router = APIRouter(prefix="/account", tags=["account"])


class AccountDeletionRequest(BaseModel):
    password: str = Field(min_length=1, max_length=200, pattern=r"\S", repr=False)


@router.delete("")
def delete_current_account(
    body: AccountDeletionRequest, current_user=Depends(get_current_user),
) -> dict[str, bool]:
    email = current_user.email
    if not email:
        raise HTTPException(status_code=403, detail="Password confirmation failed")
    try:
        verified_user_id = account_deletion.verify_password(email, body.password)
    except HTTPError as exc:
        raise HTTPException(status_code=503, detail="Password confirmation unavailable") from exc
    if verified_user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Password confirmation failed")

    # Never pretend that a shared demo identity was permanently deleted.
    if str(current_user.id) == str(DEMO_USER_ID):
        raise HTTPException(
            status_code=403 if settings.demo_fallback_enabled else 503,
            detail="Demo accounts cannot be deleted",
        )
    supabase = get_optional_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Account data store unavailable")
    try:
        delete_account(supabase, str(current_user.id))
    except (APIError, HTTPError, AuthError) as exc:
        raise HTTPException(status_code=503, detail="Account deletion unavailable") from exc
    return {"deleted": True}
