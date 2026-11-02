import type { WeeklyAvailability } from '../types';

export const WEEKDAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
] as const;

export const HOUR_OPTIONS = Array.from({ length: 17 }, (_, hour) =>
  `${String(hour + 6).padStart(2, '0')}:00`);

const defaultSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

export const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailability = WEEKDAYS.reduce<WeeklyAvailability>(
  (availability, day) => ({ ...availability, [day.key]: [...defaultSlots] }),
  {},
);

export function availableSlots(
  availability: WeeklyAvailability | null | undefined,
  date: string,
): string[] {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAYS[(new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7];
  if (!weekday) return [];
  return [...((availability ?? DEFAULT_WEEKLY_AVAILABILITY)[weekday.key] ?? [])].sort();
}

export const SPORTS = [
  { key: 'gym', label: '헬스' },
  { key: 'running', label: '러닝' },
  { key: 'pilates', label: '필라테스' },
  { key: 'yoga', label: '요가' },
  { key: 'crossfit', label: '크로스핏' },
] as const;

export const sportLabel = (key: string): string =>
  SPORTS.find((sport) => sport.key === key)?.label ?? key;

export type CoachApplicationStatus = 'none' | 'pending' | 'approved';

export function applicationStatus(role: string, details: unknown): CoachApplicationStatus {
  if (role === 'coach') return 'approved';
  return details ? 'pending' : 'none';
}

export type CoachProfileForm = {
  readonly name: string;
  readonly specialty: readonly string[];
  readonly basePrice: string;
  readonly experienceYears: string;
  readonly location: string;
  readonly biography: string;
  readonly qualifications: string;
  readonly isOnline: boolean;
  readonly isOffline: boolean;
  readonly weeklyAvailability: WeeklyAvailability;
};

export type CoachProfilePayload = {
  readonly name: string;
  readonly specialty: string[];
  readonly base_price: number;
  readonly experience_years: number;
  readonly location: string;
  readonly biography: string;
  readonly qualifications: string[];
  readonly is_online_available: boolean;
  readonly is_offline_available: boolean;
  readonly weekly_availability: WeeklyAvailability;
};

type StoredDetails = {
  readonly name?: string | null;
  readonly specialty?: readonly string[] | null;
  readonly base_price?: number | null;
  readonly experience_years?: number | null;
  readonly location?: string | null;
  readonly biography?: string | null;
  readonly qualifications?: readonly string[] | null;
  readonly is_online_available?: boolean | null;
  readonly is_offline_available?: boolean | null;
  readonly weekly_availability?: WeeklyAvailability | null;
};

export function formFromDetails(details: StoredDetails | null, fallbackName: string): CoachProfileForm {
  return {
    name: details?.name ?? fallbackName,
    specialty: details?.specialty ?? [],
    basePrice: details?.base_price != null ? String(details.base_price) : '',
    experienceYears: details?.experience_years != null ? String(details.experience_years) : '',
    location: details?.location ?? '',
    biography: details?.biography ?? '',
    qualifications: (details?.qualifications ?? []).join('\n'),
    isOnline: details?.is_online_available ?? true,
    isOffline: details?.is_offline_available ?? true,
    weeklyAvailability: WEEKDAYS.reduce<WeeklyAvailability>(
      (availability, day) => ({
        ...availability,
        [day.key]: [...((details?.weekly_availability ?? DEFAULT_WEEKLY_AVAILABILITY)[day.key] ?? [])],
      }),
      {},
    ),
  };
}

const wholeNumber = (value: string, max: number): number | null => {
  const trimmed = value.replace(/,/g, '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed <= max ? parsed : null;
};

export function buildCoachProfile(
  form: CoachProfileForm,
): { readonly ok: true; readonly payload: CoachProfilePayload } | { readonly ok: false; readonly error: string } {
  const name = form.name.trim();
  if (!name || name.length > 50) return { ok: false, error: '코치 이름을 50자 이내로 입력해주세요.' };
  if (form.specialty.length === 0 || form.specialty.length > 5) {
    return { ok: false, error: '전문 분야를 1~5개 선택해주세요.' };
  }
  const basePrice = wholeNumber(form.basePrice, 1_000_000);
  if (basePrice === null) return { ok: false, error: '세션 가격을 1,000,000원 이하의 숫자로 입력해주세요.' };
  const experienceYears = wholeNumber(form.experienceYears, 60);
  if (experienceYears === null) return { ok: false, error: '경력을 0~60년 사이 숫자로 입력해주세요.' };
  if (!form.isOnline && !form.isOffline) {
    return { ok: false, error: '온라인 또는 오프라인 중 하나 이상 선택해주세요.' };
  }
  if (WEEKDAYS.every((day) => !form.weeklyAvailability[day.key]?.length)) {
    return { ok: false, error: '예약 가능한 시간을 하나 이상 선택해주세요.' };
  }
  const location = form.location.trim();
  if (location.length > 100) return { ok: false, error: '지역은 100자 이내로 입력해주세요.' };
  const biography = form.biography.trim();
  if (biography.length > 1000) return { ok: false, error: '소개는 1,000자 이내로 입력해주세요.' };
  const qualifications = form.qualifications.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  if (qualifications.length > 10) return { ok: false, error: '자격 및 이력은 10개까지 입력할 수 있습니다.' };

  return {
    ok: true,
    payload: {
      name,
      specialty: [...form.specialty],
      base_price: basePrice,
      experience_years: experienceYears,
      location,
      biography,
      qualifications,
      is_online_available: form.isOnline,
      is_offline_available: form.isOffline,
      weekly_availability: WEEKDAYS.reduce<WeeklyAvailability>(
        (availability, day) => ({
          ...availability,
          [day.key]: [...(form.weeklyAvailability[day.key] ?? [])].sort(),
        }),
        {},
      ),
    },
  };
}
