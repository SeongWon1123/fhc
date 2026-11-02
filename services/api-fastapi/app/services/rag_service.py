import base64
import json
import logging
from typing import List, Tuple

import httpx

from app.config import settings
from app.database import get_optional_supabase


logger = logging.getLogger(__name__)

OLLAMA_UNAVAILABLE_MESSAGE = (
    "The AI nutrition service is temporarily unavailable. "
    "For now, prioritize balanced meals with lean protein, vegetables, "
    "whole-food carbohydrates, and enough water."
)


async def get_embedding(text: str) -> List[float]:
    if settings.embed_provider == "openai_compatible":
        base_url = (settings.embed_api_base_url.strip() or settings.chat_api_base_url.strip()).rstrip("/")
        api_key = settings.embed_api_key.strip() or settings.chat_api_key.strip()
        model = settings.embed_api_model.strip()
        if not (base_url and api_key and model):
            raise ValueError("Embedding API configuration is incomplete")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/embeddings",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "input": text, "dimensions": settings.embed_dimensions},
            )
            resp.raise_for_status()
            embedding = resp.json()["data"][0]["embedding"]
            if not isinstance(embedding, list) or len(embedding) != settings.embed_dimensions:
                raise ValueError("Embedding API returned an unexpected vector dimension")
            return embedding
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.ollama_base_url}/api/embeddings",
            json={"model": settings.ollama_embed_model, "prompt": text},
        )
        resp.raise_for_status()
        return resp.json()["embedding"]


async def _ollama_chat(messages: List[dict]) -> str:
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_chat_model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 800},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]
    except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError):
        return OLLAMA_UNAVAILABLE_MESSAGE
    except Exception:
        return OLLAMA_UNAVAILABLE_MESSAGE


async def _openai_compatible_chat(messages: List[dict]) -> str:
    base_url = settings.chat_api_base_url.strip().rstrip("/")
    if not (base_url and settings.chat_api_key.strip() and settings.chat_api_model.strip()):
        logger.warning("Diet chat API is not configured: set CHAT_API_BASE_URL, CHAT_API_KEY, CHAT_API_MODEL")
        return OLLAMA_UNAVAILABLE_MESSAGE
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.chat_api_key.strip()}"},
                json={
                    "model": settings.chat_api_model.strip(),
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 800,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as exc:
        logger.warning("Diet chat API returned HTTP %s", exc.response.status_code)
        return OLLAMA_UNAVAILABLE_MESSAGE
    except Exception as exc:
        logger.warning("Diet chat API request failed: %s", type(exc).__name__)
        return OLLAMA_UNAVAILABLE_MESSAGE
    if not isinstance(content, str) or not content.strip():
        logger.warning("Diet chat API returned an empty reply")
        return OLLAMA_UNAVAILABLE_MESSAGE
    return content


async def _chat(messages: List[dict]) -> str:
    if settings.chat_provider == "openai_compatible":
        return await _openai_compatible_chat(messages)
    return await _ollama_chat(messages)


async def _ollama_vision(image_b64: str, prompt: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": settings.ollama_vision_model,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 1000},
                },
            )
            resp.raise_for_status()
            return resp.json()["response"]
    except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError):
        return OLLAMA_UNAVAILABLE_MESSAGE
    except Exception:
        return OLLAMA_UNAVAILABLE_MESSAGE


async def _openai_compatible_vision(image_b64: str, prompt: str, mime: str) -> str:
    base_url = (settings.vision_api_base_url.strip() or settings.chat_api_base_url.strip()).rstrip("/")
    api_key = settings.vision_api_key.strip() or settings.chat_api_key.strip()
    model = settings.vision_api_model.strip()
    if not (base_url and api_key and model):
        logger.warning("Diet vision API configuration is incomplete")
        return OLLAMA_UNAVAILABLE_MESSAGE
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {
                                "url": f"data:{mime};base64,{image_b64}",
                            }},
                        ],
                    }],
                    "max_tokens": 600,
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            if isinstance(content, str) and content.strip():
                return content
            logger.warning("Diet vision API returned an empty reply")
    except httpx.HTTPStatusError as exc:
        logger.warning("Diet vision API returned HTTP %s", exc.response.status_code)
    except (httpx.RequestError, ValueError, KeyError, IndexError, TypeError) as exc:
        logger.warning("Diet vision API request failed: %s", type(exc).__name__)
    return OLLAMA_UNAVAILABLE_MESSAGE


async def search_rag(query: str, category: str | None = None, top_k: int = 5) -> List[dict]:
    try:
        supabase = get_optional_supabase()
        if supabase is None:
            return []
        query_embedding = await get_embedding(query)
        result = supabase.rpc(
            "match_rag_documents",
            {
                "query_embedding": query_embedding,
                "match_threshold": settings.rag_match_threshold,
                "match_count": top_k,
                "filter_category": category,
            },
        ).execute()
        return result.data if result.data else []
    except Exception as exc:
        logger.warning("Diet RAG search failed: %s", type(exc).__name__)
        return []


