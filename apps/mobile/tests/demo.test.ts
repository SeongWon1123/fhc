import { IS_DEMO, demoModeFrom, DEMO_USER } from '../src/lib/demo';

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

test('IS_DEMO mirrors EXPO_PUBLIC_DEMO_MODE through the same predicate', () => {
  expect(IS_DEMO).toBe(demoModeFrom(process.env.EXPO_PUBLIC_DEMO_MODE));
});

test('DEMO_USER is shaped like the supabase user RootNavigator reads', () => {
  expect(DEMO_USER.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(DEMO_USER.user_metadata.onboarding_completed).toBe(true);
});
