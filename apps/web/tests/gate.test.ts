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
    // It also wins over a session that still exists on the client (e.g. stale
    // credentials in localStorage): auth cannot be validated without config.
    expect(decideGate({ loading: false, unconfigured: true, hasSession: true })).toBe('unconfigured');
  });

  test('requires a session once auth is configured', () => {
    expect(decideGate({ loading: false, unconfigured: false, hasSession: false })).toBe(
      'unauthenticated',
    );
  });

  test('does not admit a session before server verification', () => {
    expect(decideGate({ loading: false, unconfigured: false, hasSession: true })).toBe('loading');
  });

  test('admits a server authorized operator', () => {
    expect(decideGate({ loading: false, unconfigured: false, hasSession: true, access: 'allowed' })).toBe(
      'authenticated',
    );
  });

  test.each(['denied', 'failed', 'unauthenticated'] as const)('blocks server access outcome %s', (access) => {
    expect(decideGate({ loading: false, unconfigured: false, hasSession: true, access })).toBe(access);
  });

  test('discards operator authorization when the session ends', () => {
    expect(decideGate({ loading: false, unconfigured: false, hasSession: false, access: 'allowed' })).toBe('unauthenticated');
  });

  test('configuration failure overrides previously authorized access', () => {
    expect(decideGate({ loading: false, unconfigured: true, hasSession: true, access: 'allowed' })).toBe('unconfigured');
  });
});
