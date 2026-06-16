from typing import List

from app.config import settings
from app.database import get_optional_supabase
from app.fallback import matched_coaches


def calculate_match_score(
    user_profile: dict,
    coach: dict,
    coach_details: dict,
) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []

    user_sports = set(user_profile.get("preferred_sports") or [])
    coach_sports = set(coach_details.get("specialty") or [])
    if user_sports and coach_sports:
        overlap = len(user_sports.intersection(coach_sports)) / len(user_sports)
        score += overlap * 40
        if overlap > 0:
            reasons.append(f"Matches {int(overlap * 100)}% of preferred sports")

    rating = float(coach_details.get("rating") or 0)
    score += (rating / 5.0) * 20
    if rating >= 4.5:
        reasons.append(f"Highly rated coach ({rating:.1f})")

    exp_years = int(coach_details.get("experience_years") or 0)
    score += min(exp_years / 10.0, 1.0) * 20
    if exp_years >= 3:
        reasons.append(f"{exp_years} years of coaching experience")

    score += 20
    return round(score, 1), reasons


async def get_matched_coaches(user_id: str, limit: int = 10) -> List[dict]:
    supabase = get_optional_supabase()
    if supabase is None:
        if settings.demo_fallback_enabled:
            return matched_coaches(limit)
        raise RuntimeError("Coach data store unavailable")

    try:
        user_result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not user_result.data:
            return matched_coaches(limit) if settings.demo_fallback_enabled else []
        user_profile = user_result.data

        coaches_result = (
            supabase.table("profiles")
            .select("*, coach_details(*)")
            .eq("role", "coach")
            .eq("coach_details.is_verified", True)
            .execute()
        )

        if not coaches_result.data:
            return matched_coaches(limit) if settings.demo_fallback_enabled else []

        scored_coaches = []
        for coach in coaches_result.data:
            coach_details = coach.get("coach_details") or {}
            if isinstance(coach_details, list):
                coach_details = coach_details[0] if coach_details else {}

            score, reasons = calculate_match_score(user_profile, coach, coach_details)
            scored_coaches.append(
                {
                    **coach,
                    "coach_details": coach_details,
                    "match_score": score,
                    "match_reasons": reasons,
                }
            )

        scored_coaches.sort(key=lambda item: item["match_score"], reverse=True)
        return scored_coaches[:limit]
    except Exception:
        if settings.demo_fallback_enabled:
            return matched_coaches(limit)
        raise
