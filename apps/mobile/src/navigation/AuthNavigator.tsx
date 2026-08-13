import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { useStore } from '../lib/store';

type AuthStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  ResetPassword: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  forceRecovery?: boolean;
  authMessage?: string | null;
  onDismissAuthMessage?: () => void;
}

export default function AuthNavigator({
  forceRecovery = false,
  authMessage = null,
  onDismissAuthMessage,
}: AuthNavigatorProps) {
  const { user } = useStore();
  const initialRouteName = forceRecovery ? 'ResetPassword' : user ? 'Onboarding' : 'Login';

  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => (
          <LoginScreen
            {...props}
            authMessage={authMessage}
            onDismissAuthMessage={onDismissAuthMessage}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
