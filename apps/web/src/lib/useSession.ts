import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabaseClient';

type SessionState = {
  /** true until the initial session lookup settles */
  loading: boolean;
  session: Session | null;
  /**
   * Supabase env vars are absent; the console stays blocked.
   */
  unconfigured: boolean;
};

/**
 * Subscribes to Supabase auth state before resolving the initial session, so a
 * sign-in that lands during the lookup is never missed.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: isSupabaseConfigured,
    session: null,
    unconfigured: !isSupabaseConfigured,
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let active = true;
    let settled = false;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      settled = true;
      setState({ loading: false, session, unconfigured: false });
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        // A sign-in event already won the race; keep its newer value.
        if (!active || settled) return;
        setState({ loading: false, session, unconfigured: false });
      })
      .catch(() => {
        if (!active || settled) return;
        setState({ loading: false, session: null, unconfigured: false });
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
