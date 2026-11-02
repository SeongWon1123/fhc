import type { Booking, ClothingFeedItem, Coach, Member } from '../data';
import { AdminApiError, requestAdmin } from './adminApi';

export type OperationsDataSource = 'supabase';
export type OperationsData = {
  source: OperationsDataSource;
  coaches: Coach[];
  coachApplications: Coach[];
  members: Member[];
  bookings: Booking[];
  clothingItems: ClothingFeedItem[];
};

export async function loadOperationsData(token: string, signal?: AbortSignal): Promise<OperationsData> {
  const data = await requestAdmin('overview', token, signal);
  if (
    typeof data !== 'object' || data === null ||
    !('source' in data) || data.source !== 'supabase' ||
    !('coaches' in data) || !Array.isArray(data.coaches) ||
    !('members' in data) || !Array.isArray(data.members) ||
    !('bookings' in data) || !Array.isArray(data.bookings) ||
    !('clothing_items' in data) || !Array.isArray(data.clothing_items)
  ) {
    throw new AdminApiError(502);
  }
  return {
    source: data.source,
    coaches: data.coaches,
    coachApplications: 'coach_applications' in data && Array.isArray(data.coach_applications)
      ? data.coach_applications
      : [],
    members: data.members,
    bookings: data.bookings,
    clothingItems: data.clothing_items,
  };
}
