import React from 'react';
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

const Tab = createBottomTabNavigator();
const CoachStack = createStackNavigator();
const DietStack = createStackNavigator();

function CoachStackNavigator() {
  return (
    <CoachStack.Navigator>
      <CoachStack.Screen name="CoachList" component={CoachListScreen} options={{ headerShown: false }} />
      <CoachStack.Screen name="CoachDetail" component={CoachDetailScreen} options={{ title: '코치 프로필' }} />
      <CoachStack.Screen name="Booking" component={BookingScreen} options={{ title: '예약하기' }} />
      <CoachStack.Screen name="BookingList" component={BookingListScreen} options={{ title: '내 예약' }} />
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
    Diet: Utensils,
    Clothing: Shirt,
    Profile: User,
  };
  const Icon = icons[routeName] ?? CalendarCheck;
  return <Icon size={focused ? 24 : 21} color={color} />;
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
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
      <Tab.Screen name="Diet" component={DietStackNavigator} options={{ tabBarLabel: '식단' }} />
      <Tab.Screen name="Clothing" component={ClothingScreen} options={{ tabBarLabel: '의류' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '내 정보' }} />
    </Tab.Navigator>
  );
}
