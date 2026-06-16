import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, Clock, Video } from 'lucide-react-native';
import { Booking } from '../types';

interface BookingCardProps {
  booking: Booking;
  onPress?: () => void;
}

const statusConfig: Record<Booking['status'], { label: string; color: string }> = {
  pending: { label: '대기', color: '#d97706' },
  confirmed: { label: '확정', color: '#2563eb' },
  completed: { label: '완료', color: '#16a34a' },
  cancelled: { label: '취소', color: '#dc2626' },
  no_show: { label: '노쇼', color: '#6b7280' },
};

export const BookingCardComponent: React.FC<BookingCardProps> = ({ booking, onPress }) => {
  const scheduledAt = new Date(booking.scheduled_at);
  const config = statusConfig[booking.status];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Calendar size={17} color="#6b7280" />
          <Text style={styles.title}>
            {scheduledAt.toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${config.color}1A` }]}>
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Clock size={15} color="#6b7280" />
        <Text style={styles.detailText}>
          {scheduledAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          {' / '}
          {booking.duration_minutes}분
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Video size={15} color="#6b7280" />
        <Text style={styles.detailText}>{booking.session_type === 'online' ? '온라인 세션' : '오프라인 세션'}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.price}>{booking.price.toLocaleString('ko-KR')}원</Text>
        {booking.notes ? <Text style={styles.notes} numberOfLines={1}>{booking.notes}</Text> : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    marginTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  notes: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
});
