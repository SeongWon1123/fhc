import logging
from typing import Dict, List
from urllib.parse import quote

from app.config import settings
from app.database import get_optional_supabase


logger = logging.getLogger(__name__)


SPORT_ALIASES = {
    "all": "gym",
    "fitness": "gym",
    "strength": "gym",
    "training": "gym",
    "\ud5ec\uc2a4": "gym",
    "crossfit": "crossfit",
    "\ud06c\ub85c\uc2a4\ud54f": "crossfit",
    "pilates": "pilates",
    "\ud544\ub77c\ud14c\uc2a4": "pilates",
    "running": "running",
    "run": "running",
    "\ub7ec\ub2dd": "running",
    "yoga": "yoga",
    "\uc694\uac00": "yoga",
}

def _search_item(item_id: str, keyword: str, category: str, image_text: str) -> dict:
    # Commission-free search links until a real affiliate catalogue is contracted.
    return {
        "id": item_id,
        "name": keyword,
        "brand": "무신사 검색",
        "price": 0,
        "url": f"https://www.musinsa.com/search/goods?keyword={quote(keyword)}&gf=A",
        "image_url": f"https://placehold.co/300x300?text={image_text}",
        "category": category,
        "affiliate_type": "search",
        "commission_rate": 0,
    }


SAMPLE_PRODUCTS: dict[str, list[dict]] = {
    "gym": [
        _search_item("gym-top", "트레이닝 티셔츠", "gym-top", "Training+Tee"),
        _search_item("gym-bottom", "컴프레션 타이츠", "gym-bottom", "Compression"),
    ],
    "crossfit": [
        _search_item("crossfit-shoes", "크로스핏 트레이닝화", "crossfit-shoes", "Crossfit+Shoe"),
    ],
    "pilates": [
        _search_item("pilates-bottom", "필라테스 레깅스", "pilates-bottom", "Pilates+Legging"),
    ],
    "running": [
        _search_item("running-shoes", "러닝화", "running-shoes", "Running+Shoe"),
        _search_item("running-bottom", "러닝 반바지", "running-bottom", "Running+Shorts"),
    ],
    "yoga": [
        _search_item("yoga-accessory", "요가 매트", "yoga-accessory", "Yoga+Mat"),
    ],
}


def _is_retired_placeholder(items: list) -> bool:
    return any("/products/sample" in str(item.get("url", "")) for item in items)


def normalize_sport_category(sport_category: str) -> str:
    return SPORT_ALIASES.get((sport_category or "gym").strip().lower(), "gym")


async def get_clothing_recommendations(
    user_id: str,
    sport_category: str,
    limit: int = 8,
) -> tuple[str | None, List[Dict]]:
    normalized_category = normalize_sport_category(sport_category)
    supabase = get_optional_supabase()

    if supabase is None and not settings.demo_fallback_enabled:
        raise RuntimeError("Clothing recommendation data store unavailable")

    if supabase is not None:
        try:
            result = (
                supabase.table("clothing_recommendations")
                .select("id, items")
                .eq("user_id", user_id)
                .eq("sport_category", normalized_category)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                items = result.data[0].get("items") or []
                if items and not _is_retired_placeholder(items):
                    return result.data[0].get("id"), items[:limit]
        except Exception:
            if not settings.demo_fallback_enabled:
                raise RuntimeError("Clothing recommendation data store unavailable")

    # Seed a deterministic starter set on first access, then persist it per user/category.
    # This keeps real Supabase mode usable before an external commerce catalogue is connected.
    products = SAMPLE_PRODUCTS.get(normalized_category, SAMPLE_PRODUCTS["gym"])[:limit]

    if supabase is not None:
        try:
            inserted = supabase.table("clothing_recommendations").insert(
                {
                    "user_id": user_id,
                    "sport_category": normalized_category,
                    "items": products,
                    "commission_rate": 0,
                }
            ).execute()
            if inserted.data:
                return inserted.data[0].get("id"), products
        except Exception as exc:
            logger.warning("Clothing recommendation was not stored: %s", type(exc).__name__)

    return None, products
