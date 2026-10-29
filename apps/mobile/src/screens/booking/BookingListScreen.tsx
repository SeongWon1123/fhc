import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { Check } from 'lucide-react-native';
import { BookingCardComponent } from '../../components/BookingCardComponent';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store';
import { useBookingRealtime } from '../../lib/bookingRealtimeStore';
import {
  bookingActions, bookingReview, bookingUpdate, canReview, reviewPayload, type BookingAction,
} from '../../lib/bookingManagement';
import type { Booking } from '../../types';
import { tokens as t } from '../../theme/tokens';
import { KoreanText as Text } from '../../components/common/KoreanText';

function BookingManagement({
  booking, actorId, disabled, error, onReload, onUpdate, onReview,
}: {
  readonly booking: Booking;
  readonly actorId: string;
  readonly disabled: boolean;
  readonly error: string | null;
  readonly onReload: () => void;
  readonly onUpdate: (booking: Booking, action: BookingAction, notes: string) => Promise<void>;
  readonly onReview: (booking: Booking, payload: { rating: number; content: string | null }) => Promise<string | null>;
}) {
  const [notes, setNotes] = useState(booking.coach_notes ?? '');
  const [selected, setSelected] = useState<BookingAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const allowed = bookingActions(booking, actorId);
  const existingReview = bookingReview(booking);
  const reviewable = canReview(booking, actorId);

  const submitReview = async () => {
    if (reviewSaving) return;
    const built = reviewPayload(rating, reviewText);
    if (!built.ok) {
      setReviewError(built.error);
      return;
    }
    setReviewSaving(true);
    setReviewError(null);
    const failure = await onReview(booking, built.payload);
    setReviewSaving(false);
    if (failure) setReviewError(failure);
    else setReviewOpen(false);
  };
  const isCoach = booking.coach_id === actorId;
  useEffect(() => { setNotes(booking.coach_notes ?? ''); }, [booking.coach_notes]);
  useEffect(() => { setSelected(null); }, [booking.status]);

  return (
    <View style={styles.booking} testID={`booking-${booking.id}`}>
      <BookingCardComponent booking={booking} />
      <View style={styles.controls}>
        <Text style={styles.participant}>
          {isCoach ? '회원' : '코치'}: {booking.profiles?.full_name || '이름 미등록'}
        </Text>
        {isCoach && allowed.length > 0 ? (
          <View style={styles.field}>
            <Text style={styles.label}>코치 메모</Text>
            <TextInput
              accessibilityLabel="코치 메모"
              value={notes}
              onChangeText={setNotes}
              editable={!disabled}
              multiline
              maxLength={2000}
              placeholder="예: 무릎 상태 확인"
              placeholderTextColor={t.color.mutedText}
              style={styles.input}
            />
            <Text style={styles.helper}>메모는 아래 예약 상태를 변경할 때 함께 저장됩니다.</Text>
          </View>
        ) : isCoach && booking.coach_notes ? (
          <View style={styles.field}>
            <Text style={styles.label}>코치 메모</Text>
            <Text selectable style={styles.body}>{booking.coach_notes}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text testID={`booking-mutation-error-${booking.id}`} style={styles.body}>{error}</Text>
            <TouchableOpacity
              accessibilityRole="button" disabled={disabled}
              style={[styles.button, styles.secondaryButton]} onPress={onReload}
            >
              <Text style={styles.secondaryText}>예약 새로고침</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {selected ? (
          <View style={styles.confirmation}>
            <Text style={styles.label}>{selected.label} 처리를 진행할까요?</Text>
            <Text style={styles.helper}>변경한 예약 상태는 되돌릴 수 없습니다.</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button" disabled={disabled}
                style={[styles.button, styles.secondaryButton, disabled && styles.disabled]}
                onPress={() => setSelected(null)}
              >
                <Text style={styles.secondaryText}>돌아가기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button" disabled={disabled}
                accessibilityLabel={`${selected.label} 확인`}
                style={[styles.button, selected.destructive ? styles.dangerButton : styles.primaryButton, disabled && styles.disabled]}
                onPress={() => void onUpdate(booking, selected, notes)}
              >
                <Text style={styles.buttonText}>{disabled ? '저장 중' : selected.label}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : allowed.length > 0 ? (
          <View style={styles.actions}>
            {allowed.map((action) => (
              <TouchableOpacity
                key={action.status} accessibilityRole="button" disabled={disabled}
                style={[styles.button, action.destructive ? styles.secondaryButton : styles.primaryButton, disabled && styles.disabled]}
                onPress={() => setSelected(action)}
              >
                <Text style={action.destructive ? styles.dangerText : styles.buttonText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            {existingReview ? (
              <View style={styles.field}>
                <Text style={styles.label}>내 리뷰</Text>
                <Text accessibilityLabel={`별점 ${existingReview.rating}점`} style={styles.stars}>
                  {'★'.repeat(existingReview.rating)}{'☆'.repeat(5 - existingReview.rating)}
                </Text>
                {existingReview.content ? <Text selectable style={styles.body}>{existingReview.content}</Text> : null}
              </View>
            ) : null}
            {reviewable && reviewOpen ? (
              <View style={styles.field}>
                <Text style={styles.label}>별점</Text>
                <View style={styles.actions}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <TouchableOpacity
                      key={score} accessibilityRole="button" accessibilityLabel={`${score}점`}
                      accessibilityState={{ selected: rating === score }} disabled={reviewSaving}
                      style={styles.starButton} onPress={() => setRating(score)}
                    >
                      <Text style={[styles.stars, rating < score && styles.starOff]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="리뷰 내용" value={reviewText} onChangeText={setReviewText}
                  editable={!reviewSaving} multiline maxLength={500}
                  placeholder="세션은 어땠나요? (선택)" placeholderTextColor={t.color.mutedText} style={styles.input}
                />
                {reviewError ? (
                  <Text accessibilityLiveRegion="polite" style={styles.dangerText}>{reviewError}</Text>
                ) : null}
                <View style={styles.actions}>
                  <TouchableOpacity
                    accessibilityRole="button" disabled={reviewSaving}
                    style={[styles.button, styles.secondaryButton]} onPress={() => setReviewOpen(false)}
                  >
                    <Text style={styles.secondaryText}>돌아가기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button" disabled={reviewSaving}
                    style={[styles.button, styles.primaryButton, reviewSaving && styles.disabled]} onPress={() => void submitReview()}
                  >
                    <Text style={styles.buttonText}>{reviewSaving ? '등록 중' : '리뷰 등록'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : reviewable ? (
              <TouchableOpacity
                accessibilityRole="button" style={[styles.button, styles.primaryButton]}
                onPress={() => { setReviewOpen(true); setReviewError(null); }}
              >
                <Text style={styles.buttonText}>리뷰 쓰기</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.helper}>처리가 끝난 예약입니다.</Text>
          </>
        )}
      </View>
    </View>
  );
}

export const BookingListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<{ Coaches: undefined }>>();
  const user = useStore((state) => state.user);
  const userId = user?.id ?? '';
  const [role, setRole] = useState<'user' | 'coach'>(user?.role === 'coach' ? 'coach' : 'user');
  const revision = useBookingRealtime((state) => state.revision);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<{
    readonly bookingId: string;
    readonly message: string;
  } | null>(null);
  const [message, setMessage] = useState<{
    readonly kind: 'success' | 'warning';
    readonly text: string;
  } | null>(null);
  const request = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const active = useRef(false);

  const fetchBookings = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const { data } = await api.get<Booking[]>('/bookings/my', {
        params: { role }, signal: controller.signal,
      });
      if (controller.signal.aborted) return false;
      setBookings(data);
      setError(null);
      return true;
    } catch (cause: unknown) {
      if (controller.signal.aborted) return false;
      const denied = isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403);
      setMessage(null);
      setError(denied ? '예약 조회 권한이 없습니다. 계정을 다시 확인해주세요.'
        : '예약을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
      return false;
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [role, userId]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    setMessage(null);
    setMutationError(null);
    void fetchBookings();
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, [fetchBookings, revision]));

  const updateBooking = async (booking: Booking, action: BookingAction, notes: string) => {
    if (mutation.current) return;
    mutation.current = true;
    setSaving(true);
    setMessage(null);
    setError(null);
    setMutationError(null);
    try {
      const result = await api.patch<Booking>(`/bookings/${booking.id}/status`,
        bookingUpdate(action.status, booking.coach_id === userId, notes));
      if (!active.current) return;
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, ...result.data } : item));
      setMessage(result.headers['x-booking-notification'] === 'unavailable'
        ? { kind: 'warning', text: '예약은 저장됐습니다.\n실시간 알림 전송에 실패했습니다.\n상대방은 예약 탭을 새로고침해주세요.' }
        : { kind: 'success', text: '예약 변경을 저장했습니다.' });
      await fetchBookings();
    } catch (cause: unknown) {
      if (!active.current) return;
      if (isAxiosError(cause) && cause.response?.status === 409) {
        await fetchBookings();
        setMutationError({ bookingId: booking.id, message: '예약 상태가 이미 변경되었습니다.\n현재 상태를 확인하고 다시 선택해주세요.' });
      } else if (isAxiosError(cause) && cause.response?.status === 403) {
        setMutationError({ bookingId: booking.id, message: '이 예약을 변경할 권한이 없습니다.' });
      } else {
        setMutationError({ bookingId: booking.id, message: '변경 결과를 확인하지 못했습니다.\n예약을 새로고침해 상태를 확인해주세요.' });
      }
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  };

  const submitReview = async (
    booking: Booking, payload: { rating: number; content: string | null },
  ): Promise<string | null> => {
    try {
      await api.post(`/bookings/${booking.id}/review`, payload);
      if (!active.current) return null;
      setMessage({ kind: 'success', text: '리뷰를 등록했습니다.' });
      await fetchBookings();
      return null;
    } catch (cause: unknown) {
      if (isAxiosError(cause) && (cause.response?.status === 409 || cause.response?.status === 403)) {
        await fetchBookings();
        return '이미 리뷰를 작성했거나 리뷰를 쓸 수 없는 예약입니다.';
      }
      return '리뷰를 등록하지 못했습니다. 연결을 확인하고 다시 시도해주세요.';
    }
  };

  const reloadBooking = async (bookingId: string) => {
    const refreshed = await fetchBookings();
    if (!active.current) return;
    setMutationError((current) => current?.bookingId === bookingId
      ? refreshed ? null : { bookingId, message: '예약을 다시 불러오지 못했습니다.\n연결을 확인하고 다시 시도해주세요.' }
      : current);
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{role === 'coach' ? '예약 관리' : '내 예약'}</Text>
        <Text style={styles.subtitle}>
          {role === 'coach' ? '받은 요청을 확인하고 세션을 관리하세요.' : '예약 상태를 확인하고 필요한 예약을 취소하세요.'}
        </Text>
        {user?.role === 'coach' ? (
          <View style={styles.actions}>
            {(['coach', 'user'] as const).map((value) => (
              <TouchableOpacity
                key={value} accessibilityRole="button" accessibilityState={{ selected: role === value }}
                disabled={saving || role === value} onPress={() => { setRole(value); setBookings([]); setLoading(true); setMessage(null); }}
                style={[styles.button, role === value ? styles.selectedButton : styles.secondaryButton]}
              >
                <View style={styles.roleLabel}>
                  {role === value ? <Check size={16} color={t.color.primary} /> : null}
                  <Text style={styles.secondaryText}>{value === 'coach' ? '받은 예약' : '신청한 예약'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingManagement
            booking={item} actorId={userId} disabled={saving} onUpdate={updateBooking} onReview={submitReview}
            error={mutationError?.bookingId === item.id ? mutationError.message : null}
            onReload={() => void reloadBooking(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true); void fetchBookings();
        }} tintColor={t.color.primary} />}
        ListHeaderComponent={(
          <View>
            {message ? (
              <Text accessibilityLiveRegion="polite" style={[styles.message, message.kind === 'warning' && styles.warning]}>
                {message.text}
              </Text>
            ) : null}
            {error ? (
              <View style={styles.error} accessibilityLiveRegion="polite">
                <Text testID="booking-error" style={styles.body}>{error}</Text>
                <TouchableOpacity accessibilityRole="button" style={[styles.button, styles.secondaryButton]} onPress={() => void fetchBookings()}>
                  <Text style={styles.secondaryText}>새로고침</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={t.color.primary} />
            <Text style={styles.helper}>예약을 불러오고 있습니다.</Text>
          </View>
        ) : !error ? (
          <View style={styles.empty}>
            <Text style={styles.sectionTitle}>{role === 'coach' ? '받은 예약이 없습니다' : '아직 예약이 없습니다'}</Text>
            <Text style={styles.helper}>{role === 'coach' ? '새 예약 요청이 들어오면 이곳에서 확인할 수 있습니다.' : '코치를 선택하고 첫 세션을 요청해보세요.'}</Text>
            {role === 'user' ? (
              <TouchableOpacity accessibilityRole="button" style={[styles.button, styles.primaryButton]} onPress={() => navigation.navigate('Coaches')}>
                <Text style={styles.buttonText}>코치 둘러보기</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.background },
  header: { padding: t.space.xl, backgroundColor: t.color.surface, gap: t.space.sm },
  title: { fontSize: t.font.title, fontWeight: '800', color: t.color.text },
  subtitle: { fontSize: t.font.secondary, lineHeight: 24, color: t.color.mutedText },
  list: { padding: t.space.lg, paddingBottom: t.space.section },
  booking: { marginBottom: t.space.xl },
  controls: { backgroundColor: t.color.surface, marginTop: -t.space.lg, padding: t.space.lg, borderBottomLeftRadius: t.radius.card, borderBottomRightRadius: t.radius.card, gap: t.space.md },
  participant: { color: t.color.text, fontSize: t.font.body, fontWeight: '600' },
  field: { gap: t.space.sm },
  label: { fontSize: t.font.body, color: t.color.text, fontWeight: '700' },
  input: { minHeight: 88, padding: t.space.md, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.input, color: t.color.text, fontSize: t.font.body, textAlignVertical: 'top' },
  body: { fontSize: t.font.body, color: t.color.text, lineHeight: 26 },
  helper: { fontSize: t.font.secondary, color: t.color.mutedText, lineHeight: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  roleLabel: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  button: { minHeight: 48, paddingVertical: t.space.md, paddingHorizontal: t.space.lg, borderRadius: t.radius.input, justifyContent: 'center', alignItems: 'center' },
  primaryButton: { backgroundColor: t.color.primary },
  secondaryButton: { backgroundColor: t.color.mutedSurface },
  selectedButton: { backgroundColor: t.color.primarySoft },
  dangerButton: { backgroundColor: t.color.danger },
  buttonText: { color: t.color.surface, fontWeight: '700', fontSize: t.font.secondary },
  secondaryText: { color: t.color.text, fontWeight: '700', fontSize: t.font.secondary },
  dangerText: { color: t.color.danger, fontWeight: '700', fontSize: t.font.secondary },
  disabled: { opacity: 0.65 },
  confirmation: { gap: t.space.sm },
  starButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  stars: { fontSize: 24, color: '#f59e0b', letterSpacing: 2 },
  starOff: { color: t.color.border },
  message: { backgroundColor: t.color.primarySoft, color: t.color.text, padding: t.space.lg, fontSize: t.font.secondary, lineHeight: 24, marginBottom: t.space.lg },
  warning: { backgroundColor: t.color.warningSoft },
  error: { backgroundColor: t.color.dangerSoft, padding: t.space.lg, gap: t.space.md, marginBottom: t.space.lg },
  empty: { paddingVertical: t.space.section, gap: t.space.md, alignItems: 'center' },
  sectionTitle: { fontSize: t.font.section, fontWeight: '800', color: t.color.text },
});
