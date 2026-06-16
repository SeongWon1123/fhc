import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Dumbbell, Shirt, TrendingUp, Utensils } from 'lucide-react-native';
import { CoachCard } from '../../components/CoachCard';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store';
import { Coach } from '../../types';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useStore();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecommendedCoaches();
  }, []);

  const fetchRecommendedCoaches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/coaches/recommended');
      const nextCoaches = Array.isArray(data) ? data : data?.items ?? data?.coaches;
      setCoaches(Array.isArray(nextCoaches) ? nextCoaches.slice(0, 2) : []);
    } catch (error) {
      console.error('추천 코치를 불러오지 못했습니다:', error);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCoachPress = (coach: Coach) => {
    navigation.navigate('Coaches', {
      screen: 'CoachDetail',
      params: { coach_id: coach.id, coach },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>안녕하세요, {user?.full_name || '회원님'}</Text>
          <Text style={styles.subGreeting}>오늘의 코칭, 식단, 운동 의류 계획을 확인하세요.</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <TrendingUp size={20} color="#2563eb" />
            <Text style={styles.cardTitle}>오늘</Text>
          </View>
          <View style={styles.workoutSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>1</Text>
              <Text style={styles.summaryLabel}>예약</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>2</Text>
              <Text style={styles.summaryLabel}>식사</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>82%</Text>
              <Text style={styles.summaryLabel}>계획 적합도</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Diet', { screen: 'DietChat' })}
          >
            <Text style={styles.primaryButtonText}>식단 코치에게 묻기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Dumbbell size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>추천 코치</Text>
          </View>
          {loading ? (
            <ActivityIndicator color="#2563eb" style={styles.loading} />
          ) : coaches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>아직 표시할 승인 코치가 없습니다.</Text>
            </View>
          ) : (
            coaches.map((coach) => <CoachCard key={coach.id} coach={coach} onPress={handleCoachPress} />)
          )}
        </View>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Diet', { screen: 'DietLog' })}>
            <Utensils size={22} color="#2563eb" />
            <Text style={styles.actionTitle}>식단 기록</Text>
            <Text style={styles.actionText}>식사와 영양 균형을 확인하세요.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Clothing')}>
            <Shirt size={22} color="#2563eb" />
            <Text style={styles.actionTitle}>운동 의류</Text>
            <Text style={styles.actionText}>운동 스타일별 의류를 확인하세요.</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  content: {
    padding: 16,
  },
  header: {
    paddingVertical: 18,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subGreeting: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 5,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 8,
  },
  workoutSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563eb',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 8,
  },
  loading: {
    paddingVertical: 20,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    padding: 16,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    minHeight: 136,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  actionTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  actionText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
});
