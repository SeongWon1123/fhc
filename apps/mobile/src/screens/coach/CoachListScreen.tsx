import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import { CoachCard } from '../../components/CoachCard';
import { api } from '../../lib/api';
import { sortCoachesByRating } from '../../lib/coachSort';
import { Coach } from '../../types';

const filters = [
  { key: 'all', label: '전체' },
  { key: 'online', label: '온라인' },
  { key: 'offline', label: '오프라인' },
  { key: 'top_rated', label: '평점 높은 순' },
];

export const CoachListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/coaches');
      const nextCoaches = Array.isArray(data) ? data : data?.items ?? data?.coaches;
      setCoaches(Array.isArray(nextCoaches) ? nextCoaches : []);
    } catch (error) {
      console.error('코치 목록을 불러오지 못했습니다:', error);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCoaches();
    setRefreshing(false);
  };

  const filteredCoaches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matchingCoaches = coaches.filter((coach) => {
      const details = coach.coach_details;
      const matchesSearch =
        !query ||
        coach.full_name?.toLowerCase().includes(query) ||
        details.specialty?.some((specialty) => specialty.toLowerCase().includes(query));

      const matchesFilter =
        selectedFilter === 'all' ||
        selectedFilter === 'top_rated' ||
        (selectedFilter === 'online' && details.is_online_available) ||
        (selectedFilter === 'offline' && details.is_offline_available);

      return matchesSearch && matchesFilter;
    });

    return selectedFilter === 'top_rated' ? sortCoachesByRating(matchingCoaches) : matchingCoaches;
  }, [coaches, searchQuery, selectedFilter]);

  const handleCoachPress = (coach: Coach) => {
    navigation.navigate('CoachDetail', { coach_id: coach.id, coach });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>코치 찾기</Text>
        <Text style={styles.subtitle}>운동, 식단, 회복을 함께 도와줄 코치를 예약하세요.</Text>
      </View>

      <View style={styles.searchBar}>
        <Search size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="이름 또는 전문 분야 검색"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedFilter === filter.key }}
            style={[styles.filterChip, selectedFilter === filter.key && styles.selectedFilterChip]}
            onPress={() => setSelectedFilter(filter.key)}
          >
            <Text style={[styles.filterText, selectedFilter === filter.key && styles.selectedFilterText]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filteredCoaches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CoachCard coach={item} onPress={handleCoachPress} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>검색 조건에 맞는 코치가 없습니다.</Text>
            </View>
          }
        />
      )}
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
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
    maxHeight: 44,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedFilterChip: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  selectedFilterText: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
