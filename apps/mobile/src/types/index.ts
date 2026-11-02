import type { BookingStatus, SessionType } from '@fitconnect/shared';

export type { BookingStatus, SessionType };

export interface Coach {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  coach_details: CoachDetails;
  reviews?: CoachReview[];
  match_score?: number;
  match_reasons?: string[];
}

export interface CoachDetails {
  id: string;
  specialty: string[] | null;
  biography?: string;
  experience_years: number;
  qualifications: string[] | null;
  base_price: number;
  location?: string;
  is_online_available: boolean;
  is_offline_available: boolean;
  video_url?: string;
  is_verified: boolean;
  rating: number;
  review_count: number;
  booking_count?: number;
  weekly_availability?: WeeklyAvailability | null;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Bookable hourly start times ("HH:00") per weekday, Korea time. */
export type WeeklyAvailability = Partial<Record<Weekday, string[]>>;

/** Review shown publicly on a coach profile; author is a masked display name. */
export interface CoachReview {
  id: string;
  rating: number;
  content?: string | null;
  created_at: string;
  author: string;
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
  coach_notes?: string | null;
  profiles?: { full_name?: string | null; avatar_url?: string | null } | null;
  reviews?: BookingReview | BookingReview[] | null;
  created_at: string;
}

export interface BookingReview {
  id: string;
  rating: number;
  content?: string | null;
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
  commission_rate?: number;
}
