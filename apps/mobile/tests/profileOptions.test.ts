import { fitnessGoals, sports, validateProfileInput } from '../src/lib/profileOptions';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe(expected: unknown): void;
};

const valid = {
  full_name: ' 김회원 ',
  phone: '010-1234-5678',
  fitness_goal: 'maintenance',
  preferred_sports: ['gym'],
};

test('valid profile input passes validation', () => {
  expect(validateProfileInput(valid)).toBe(null);
});

test('names that impersonate the service or operators are rejected', () => {
  for (const full_name of ['FitConnect 운영팀', '핏커넥트', '관리자 김', 'ADMIN', '공식 코치']) {
    expect(typeof validateProfileInput({ ...valid, full_name })).toBe('string');
  }
});

test('blank and oversized trimmed names are rejected', () => {
  for (const full_name of ['', ' \n\t ', '가'.repeat(31)]) {
    expect(typeof validateProfileInput({ ...valid, full_name })).toBe('string');
  }
});

test('name length boundaries are measured after trimming', () => {
  for (const full_name of [' 가 ', ` ${'가'.repeat(30)} `]) {
    expect(validateProfileInput({ ...valid, full_name })).toBe(null);
  }
});

test('optional phone and Korean mobile and landline formats are accepted', () => {
  for (const phone of [undefined, '', '01012345678', '011-123-4567', '02-123-4567',
    '02-1234-5678', '0311234567', '061-123-4567', '070-1234-5678']) {
    expect(validateProfileInput({ ...valid, phone })).toBe(null);
  }
});

test('invalid and oversized phone numbers are rejected', () => {
  for (const phone of ['1234', '010-1234-567', '010--1234-5678', 'abc', '+82-10-1234-5678',
    '999-1234-5678', '010 1234 5678', '1'.repeat(21)]) {
    expect(typeof validateProfileInput({ ...valid, phone })).toBe('string');
  }
});

test('every known fitness goal is accepted', () => {
  for (const goal of fitnessGoals) {
    expect(validateProfileInput({ ...valid, fitness_goal: goal.key })).toBe(null);
  }
});

test('empty and unknown fitness goals are rejected', () => {
  for (const fitness_goal of ['', 'unknown']) {
    expect(typeof validateProfileInput({ ...valid, fitness_goal })).toBe('string');
  }
});

test('one through five known sports are accepted', () => {
  for (let count = 1; count <= 5; count += 1) {
    const preferred_sports = sports.slice(0, count).map((sport) => sport.key);
    expect(validateProfileInput({ ...valid, preferred_sports })).toBe(null);
  }
});

test('empty, unknown, and six sports are rejected', () => {
  for (const preferred_sports of [[], ['unknown'], ['gym', 'unknown'],
    ['gym', 'running', 'pilates', 'yoga', 'crossfit', 'gym']]) {
    expect(typeof validateProfileInput({ ...valid, preferred_sports })).toBe('string');
  }
});
