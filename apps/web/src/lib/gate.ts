/**
 * The operator console's access rule, isolated from React so it can be tested
 * without a DOM. App.tsx renders exactly one of these outcomes.
 */
export type GateDecision = 'loading' | 'unconfigured' | 'unauthenticated' | 'authenticated';

export function decideGate(state: {
  loading: boolean;
  unconfigured: boolean;
  hasSession: boolean;
}): GateDecision {
  if (state.loading) return 'loading';
  // Missing Supabase env vars must be surfaced, not silently treated as
  // "logged out": the operator needs to know auth cannot work at all.
  if (state.unconfigured) return 'unconfigured';
  return state.hasSession ? 'authenticated' : 'unauthenticated';
}
