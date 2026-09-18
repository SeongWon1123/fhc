import type { BookingStatus, SessionType } from '@fitconnect/shared';

export type { BookingStatus, SessionType };

export interface Coach {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  coach_details: CoachDetails;
  match_score?: number;
  match_reasons?: string[];
}

export interface CoachDetails {
  id: string;
  specialty: string[];
  biography?: string;
  experience_years: number;
  qualifications: string[];
  base_price: number;
  location?: string;
  is_online_available: boolean;
  is_offline_available: boolean;
  video_url?: string;
  is_verified: boolean;
  rating: number;
  review_count: number;
}

export interface Booking {
  id: string;
  user_id: string;
  coach_id: string;
  scheduled_at: string;
  duration_minutes: number;
  session_type: SessionType;
  status: BookingStatus;
  price: number;
  meeting_url?: string;
  notes?: string;
  created_at: string;
}

export interface DietLog {
  id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  calories: number;
  macronutrients: {
    protein: number;
    fat: number;
    carb: number;
    fiber?: number;
  };
  image_url?: string;
  ai_analysis?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ClothingItem {
  name: string;
  brand: string;
  price: number;
  original_price?: number;
  url: string;
  image_url: string;
  category: string;
  affiliate_type: string;
}