import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Coach } from '../types';
import { CoachCard } from '../components/CoachCard';

export const CoachListScreen: React.FC = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          coach_details (*)
        `)
        .eq('role', 'coach');

      if (error) throw error;
      setCoaches(data as any[]);
    } catch (error) {
      console.error('코치 목록을 불러오지 못했습니다:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCoaches = coaches.filter(
    (coach) =>
      coach.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coach.coach_details.specialty?.some((specialty) => specialty.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>나에게 맞는 코치 찾기</Text>
        <Text style={styles.subtitle}>순천 지역 피트니스 전문가를 확인하세요</Text>
      </View>

      <View style={styles.searchBar}>
        <Search size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="이름 또는 전문 분야 검색..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filteredCoaches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CoachCard coach={item} onPress={(coach) => console.log('선택한 코치:', coach.full_name)} />
          )}
          contentContainerStyle={styles.listContent}
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
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  listContent: {
    padding: 16,
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
