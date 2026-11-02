import { SPORTS, sportLabel } from './coachProfile';

export { SPORTS, sportLabel };

export type WorkoutSport = typeof SPORTS[number]['key'];

export type WorkoutLog = {
  readonly id: string;
  readonly user_id: string;
  readonly sport_category: string;
  readonly workout_type: string;
  readonly duration: number;
  readonly calories_burned: number;
  readonly data: { readonly memo?: string | null } | null;
  readonly created_at: string;
};

export type WorkoutForm = {
  readonly sport: string;
  readonly minutes: string;
  readonly calories: string;
  readonly memo: string;
};

export type WorkoutPayload = {
  readonly sport_category: WorkoutSport;
  readonly duration_minutes: number;
  readonly calories_burned: number;
  readonly memo: string;
};

export function buildWorkoutLog(
  form: WorkoutForm,
): { readonly ok: true; readonly payload: WorkoutPayload } | { readonly ok: false; readonly error: string } {
  const sport = SPORTS.find((option) => option.key === form.sport);
  if (!sport) return { ok: false, error: '운동 종목을 선택해주세요.' };
  const minutes = form.minutes.trim();
  const duration = Number(minutes);
  if (!/^\d+$/.test(minutes) || duration < 1 || duration > 600) {
    return { ok: false, error: '운동 시간은 1~600분 사이의 정수로 입력해주세요.' };
  }
  const calories = form.calories.trim();
  const burned = calories === '' ? 0 : Number(calories);
  if ((calories !== '' && !/^\d+$/.test(calories)) || burned < 0 || burned > 5000) {
    return { ok: false, error: '소모 칼로리는 0~5,000kcal 사이의 정수로 입력해주세요.' };
  }
  // Count Unicode code points, as Pydantic does, rather than UTF-16 units.
  if ([...form.memo].length > 200) return { ok: false, error: '메모는 200자 이내로 입력해주세요.' };
  return {
    ok: true,
    payload: {
      sport_category: sport.key,
      duration_minutes: duration,
      calories_burned: burned,
      memo: form.memo.trim(),
    },
  };
}

export const formatWorkoutDate = (createdAt: string): string =>
  new Date(createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

export const formatWorkoutSummary = (log: WorkoutLog): string =>
  `${sportLabel(log.sport_category)} · ${log.duration}분 · ${log.calories_burned.toLocaleString('ko-KR')} kcal`;
