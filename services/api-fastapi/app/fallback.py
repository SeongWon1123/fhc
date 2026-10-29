from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from threading import Lock
from uuid import UUID, uuid4

from app.models.booking import BookingStatusUpdate
from app.services.booking_rules import BookingConflictError, ensure_booking_update, overlaps


_BOOKING_LOCK = Lock()


DEMO_USER_ID = UUID("00000000-0000-0000-0000-000000000001")

DEMO_USER = SimpleNamespace(
    id=DEMO_USER_ID,
    email="demo@fitconnect.local",
    role="user",
)

SAMPLE_COACHES: list[dict] = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "mina.coach@example.com",
        "full_name": "박민아",
        "avatar_url": None,
        "role": "coach",
        "coach_details": {
            "id": "11111111-1111-1111-1111-111111111111",
            "specialty": ["헬스", "근력", "체중 감량"],
            "biography": "바쁜 초보자를 위한 근력 운동과 체중 관리 코칭을 제공합니다.",
            "experience_years": 7,
            "qualifications": ["NASM CPT", "영양 코칭"],
            "base_price": 70000,
            "location": "서울",
            "is_online_available": True,
            "is_offline_available": True,
            "video_url": None,
            "is_verified": True,
            "rating": 4.8,
            "review_count": 42,
        },
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "email": "jun.coach@example.com",
        "full_name": "이준",
        "avatar_url": None,
        "role": "coach",
        "coach_details": {
            "id": "22222222-2222-2222-2222-222222222222",
            "specialty": ["러닝", "지구력", "모빌리티"],
            "biography": "지속 가능한 러닝 루틴과 지구력 향상 계획을 설계합니다.",
            "experience_years": 5,
            "qualifications": ["RRCA Coach", "교정 운동"],
            "base_price": 60000,
            "location": "부산",
            "is_online_available": True,
            "is_offline_available": False,
            "video_url": None,
            "is_verified": True,
            "rating": 4.6,
            "review_count": 31,
        },
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "email": "sora.coach@example.com",
        "full_name": "김소라",
        "avatar_url": None,
        "role": "coach",
        "coach_details": {
            "id": "33333333-3333-3333-3333-333333333333",
            "specialty": ["필라테스", "요가", "자세 교정"],
            "biography": "저충격 컨디셔닝을 위한 필라테스와 자세 교정 코칭을 제공합니다.",
            "experience_years": 9,
            "qualifications": ["필라테스 지도자", "Yoga Alliance RYT"],
            "base_price": 80000,
            "location": "인천",
            "is_online_available": True,
            "is_offline_available": True,
            "video_url": None,
            "is_verified": True,
            "rating": 4.9,
            "review_count": 58,
        },
    },
]

SAMPLE_MEMBERS: list[dict] = [
    {
        "id": str(DEMO_USER_ID),
        "email": "demo@fitconnect.local",
        "full_name": "데모 회원",
        "role": "user",
        "fitness_goal": "근육 증가",
        "created_at": "2026-05-20T09:00:00+09:00",
    },
    {
        "id": "44444444-4444-4444-4444-444444444444",
        "email": "runner@example.com",
        "full_name": "러너 아리",
        "role": "user",
        "fitness_goal": "지구력 향상",
        "created_at": "2026-05-22T11:20:00+09:00",
    },
    {
        "id": "55555555-5555-5555-5555-555555555555",
        "email": "posture@example.com",
        "full_name": "자세 하나",
        "role": "user",
        "fitness_goal": "체형 유지",
        "created_at": "2026-05-26T16:30:00+09:00",
    },
]

SAMPLE_CLOTHING_FEED: list[dict] = [
    {
        "id": "gear-gym-tee",
        "sport": "근력",
        "category": "상의",
        "item": "통기성 컴프레션 티셔츠",
        "price": 39000,
    },
    {
        "id": "gear-running-shoes",
        "sport": "러닝",
        "category": "신발",
        "item": "안정형 러닝화",
        "price": 129000,
    },
    {
        "id": "gear-pilates-leggings",
        "sport": "필라테스",
        "category": "하의",
        "item": "하이웨이스트 스트레치 레깅스",
        "price": 59000,
    },
    {
        "id": "gear-yoga-mat",
        "sport": "요가",
        "category": "액세서리",
        "item": "논슬립 트레이닝 매트",
        "price": 49000,
    },
]

_BOOKINGS: list[dict] = []
_DIET_LOGS: list[dict] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_coach(coach: dict) -> dict:
    normalized = dict(coach)
    details = normalized.get("coach_details") or {}
    if isinstance(details, list):
        details = details[0] if details else {}
    normalized["coach_details"] = details
    return normalized


