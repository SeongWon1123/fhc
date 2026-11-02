from datetime import date, datetime
from threading import Lock
from zoneinfo import ZoneInfo


KST = ZoneInfo("Asia/Seoul")


def kst_day_start() -> datetime:
    return datetime.now(KST).replace(hour=0, minute=0, second=0, microsecond=0)


class DailyUsageLimiter:
    """Atomically consume daily requests and discard stale counters."""

    def __init__(self) -> None:
        self._counts: dict[tuple[str, date], int] = {}
        self._lock = Lock()

    def consume(self, user_id: str, limit: int) -> bool:
        with self._lock:
            today = kst_day_start().date()
            for key in list(self._counts):
                if key[1] != today:
                    del self._counts[key]
            key = (user_id, today)
            count = self._counts.get(key, 0)
            if count >= limit:
                return False
            self._counts[key] = count + 1
            return True


# These limits are per-process and reset on restart.
image_usage = DailyUsageLimiter()
demo_chat_usage = DailyUsageLimiter()