async def generate_diet_response(
    user_message: str,
    history: List[dict],
    user_profile: dict,
) -> Tuple[str, List[str]]:
    try:
        relevant_docs = await search_rag(user_message, category="nutrition")
        context = "\n\n".join([doc.get("content", "") for doc in relevant_docs[:3]])
        sources = [doc.get("title", "nutrition") for doc in relevant_docs[:3]]

        profile_summary = (
            f"Fitness goal: {user_profile.get('fitness_goal', 'general health')}\n"
            f"Preferred sports: {', '.join(user_profile.get('preferred_sports') or [])}"
        )
        system_prompt = f"""
You are FitConnect's nutrition assistant.
Use the reference context when it is available, and answer with practical,
non-diagnostic nutrition guidance.

Reference context:
{context or 'General nutrition knowledge only.'}

User profile:
{profile_summary}

Rules:
- Be concise and actionable.
- Do not provide medical diagnosis or prescriptions.
- Recommend consulting a clinician for medical conditions.
"""

        messages = [
            {"role": "system", "content": system_prompt},
            *history[-6:],
            {"role": "user", "content": user_message},
        ]
        reply = await _chat(messages)
        return reply, sources
    except Exception:
        return OLLAMA_UNAVAILABLE_MESSAGE, []


NUTRIENTS = ("protein", "fat", "carb", "fiber")


# Same bounds as DietLogCreate so a previewed analysis can always be saved.
MAX_CALORIES = 10000
MAX_NUTRIENT_GRAMS = 2000


def _is_amount(value, limit: int) -> bool:
    # Range comparison also rejects NaN, infinities and huge integers without float conversion.
    return (
        isinstance(value, (int, float)) and not isinstance(value, bool)
        and 0 <= value <= limit
    )


def _food_analysis(parsed) -> dict | None:
    """Accept only the analysis shape clients render and DietLogCreate stores."""
    if not isinstance(parsed, dict):
        return None
    food_name, analysis = parsed.get("food_name"), parsed.get("ai_analysis")
    recommendations = parsed.get("recommendations")
    macros = parsed.get("macronutrients")
    if not (isinstance(food_name, str) and 0 < len(food_name.strip()) <= 100
            and isinstance(analysis, str) and 0 < len(analysis.strip()) <= 2000
            and isinstance(recommendations, list)
            and all(isinstance(item, str) and item.strip() for item in recommendations)):
        return None
    if food_name.strip() == "음식 아님":
        calories, macros = 0, dict.fromkeys(NUTRIENTS, 0)
    else:
        calories = parsed.get("calories")
        if not (_is_amount(calories, MAX_CALORIES) and isinstance(macros, dict)
                and all(_is_amount(macros.get(name), MAX_NUTRIENT_GRAMS) for name in NUTRIENTS)):
            return None
        macros = {name: macros[name] for name in NUTRIENTS}
    return {
        "food_name": food_name.strip(),
        "calories": calories,
        "macronutrients": macros,
        "ai_analysis": analysis.strip(),
        "recommendations": [item.strip() for item in recommendations],
        "analysis": analysis.strip(),
    }


async def analyze_food_image(
    image_bytes: bytes, user_profile: dict, mime: str = "image/jpeg",
) -> dict:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    goal = user_profile.get("fitness_goal", "general health")
    prompt = f"""
Analyze this food image and return only JSON with this shape:
{{
  "food_name": "short food name",
  "calories": 0,
  "macronutrients": {{"protein": 0, "fat": 0, "carb": 0, "fiber": 0}},
  "ai_analysis": "brief nutrition assessment for the user's {goal} goal",
  "recommendations": ["one practical suggestion", "another suggestion"]
}}
Write food_name and ai_analysis in Korean.
Use numbers only (no units or strings) for calories and all macronutrients.
If the image is not food, return calories 0, food_name "음식 아님",
and zero for all macronutrients.
"""

    if settings.vision_provider == "openai_compatible":
        raw_response = await _openai_compatible_vision(image_b64, prompt, mime)
    else:
        raw_response = await _ollama_vision(image_b64, prompt)
    start = raw_response.find("{")
    end = raw_response.rfind("}") + 1
    if start != -1 and end > start:
        try:
            parsed = json.loads(raw_response[start:end])
        except json.JSONDecodeError:
            parsed = None
        analysis = _food_analysis(parsed)
        if analysis is not None:
            return analysis

    return {
        "food_name": "Unknown food",
        "calories": 0,
        "macronutrients": {"protein": 0, "fat": 0, "carb": 0, "fiber": 0},
        "ai_analysis": raw_response[:300] if raw_response else OLLAMA_UNAVAILABLE_MESSAGE,
        "analysis": raw_response[:300] if raw_response else OLLAMA_UNAVAILABLE_MESSAGE,
        "recommendations": ["Try again with a clear, well-lit food photo."],
    }
