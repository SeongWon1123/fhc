import type { DietLog } from '../types';

export type DietImageAnalysis = Readonly<{
  food_name: string;
  calories: number;
  macronutrients: Readonly<Required<DietLog['macronutrients']>>;
  ai_analysis: string;
  analysis: string;
  recommendations: readonly string[];
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonnegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isNonemptyText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

// The image endpoint can return HTTP 200 with an unavailable/unparsed AI fallback.
// Only a complete, usable nutrition result may become a saveable meal.
export function parseDietImageAnalysis(value: unknown): DietImageAnalysis | null {
  if (!isRecord(value) || !isRecord(value.macronutrients)) return null;
  const macros = value.macronutrients;
  if (
    !isNonemptyText(value.food_name) ||
    value.food_name.trim().toLowerCase() === 'unknown food' ||
    !isNonnegativeNumber(value.calories) ||
    !isNonnegativeNumber(macros.protein) ||
    !isNonnegativeNumber(macros.fat) ||
    !isNonnegativeNumber(macros.carb) ||
    !isNonnegativeNumber(macros.fiber) ||
    !isNonemptyText(value.ai_analysis) ||
    !isNonemptyText(value.analysis) ||
    !Array.isArray(value.recommendations) ||
    !value.recommendations.every(isNonemptyText)
  ) return null;

  return {
    food_name: value.food_name.trim(),
    calories: Math.round(value.calories),
    macronutrients: {
      protein: macros.protein,
      fat: macros.fat,
      carb: macros.carb,
      fiber: macros.fiber,
    },
    ai_analysis: value.ai_analysis.trim(),
    analysis: value.analysis.trim(),
    recommendations: value.recommendations.map((item: string) => item.trim()),
  };
}
