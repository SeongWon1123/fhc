from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from enum import Enum

class UserRole(str, Enum):
    user = "user"
    coach = "coach"
    gym_owner = "gym_owner"
    admin = "admin"

class FitnessGoal(str, Enum):
    weight_loss = "weight_loss"
    muscle_gain = "muscle_gain"
    maintenance = "maintenance"
    endurance = "endurance"

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    fitness_goal: Optional[FitnessGoal] = None
    preferred_sports: Optional[List[str]] = None

class ProfileResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    role: UserRole
    fitness_goal: Optional[FitnessGoal]
    preferred_sports: Optional[List[str]]
    onboarding_completed: bool
