"""Best-effort inbox notifications using the server's service-role client."""

import logging
from typing import NotRequired, TypedDict
from zoneinfo import ZoneInfo

from supabase import Client

from app.database import get_supabase
from app.services.booking_rules import booking_start

logger = logging.getLogger(__name__)


class NotificationBooking(TypedDict):
    id: str
    user_id: str
    coach_id: str
    status: str
    scheduled_at: NotRequired[str]


class NotificationReview(TypedDict):
    id: str
    booking_id: str
    user_id: str
    coach_id: str


def _actor_name(client: Client, actor_id: str) -> str:
    try:
        rows = client.table("profiles").select("full_name").eq("id", actor_id).limit(1).execute()
        return (rows.data[0].get("full_name") if rows.data else None) or "상대방"
    except Exception:
        logger.warning("Notification profile lookup failed")
        return "상대방"


def notify_booking(booking: NotificationBooking, actor_id: str) -> None:
    """Insert one notification for the other participant; never fail a booking."""
    try:
        client = get_supabase()
        status = booking["status"]
        titles = {
            "pending": "새 예약 요청",
            "confirmed": "예약 확정",
            "cancelled": "예약 취소",
            "completed": "세션 완료",
            "no_show": "노쇼 처리",
        }
        actions = {
            "pending": "세션을 요청했습니다.",
            "confirmed": "예약을 확정했습니다.",
            "cancelled": "예약을 취소했습니다.",
            "completed": "세션을 완료 처리했습니다.",
            "no_show": "예약을 노쇼 처리했습니다.",
        }
        start = booking_start(booking["scheduled_at"]).astimezone(ZoneInfo("Asia/Seoul"))
        period = "오전" if start.hour < 12 else "오후"
        when = f"{start.month}월 {start.day}일 {period} {start.hour % 12 or 12}:{start.minute:02d}"
        recipient = booking["user_id"] if str(actor_id) == str(booking["coach_id"]) else booking["coach_id"]
        client.table("notifications").insert({
            "user_id": str(recipient),
            "type": "booking_requested" if status == "pending" else f"booking_{status}",
            "title": titles[status],
            "body": f"{_actor_name(client, actor_id)} 님이 {when} {actions[status]}",
            "data": {"booking_id": str(booking["id"]), "status": status},
        }).execute()
    except Exception:
        # Notification failures must not roll back a successful booking.
        logger.warning("Booking notification creation failed")


def notify_review(review: NotificationReview) -> None:
    """Insert one coach notification without changing the review's outcome."""
    try:
        client = get_supabase()
        client.table("notifications").insert({
            "user_id": str(review["coach_id"]),
            "type": "review_created",
            "title": "새 리뷰",
            "body": f"{_actor_name(client, str(review['user_id']))} 님이 세션 리뷰를 남겼습니다.",
            "data": {"review_id": str(review["id"]), "booking_id": str(review["booking_id"])},
        }).execute()
    except Exception:
        logger.warning("Review notification creation failed")
