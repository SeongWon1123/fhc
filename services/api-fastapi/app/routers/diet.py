import base64

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.config import settings
from app.database import get_optional_supabase
from app.dependencies import get_current_user
from app.fallback import DEMO_USER_ID, add_diet_log, list_diet_logs
from app.models.diet import ChatRequest, ChatResponse, DietLogCreate
from app.services.rag_service import analyze_food_image, generate_diet_response
from app.services.usage_limits import demo_chat_usage, image_usage, kst_day_start


router = APIRouter(prefix="/diet", tags=["diet"])
MAX_UPLOAD_SIZE = 5 * 1024 * 1024


def _using_demo_user(current_user) -> bool:
    return settings.demo_fallback_enabled and str(getattr(current_user, "id", "")) == str(
        DEMO_USER_ID
    )


@router.post("/chat", response_model=ChatResponse)
async def diet_chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
):
    supabase = None if _using_demo_user(current_user) else get_optional_supabase()
    user_profile: dict = {}
    history: list[dict] = []

    if supabase is None and not settings.demo_fallback_enabled:
        raise HTTPException(status_code=503, detail="Diet data store unavailable")

    if supabase is None:
        if not demo_chat_usage.consume(str(current_user.id), settings.diet_chat_daily_limit):
            raise HTTPException(status_code=429, detail="Daily diet chat limit reached")
    else:
        try:
            usage = (
                supabase.table("chat_messages")
                .select("id", count="exact")
                .eq("user_id", str(current_user.id))
                .eq("role", "user")
                .gte("created_at", kst_day_start().isoformat())
                .execute()
            )
            count = usage.count
            if count is None:
                raise HTTPException(status_code=503, detail="Diet usage count unavailable")
        except Exception:
            raise HTTPException(status_code=503, detail="Diet usage count unavailable")
        if count >= settings.diet_chat_daily_limit:
            raise HTTPException(status_code=429, detail="Daily diet chat limit reached")

    if supabase is not None:
        try:
            profile = (
                supabase.table("profiles")
                .select("fitness_goal, preferred_sports")
                .eq("id", str(current_user.id))
                .single()
                .execute()
            )
            user_profile = profile.data or {}

            history_result = (
                supabase.table("chat_messages")
                .select("role, content")
                .eq("session_id", str(request.session_id))
                .eq("user_id", str(current_user.id))
                .order("created_at", desc=True)
                .limit(6)
                .execute()
            )
            history = [
                {"role": message["role"], "content": message["content"]}
                for message in reversed(history_result.data or [])
            ]
        except Exception:
            if settings.demo_fallback_enabled:
                user_profile = {}
                history = []
            else:
                raise HTTPException(status_code=503, detail="Diet data store unavailable")

    reply, sources = await generate_diet_response(request.message, history, user_profile)

    if supabase is not None:
        try:
            supabase.table("chat_messages").insert(
                [
                    {
                        "user_id": str(current_user.id),
                        "session_id": str(request.session_id),
                        "role": "user",
                        "content": request.message,
                        "context_type": request.context_type,
                    },
                    {
                        "user_id": str(current_user.id),
                        "session_id": str(request.session_id),
                        "role": "assistant",
                        "content": reply,
                        "context_type": request.context_type,
                    },
                ]
            ).execute()
        except Exception:
            if not settings.demo_fallback_enabled:
                raise HTTPException(status_code=503, detail="Diet data store unavailable")

    return ChatResponse(reply=reply, session_id=request.session_id, sources=sources)


@router.post("/analyze-image")
async def analyze_diet_image(
    file: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
    current_user=Depends(get_current_user),
):
    upload = image or file
    if upload is None:
        raise HTTPException(status_code=400, detail="Image file required")
    if upload.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Image file required")

    content = await upload.read(MAX_UPLOAD_SIZE + 1)
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File size must be 5MB or smaller")

    detected_type = None
    if content.startswith(b"\xff\xd8\xff"):
        detected_type = "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_type = "image/png"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        detected_type = "image/webp"
    if detected_type is None or detected_type != upload.content_type:
        raise HTTPException(status_code=400, detail="Image content does not match its type")

    supabase = None if _using_demo_user(current_user) else get_optional_supabase()
    user_profile: dict = {}
    if supabase is None and not settings.demo_fallback_enabled:
        raise HTTPException(status_code=503, detail="Diet data store unavailable")

    if supabase is not None:
        try:
            profile = (
                supabase.table("profiles")
                .select("fitness_goal")
                .eq("id", str(current_user.id))
                .single()
                .execute()
            )
            user_profile = profile.data or {}
        except Exception:
            if settings.demo_fallback_enabled:
                user_profile = {}
            else:
                raise HTTPException(status_code=503, detail="Diet data store unavailable")

    if not image_usage.consume(str(current_user.id), settings.diet_image_daily_limit):
        raise HTTPException(status_code=429, detail="Daily image analysis limit reached")

    analysis = await analyze_food_image(content, user_profile)
    analysis["image_data_url"] = f"data:{detected_type};base64,{base64.b64encode(content).decode()}"
    analysis.setdefault("analysis", analysis.get("ai_analysis", "Food image analyzed."))
    return analysis


@router.post("/logs")
async def save_diet_log(
    log: DietLogCreate,
    current_user=Depends(get_current_user),
):
    log_data = log.model_dump(mode="json")
    supabase = None if _using_demo_user(current_user) else get_optional_supabase()
    if supabase is None:
        if not settings.demo_fallback_enabled:
            raise HTTPException(status_code=503, detail="Diet log data store unavailable")
        return add_diet_log(log_data, current_user.id)

    try:
        result = (
            supabase.table("diet_logs")
            .insert({"user_id": str(current_user.id), **log_data})
            .execute()
        )
        return result.data[0]
    except Exception:
        if settings.demo_fallback_enabled:
            return add_diet_log(log_data, current_user.id)
        raise HTTPException(status_code=503, detail="Diet log data store unavailable")


@router.get("/logs")
async def get_diet_logs(
    current_user=Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
):
    supabase = None if _using_demo_user(current_user) else get_optional_supabase()
    if supabase is None:
        if not settings.demo_fallback_enabled:
            raise HTTPException(status_code=503, detail="Diet log data store unavailable")
        return list_diet_logs(current_user.id, limit)

    try:
        result = (
            supabase.table("diet_logs")
            .select("*")
            .eq("user_id", str(current_user.id))
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception:
        if settings.demo_fallback_enabled:
            return list_diet_logs(current_user.id, limit)
        raise HTTPException(status_code=503, detail="Diet log data store unavailable")
