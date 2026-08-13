import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { consumeAuthLink, type AuthLinkKind } from '../lib/authLinking';
import { useStore } from '../lib/store';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';

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
      async (event, session) => {
        if (!isMounted) return;
        setLoading(true);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email ?? undefined);
        } else {
          if (event === 'SIGNED_OUT') setAuthFlow(null);
          setUser(null);
        }
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      linkSubscription.remove();
      subscription.unsubscribe();
    };
  }, [fetchProfile, handleIncomingUrl, setLoading, setUser]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  const forceRecovery = authFlow === 'recovery';
  return (
    <NavigationContainer>
      {forceRecovery || !user || !user.onboarding_completed ? (
        <AuthNavigator
          key={forceRecovery ? 'recovery' : user ? 'onboarding' : 'login'}
          forceRecovery={forceRecovery}
          authMessage={authMessage}
          onDismissAuthMessage={() => setAuthMessage(null)}
        />
      ) : (
        <MainTabNavigator />
      )}
    </NavigationContainer>
  );
}
