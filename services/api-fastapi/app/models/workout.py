from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WorkoutLogCreate(BaseModel):
    model_config = ConfigDict(frozen=True)

    sport_category: Literal["gym", "running", "pilates", "yoga", "crossfit"]
    duration_minutes: int = Field(ge=1, le=600, strict=True)
    calories_burned: int = Field(default=0, ge=0, le=5000, strict=True)
    memo: str = Field(default="", max_length=200)
