from typing import Dict, List

from app.config import settings
from app.database import get_optional_supabase


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

SAMPLE_PRODUCTS: dict[str, list[dict]] = {
    "gym": [
        {
            "id": "gym-top-001",
            "name": "드라이 트레이닝 티셔츠",
            "brand": "NIKE",
            "price": 39000,
            "original_price": 49000,
            "url": "https://www.musinsa.com/products/sample1",
            "image_url": "https://placehold.co/300x300?text=Training+Tee",
            "category": "gym-top",
            "affiliate_type": "musinsa",
            "commission_rate": 0.05,
        },
        {
            "id": "gym-tight-001",
            "name": "컴프레션 트레이닝 타이츠",
            "brand": "Under Armour",
            "price": 52000,
            "original_price": 65000,
            "url": "https://www.musinsa.com/products/sample2",
            "image_url": "https://placehold.co/300x300?text=Compression",
            "category": "gym-bottom",
            "affiliate_type": "musinsa",
            "commission_rate": 0.05,
        },
    ],
    "crossfit": [
        {
            "id": "crossfit-shoe-001",
            "name": "나노 크로스 트레이닝화",
            "brand": "Reebok",
            "price": 159000,
            "original_price": 189000,
            "url": "https://www.musinsa.com/products/sample3",
            "image_url": "https://placehold.co/300x300?text=Crossfit+Shoe",
            "category": "crossfit-shoes",
            "affiliate_type": "musinsa",
            "commission_rate": 0.05,
        }
    ],
    "pilates": [
        {
            "id": "pilates-legging-001",
            "name": "얼라인 하이웨이스트 레깅스",
            "brand": "Lululemon",
            "price": 128000,
            "original_price": 148000,
            "url": "https://www.musinsa.com/products/sample4",
            "image_url": "https://placehold.co/300x300?text=Pilates+Legging",
            "category": "pilates-bottom",
            "affiliate_type": "musinsa",
            "commission_rate": 0.05,
        }
    ],
    "running": [
        {
            "id": "running-shoe-001",
            "name": "젤 카야노 러닝화",
            "brand": "ASICS",
            "price": 149000,
            "original_price": 169000,
            "url": "https://www.musinsa.com/products/sample5",
            "image_url": "https://placehold.co/300x300?text=Running+Shoe",
            "category": "running-shoes",
            "affiliate_type": "musinsa",
            "commission_rate": 0.05,
        }
    ],
    "yoga": [
        {
            "id": "yoga-mat-001",
            "name": "프로 요가 매트 5mm",
            "brand": "Manduka",
            "price": 85000,
            "original_price": 95000,
            "url": "https://www.musinsa.com/products/sample6",
            "image_url": "https://placehold.co/300x300?text=Yoga+Mat",
            "category": "yoga-accessory",
            "affiliate_type": "musinsa",
            "commission_rate": 0.05,
        }
    ],
}


def normalize_sport_category(sport_category: str) -> str:
    return SPORT_ALIASES.get((sport_category or "gym").strip().lower(), "gym")


async def get_clothing_recommendations(
    user_id: str,
    sport_category: str,
    limit: int = 8,
) -> List[Dict]:
    normalized_category = normalize_sport_category(sport_category)
    supabase = get_optional_supabase()

    if supabase is None and not settings.demo_fallback_enabled:
        raise RuntimeError("Clothing recommendation data store unavailable")

    if supabase is not None:
        try:
            result = (
                supabase.table("clothing_recommendations")
                .select("items")
                .eq("user_id", user_id)
                .eq("sport_category", normalized_category)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                items = result.data[0].get("items") or []
                return items[:limit]
        except Exception:
            if not settings.demo_fallback_enabled:
                raise RuntimeError("Clothing recommendation data store unavailable")

    if not settings.demo_fallback_enabled:
        return []

    products = SAMPLE_PRODUCTS.get(normalized_category, SAMPLE_PRODUCTS["gym"])[:limit]

    if supabase is not None:
        try:
            supabase.table("clothing_recommendations").insert(
                {
                    "user_id": user_id,
                    "sport_category": normalized_category,
                    "items": products,
                    "commission_rate": 0.05,
                }
            ).execute()
        except Exception:
            pass

    return products
