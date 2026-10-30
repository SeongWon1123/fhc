import { bookingIdOf, countUnread } from '../src/lib/notifications';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
};

  test('returns zero when the inbox is empty', () => {
    // Given: an empty inbox.
    const notifications: { is_read: boolean }[] = [];
    // When: unread notifications are counted.
    const count = countUnread(notifications);
    // Then: none are unread.
    expect(count).toBe(0);
  });

  test('returns zero when every notification is read', () => {
    // Given: notifications already read.
    const notifications = [{ is_read: true }, { is_read: true }];
    // When: unread notifications are counted.
    const count = countUnread(notifications);
    // Then: read rows do not contribute.
    expect(count).toBe(0);
  });

  test('counts every unread notification when none are read', () => {
    // Given: unread notifications.
    const notifications = [{ is_read: false }, { is_read: false }];
    // When: unread notifications are counted.
    const count = countUnread(notifications);
    // Then: every row contributes.
    expect(count).toBe(2);
  });

  test('counts only unread notifications without mutating the inbox', () => {
    // Given: an immutable inbox mixing read and unread rows.
    const notifications = Object.freeze([
      Object.freeze({ is_read: false }), Object.freeze({ is_read: true }),
      Object.freeze({ is_read: false }), Object.freeze({ is_read: true }),
    ]);
    // When: unread notifications are counted.
    const count = countUnread(notifications);
    // Then: only the two unread rows contribute and the input remains intact.
    expect(count).toBe(2);
    expect(notifications.map((item) => item.is_read)).toEqual([false, true, false, true]);
  });

test('returns the booking id when notification data contains booking status', () => {
  // Given: a booking status notification.
  const notification = { data: { booking_id: 'booking-123', status: 'confirmed' } };
  // When: its related booking is extracted.
  const id = bookingIdOf(notification);
  // Then: the booking id is returned.
  expect(id).toBe('booking-123');
});

test('returns the booking id when notification data contains a review', () => {
  // Given: a review notification referring to a booking.
  const notification = { data: { review_id: 'review-123', booking_id: 'booking-456' } };
  // When: its related booking is extracted.
  const id = bookingIdOf(notification);
  // Then: the booking id, not the review id, is returned.
  expect(id).toBe('booking-456');
});

test('returns null when notification data or booking id is missing', () => {
  // Given: notifications without a related booking.
  const notifications = [{ data: null }, { data: {} }, { data: { review_id: 'review-123' } }];
  // When: their related bookings are extracted.
  const ids = notifications.map(bookingIdOf);
  // Then: none has a booking id.
  expect(ids).toEqual([null, null, null]);
});

test('returns null when booking ids are non-string or empty', () => {
  // Given: malformed booking identifiers.
  const notifications = [123, false, null, undefined, {}, [], '', ' \n\t ']
    .map((booking_id) => ({ data: { booking_id } }));
  // When: their related bookings are extracted.
  const ids = notifications.map(bookingIdOf);
  // Then: malformed identifiers cannot trigger navigation.
  expect(ids).toEqual(notifications.map(() => null));
});

test('trims whitespace when a string booking id is present', () => {
  // Given: an identifier surrounded by whitespace.
  const notification = { data: { booking_id: ' booking-123 ' } };
  // When: its related booking is extracted.
  const id = bookingIdOf(notification);
  // Then: navigation receives the identifier without padding.
  expect(id).toBe('booking-123');
});
