export const fitnessGoals = [
  { key: 'weight_loss', label: '체중 감량' },
  { key: 'muscle_gain', label: '근육 증가' },
  { key: 'maintenance', label: '건강 유지' },
  { key: 'endurance', label: '지구력 향상' },
] as const;

export const sports = [
  { key: 'gym', label: '헬스' },
  { key: 'running', label: '러닝' },
  { key: 'pilates', label: '필라테스' },
  { key: 'yoga', label: '요가' },
  { key: 'crossfit', label: '크로스핏' },
] as const;

// Mirrors the database trigger in infra/supabase/init.sql (protect_profile_assignment).
const RESERVED_NAME = /(운영|관리자|핏커넥트|fitconnect|admin|official|공식)/i;

export const validateProfileInput = (input: {
  readonly full_name: string;
  readonly phone?: string;
  readonly fitness_goal: string;
  readonly preferred_sports: readonly string[];
}): string | null => {
  const name = input.full_name.trim();
  if (name.length < 1 || name.length > 30) {
    return '이름은 1~30자로 입력해주세요.';
  }
  if (RESERVED_NAME.test(name)) {
    return '운영팀이나 서비스로 오해될 수 있는 이름은 사용할 수 없습니다.';
  }

  const phone = input.phone ?? '';
  if (phone.length > 20 || (phone !== '' &&
    !/^(?:01[016789]|02|0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4])|070)-?\d{3,4}-?\d{4}$/.test(phone))) {
    return '전화번호는 20자 이내의 올바른 국내 전화번호로 입력해주세요.';
  }

  if (!fitnessGoals.some((goal) => goal.key === input.fitness_goal)) {
    return '운동 목표를 선택해주세요.';
  }

  if (input.preferred_sports.length < 1 || input.preferred_sports.length > 5 ||
    input.preferred_sports.some((key) => !sports.some((sport) => sport.key === key))) {
    return '선호 운동은 목록에서 1~5개 선택해주세요.';
  }

  return null;
};
