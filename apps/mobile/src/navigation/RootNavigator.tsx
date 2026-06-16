import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';

export default function RootNavigator() {
  const { user, isLoading, setUser, setLoading, fetchProfile } = useStore();

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
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    hydrateSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email ?? undefined);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, setLoading, setUser]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user && user.onboarding_completed ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
