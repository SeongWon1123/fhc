import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { consumeAuthLink, type AuthLinkKind } from '../lib/authLinking';
import { useStore } from '../lib/store';
import { DEMO_USER, IS_DEMO } from '../lib/demo';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootNavigator() {
  const { user, isLoading, setUser, setLoading, fetchProfile } = useStore();
  const [authFlow, setAuthFlow] = useState<AuthLinkKind | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const handleIncomingUrl = useCallback(async (url: string) => {
    try {
      const result = await consumeAuthLink(url);
      if (!result) return;
      setAuthMessage(null);
      setAuthFlow(result.kind);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '인증 링크를 처리할 수 없습니다. 새 링크를 요청한 뒤 다시 시도해주세요.';
      setAuthFlow(null);
      setAuthMessage(message);
    }
  }, []);

  useEffect(() => {
    if (IS_DEMO) {
      // Demo builds never touch Supabase auth: no session read, no auth-event
      // subscription. Seed the fixed user and end the loading state instead.
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const hydrateSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email ?? undefined);
        } else {
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void hydrateSession();
    void Linking.getInitialURL().then((url) => {
      if (url) void handleIncomingUrl(url);
    });

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        // Return synchronously: profile requests also need the Auth lock.
        // Awaiting them from this callback deadlocks session hydration.
        void (async () => {
          if (event === 'TOKEN_REFRESHED') return;
          setLoading(true);
          if (session?.user) {
            await fetchProfile(session.user.id, session.user.email ?? undefined);
          } else {
            if (event === 'SIGNED_OUT') setAuthFlow(null);
            setUser(null);
          }
          if (isMounted) setLoading(false);
        })();
      }
    );

    return () => {
      isMounted = false;
      linkSubscription.remove();
      subscription.unsubscribe();
    };
  }, [fetchProfile, handleIncomingUrl, setLoading, setUser]);

  useEffect(() => {
    // Demo logout is a no-op: re-seed the fixed user so the app body never
    // falls back to the login screen.
    if (IS_DEMO && !user) setUser(DEMO_USER);
  }, [setUser, user]);

  if (isLoading && !IS_DEMO) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  const forceRecovery = authFlow === 'recovery';
  const showAuth = !IS_DEMO && (forceRecovery || !user || !user.onboarding_completed);
  return (
    <SafeAreaProvider>
    <NavigationContainer>
      {showAuth ? (
        <AuthNavigator
          key={forceRecovery ? 'recovery' : user ? 'onboarding' : 'login'}
          forceRecovery={forceRecovery}
          authMessage={authMessage}
          onDismissAuthMessage={() => setAuthMessage(null)}
        />
      ) : (
        <MainTabNavigator key={user?.id} />
      )}
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
