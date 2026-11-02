type SortableCoach = {
  readonly full_name?: string | null;
  readonly coach_details: {
    readonly rating?: number | null;
    readonly review_count: number;
  };
};

export const sortCoachesByRating = <T extends SortableCoach>(coaches: readonly T[]): T[] =>
  [...coaches].sort(
    (a, b) =>
      (b.coach_details.rating ?? 0) - (a.coach_details.rating ?? 0) ||
      b.coach_details.review_count - a.coach_details.review_count ||
      (a.full_name ?? '').localeCompare(b.full_name ?? '', 'ko-KR')
  );
