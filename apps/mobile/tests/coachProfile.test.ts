import {
  applicationStatus, availableSlots, buildCoachProfile, DEFAULT_WEEKLY_AVAILABILITY,
  formFromDetails, HOUR_OPTIONS, sportLabel, WEEKDAYS,
} from '../src/lib/coachProfile';
import type { WeeklyAvailability } from '../src/types';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

const valid = {
  name: ' 김코치 ',
  specialty: ['gym', 'running'],
  basePrice: '30,000',
  experienceYears: '3',
  location: ' 순천 ',
  biography: '소개',
  qualifications: '생활스포츠지도사 2급\n, 재활 트레이닝 수료',
  isOnline: true,
  isOffline: false,
  weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
};

test('a complete form becomes the server payload', () => {
  expect(buildCoachProfile(valid)).toEqual({
    ok: true,
    payload: {
      name: '김코치',
      specialty: ['gym', 'running'],
      base_price: 30000,
      experience_years: 3,
      location: '순천',
      biography: '소개',
      qualifications: ['생활스포츠지도사 2급', '재활 트레이닝 수료'],
      is_online_available: true,
      is_offline_available: false,
      weekly_availability: DEFAULT_WEEKLY_AVAILABILITY,
    },
  });
});

test('invalid fields are rejected before reaching the server', () => {
  const invalid = [
    { name: '  ' },
    { specialty: [] },
    { basePrice: '삼만원' },
    { basePrice: '1000001' },
    { experienceYears: '61' },
    { isOnline: false, isOffline: false },
    { qualifications: Array.from({ length: 11 }, (_, i) => `자격${i}`).join('\n') },
  ];
  for (const change of invalid) {
    expect(buildCoachProfile({ ...valid, ...change }).ok).toBe(false);
  }
});

test('application status comes from the stored role and details', () => {
  expect(applicationStatus('user', null)).toBe('none');
  expect(applicationStatus('user', { id: 'me' })).toBe('pending');
  expect(applicationStatus('coach', { id: 'me' })).toBe('approved');
});

test('stored details round-trip into the form', () => {
  const form = formFromDetails({
    name: '김코치', specialty: ['yoga'], base_price: 40000, experience_years: 0,
    location: null, biography: null, qualifications: null,
    is_online_available: false, is_offline_available: true,
  }, '대체 이름');
  expect(form.basePrice).toBe('40000');
  expect(form.experienceYears).toBe('0');
  expect(form.qualifications).toBe('');
  expect(buildCoachProfile(form).ok).toBe(true);
  expect(formFromDetails(null, '대체 이름').name).toBe('대체 이름');
});

test('sport keys are shown with Korean labels', () => {
  expect(sportLabel('gym')).toBe('헬스');
  expect(sportLabel('unknown')).toBe('unknown');
});

test('new profiles use the legacy timetable for every weekday', () => {
  const form = formFromDetails(null, '코치');
  const expected = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  for (const day of WEEKDAYS) {
    expect(form.weeklyAvailability[day.key]).toEqual(expected);
  }
  expect(HOUR_OPTIONS.length).toBe(17);
  expect(HOUR_OPTIONS[0]).toBe('06:00');
  expect(HOUR_OPTIONS[16]).toBe('22:00');
});

test('weekly availability round-trips with sorted hours and days off', () => {
  const availability = { ...DEFAULT_WEEKLY_AVAILABILITY, mon: ['11:00', '09:00'], sun: [] };
  const form = formFromDetails({ weekly_availability: availability }, valid.name);
  expect(form.weeklyAvailability).toEqual(availability);
  const built = buildCoachProfile({ ...valid, weeklyAvailability: form.weeklyAvailability });
  expect(built.ok).toBe(true);
  if (built.ok) {
    expect(built.payload.weekly_availability).toEqual({ ...availability, mon: ['09:00', '11:00'] });
    expect(formFromDetails(built.payload, '').weeklyAvailability).toEqual(built.payload.weekly_availability);
  }
  expect(availability.mon).toEqual(['11:00', '09:00']);
});

test('an entirely empty week cannot be saved', () => {
  const weeklyAvailability = WEEKDAYS.reduce<WeeklyAvailability>(
    (availability, day) => ({ ...availability, [day.key]: [] }), {},
  );
  expect(buildCoachProfile({ ...valid, weeklyAvailability })).toEqual({
    ok: false, error: '예약 가능한 시간을 하나 이상 선택해주세요.',
  });
});

test('calendar dates select their weekday without local timezone parsing', () => {
  const availability = {
    mon: ['11:00', '09:00'], tue: ['10:00'], wed: ['11:00'], thu: ['12:00'],
    fri: ['13:00'], sat: ['14:00'], sun: [],
  };
  const expected = [['09:00', '11:00'], ['10:00'], ['11:00'], ['12:00'], ['13:00'], ['14:00'], []];
  for (let index = 0; index < 7; index += 1) {
    expect(availableSlots(availability, `2026-11-${String(index + 2).padStart(2, '0')}`)).toEqual(expected[index]);
  }
  expect(availableSlots({ mon: ['09:00'] }, '2026-11-03')).toEqual([]);
});

test('null or missing availability uses the default timetable', () => {
  expect(availableSlots(null, '2026-11-02')).toEqual(DEFAULT_WEEKLY_AVAILABILITY.mon);
  expect(availableSlots(undefined, '2026-11-08')).toEqual(DEFAULT_WEEKLY_AVAILABILITY.sun);
  expect(formFromDetails({ weekly_availability: null }, '').weeklyAvailability).toEqual(DEFAULT_WEEKLY_AVAILABILITY);
});
