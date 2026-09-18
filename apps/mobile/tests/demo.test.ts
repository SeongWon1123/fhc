import { demoModeFrom, DEMO_USER } from '../src/lib/demo';

/**
 * Bun injects `test`/`expect` as Jest-compatible globals into test files, so no
 * runtime import is needed. They are declared locally on purpose: this repo has
 * no bun-types dependency (adding one is out of scope for the demo guard) while
 * `tsc --noEmit` still type-checks this file.
 */
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
  toMatch(pattern: RegExp): void;
};

test('demoModeFrom only accepts the exact string "true"', () => {
  expect(demoModeFrom('true')).toBe(true);
  expect(demoModeFrom(undefined)).toBe(false);
  expect(demoModeFrom('false')).toBe(false);
  expect(demoModeFrom('TRUE')).toBe(false);
});

test('DEMO_USER carries the fields RootNavigator and the store read', () => {
  expect(DEMO_USER.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(DEMO_USER.email).toMatch(/@/);
  expect(DEMO_USER.role).toBe('user');
  expect(DEMO_USER.onboarding_completed).toBe(true);
  expect(DEMO_USER.user_metadata.onboarding_completed).toBe(true);
});
