from datetime import datetime, timedelta, timezone
from typing import TypedDict

from app.models.booking import BookingStatusUpdate


class BookingPermissionError(PermissionError):
    pass


class BookingConflictError(ValueError):
    pass


class BookingWindow(TypedDict):
    coach_id: str
    scheduled_at: str
    duration_minutes: int
    status: str


class BookingRecord(BookingWindow):
    user_id: str


def booking_start(value: str | datetime) -> datetime:
    start = datetime.fromisoformat(value) if isinstance(value, str) else value
    return start.replace(tzinfo=timezone.utc) if start.tzinfo is None else start


def overlaps(existing: BookingWindow, candidate: BookingWindow) -> bool:
    if existing["coach_id"] != str(candidate["coach_id"]):
        return False
    if existing["status"] not in {"pending", "confirmed"}:
        return False
    start = booking_start(candidate["scheduled_at"])
    existing_start = booking_start(existing["scheduled_at"])
    return (
        start < existing_start + timedelta(minutes=existing["duration_minutes"])
        and existing_start < start + timedelta(minutes=candidate["duration_minutes"])
    )


def ensure_booking_update(
    booking: BookingRecord,
    actor_id: str,
    update: BookingStatusUpdate,
) -> None:
    is_coach = actor_id == booking["coach_id"]
    if not is_coach and actor_id != booking["user_id"]:
        raise BookingPermissionError("Not authorized")
    if not is_coach and "coach_notes" in update.model_fields_set:
        raise BookingPermissionError("Only the coach can edit coach notes")
    if not is_coach and update.status != "cancelled":
        raise BookingPermissionError("Members may only cancel their bookings")

    coach_transitions = {
        "pending": {"confirmed", "cancelled"},
        "confirmed": {"completed", "cancelled", "no_show"},
    }
    member_transitions = {
        "pending": {"cancelled"},
        "confirmed": {"cancelled"},
    }
    allowed = coach_transitions if is_coach else member_transitions
    if update.status not in allowed.get(booking["status"], set()):
        raise BookingConflictError("Booking status transition is not allowed")
