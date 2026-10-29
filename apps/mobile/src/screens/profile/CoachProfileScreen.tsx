import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { KoreanText as Text } from '../../components/common/KoreanText';
import { api } from '../../lib/api';
import {
  SPORTS,
  WEEKDAYS,
  HOUR_OPTIONS,
  applicationStatus,
  buildCoachProfile,
  formFromDetails,
  type CoachApplicationStatus,
  type CoachProfileForm,
} from '../../lib/coachProfile';
import { notify } from '../../lib/notify';
import { useStore } from '../../lib/store';
import type { Weekday } from '../../types';

const statusCopy: Readonly<Record<CoachApplicationStatus, { title: string; body: string }>> = {
  none: {
    title: '코치로 활동하기',
    body: '프로필을 작성해 신청하면 운영자가 확인한 뒤 코치 목록에 표시됩니다.',
  },
  pending: {
    title: '승인 대기 중',
    body: '운영자가 신청 내용을 확인하고 있습니다. 승인 전까지 내용을 수정할 수 있습니다.',
  },
  approved: {
    title: '승인된 코치',
    body: '저장한 내용은 회원에게 보이는 코치 프로필에 바로 반영됩니다.',
  },
};

export const CoachProfileScreen: React.FC = () => {
  const user = useStore((state) => state.user);
  const fetchProfile = useStore((state) => state.fetchProfile);
  const [status, setStatus] = useState<CoachApplicationStatus>('none');
  const [form, setForm] = useState<CoachProfileForm>(formFromDetails(null, user?.full_name ?? ''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState<Weekday>('mon');
  const [error, setError] = useState<string | null>(null);
  const saveLock = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ role: string; details: Record<string, unknown> | null }>('/coaches/me/details');
      setStatus(applicationStatus(data.role, data.details));
      setForm(formFromDetails(data.details, user.full_name ?? ''));
      if (data.role !== user.role) await fetchProfile(user.id, user.email);
    } catch {
      setError('코치 프로필을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, user]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const update = <K extends keyof CoachProfileForm>(key: K, value: CoachProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleSport = (key: string) => {
    update('specialty', form.specialty.includes(key)
      ? form.specialty.filter((sport) => sport !== key)
      : [...form.specialty, key]);
  };

  const save = async () => {
    if (saveLock.current) return;
    const built = buildCoachProfile(form);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      await api.put('/coaches/me/details', built.payload);
      notify(
        status === 'none' ? '코치 신청 완료' : '코치 프로필 저장',
        status === 'none' ? '운영자 승인 후 코치 목록에 표시됩니다.' : '변경 내용을 저장했습니다.',
      );
      await load();
    } catch (cause: unknown) {
      setError(isAxiosError(cause) && cause.response?.status === 422
        ? '입력 내용을 다시 확인해주세요.'
        : '저장하지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const copy = statusCopy[status];
  const weekdayLabel = WEEKDAYS.find((day) => day.key === selectedWeekday)?.label;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.status, status === 'pending' && styles.pending, status === 'approved' && styles.approved]}>
        <Text style={styles.statusTitle}>{copy.title}</Text>
        <Text style={styles.statusBody}>{copy.body}</Text>
      </View>

      <Input label="코치 이름" value={form.name} onChangeText={(value) => update('name', value)} maxLength={50} />

      <Text style={styles.label}>전문 분야 (1~5개)</Text>
      <View style={styles.chips}>
        {SPORTS.map((sport) => {
          const selected = form.specialty.includes(sport.key);
          return (
            <TouchableOpacity
              key={sport.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleSport(sport.key)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sport.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label="세션 가격 (원/시간)"
        value={form.basePrice}
        onChangeText={(value) => update('basePrice', value)}
        keyboardType="number-pad"
      />
      <Input
        label="경력 (년)"
        value={form.experienceYears}
        onChangeText={(value) => update('experienceYears', value)}
        keyboardType="number-pad"
      />
      <Input label="활동 지역" value={form.location} onChangeText={(value) => update('location', value)} maxLength={100} placeholder="예: 순천 조례동" />

      <Text style={styles.label}>세션 방식</Text>
      <View style={styles.chips}>
        {([['isOnline', '온라인'], ['isOffline', '오프라인']] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: form[key] }}
            style={[styles.chip, form[key] && styles.chipSelected]}
            onPress={() => update(key, !form[key])}
          >
            <Text style={[styles.chipText, form[key] && styles.chipTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>예약 가능 시간</Text>
      <View style={styles.chips}>
        {WEEKDAYS.map((day) => {
          const selected = selectedWeekday === day.key;
          return (
            <TouchableOpacity
              key={day.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${day.label}요일`}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setSelectedWeekday(day.key)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {day.label} ({form.weeklyAvailability[day.key]?.length ?? 0})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.chips}>
        {HOUR_OPTIONS.map((hour) => {
          const slots = form.weeklyAvailability[selectedWeekday] ?? [];
          const selected = slots.includes(hour);
          return (
            <TouchableOpacity
              key={hour}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${weekdayLabel}요일 ${hour}`}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => update('weeklyAvailability', {
                ...form.weeklyAvailability,
                [selectedWeekday]: selected ? slots.filter((slot) => slot !== hour) : [...slots, hour],
              })}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{hour}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: !form.weeklyAvailability[selectedWeekday]?.length }}
          accessibilityLabel={`${weekdayLabel}요일 쉬기`}
          style={styles.chip}
          onPress={() => update('weeklyAvailability', { ...form.weeklyAvailability, [selectedWeekday]: [] })}
        >
          <Text style={styles.chipText}>이 요일 쉬기</Text>
        </TouchableOpacity>
      </View>

      <Input
        label="소개"
        value={form.biography}
        onChangeText={(value) => update('biography', value)}
        multiline
        maxLength={1000}
        style={styles.multiline}
      />
      <Input
        label="자격 및 이력 (줄마다 하나)"
        value={form.qualifications}
        onChangeText={(value) => update('qualifications', value)}
        multiline
        style={styles.multiline}
      />

      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        title={status === 'none' ? '코치 신청하기' : '저장하기'}
        onPress={save}
        loading={saving}
        fullWidth
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  status: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 20 },
  pending: { backgroundColor: '#fffbeb' },
  approved: { backgroundColor: '#f0fdf4' },
  statusTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  statusBody: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff',
  },
  chipSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 15, color: '#374151' },
  chipTextSelected: { color: '#2563eb', fontWeight: '700' },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  error: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#b91c1c', fontSize: 14, lineHeight: 20 },
});

export default CoachProfileScreen;
