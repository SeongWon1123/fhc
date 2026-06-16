import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DietLog } from '../types';

interface DietLogCardProps {
  log: DietLog;
  onPress?: () => void;
}

const mealConfig: Record<DietLog['meal_type'], { label: string; accent: string }> = {
  breakfast: { label: '아침', accent: '#f59e0b' },
  lunch: { label: '점심', accent: '#2563eb' },
  dinner: { label: '저녁', accent: '#7c3aed' },
  snack: { label: '간식', accent: '#16a34a' },
};

export const DietLogCard: React.FC<DietLogCardProps> = ({ log, onPress }) => {
  const config = mealConfig[log.meal_type];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={[styles.mealBadge, { backgroundColor: `${config.accent}1A` }]}>
          <Text style={[styles.mealLabel, { color: config.accent }]}>{config.label}</Text>
        </View>
        <Text style={styles.calories}>{log.calories}kcal</Text>
      </View>

      {log.image_url ? <Image source={{ uri: log.image_url }} style={styles.image} /> : null}

      <Text style={styles.foodName}>{log.food_name}</Text>

      <View style={styles.macros}>
        <View style={styles.macroItem}>
          <Text style={styles.macroLabel}>탄수</Text>
          <Text style={styles.macroValue}>{log.macronutrients.carb}g</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroLabel}>단백질</Text>
          <Text style={styles.macroValue}>{log.macronutrients.protein}g</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroLabel}>지방</Text>
          <Text style={styles.macroValue}>{log.macronutrients.fat}g</Text>
        </View>
      </View>

      {log.ai_analysis ? (
        <View style={styles.analysisContainer}>
          <Text style={styles.analysisLabel}>AI 메모</Text>
          <Text style={styles.analysisText} numberOfLines={2}>{log.ai_analysis}</Text>
        </View>
      ) : null}
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
  mealBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  mealLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  calories: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  analysisContainer: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
  },
  analysisLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 4,
  },
  analysisText: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 16,
  },
});
