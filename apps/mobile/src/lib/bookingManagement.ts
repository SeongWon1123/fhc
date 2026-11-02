import type { Booking, BookingReview, BookingStatus } from '../types';

export type BookingAction = {
  readonly status: BookingStatus;
  readonly label: string;
  readonly destructive: boolean;
};

const actions: Readonly<Record<'confirmed' | 'cancelled' | 'completed' | 'no_show', BookingAction>> = {
  confirmed: { status: 'confirmed', label: '예약 승인', destructive: false },
  cancelled: { status: 'cancelled', label: '예약 취소', destructive: true },
  completed: { status: 'completed', label: '세션 완료', destructive: false },
  no_show: { status: 'no_show', label: '노쇼 처리', destructive: true },
};

export function bookingActions(
  booking: Pick<Booking, 'user_id' | 'coach_id' | 'status'>,
  actorId: string,
): readonly BookingAction[] {
  if (actorId !== booking.coach_id && actorId !== booking.user_id) return [];
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return [];
  if (actorId !== booking.coach_id) return [actions.cancelled];
  return booking.status === 'pending'
    ? [actions.confirmed, actions.cancelled]
    : [actions.completed, actions.cancelled, actions.no_show];
}

export function bookingUpdate(
  status: BookingStatus, isCoach: boolean, notes: string,
): { readonly status: BookingStatus; readonly coach_notes?: string | null } {
  return isCoach ? { status, coach_notes: notes.trim() || null } : { status };
}

export type BookingUpdateEvent = {
  readonly bookingId: string;
  readonly status: BookingStatus;
};

export function bookingReview(booking: Pick<Booking, 'reviews'>): BookingReview | null {
  const review = Array.isArray(booking.reviews) ? booking.reviews[0] : booking.reviews;
  return review ?? null;
}

export function canReview(
  booking: Pick<Booking, 'user_id' | 'status' | 'reviews'>,
  actorId: string,
): boolean {
  return booking.user_id === actorId && booking.status === 'completed' && !bookingReview(booking);
}

export function reviewPayload(
  rating: number, content: string,
): { readonly ok: true; readonly payload: { rating: number; content: string | null } }
  | { readonly ok: false; readonly error: string } {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: '별점을 1~5점 중에서 선택해주세요.' };
  }
  const text = content.trim();
  if (text.length > 500) return { ok: false, error: '리뷰는 500자 이내로 작성해주세요.' };
  return { ok: true, payload: { rating, content: text || null } };
}

export function parseBookingEvent(value: unknown): BookingUpdateEvent | null {
  if (typeof value !== 'object' || value === null
    || !('bookingId' in value) || typeof value.bookingId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.bookingId)
    || !('status' in value)) return null;
  switch (value.status) {
    case 'pending': case 'confirmed': case 'completed': case 'cancelled': case 'no_show':
      return { bookingId: value.bookingId, status: value.status };
    default:
      return null;
  }
}
