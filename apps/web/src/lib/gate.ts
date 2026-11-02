/**
 * The operator console's access rule, isolated from React so it can be tested
 * without a DOM. App.tsx renders exactly one of these outcomes.
 */
export type AccessState = 'checking' | 'allowed' | 'denied' | 'failed' | 'unauthenticated';
export type GateDecision = 'loading' | 'unconfigured' | 'unauthenticated' | 'authenticated' | 'denied' | 'failed';

export function decideGate(state: {
  loading: boolean;
  unconfigured: boolean;
  hasSession: boolean;
  access?: AccessState;
}): GateDecision {
  if (state.loading) return 'loading';
  // Missing Supabase env vars must be surfaced, not silently treated as
  // "logged out": the operator needs to know auth cannot work at all.
  if (state.unconfigured) return 'unconfigured';
  if (!state.hasSession) return 'unauthenticated';
  switch (state.access) {
    case 'allowed': return 'authenticated';
    case 'denied': return 'denied';
    case 'failed': return 'failed';
    case 'unauthenticated': return 'unauthenticated';
    default: return 'loading';
  }
}
