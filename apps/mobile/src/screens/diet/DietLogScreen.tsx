import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar, Plus } from 'lucide-react-native';
import { DietLogCard } from '../../components/DietLogCard';
import { Loading } from '../../components/common/Loading';
import { api } from '../../lib/api';
import { DietLog } from '../../types';

type DietLogSection = {
  title: string;
  data: DietLog[];
};

export const DietLogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [dietLogs, setDietLogs] = useState<DietLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDietLogs();
  }, []);

  const fetchDietLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/diet/logs');
      const nextLogs = Array.isArray(data) ? data : data?.items ?? data?.logs;
      setDietLogs(Array.isArray(nextLogs) ? nextLogs : []);
    } catch (error) {
      console.error('식단 기록을 불러오지 못했습니다:', error);
      setDietLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDietLogs();
    setRefreshing(false);
  };

  const sections = useMemo<DietLogSection[]>(() => {
    const grouped = dietLogs.reduce<Record<string, DietLog[]>>((acc, log) => {
      const date = new Date(log.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      acc[date] = acc[date] ? [...acc[date], log] : [log];
      return acc;
    }, {});

    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [dietLogs]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>아직 식단 기록이 없습니다</Text>
      <Text style={styles.emptyDescription}>식단 코치와 대화하며 식사와 AI 메모를 남겨보세요.</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('DietChat')}>
        <Plus size={20} color="#ffffff" />
        <Text style={styles.emptyButtonText}>식단 코치 시작</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return <Loading message="식단 기록을 불러오는 중..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>식단 기록</Text>
        <Text style={styles.subtitle}>식사, 칼로리, 영양소, AI 메모를 확인하세요.</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DietLogCard log={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Calendar size={16} color="#6b7280" />
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        ListEmptyComponent={renderEmptyState}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('DietChat')}>
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  list: {
    padding: 16,
    paddingBottom: 92,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4b5563',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
