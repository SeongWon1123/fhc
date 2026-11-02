import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { KoreanText as Text } from '../../components/common/KoreanText';
import { notify } from '../../lib/notify';
import { fitnessGoals, sports, validateProfileInput } from '../../lib/profileOptions';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

export const ProfileEditScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, setUser } = useStore();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [fitnessGoal, setFitnessGoal] = useState(user?.fitness_goal ?? '');
  const [preferredSports, setPreferredSports] = useState<string[]>(user?.preferred_sports ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveLock = useRef(false);

  const toggleSport = (key: string) => {
    setPreferredSports((current) => current.includes(key)
      ? current.filter((sport) => sport !== key)
      : [...current, key]);
  };

  const save = async () => {
    if (saveLock.current) return;
    const values = {
      full_name: fullName.trim(),
      phone,
      fitness_goal: fitnessGoal,
      preferred_sports: preferredSports,
    };
    const validationError = validateProfileInput(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) {
      notify('프로필 저장 실패', '프로필을 저장하려면 다시 로그인해주세요.');
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await supabase
        .from('profiles')
        .update(values)
        .eq('id', user.id)
        .select('id')
        .single();
      if (saveError) throw saveError;

      setUser({ ...user, ...values });
      notify('프로필 저장', '프로필을 저장했습니다.');
      navigation.goBack();
    } catch {
      const message = '프로필을 저장하지 못했습니다. 연결을 확인하고 다시 시도해주세요.';
      setError(message);
      notify('프로필 저장 실패', message);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>프로필 수정</Text>
      <Text style={styles.subtitle}>이름과 연락처, 운동 목표를 변경할 수 있습니다.</Text>

      <Input
        label="이름"
        accessibilityLabel="이름"
        value={fullName}
        onChangeText={setFullName}
        maxLength={30}
        editable={!saving}
        autoCapitalize="words"
      />
      <Input
        label="전화번호"
        accessibilityLabel="전화번호"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="010-1234-5678 (선택)"
        maxLength={20}
        editable={!saving}
      />

      <Text style={styles.label}>운동 목표</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="운동 목표">
        {fitnessGoals.map((goal) => {
          const selected = fitnessGoal === goal.key;
          return (
            <TouchableOpacity
              key={goal.key}
              accessibilityRole="radio"
              accessibilityLabel={goal.label}
              accessibilityState={{ checked: selected, disabled: saving }}
              aria-checked={selected}
              style={[styles.chip, selected && styles.chipSelected]}
              disabled={saving}
              onPress={() => setFitnessGoal(goal.key)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {goal.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>선호 운동 (1~5개)</Text>
      <View style={styles.chips} role="group" accessibilityLabel="선호 운동">
        {sports.map((sport) => {
          const selected = preferredSports.includes(sport.key);
          return (
            <TouchableOpacity
              key={sport.key}
              accessibilityRole="checkbox"
              accessibilityLabel={sport.label}
              accessibilityState={{ checked: selected, disabled: saving }}
              aria-checked={selected}
              style={[styles.chip, selected && styles.chipSelected]}
              disabled={saving}
              onPress={() => toggleSport(sport.key)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {sport.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button title="저장하기" onPress={save} loading={saving} fullWidth />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', lineHeight: 22, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff',
  },
  chipSelected: { backgroundColor: '#eff6ff' },
  chipText: { fontSize: 15, color: '#374151' },
  chipTextSelected: { color: '#2563eb', fontWeight: '700' },
  error: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#b91c1c', fontSize: 14, lineHeight: 20 },
});
