from typing import Any
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, StringConstraints


class ChatRequest(BaseModel):
    session_id: UUID = Field(default_factory=uuid4)
    message: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
    ]
    context_type: Literal["diet", "workout", "clothing", "general"] = "diet"


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
    food_name: str = Field(min_length=1, max_length=100)
    calories: int = Field(ge=0, le=10000)
    macronutrients: dict[
        Literal["protein", "fat", "carb", "fiber"],
        Annotated[float, Field(ge=0, le=2000, strict=True, allow_inf_nan=False)],
    ]
    ai_analysis: str | None = Field(default=None, max_length=2000)
