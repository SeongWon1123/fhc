from typing import Any
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: UUID = Field(default_factory=uuid4)
    message: str = Field(min_length=1)
    context_type: str = "diet"


class ChatResponse(BaseModel):
    reply: str
    session_id: UUID
    sources: list[str] = Field(default_factory=list)


class DietAnalysisResponse(BaseModel):
    food_name: str
    calories: int
    macronutrients: dict[str, Any]
    ai_analysis: str
    recommendations: list[str]


class DietLogCreate(BaseModel):
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    food_name: str
    calories: int = Field(ge=0)
    macronutrients: dict[str, Any]
    ai_analysis: str | None = None
