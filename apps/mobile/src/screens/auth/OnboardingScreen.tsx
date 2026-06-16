import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

const fitnessGoals = [
  { key: 'weight_loss', label: '체중 감량' },
  { key: 'muscle_gain', label: '근육 증가' },
  { key: 'maintenance', label: '건강 유지' },
  { key: 'endurance', label: '지구력 향상' },
];

const sports = [
  { key: 'gym', label: '헬스' },
  { key: 'running', label: '러닝' },
  { key: 'pilates', label: '필라테스' },
  { key: 'yoga', label: '요가' },
  { key: 'crossfit', label: '크로스핏' },
];

export const OnboardingScreen: React.FC = () => {
  const [step, setStep] = useState(0);
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setUser } = useStore();

  const handleSportSelect = (sportKey: string) => {
    setPreferredSports((prev) =>
      prev.includes(sportKey) ? prev.filter((sport) => sport !== sportKey) : [...prev, sportKey]
    );
  };

  const handleNext = async () => {
    if (step === 0 && !fitnessGoal) {
      Alert.alert('목표 선택', '지금 가장 중요한 운동 목표를 선택해주세요.');
      return;
    }

    if (step === 1 && preferredSports.length === 0) {
      Alert.alert('운동 선택', '원하는 운동 스타일을 하나 이상 선택해주세요.');
      return;
    }

    if (step === 2 && !fullName.trim()) {
      Alert.alert('이름 입력', '코치에게 표시할 이름을 입력해주세요.');
      return;
    }

    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    if (!user) {
      Alert.alert('세션 없음', '온보딩을 마치려면 다시 로그인해주세요.');
      return;
    }

    const updatedUser = {
      ...user,
      full_name: fullName.trim(),
      fitness_goal: fitnessGoal,
      preferred_sports: preferredSports,
      onboarding_completed: true,
    };

    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email,
          full_name: updatedUser.full_name,
          role: user.role ?? 'user',
          fitness_goal: fitnessGoal,
          preferred_sports: preferredSports,
          onboarding_completed: true,
        },
        { onConflict: 'id' }
      );

      if (error) throw error;

      setUser(updatedUser);
    } catch (error: any) {
      Alert.alert('온보딩 실패', error.message ?? '프로필을 저장할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderGoalStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>주요 목표를 선택하세요</Text>
      <Text style={styles.stepSubtitle}>목표에 맞춰 코치, 식단, 운동 의류 추천을 조정합니다.</Text>
      <View style={styles.optionsContainer}>
        {fitnessGoals.map((goal) => (
          <TouchableOpacity
            key={goal.key}
            style={[styles.optionCard, fitnessGoal === goal.key && styles.selectedOption]}
            onPress={() => setFitnessGoal(goal.key)}
          >
            <Text style={[styles.optionLabel, fitnessGoal === goal.key && styles.selectedOptionLabel]}>
              {goal.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSportStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>운동 스타일 선택</Text>
      <Text style={styles.stepSubtitle}>도움받고 싶은 운동을 모두 선택해주세요.</Text>
      <View style={styles.sportsContainer}>
        {sports.map((sport) => (
          <TouchableOpacity
            key={sport.key}
            style={[styles.sportTag, preferredSports.includes(sport.key) && styles.selectedSport]}
            onPress={() => handleSportSelect(sport.key)}
          >
            <Text style={[styles.sportLabel, preferredSports.includes(sport.key) && styles.selectedSportLabel]}>
              {sport.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>프로필 이름 입력</Text>
      <Text style={styles.stepSubtitle}>예약 시 코치에게 이 이름이 표시됩니다.</Text>
      <View style={styles.form}>
        <Input
          label="이름"
          value={fullName}
          onChangeText={setFullName}
          placeholder="이름 입력"
          autoCapitalize="words"
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={[styles.progressDot, index <= step && styles.activeDot]} />
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {step === 0 && renderGoalStep()}
        {step === 1 && renderSportStep()}
        {step === 2 && renderNameStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <Button
            title="이전"
            onPress={() => setStep((current) => current - 1)}
            variant="secondary"
            style={styles.backButton}
          />
        )}
        <Button
          title={step === 2 ? '완료' : '다음'}
          onPress={handleNext}
          loading={loading}
          fullWidth={step === 0}
          style={styles.nextButton}
        />
      </View>
    </View>
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 52,
    paddingBottom: 20,
  },
  progressDot: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  activeDot: {
    backgroundColor: '#2563eb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  stepContainer: {
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedOption: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  selectedOptionLabel: {
    color: '#2563eb',
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sportTag: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedSport: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  sportLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  selectedSportLabel: {
    color: '#ffffff',
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  backButton: {
    flex: 1,
    marginRight: 12,
  },
  nextButton: {
    flex: 2,
  },
});