def list_coaches(
    specialty: str | None = None,
    location: str | None = None,
    min_rating: float | None = None,
    max_price: int | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    coaches = [normalize_coach(coach) for coach in SAMPLE_COACHES]

    if specialty:
        specialty_lower = specialty.lower()
        coaches = [
            coach
            for coach in coaches
            if specialty_lower
            in [item.lower() for item in coach["coach_details"].get("specialty", [])]
        ]
    if location:
        location_lower = location.lower()
        coaches = [
            coach
            for coach in coaches
            if location_lower in (coach["coach_details"].get("location") or "").lower()
        ]
    if min_rating is not None:
        coaches = [
            coach
            for coach in coaches
            if float(coach["coach_details"].get("rating") or 0) >= min_rating
        ]
    if max_price is not None:
        coaches = [
            coach
            for coach in coaches
            if int(coach["coach_details"].get("base_price") or 0) <= max_price
        ]

    return coaches[offset : offset + limit]


def get_coach(coach_id: str | UUID) -> dict | None:
    coach_id = str(coach_id)
    for coach in SAMPLE_COACHES:
        if coach["id"] == coach_id:
            return normalize_coach(coach)
    return None


def matched_coaches(limit: int = 10) -> list[dict]:
    coaches = [normalize_coach(coach) for coach in SAMPLE_COACHES]
    for index, coach in enumerate(coaches):
        coach["match_score"] = max(75.0, 96.0 - index * 7)
        coach["match_reasons"] = [
            "선택한 운동 목표와 잘 맞습니다.",
            "비슷한 회원들의 평점이 높습니다.",
        ]
    return coaches[:limit]


def coach_price(coach_id: str | UUID) -> int | None:
    coach = get_coach(coach_id)
    if not coach:
        return None
    return int(coach["coach_details"].get("base_price") or 0)


def create_booking(booking: dict, user_id: str | UUID) -> dict:
    duration = int(booking.get("duration_minutes") or 60)
    price_per_hour = coach_price(booking["coach_id"])
    if price_per_hour is None:
        raise ValueError("Coach not found")

    scheduled_at = booking["scheduled_at"]
    if hasattr(scheduled_at, "isoformat"):
        scheduled_at = scheduled_at.isoformat()

    item = {
        "id": str(uuid4()),
        "user_id": str(user_id),
        "coach_id": str(booking["coach_id"]),
        "scheduled_at": scheduled_at,
        "duration_minutes": duration,
        "session_type": str(booking.get("session_type") or "online"),
        "status": "pending",
        "price": price_per_hour * duration // 60,
        "meeting_url": f"https://meet.fitconnect.local/{uuid4().hex[:8]}"
        if str(booking.get("session_type") or "online") == "online"
        else None,
        "notes": booking.get("notes"),
        "created_at": now_iso(),
    }
    with _BOOKING_LOCK:
        if any(overlaps(existing, item) for existing in _BOOKINGS):
            raise BookingConflictError("Time slot already booked")
        _BOOKINGS.append(item)
    return item


def list_bookings(user_id: str | UUID, role: str = "user") -> list[dict]:
    user_id = str(user_id)
    key = "coach_id" if role == "coach" else "user_id"
    return [booking for booking in reversed(_BOOKINGS) if booking.get(key) == user_id]


def sample_admin_bookings() -> list[dict]:
    coaches = [normalize_coach(coach) for coach in SAMPLE_COACHES]
    return [
        {
            "id": "booking-demo-1001",
            "user_name": "데모 회원",
            "coach_name": coaches[0]["full_name"],
            "scheduled_at": "2026-06-07T10:00:00+09:00",
            "status": "confirmed",
            "amount": 70000,
            "session_type": "offline",
        },
        {
            "id": "booking-demo-1002",
            "user_name": "러너 아리",
            "coach_name": coaches[1]["full_name"],
            "scheduled_at": "2026-06-08T19:30:00+09:00",
            "status": "pending",
            "amount": 60000,
            "session_type": "online",
        },
        {
            "id": "booking-demo-1003",
            "user_name": "자세 하나",
            "coach_name": coaches[2]["full_name"],
            "scheduled_at": "2026-06-03T14:00:00+09:00",
            "status": "completed",
            "amount": 80000,
            "session_type": "offline",
        },
        *[
            {
                **booking,
                "user_name": "데모 회원",
                "coach_name": (get_coach(booking["coach_id"]) or {}).get("full_name", "코치"),
                "amount": booking.get("price", 0),
            }
            for booking in reversed(_BOOKINGS)
        ],
    ]


def update_booking_status(
    booking_id: str | UUID,
    user_id: str | UUID,
    update: BookingStatusUpdate,
) -> dict | None:
    booking_id = str(booking_id)
    user_id = str(user_id)
    with _BOOKING_LOCK:
        for booking in _BOOKINGS:
            if booking["id"] != booking_id:
                continue
            ensure_booking_update(booking, user_id, update)
            candidate = {**booking, "status": update.status}
            if candidate["status"] in {"pending", "confirmed"} and any(
                existing["id"] != booking_id and overlaps(existing, candidate)
                for existing in _BOOKINGS
            ):
                raise BookingConflictError("Time slot already booked")
            booking.update(update.model_dump(exclude_unset=True))
            return booking
    return None


def add_diet_log(log: dict, user_id: str | UUID) -> dict:
    item = {
        "id": str(uuid4()),
        "user_id": str(user_id),
        **log,
        "created_at": now_iso(),
    }
    _DIET_LOGS.append(item)
    return item


def list_diet_logs(user_id: str | UUID, limit: int = 30) -> list[dict]:
    user_id = str(user_id)
    logs = [log for log in reversed(_DIET_LOGS) if log.get("user_id") == user_id]
    return logs[:limit]
