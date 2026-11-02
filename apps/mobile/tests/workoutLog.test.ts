import {
  buildWorkoutLog, formatWorkoutDate, formatWorkoutSummary, SPORTS, sportLabel,
} from '../src/lib/workoutLog';
import { SPORTS as coachSports } from '../src/lib/coachProfile';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

const valid = { sport: 'running', minutes: ' 45 ', calories: ' 250 ', memo: ' 가볍게 달리기 ' };

test('workout form builds the API body with trimmed fields', () => {
  expect(buildWorkoutLog(valid)).toEqual({
    ok: true,
    payload: { sport_category: 'running', duration_minutes: 45, calories_burned: 250, memo: '가볍게 달리기' },
  });
});

test('optional calories and memo can be empty', () => {
  expect(buildWorkoutLog({ ...valid, calories: '', memo: '' })).toEqual({
    ok: true,
    payload: { sport_category: 'running', duration_minutes: 45, calories_burned: 0, memo: '' },
  });
});

test('sport options reuse the coach vocabulary without copying it', () => {
  expect(SPORTS).toBe(coachSports);
  for (const sport of SPORTS) {
    expect(buildWorkoutLog({ ...valid, sport: sport.key }).ok).toBe(true);
    expect(sportLabel(sport.key)).toBe(sport.label);
  }
});

test('invalid minutes cannot become a workout payload', () => {
  for (const minutes of ['', ' ', '0', '-1', '601', '1.5', '1e2', 'NaN', 'Infinity', '육십']) {
    expect(buildWorkoutLog({ ...valid, minutes }).ok).toBe(false);
  }
});

test('invalid calories cannot become a workout payload', () => {
  for (const calories of ['-1', '5001', '1.5', '1e2', 'NaN', 'Infinity', '백']) {
    expect(buildWorkoutLog({ ...valid, calories }).ok).toBe(false);
  }
});

test('unknown sport and overlong memo are rejected', () => {
  expect(buildWorkoutLog({ ...valid, sport: 'swimming' }).ok).toBe(false);
  expect(buildWorkoutLog({ ...valid, memo: '가'.repeat(201) }).ok).toBe(false);
  expect(buildWorkoutLog({ ...valid, memo: '🏃'.repeat(201) }).ok).toBe(false);
});

test('inclusive minute calorie and Unicode memo boundaries are accepted', () => {
  for (const minutes of ['1', '600']) {
    for (const calories of ['0', '5000']) {
      expect(buildWorkoutLog({ ...valid, minutes, calories, memo: '🏃'.repeat(200) }).ok).toBe(true);
    }
  }
});

test('stored workout is formatted with Korean sport and units', () => {
  expect(formatWorkoutSummary({
    id: 'one', user_id: 'member', sport_category: 'gym', workout_type: 'gym',
    duration: 60, calories_burned: 1200, data: null, created_at: '2026-10-29T12:00:00Z',
  })).toBe('헬스 · 60분 · 1,200 kcal');
});

test('workout date uses Korean locale for the device local date', () => {
  const date = new Date(2026, 9, 29, 12).toISOString();
  expect(formatWorkoutDate(date)).toBe('2026년 10월 29일');
});
