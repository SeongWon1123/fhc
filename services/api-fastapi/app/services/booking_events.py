import logging
from typing import Literal

from httpx import AsyncClient, HTTPError, InvalidURL, Timeout


logger = logging.getLogger(__name__)


async def publish_booking_change(
    booking_id: str,
    authorization: str,
    bff_internal_url: str,
) -> Literal["delivered", "unavailable"]:
    """Publish saved state without making a failed notification a failed write."""
    try:
        async with AsyncClient(timeout=Timeout(2.0), follow_redirects=False) as client:
            response = await client.post(
                f"{bff_internal_url.rstrip('/')}/api/realtime/trigger-update",
                headers={"Authorization": authorization},
                json={"bookingId": booking_id},
            )
            response.raise_for_status()
    except (HTTPError, InvalidURL) as exc:
        # Exception messages and response bodies may contain credentials.
        logger.warning("Booking notification unavailable (%s)", type(exc).__name__)
        return "unavailable"
    return "delivered"
