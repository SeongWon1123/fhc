from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SessionType(str, Enum):
    online = "online"
    offline = "offline"


class BookingCreate(BaseModel):
    coach_id: UUID
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, gt=0, le=240)
    session_type: SessionType = SessionType.online
    notes: str | None = Field(default=None, max_length=500)


class BookingStatusUpdate(BaseModel):
    status: Literal["pending", "confirmed", "completed", "cancelled", "no_show"]
    coach_notes: str | None = Field(default=None, max_length=500)


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    content: str | None = Field(default=None, max_length=500)


class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    coach_id: UUID
    scheduled_at: datetime
    duration_minutes: int
    session_type: SessionType
    status: str
    price: int
    meeting_url: str | None = None
    notes: str | None = None
    created_at: datetime
