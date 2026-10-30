import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl,
  SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { api } from '../../lib/api';
import { notify } from '../../lib/notify';
import {
  buildWorkoutLog, formatWorkoutDate, formatWorkoutSummary, SPORTS,
} from '../../lib/workoutLog';
import type { WorkoutLog, WorkoutSport } from '../../lib/workoutLog';

export const WorkoutLogScreen: React.FC = () => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [sport, setSport] = useState<WorkoutSport>('gym');
  const [minutes, setMinutes] = useState('');
  const [calories, setCalories] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const request = useRef(0);
  const mutating = useRef(false);

  const loadLogs = useCallback(async (signal?: AbortSignal) => {
    const current = ++request.current;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<WorkoutLog[]>('/workouts', { signal });
      if (!signal?.aborted && current === request.current) setLogs(data);
    } catch {
      if (!signal?.aborted && current === request.current) {
        setError('운동 기록을 불러오지 못했습니다. 다시 시도해주세요.');
      }
    } finally {
      if (!signal?.aborted && current === request.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadLogs(controller.signal);
    return () => {
      controller.abort();
      request.current += 1;
    };
  }, [loadLogs]));

  const saveLog = async () => {
    if (mutating.current) return;
    const result = buildWorkoutLog({ sport, minutes, calories, memo });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    mutating.current = true;
    setSaving(true);
    setError('');
    try {
      await api.post<WorkoutLog>('/workouts', result.payload);
      setMinutes('');
      setCalories('');
      setMemo('');
      await loadLogs();
    } catch {
      setError('운동 기록을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      mutating.current = false;
      setSaving(false);
    }
  };

  const deleteLog = async (id: string) => {
    if (mutating.current) return;
    mutating.current = true;
    setDeleting(id);
    setError('');
    try {
      await api.delete(`/workouts/${id}`);
      await loadLogs();
    } catch {
      setError('운동 기록을 삭제하지 못했습니다. 다시 시도해주세요.');
    } finally {
      mutating.current = false;
      setDeleting(null);
    }
  };

  const confirmDelete = (log: WorkoutLog) => {
    notify('운동 기록 삭제', `${formatWorkoutSummary(log)} 기록을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { void deleteLog(log.id); } },
    ]);
  };

  const busy = saving || deleting !== null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          refreshControl={(
            <RefreshControl
              refreshing={loading}
              tintColor="#13795b"
              onRefresh={() => { if (!mutating.current) void loadLogs(); }}
            />
          )}
          ListHeaderComponent={(
            <View>
              <Text style={styles.title}>운동 기록</Text>
              <Text style={styles.subtitle}>오늘의 운동을 기록하고 꾸준함을 쌓아보세요.</Text>
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>운동 추가</Text>
                <Text style={styles.label}>운동 종목</Text>
                <View style={styles.chips}>
                  {SPORTS.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: sport === option.key, disabled: busy }}
                      disabled={busy}
                      onPress={() => setSport(option.key)}
                      style={[styles.chip, sport === option.key && styles.selectedChip]}
                    >
                      <Text style={[styles.chipText, sport === option.key && styles.selectedChipText]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Input
                  label="운동 시간(분)"
                  accessibilityLabel="운동 시간(분)"
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="numeric"
                  editable={!busy}
                />
                <Input
                  label="소모 칼로리(kcal)"
                  accessibilityLabel="소모 칼로리(kcal)"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  editable={!busy}
                />
                <Text style={styles.hint}>칼로리는 선택 사항입니다. 비워두면 0kcal로 저장됩니다.</Text>
                <Input
                  label="메모"
                  accessibilityLabel="메모"
                  value={memo}
                  onChangeText={setMemo}
                  multiline
                  editable={!busy}
                />
                <Text style={styles.hint}>메모는 200자까지 입력할 수 있습니다.</Text>
                <Button
                  title="기록 저장"
                  onPress={() => { void saveLog(); }}
                  loading={saving}
                  disabled={busy || loading}
                  fullWidth
                  style={styles.saveButton}
                />
              </View>
              {error !== '' && (
                <View style={styles.error}>
                  <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
                  <Button
                    title="다시 불러오기"
                    variant="secondary"
                    disabled={busy || loading}
                    onPress={() => { void loadLogs(); }}
                  />
                </View>
              )}
              <Text style={styles.sectionTitle}>최근 운동</Text>
              {loading && <ActivityIndicator accessibilityLabel="운동 기록을 불러오는 중" color="#13795b" />}
            </View>
          )}
          ListEmptyComponent={!loading && !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>아직 운동 기록이 없습니다.</Text>
              <Text style={styles.subtitle}>위에서 첫 운동을 기록해보세요.</Text>
            </View>
          ) : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.summary}>{formatWorkoutSummary(item)}</Text>
              <Text style={styles.date}>{formatWorkoutDate(item.created_at)}</Text>
              {item.data?.memo ? <Text style={styles.memo}>{item.data.memo}</Text> : null}
              <Button
                title="삭제"
                variant="secondary"
                textStyle={styles.deleteText}
                onPress={() => confirmDelete(item)}
                loading={deleting === item.id}
                disabled={busy || loading}
                style={styles.deleteButton}
              />
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#6b7280', marginTop: 4 },
  form: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginVertical: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  label: { fontSize: 14, color: '#111827', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 999, backgroundColor: '#eef2f5' },
  selectedChip: { backgroundColor: '#e1f4ed' },
  chipText: { fontSize: 14, color: '#111827' },
  selectedChipText: { color: '#13795b', fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 20, color: '#6b7280', marginBottom: 16 },
  saveButton: { backgroundColor: '#13795b' },
  error: { padding: 16, marginBottom: 16, backgroundColor: '#fee4e2', borderRadius: 12, gap: 12 },
  errorText: { color: '#b42318', fontSize: 14, lineHeight: 22 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' },
  card: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 12 },
  summary: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: '#111827' },
  date: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  memo: { fontSize: 14, lineHeight: 22, color: '#111827', marginTop: 12 },
  deleteButton: { alignSelf: 'flex-end', marginTop: 12 },
  deleteText: { color: '#b42318' },
});
