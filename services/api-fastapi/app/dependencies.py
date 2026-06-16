from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.database import get_optional_supabase, is_supabase_configured
from app.fallback import DEMO_USER


bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
):
    if credentials and is_supabase_configured():
        try:
            supabase = get_optional_supabase()
            if supabase is None:
                raise RuntimeError("Supabase client unavailable")
            user = supabase.auth.get_user(credentials.credentials)
            if not user or not user.user:
                raise HTTPException(status_code=401, detail="Invalid token")
            return user.user
        except HTTPException:
            raise
        except Exception:
            if not settings.demo_fallback_enabled:
                raise HTTPException(
                    status_code=401,
                    detail="Could not validate credentials",
                )

    if settings.demo_fallback_enabled:
        return DEMO_USER

    if not credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    raise HTTPException(status_code=503, detail="Authentication service unavailable")
