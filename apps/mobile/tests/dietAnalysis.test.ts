import { parseDietImageAnalysis } from '../src/lib/dietAnalysis';

declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
};

const analysis = {
  food_name: '비빔밥',
  calories: 450,
  macronutrients: { protein: 20, fat: 10, carb: 65, fiber: 5 },
  ai_analysis: '채소와 단백질이 포함된 식사입니다.',
  analysis: '식사 분석 결과입니다.',
  recommendations: ['채소를 곁들여주세요.'],
};

test('parses complete nutrition and excludes unrelated response fields', () => {
  const response = { ...analysis, food_name: ' 비빔밥 ', image_data_url: 'data:image/jpeg;base64,abc' };
  const result = parseDietImageAnalysis(response);
  expect(result).toEqual(analysis);
});

test('accepts zero calories and nutrients for an identified food', () => {
  const response = {
    ...analysis,
    food_name: '물',
    calories: 0,
    macronutrients: { protein: 0, fat: 0, carb: 0, fiber: 0 },
    recommendations: [],
  };
  const result = parseDietImageAnalysis(response);
  expect(result).toEqual(response);
});

test('normalizes fractional image calories for integer meal storage', () => {
  for (const [calories, expected] of [[450.4, 450], [450.5, 451], [0.4, 0]]) {
    const result = parseDietImageAnalysis({
      ...analysis,
      calories,
      macronutrients: { ...analysis.macronutrients, fat: 10.5 },
    });
    expect(result?.calories).toBe(expected);
    expect(result?.macronutrients.fat).toBe(10.5);
  }
});

test('rejects the unavailable AI fallback instead of offering a meal', () => {
  const response = {
    ...analysis,
    food_name: 'Unknown food',
    calories: 0,
    macronutrients: { protein: 0, fat: 0, carb: 0, fiber: 0 },
  };
  const result = parseDietImageAnalysis(response);
  expect(result).toBe(null);
});

test('rejects missing or malformed structured analysis', () => {
  const responses: unknown[] = [
    null, [], 'unavailable', {},
    { ...analysis, food_name: ' ' },
    { ...analysis, macronutrients: null },
    { ...analysis, macronutrients: { protein: 20, fat: 10, carb: 65 } },
    { ...analysis, ai_analysis: undefined },
    { ...analysis, analysis: '' },
    { ...analysis, recommendations: ['valid', 4] },
  ];
  const results = responses.map(parseDietImageAnalysis);
  expect(results).toEqual(responses.map(() => null));
});

test('rejects nonnumeric negative and nonfinite calories', () => {
  const invalidCalories = ['450', null, -1, NaN, Infinity];
  const results = invalidCalories.map((calories) => parseDietImageAnalysis({ ...analysis, calories }));
  expect(results).toEqual(invalidCalories.map(() => null));
});

test('rejects invalid values in every nutrient field', () => {
  const invalidMacros = ['protein', 'fat', 'carb', 'fiber'].flatMap((key) =>
    ['10', null, -1, NaN, Infinity].map((value) => ({ ...analysis.macronutrients, [key]: value }))
  );
  const results = invalidMacros.map((macronutrients) =>
    parseDietImageAnalysis({ ...analysis, macronutrients })
  );
  expect(results).toEqual(invalidMacros.map(() => null));
});
