import React from 'react';
import { SafeAreaInsetsContext, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { CalendarCheck, Dumbbell, Home, Shirt, Utensils, User } from 'lucide-react-native';
import { HomeScreen } from '../screens/home/HomeScreen';
import { CoachListScreen } from '../screens/coach/CoachListScreen';
import { CoachDetailScreen } from '../screens/coach/CoachDetailScreen';
import { BookingScreen } from '../screens/booking/BookingScreen';
import { BookingListScreen } from '../screens/booking/BookingListScreen';
import { DietChatScreen } from '../screens/diet/DietChatScreen';
import { DietLogScreen } from '../screens/diet/DietLogScreen';
import { ClothingScreen } from '../screens/clothing/ClothingScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CoachProfileScreen } from '../screens/profile/CoachProfileScreen';
import { WorkoutLogScreen } from '../screens/workout/WorkoutLogScreen';
import { ProfileEditScreen } from '../screens/profile/ProfileEditScreen';
import { AccountDeleteScreen } from '../screens/profile/AccountDeleteScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { BookingRealtimeBanner } from '../components/BookingRealtimeBanner';
import { useStore } from '../lib/store';

const Tab = createBottomTabNavigator();
const CoachStack = createStackNavigator();
const DietStack = createStackNavigator();
const ProfileStack = createStackNavigator();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} options={{ headerShown: false, title: '내 정보' }} />
      <ProfileStack.Screen name="CoachProfile" component={CoachProfileScreen} options={{ title: '코치 프로필' }} />
      <ProfileStack.Screen name="WorkoutLog" component={WorkoutLogScreen} options={{ title: '운동 기록' }} />
      <ProfileStack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: '프로필 수정' }} />
      <ProfileStack.Screen name="AccountDelete" component={AccountDeleteScreen} options={{ title: '계정 삭제' }} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: '알림' }} />
    </ProfileStack.Navigator>
  );
}

function CoachStackNavigator() {
  return (
    <CoachStack.Navigator>
      <CoachStack.Screen name="CoachList" component={CoachListScreen} options={{ headerShown: false }} />
      <CoachStack.Screen name="CoachDetail" component={CoachDetailScreen} options={{ title: '코치 프로필' }} />
      <CoachStack.Screen name="Booking" component={BookingScreen} options={{ title: '예약하기' }} />
    </CoachStack.Navigator>
  );
}

function DietStackNavigator() {
  return (
    <DietStack.Navigator>
      <DietStack.Screen name="DietChat" component={DietChatScreen} options={{ headerShown: false }} />
      <DietStack.Screen name="DietLog" component={DietLogScreen} options={{ title: '식단 기록' }} />
    </DietStack.Navigator>
  );
}

function TabIcon({ routeName, color, focused }: { routeName: string; color: string; focused: boolean }) {
  const icons: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
    Home,
    Coaches: Dumbbell,
    Bookings: CalendarCheck,
    Diet: Utensils,
    Clothing: Shirt,
    Profile: User,
  };
  const Icon = icons[routeName] ?? CalendarCheck;
  return <Icon size={focused ? 24 : 21} color={color} />;
}

export default function MainTabNavigator() {
  const isCoach = useStore((state) => state.user?.role === 'coach');
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
    {/* The shell owns the top inset, even when the live banner is hidden.
        Nested screens/headers must not reserve the status-bar space again. */}
    <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
    <BookingRealtimeBanner />
    <Tab.Navigator
      initialRouteName={isCoach ? 'Bookings' : 'Home'}
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({ color, focused }) => (
          <TabIcon routeName={route.name} color={color} focused={focused} />
        ),
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '홈' }} />
      <Tab.Screen name="Coaches" component={CoachStackNavigator} options={{ tabBarLabel: '코치' }} />
      <Tab.Screen name="Bookings" component={BookingListScreen} options={{ tabBarLabel: '예약' }} />
      <Tab.Screen name="Diet" component={DietStackNavigator} options={{ tabBarLabel: '식단' }} />
      <Tab.Screen name="Clothing" component={ClothingScreen} options={{ tabBarLabel: '의류' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ tabBarLabel: '내 정보' }} />
    </Tab.Navigator>
    </SafeAreaInsetsContext.Provider>
    </SafeAreaView>
  );
}
