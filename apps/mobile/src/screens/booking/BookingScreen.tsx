import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { api } from '../../lib/api';
import { notify } from '../../lib/notify';
import { Coach } from '../../types';

type BookingRouteParams = {
  coach?: Coach;
  coach_id?: string;
};

export const BookingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params ?? {}) as BookingRouteParams;
  const [coach, setCoach] = useState<Coach | null>(params.coach ?? null);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [sessionType, setSessionType] = useState<'online' | 'offline'>('online');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCoach, setLoadingCoach] = useState(!params.coach && Boolean(params.coach_id));

  useEffect(() => {
    const fetchCoach = async () => {
      if (!params.coach_id || params.coach) return;

      setLoadingCoach(true);
      try {
        const { data } = await api.get(`/coaches/${params.coach_id}`);
        setCoach(data ?? null);
      } catch (error) {
        console.error('예약할 코치를 불러오지 못했습니다:', error);
        setCoach(null);
      } finally {
        setLoadingCoach(false);
      }
    };

    fetchCoach();
  }, [params.coach, params.coach_id]);

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

  const minDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }, []);

  const maxDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  }, []);

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) {
      notify('시간 선택', '예약 전에 날짜와 시간을 선택해주세요.');
      return;
    }

    if (!coach) {
      notify('코치 없음', '예약은 활성 코치 프로필에서 시작해주세요.');
      return;
    }

    if (sessionType === 'offline' && !coach.coach_details.is_offline_available) {
      notify('예약 불가', '이 코치는 현재 온라인 세션만 가능합니다.');
      return;
    }

    setLoading(true);
    try {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

      await api.post('/bookings', {
        coach_id: coach.id,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        session_type: sessionType,
        price: coach.coach_details.base_price,
        notes: notes.trim() || undefined,
      });

      notify('예약 요청 완료', '예약 요청이 접수되었습니다.', [
        { text: '예약 보기', onPress: () => navigation.navigate('BookingList') },
      ]);
    } catch (error: any) {
      console.error('예약 생성에 실패했습니다:', error);
      notify('예약 실패', '예약 서비스를 사용할 수 없습니다. 연결이 복구된 뒤 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingCoach) {
    return <Loading message="코치 예약 가능 시간을 불러오는 중..." />;
  }

  if (!coach) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>코치 정보 없음</Text>
        <Text style={styles.emptyDescription}>예약은 활성 코치 프로필에서 시작해주세요.</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('CoachList')}>
          <Text style={styles.emptyButtonText}>코치 둘러보기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.coachInfo}>
          <Text style={styles.coachName}>{coach.full_name}</Text>
          <Text style={styles.price}>{coach.coach_details.base_price.toLocaleString('ko-KR')}원 / 시간</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>날짜 선택</Text>
          <Calendar
            minDate={minDate}
            maxDate={maxDate}
            onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
            markedDates={{
              [selectedDate]: {
                selected: true,
                selectedColor: '#2563eb',
                selectedTextColor: '#ffffff',
              },
            }}
            theme={{
              selectedDayBackgroundColor: '#2563eb',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#2563eb',
              arrowColor: '#2563eb',
            }}
          />
        </View>

        {selectedDate ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>시간 선택</Text>
            <View style={styles.timeSlotsContainer}>
              {timeSlots.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeSlot, selectedTime === time && styles.selectedTimeSlot]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text style={[styles.timeSlotText, selectedTime === time && styles.selectedTimeSlotText]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {selectedDate && selectedTime ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>세션 방식</Text>
              <View style={styles.typeContainer}>
                <TouchableOpacity
                  style={[styles.typeOption, sessionType === 'online' && styles.selectedTypeOption]}
                  onPress={() => setSessionType('online')}
                >
                  <Text style={[styles.typeText, sessionType === 'online' && styles.selectedTypeText]}>
                    온라인 세션
                  </Text>
                  <Text style={styles.typeDescription}>코치와 영상 통화로 진행합니다.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    sessionType === 'offline' && styles.selectedTypeOption,
                    !coach.coach_details.is_offline_available && styles.disabledTypeOption,
                  ]}
                  onPress={() => coach.coach_details.is_offline_available && setSessionType('offline')}
                  disabled={!coach.coach_details.is_offline_available}
                >
                  <Text
                    style={[
                      styles.typeText,
                      sessionType === 'offline' && styles.selectedTypeText,
                      !coach.coach_details.is_offline_available && styles.disabledText,
                    ]}
                  >
                    오프라인 세션
                  </Text>
                  <Text
                    style={[
                      styles.typeDescription,
                      !coach.coach_details.is_offline_available && styles.disabledText,
                    ]}
                  >
                    {coach.coach_details.is_offline_available ? coach.coach_details.location || '코치 스튜디오' : '이용 불가'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>요청 메모</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="목표, 부상, 장비, 일정 관련 메모"
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.priceSummary}>
              <View style={styles.priceDetails}>
                <Text style={styles.priceItem}>세션 가격</Text>
                <Text style={styles.priceValue}>{coach.coach_details.base_price.toLocaleString('ko-KR')}원</Text>
              </View>
              <View style={styles.totalPrice}>
                <Text style={styles.totalLabel}>총 결제 예정 금액</Text>
                <Text style={styles.totalValue}>{coach.coach_details.base_price.toLocaleString('ko-KR')}원</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {selectedDate && selectedTime ? (
        <View style={styles.footer}>
          <Button title="예약 요청하기" onPress={handleBooking} loading={loading} fullWidth />
        </View>
      ) : null}
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
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  coachInfo: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  coachName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '700',
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  timeSlot: {
    width: 72,
    height: 46,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    margin: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedTimeSlot: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  timeSlotText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '700',
  },
  selectedTimeSlotText: {
    color: '#ffffff',
  },
  typeContainer: {
    gap: 12,
  },
  typeOption: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedTypeOption: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  disabledTypeOption: {
    backgroundColor: '#f9fafb',
  },
  typeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  selectedTypeText: {
    color: '#2563eb',
  },
  typeDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  disabledText: {
    color: '#9ca3af',
  },
  notesInput: {
    minHeight: 110,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    fontSize: 15,
    color: '#111827',
  },
  priceSummary: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  priceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceItem: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  totalPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  centered: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
