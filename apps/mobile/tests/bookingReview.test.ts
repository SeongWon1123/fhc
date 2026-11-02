import { bookingReview, canReview, reviewPayload } from '../src/lib/bookingManagement';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

const completed = { user_id: 'member', status: 'completed', reviews: null } as const;

test('only the member of a completed, unreviewed booking can review', () => {
  expect(canReview(completed, 'member')).toBe(true);
  expect(canReview(completed, 'coach')).toBe(false);
  expect(canReview({ ...completed, status: 'confirmed' }, 'member')).toBe(false);
  expect(canReview({ ...completed, reviews: [{ id: 'r', rating: 4 }] }, 'member')).toBe(false);
  expect(canReview({ ...completed, reviews: { id: 'r', rating: 4 } }, 'member')).toBe(false);
  expect(canReview({ ...completed, reviews: [] }, 'member')).toBe(true);
});

test('the embedded review is read whether the API returns an object or a list', () => {
  expect(bookingReview({ reviews: [{ id: 'r', rating: 5 }] })).toEqual({ id: 'r', rating: 5 });
  expect(bookingReview({ reviews: { id: 'r', rating: 3 } })).toEqual({ id: 'r', rating: 3 });
  expect(bookingReview({ reviews: undefined })).toBe(null);
});

test('review input is validated before it is sent', () => {
  expect(reviewPayload(5, '  친절해요 ')).toEqual({ ok: true, payload: { rating: 5, content: '친절해요' } });
  expect(reviewPayload(4, '   ')).toEqual({ ok: true, payload: { rating: 4, content: null } });
  expect(reviewPayload(0, '').ok).toBe(false);
  expect(reviewPayload(6, '').ok).toBe(false);
  expect(reviewPayload(5, 'x'.repeat(501)).ok).toBe(false);
});
