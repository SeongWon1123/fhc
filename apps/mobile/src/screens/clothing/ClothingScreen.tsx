import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ClothingCard } from '../../components/ClothingCard';
import { Loading } from '../../components/common/Loading';
import { api } from '../../lib/api';
import { notify } from '../../lib/notify';
import { ClothingItem } from '../../types';

const sports = [
  { key: 'all', label: '전체' },
  { key: 'gym', label: '헬스' },
  { key: 'running', label: '러닝' },
  { key: 'pilates', label: '필라테스' },
  { key: 'yoga', label: '요가' },
];

export const ClothingScreen: React.FC = () => {
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchClothingItems(selectedSport);
  }, [selectedSport]);

  const fetchClothingItems = async (sport: string) => {
    setLoading(true);
    try {
      const sportCategory = sport === 'all' ? 'gym' : sport;
      const { data } = await api.get(`/clothing/recommendations?sport_category=${sportCategory}`);
      const nextItems = Array.isArray(data) ? data : data?.items;
      setClothingItems(Array.isArray(nextItems) ? nextItems : []);
      setRecommendationId(typeof data?.recommendation_id === 'string' ? data.recommendation_id : null);
    } catch (error) {
      console.error('의류 추천을 불러오지 못했습니다:', error);
      setClothingItems([]);
      setRecommendationId(null);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClothingItems(selectedSport);
    setRefreshing(false);
  };

  const handleItemPress = async (item: ClothingItem) => {
    if (recommendationId) {
      // Tracking must never block the shopper from reaching the product.
      api.post(`/clothing/click/${encodeURIComponent(recommendationId)}`).catch((error: unknown) => {
        console.warn('의류 추천 클릭을 기록하지 못했습니다:', error);
      });
    }
    try {
      const supported = await Linking.canOpenURL(item.url);
      if (!supported) {
        notify('링크 열기 불가', '이 추천 상품 링크를 열 수 없습니다.');
        return;
      }
      await Linking.openURL(item.url);
    } catch (error) {
      console.error('의류 링크 열기에 실패했습니다:', error);
      notify('링크 열기 불가', '현재 이 추천 상품을 열 수 없습니다.');
    }
  };

  const filteredItems = useMemo(
    () =>
      selectedSport === 'all'
        ? clothingItems
        : clothingItems.filter((item) => item.category.toLowerCase().includes(selectedSport)),
    [clothingItems, selectedSport]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>아직 추천 의류가 없습니다</Text>
      <Text style={styles.emptyDescription}>다른 운동 필터를 선택하거나 목록을 새로고침해보세요.</Text>
    </View>
  );

  if (loading && !refreshing && clothingItems.length === 0) {
    return <Loading message="운동 의류를 불러오는 중..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>운동 의류</Text>
        <Text style={styles.subtitle}>운동 스타일에 맞는 의류 추천을 확인하세요.</Text>
        <Text style={styles.disclosure}>
          상품 링크는 외부 쇼핑몰(무신사)로 연결됩니다. '제휴' 표시 링크로 구매하면 핏커넥트가 수수료를 받을 수 있습니다.
        </Text>
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sports}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, selectedSport === item.key && styles.selectedFilterChip]}
              onPress={() => setSelectedSport(item.key)}
            >
              <Text style={[styles.filterText, selectedSport === item.key && styles.selectedFilterText]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => `${item.name}-${item.brand}`}
        renderItem={({ item }) => <ClothingCard item={item} onPress={() => handleItemPress(item)} />}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        ListEmptyComponent={renderEmptyState}
      />
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
    lineHeight: 20,
  },
  disclosure: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 17,
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 9,
  },
  filterList: {
    paddingHorizontal: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  list: {
    padding: 16,
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
    color: '#6b7280',
    fontWeight: '700',
  },
  selectedFilterText: {
    color: '#ffffff',
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
  },
});
