import { countTodayBookings, countTodayMeals } from '../src/lib/homeStats';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

const now = new Date('2026-10-29T12:00:00+09:00');
const at = (day: number, hour = 9) =>
  `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+09:00`;

test('bookings on the same Korean day are counted', () => {
  const bookings = [
    { scheduled_at: at(29, 0), status: 'confirmed' },
    { scheduled_at: at(29, 23), status: 'pending' },
  ];
  expect(countTodayBookings(bookings, now)).toBe(2);
});

test('yesterday and tomorrow bookings are excluded', () => {
  const bookings = [
    { scheduled_at: at(28), status: 'confirmed' },
    { scheduled_at: at(30), status: 'confirmed' },
  ];
  expect(countTodayBookings(bookings, now)).toBe(0);
});

test('Korean midnight decides the day even when UTC dates differ', () => {
  const justAfterMidnight = new Date('2026-10-29T00:30:00+09:00');
  const records = [
    { scheduled_at: '2026-10-28T23:30:00+09:00', created_at: '2026-10-28T14:30:00Z', status: 'confirmed' },
    { scheduled_at: '2026-10-29T00:15:00+09:00', created_at: '2026-10-28T15:15:00Z', status: 'confirmed' },
  ];
  expect(countTodayBookings(records, justAfterMidnight)).toBe(1);
  expect(countTodayMeals(records, justAfterMidnight)).toBe(1);
});

test('cancelled and no_show bookings are excluded', () => {
  const bookings = [
    { scheduled_at: at(29), status: 'cancelled' },
    { scheduled_at: at(29), status: 'no_show' },
    { scheduled_at: at(29), status: 'completed' },
  ];
  expect(countTodayBookings(bookings, now)).toBe(1);
});

test('meals are counted by Korean day', () => {
  const logs = [{ created_at: at(29) }, { created_at: at(29, 20) }, { created_at: at(28) }, { created_at: at(30) }];
  expect(countTodayMeals(logs, now)).toBe(2);
});

test('empty arrays give 0', () => {
  expect(countTodayBookings([], now)).toBe(0);
  expect(countTodayMeals([], now)).toBe(0);
});

test('invalid or missing dates are ignored', () => {
  expect(countTodayBookings([{ scheduled_at: 'nope', status: 'confirmed' }, { status: 'confirmed' }], now)).toBe(0);
  expect(countTodayMeals([{ created_at: 'nope' }, { created_at: null }, {}], now)).toBe(0);
});
