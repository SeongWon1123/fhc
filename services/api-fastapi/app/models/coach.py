from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

class CoachDetailUpdate(BaseModel):
    specialty: Optional[List[str]] = None
    biography: Optional[str] = None
    experience_years: Optional[int] = None
    qualifications: Optional[List[str]] = None
    base_price: Optional[int] = None
    location: Optional[str] = None
    is_online_available: Optional[bool] = None
    video_url: Optional[str] = None

class CoachListResponse(BaseModel):
    id: UUID
    full_name: Optional[str]
    avatar_url: Optional[str]
    coach_details: Optional[dict]

class MatchingScore(BaseModel):
    coach_id: UUID
    score: float
    reasons: List[str]