import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import { useStore } from '../lib/store';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  const { user } = useStore();

  return (
    <Stack.Navigator initialRouteName={user ? 'Onboarding' : 'Login'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}
