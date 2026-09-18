import { describe, expect, test } from 'bun:test';
import { decideGate } from '../src/lib/gate';

describe('operator console access rule', () => {
  test('shows a loading state until the session lookup settles', () => {
    expect(decideGate({ loading: true, unconfigured: false, hasSession: false })).toBe('loading');
    // Even with a session already present, an unsettled lookup must not flash
    // the console before auth has been confirmed.
    expect(decideGate({ loading: true, unconfigured: false, hasSession: true })).toBe('loading');
  });

  test('reports missing Supabase configuration instead of a bare login form', () => {
    // `unconfigured` wins over an absent session: telling the operator to log in
    // would be misleading when no auth backend exists.
    expect(decideGate({ loading: false, unconfigured: true, hasSession: false })).toBe('unconfigured');
  });

  test('requires a session once auth is configured', () => {
    expect(decideGate({ loading: false, unconfigured: false, hasSession: false })).toBe(
      'unauthenticated',
    );
  });

  test('admits an authenticated operator', () => {
    expect(decideGate({ loading: false, unconfigured: false, hasSession: true })).toBe(
      'authenticated',
    );
  });
});
