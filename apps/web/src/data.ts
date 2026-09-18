import type { BookingStatus } from '@fitconnect/shared';

export type { BookingStatus };

export interface Coach {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  booking_count: number;
  is_verified: boolean;
  location: string;
  base_price: number;
}

export interface Booking {
  id: string;
  user_name: string;
  coach_name: string;
  scheduled_at: string;
  status: BookingStatus;
  amount: number;
  session_type: 'online' | 'offline';
}

export interface Member {
  id: string;
  email: string;
  name: string;
  fitness_goal: string;
  join_date: string;
}

export interface ClothingFeedItem {
  id: string;
  sport: string;
  category: string;
  item: string;
  price: number;
}
