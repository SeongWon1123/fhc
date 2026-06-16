import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { ClothingItem } from '../types';

interface ClothingCardProps {
  item: ClothingItem;
  onPress?: () => void;
}

const categoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    'gym-top': '헬스 상의',
    'gym-bottom': '헬스 하의',
    'crossfit-shoes': '크로스핏 신발',
    'pilates-bottom': '필라테스 하의',
    'running-shoes': '러닝화',
    'yoga-accessory': '요가 소품',
    gym: '헬스',
    running: '러닝',
    pilates: '필라테스',
    yoga: '요가',
  };

  return labels[category] ?? category;
};

export const ClothingCard: React.FC<ClothingCardProps> = ({ item, onPress }) => {
  const discountPercentage = item.original_price
    ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
    : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.image_url || 'https://placehold.co/400x400/png?text=Gear' }}
          style={styles.image}
        />
        {discountPercentage > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discountPercentage}% 할인</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.brand}>{item.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>

        <View style={styles.priceContainer}>
          {item.original_price ? (
            <Text style={styles.originalPrice}>{item.original_price.toLocaleString('ko-KR')}원</Text>
          ) : null}
          <Text style={styles.price}>{item.price.toLocaleString('ko-KR')}원</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.categoryText}>{categoryLabel(item.category)}</Text>
          <ExternalLink size={13} color="#6b7280" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eef2f7',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#f3f4f6',
  },
  image: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    padding: 12,
  },
  brand: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  name: {
    minHeight: 38,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 19,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  originalPrice: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
