import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BookOpen, Calendar, ChevronRight, HelpCircle, LogOut, Shield, User as UserIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Button } from '../../components/common/Button';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

type Stats = {
  workouts: number;
  dietLogs: number;
  bookings: number;
};

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, signOut } = useStore();
  const [stats, setStats] = useState<Stats>({
    workouts: 0,
    dietLogs: 0,
    bookings: 0,
  });

  useEffect(() => {
    fetchUserStats();
  }, [user?.id]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      const [bookingsResponse, dietLogsResponse] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('diet_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setStats({
        workouts: 0,
        dietLogs: dietLogsResponse.count ?? 0,
        bookings: bookingsResponse.count ?? 0,
      });
    } catch (error) {
      console.error('사용자 통계를 불러오지 못했습니다:', error);
    }
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '핏커넥트에서 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        onPress: () => signOut(),
        style: 'destructive',
      },
    ]);
  };

  const menuItems = [
    {
      icon: Calendar,
      title: '내 예약',
      subtitle: '예정된 코치 세션 확인',
      onPress: () => navigation.navigate('Coaches', { screen: 'BookingList' }),
    },
    {
      icon: BookOpen,
      title: '식단 기록',
      subtitle: '식사와 AI 메모 확인',
      onPress: () => navigation.navigate('Diet', { screen: 'DietLog' }),
    },
    {
      icon: Shield,
      title: '개인정보 및 데이터',
      subtitle: '예약과 식단 기록에 저장되는 데이터 확인',
      onPress: () =>
        Alert.alert(
          '개인정보 및 데이터',
          '핏커넥트는 서비스 제공을 위해 프로필, 예약, 식단 기록, 선택한 식사 이미지 데이터만 저장합니다. 데이터 삭제 요청은 지원 문의로 처리합니다.'
        ),
    },
    {
      icon: HelpCircle,
      title: '지원 문의',
      subtitle: '계정, 예약, 데이터 요청 도움 받기',
      onPress: () => Alert.alert('지원 문의', 'MVP 파일럿 기간에는 핏커넥트 운영팀 문의 채널로 연락해주세요.'),
    },
  ];

  const roleLabel =
    user?.role === 'coach' ? '코치' : user?.role === 'admin' ? '관리자' : user?.role === 'gym_owner' ? '센터 관리자' : '회원';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <UserIcon size={34} color="#2563eb" />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.full_name || '핏커넥트 회원'}</Text>
            <Text style={styles.email}>{user?.email || '등록된 이메일 없음'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.workouts}</Text>
            <Text style={styles.statLabel}>운동</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.dietLogs}</Text>
            <Text style={styles.statLabel}>식단</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.bookings}</Text>
            <Text style={styles.statLabel}>예약</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>계정</Text>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity key={item.title} style={styles.menuItem} onPress={item.onPress}>
                <View style={styles.menuItemLeft}>
                  <Icon size={23} color="#6b7280" />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>{item.title}</Text>
                    <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#d1d5db" />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.logoutSection}>
          <Button
            title="로그아웃"
            onPress={handleSignOut}
            variant="outline"
            fullWidth
            icon={<LogOut size={20} color="#dc2626" />}
            textStyle={styles.logoutText}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 56,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  avatarFallback: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f3f4f6',
  },
  menuSection: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 16,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 18,
  },
  logoutSection: {
    margin: 16,
    marginTop: 28,
    marginBottom: 36,
  },
  logoutText: {
    color: '#dc2626',
  },
});
