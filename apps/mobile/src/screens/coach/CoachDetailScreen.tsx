import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Award, Clock, MapPin, Share as ShareIcon, Star } from 'lucide-react-native';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { api } from '../../lib/api';
import { Coach } from '../../types';
import { sportLabel } from '../../lib/coachProfile';

type CoachDetailRouteParams = {
  coach_id?: string;
  coach?: Coach;
};

export const CoachDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params ?? {}) as CoachDetailRouteParams;
  const coachId = params.coach_id ?? params.coach?.id;
  const [coach, setCoach] = useState<Coach | null>(params.coach ?? null);
  const [loading, setLoading] = useState(!params.coach && Boolean(coachId));

  // Refetch on every focus so reviews and counts written elsewhere appear on return.
  useFocusEffect(useCallback(() => {
    if (!coachId) return;
    let active = true;
    setCoach((current) => (current?.id === coachId ? current : params.coach ?? null));
    setLoading(true);
    const fetchCoachDetails = async () => {
      try {
        const { data } = await api.get<Coach>(`/coaches/${coachId}`);
        if (active) setCoach(data ?? null);
      } catch (error) {
        console.error('코치 상세 정보를 불러오지 못했습니다:', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchCoachDetails();
    return () => { active = false; };
  }, [coachId, params.coach]));

  const handleBookingPress = () => {
    if (coach) {
      navigation.navigate('Booking', { coach });
    }
  };

  const handleShare = async () => {
    if (!coach) return;

    try {
      await Share.share({
        message: `${coach.full_name} 코치와 핏커넥트 세션을 예약해보세요.`,
        title: `${coach.full_name} - FitConnect`,
      });
    } catch (error) {
      console.error('코치 공유에 실패했습니다:', error);
    }
  };

  if (loading && !coach) {
    return <Loading message="코치 프로필을 불러오는 중..." />;
  }

  if (!coach) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>코치 프로필을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const details = coach.coach_details;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Image
            source={{ uri: coach.avatar_url || 'https://placehold.co/800x600/png?text=Coach' }}
            style={styles.heroImage}
          />
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.heroOverlay}>
            <Text style={styles.coachName}>{coach.full_name}</Text>
            <View style={styles.heroMeta}>
              <View style={styles.ratingContainer}>
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.ratingText}>{details.rating.toFixed(1)}</Text>
              </View>
              {details.is_verified ? (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>승인됨</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <MapPin size={17} color="#6b7280" />
            <Text style={styles.infoText}>{details.location || '온라인'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Clock size={17} color="#6b7280" />
            <Text style={styles.infoText}>경력 {details.experience_years}년</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>세션 가격</Text>
            <Text style={styles.price}>{details.base_price.toLocaleString('ko-KR')}원 / 시간</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>전문 분야</Text>
          <View style={styles.tagsContainer}>
            {(details.specialty ?? []).map((specialty) => (
              <View key={specialty} style={styles.tag}>
                <Text style={styles.tagText}>{sportLabel(specialty)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>소개</Text>
          <Text style={styles.bodyText}>
            {details.biography || '운동 계획, 습관 추적, 꾸준한 실천을 도와줄 준비가 된 코치입니다.'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>자격 및 이력</Text>
          {details.qualifications?.length ? (
            details.qualifications.map((qualification) => (
              <View key={qualification} style={styles.qualificationItem}>
                <Award size={16} color="#2563eb" />
                <Text style={styles.qualificationText}>{qualification}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>등록된 자격 정보가 없습니다.</Text>
          )}
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{details.booking_count ?? 0}</Text>
            <Text style={styles.statLabel}>완료 세션</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{details.review_count}</Text>
            <Text style={styles.statLabel}>리뷰</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{details.is_online_available ? '가능' : '불가'}</Text>
            <Text style={styles.statLabel}>온라인</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{details.is_offline_available ? '가능' : '불가'}</Text>
            <Text style={styles.statLabel}>오프라인</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>리뷰</Text>
          {coach.reviews?.length ? (
            coach.reviews.map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <Text style={styles.reviewStars} accessibilityLabel={`별점 ${review.rating}점`}>
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </Text>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewAuthor}>{review.author}</Text>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
                {review.content ? <Text style={styles.bodyText}>{review.content}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>아직 리뷰가 없습니다.</Text>
          )}
        </View>

        <View style={styles.actionSection}>
          <Button title="세션 예약하기" onPress={handleBookingPress} fullWidth style={styles.bookingButton} />

          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
              <ShareIcon size={20} color="#2563eb" />
              <Text style={styles.secondaryButtonText}>공유</Text>
            </TouchableOpacity>
          </View>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  heroSection: {
    position: 'relative',
    height: 300,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    borderRadius: 20,
    padding: 8,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
  },
  coachName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  verifiedBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  infoSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  priceContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  priceLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563eb',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 21,
  },
  qualificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qualificationText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  reviewItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  reviewStars: {
    fontSize: 18,
    color: '#92400e',
  },
  reviewMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionSection: {
    padding: 16,
    paddingBottom: 32,
  },
  bookingButton: {
    marginBottom: 14,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#2563eb',
    marginLeft: 5,
    fontWeight: '700',
  },
});
