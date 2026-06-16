import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle, MapPin, Star } from 'lucide-react-native';
import { Coach } from '../types';

interface CoachCardProps {
  coach: Coach;
  onPress: (coach: Coach) => void;
}

const formatPrice = (price: number) => `${price.toLocaleString('ko-KR')}원`;

export const CoachCard: React.FC<CoachCardProps> = ({ coach, onPress }) => {
  const details = coach.coach_details;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(coach)} activeOpacity={0.85}>
      <Image
        source={{ uri: coach.avatar_url || 'https://placehold.co/160x160/png?text=Coach' }}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{coach.full_name || '피트니스 코치'}</Text>
          {details.is_verified && <CheckCircle size={16} color="#2563eb" />}
        </View>

        <Text style={styles.specialty} numberOfLines={1}>
          {details.specialty?.join(', ') || '일반 피트니스'}
        </Text>

        <View style={styles.metaRow}>
          <MapPin size={13} color="#6b7280" />
          <Text style={styles.metaText} numberOfLines={1}>
            {details.location || (details.is_online_available ? '온라인' : '스튜디오')}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.rating}>
            <Star size={14} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.ratingText}>
              {details.rating.toFixed(1)} ({details.review_count})
            </Text>
          </View>
          <Text style={styles.price}>{formatPrice(details.base_price)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#e5e7eb',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  specialty: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
});
