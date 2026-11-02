from pydantic import BaseModel, Field, HttpUrl, field_validator
from typing import Annotated, Literal, Optional, List
from uuid import UUID

Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
HourlySlots = Annotated[
    list[Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):00$")]],
    Field(max_length=24),
]

class CoachDetailUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    specialty: Optional[List[str]] = Field(None, min_length=1, max_length=5)
    biography: Optional[str] = Field(None, max_length=1000)
    experience_years: Optional[int] = Field(None, ge=0, le=60)
    qualifications: Optional[List[str]] = Field(None, max_length=10)
    base_price: Optional[int] = Field(None, ge=0, le=1_000_000)
    location: Optional[str] = Field(None, max_length=100)
    is_online_available: Optional[bool] = None
    is_offline_available: Optional[bool] = None
    video_url: Optional[str] = Field(default=None, max_length=500)
    weekly_availability: dict[Weekday, HourlySlots] | None = None

    @field_validator("video_url")
    @classmethod
    def validate_video_url(cls, value: str | None) -> str | None:
        if value is not None and (
            not value.startswith("https://") or HttpUrl(value).scheme != "https"
        ):
            raise ValueError("Video URL must use https://")
        return value

    @field_validator("weekly_availability")
    @classmethod
    def normalize_weekly_availability(
        cls, value: dict[Weekday, list[str]] | None,
    ) -> dict[Weekday, list[str]] | None:
        if value is None:
            return None
        for slots in value.values():
            if len(slots) != len(set(slots)):
                raise ValueError("Hourly start times must be unique")
        return {day: sorted(slots) for day, slots in value.items()}

class CoachListResponse(BaseModel):
    id: UUID
    full_name: Optional[str]
    avatar_url: Optional[str]
    coach_details: Optional[dict]

class MatchingScore(BaseModel):
    coach_id: UUID
    score: float
    reasons: List[str]
