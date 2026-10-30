import { sortCoachesByRating } from '../src/lib/coachSort';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

const coach = (full_name: string, rating: number | null | undefined, review_count = 0) => ({
  full_name,
  coach_details: { rating, review_count },
});

test('coaches are ordered by descending rating', () => {
  const coaches = [coach('김코치', 4.5, 100), coach('이코치', 5), coach('박코치', 4.8)];

  const sorted = sortCoachesByRating(coaches);

  expect(sorted.map((item) => item.coach_details.rating)).toEqual([5, 4.8, 4.5]);
});

test('equal ratings are ordered by descending review count', () => {
  const coaches = [coach('김코치', 4.8, 2), coach('박코치', 4.8, 20), coach('이코치', 4.8, 8)];

  const sorted = sortCoachesByRating(coaches);

  expect(sorted.map((item) => item.coach_details.review_count)).toEqual([20, 8, 2]);
});

test('equal ratings and review counts are ordered by Korean name', () => {
  const coaches = [coach('이코치', 4.8, 10), coach('박코치', 4.8, 10), coach('김코치', 4.8, 10)];

  const sorted = sortCoachesByRating(coaches);

  expect(sorted.map((item) => item.full_name)).toEqual(['김코치', '박코치', '이코치']);
});

test('null and undefined ratings come after positive ratings', () => {
  const coaches = [coach('김코치', null), coach('박코치', undefined), coach('이코치', 0.1)];

  const sorted = sortCoachesByRating(coaches);

  expect(sorted.map((item) => item.full_name)).toEqual(['이코치', '김코치', '박코치']);
});

test('missing ratings are treated as zero for tie breaking', () => {
  const coaches = [coach('김코치', 0, 1), coach('박코치', undefined, 3), coach('이코치', null, 2)];

  const sorted = sortCoachesByRating(coaches);

  expect(sorted.map((item) => item.full_name)).toEqual(['박코치', '이코치', '김코치']);
});

test('sorting does not mutate the input array or coach objects', () => {
  const low = Object.freeze(coach('김코치', 2));
  const high = Object.freeze(coach('이코치', 5));
  Object.freeze(low.coach_details);
  Object.freeze(high.coach_details);
  const coaches = Object.freeze([low, high]);

  const sorted = sortCoachesByRating(coaches);

  expect(coaches).toEqual([low, high]);
  expect(sorted).toEqual([high, low]);
  expect(sorted === coaches).toBe(false);
  expect(sorted[0]).toBe(high);
  expect(sorted[1]).toBe(low);
});

test('low-rated coaches are retained', () => {
  const coaches = [coach('김코치', 1), coach('박코치', 4.6), coach('이코치', 4.9)];

  const sorted = sortCoachesByRating(coaches);

  expect(sorted.length).toBe(coaches.length);
  expect(sorted.map((item) => item.coach_details.rating)).toEqual([4.9, 4.6, 1]);
});
