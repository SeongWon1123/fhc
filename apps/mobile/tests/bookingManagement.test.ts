import { bookingActions, bookingUpdate, parseBookingEvent } from '../src/lib/bookingManagement';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

const booking = { user_id: 'member', coach_id: 'coach', status: 'pending' } as const;

test('members can only cancel their active bookings', () => {
  expect(bookingActions(booking, 'member').map((action) => action.status)).toEqual(['cancelled']);
  expect(bookingActions({ ...booking, status: 'confirmed' }, 'member').map((action) => action.status))
    .toEqual(['cancelled']);
});

test('coaches receive only the transitions permitted by the server', () => {
  expect(bookingActions(booking, 'coach').map((action) => action.status))
    .toEqual(['confirmed', 'cancelled']);
  expect(bookingActions({ ...booking, status: 'confirmed' }, 'coach').map((action) => action.status))
    .toEqual(['completed', 'cancelled', 'no_show']);
});

test('outsiders and terminal bookings have no actions', () => {
  expect(bookingActions(booking, 'outsider')).toEqual([]);
  for (const status of ['completed', 'cancelled', 'no_show'] as const) {
    expect(bookingActions({ ...booking, status }, 'member')).toEqual([]);
    expect(bookingActions({ ...booking, status }, 'coach')).toEqual([]);
  }
});

test('member updates never send coach notes, including an explicit null', () => {
  expect(bookingUpdate('cancelled', false, 'private note')).toEqual({ status: 'cancelled' });
});

test('coach updates trim notes and explicitly clear an empty note', () => {
  expect(bookingUpdate('completed', true, ' 메모 ')).toEqual({ status: 'completed', coach_notes: '메모' });
  expect(bookingUpdate('confirmed', true, ' ')).toEqual({ status: 'confirmed', coach_notes: null });
});

test('realtime events reject malformed identifiers and unknown states', () => {
  const bookingId = '00000000-0000-4000-8000-000000000010';
  expect(parseBookingEvent({ bookingId, status: 'confirmed', userId: 'ignored' }))
    .toEqual({ bookingId, status: 'confirmed' });
  for (const value of [null, {}, { bookingId: 'bad', status: 'confirmed' },
    { bookingId, status: 'fake' }, { bookingId, status: null }]) {
    expect(parseBookingEvent(value)).toBe(null);
  }
});
