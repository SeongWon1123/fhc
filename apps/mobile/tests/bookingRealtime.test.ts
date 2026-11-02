import { useBookingRealtime } from '../src/lib/bookingRealtimeStore';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

const event = { bookingId: '00000000-0000-4000-8000-000000000010', status: 'confirmed' } as const;

test('a valid update notifies subscribers and invalidates the booking list', () => {
  useBookingRealtime.getState().reset('member', 'connected');
  const before = useBookingRealtime.getState().revision;
  const updates: number[] = [];
  const stop = useBookingRealtime.subscribe((state) => updates.push(state.revision));
  useBookingRealtime.getState().receive('member', event);
  stop();
  expect(updates).toEqual([before + 1]);
  expect(useBookingRealtime.getState().latest).toEqual(event);
});

test('late events and connection callbacks from a signed out account are ignored', () => {
  useBookingRealtime.getState().reset('other', 'connecting');
  const before = useBookingRealtime.getState().revision;
  useBookingRealtime.getState().receive('member', event);
  useBookingRealtime.getState().setConnection('member', 'connected');
  expect(useBookingRealtime.getState().revision).toBe(before);
  expect(useBookingRealtime.getState().latest).toBe(null);
  expect(useBookingRealtime.getState().connection).toBe('connecting');
});

test('reconnect and foreground refresh invalidate missed booking changes', () => {
  useBookingRealtime.getState().reset('member', 'disconnected');
  const before = useBookingRealtime.getState().revision;
  useBookingRealtime.getState().setConnection('member', 'connected');
  expect(useBookingRealtime.getState().revision).toBe(before + 1);
  useBookingRealtime.getState().refresh('member');
  expect(useBookingRealtime.getState().revision).toBe(before + 2);
});

test('malformed events do not invalidate or display notifications', () => {
  useBookingRealtime.getState().reset('member', 'connected');
  const before = useBookingRealtime.getState().revision;
  useBookingRealtime.getState().receive('member', { ...event, status: 'invalid' });
  expect(useBookingRealtime.getState().revision).toBe(before);
  expect(useBookingRealtime.getState().latest).toBe(null);
});
