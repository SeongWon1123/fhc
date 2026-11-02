import logging

import httpx
from fastapi import HTTPException
from supabase import Client

from app import config


logger = logging.getLogger(__name__)


def verify_password(email: str, password: str) -> str | None:
    """Reauthenticate without changing the shared Supabase client's session."""
    response = httpx.post(
        f"{config.settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password",
        headers={"apikey": config.settings.supabase_service_role_key},
        json={"email": email, "password": password},
        timeout=5.0,
    )
    if response.status_code in (400, 401):
        raise HTTPException(status_code=403, detail="Password confirmation failed")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Password confirmation unavailable")
    return response.json().get("user", {}).get("id")


def delete_account(supabase: Client, user_id: str) -> None:
    """Delete the authenticated identity, then repair surviving coach aggregates."""
    profiles = (
        supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute()
    ).data
    if not profiles or profiles[0]["role"] == "admin":
        raise HTTPException(status_code=403, detail="Account deletion is not allowed")

    upcoming = (
        supabase.table("bookings").select("id")
        .in_("status", ["pending", "confirmed"])
        .or_(f"user_id.eq.{user_id},coach_id.eq.{user_id}")
        .limit(1).execute()
    )
    if upcoming.data:
        raise HTTPException(
            status_code=409,
            detail="Upcoming bookings must be cancelled before deleting the account",
        )

    affected = {
        str(row["coach_id"])
        for row in (
            supabase.table("reviews").select("coach_id").eq("user_id", user_id)
            .execute().data or []
        )
    }
    affected.update(
        str(row["coach_id"])
        for row in (
            supabase.table("bookings").select("coach_id").eq("user_id", user_id)
            .eq("status", "completed").execute().data or []
        )
    )

    # auth.users -> profiles -> all user data is removed by database cascades.
    supabase.auth.admin.delete_user(str(user_id))

    for coach_id in sorted(affected - {user_id}):
        try:
            ratings = [
                row["rating"]
                for row in (
                    supabase.table("reviews").select("rating")
                    .eq("coach_id", coach_id).execute().data or []
                )
            ]
            completed = (
                supabase.table("bookings").select("id", count="exact")
                .eq("coach_id", coach_id).eq("status", "completed").execute()
            )
            if completed.count is None:
                raise ValueError("Completed booking count unavailable")
            supabase.table("coach_details").update({
                "review_count": len(ratings),
                "rating": round(sum(ratings) / len(ratings), 2) if ratings else 0,
                "booking_count": completed.count,
            }).eq("id", coach_id).execute()
        except Exception:
            # Deletion is irreversible: even an unexpected aggregate failure must
            # not report a failed deletion or prevent repair of the next coach.
            logger.warning("Could not recompute coach statistics after account deletion: %s", coach_id)
