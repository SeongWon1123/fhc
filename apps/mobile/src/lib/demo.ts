/**
 * Demo-mode guard for the browser showcase build.
 *
 * Pure on purpose: this module reads only `process.env` and imports nothing, so
 * it can be consumed by the app, by `bun test`, and by the static web export
 * without pulling in react-native or Supabase.
 */
export const demoModeFrom = (flag: string | undefined): boolean => flag === 'true';

export const IS_DEMO = demoModeFrom(process.env.EXPO_PUBLIC_DEMO_MODE);

/**
 * Fixed stand-in for the Supabase session user, used when IS_DEMO is true.
 *
 * `role` and `onboarding_completed` are the fields already read by
 * OnboardingScreen/RootNavigator and required by the store's `User` shape;
 * `user_metadata` mirrors the Supabase user shape.
 */
export const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'demo@fitconnect.local',
  role: 'user',
  onboarding_completed: true,
  user_metadata: {
    onboarding_completed: true,
  },
} as const;
