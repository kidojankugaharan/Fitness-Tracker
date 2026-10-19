// Nutrition math. Foods store values per 100 g; entries store grams plus a snapshot of the food.

export type Per100 = {
  kcal: number
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  sat_fat: number | null
  sodium_mg: number | null
}

export type Serving = { label: string; grams: number }

/**
 * Stored in food_entries.food_snapshot so editing or deleting a food never rewrites history.
 * `kind: 'quick'` marks a quick-add entry: no food, stored as 100 g of a "food" whose per-100g
 * values are exactly the calories/macros the user typed.
 */
export type FoodSnapshot = { name: string; brand: string | null; per100: Per100; kind?: 'quick' }

export const QUICK_ADD_GRAMS = 100

export function quickAddSnapshot(input: {
  name: string
  kcal: number
  protein: number | null
  carbs: number | null
  fat: number | null
}): FoodSnapshot {
  return {
    kind: 'quick',
    name: input.name.trim() || 'Quick add',
    brand: null,
    per100: {
      kcal: input.kcal,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      fiber: null,
      sugar: null,
      sat_fat: null,
      sodium_mg: null,
    },
  }
}

/** Nutrition label values as printed, for `basisGrams` of food (a serving, or 100 g). */
export type LabelValues = {
  kcal: number
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  sat_fat: number | null
  sodium_mg: number | null
}

/** Convert label values for `basisGrams` of food to per-100g values (rounded to 2 decimals). */
export function per100FromLabel(label: LabelValues, basisGrams: number): Per100 {
  if (!(basisGrams > 0)) throw new Error('basisGrams must be positive')
  const f = 100 / basisGrams
  const scale = (v: number | null) => (v == null ? null : Math.round(v * f * 100) / 100)
  return {
    kcal: scale(label.kcal)!,
    protein: scale(label.protein),
    carbs: scale(label.carbs),
    fat: scale(label.fat),
    fiber: scale(label.fiber),
    sugar: scale(label.sugar),
    sat_fat: scale(label.sat_fat),
    sodium_mg: scale(label.sodium_mg),
  }
}

export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

/** Macros for `grams` of a food. Unknown (null) nutrients count as 0 in totals. */
export function macrosFor(per100: Per100, grams: number): Macros {
  const f = grams / 100
  return {
    kcal: per100.kcal * f,
    protein: (per100.protein ?? 0) * f,
    carbs: (per100.carbs ?? 0) * f,
    fat: (per100.fat ?? 0) * f,
  }
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    ZERO_MACROS,
  )
}

/** Fraction of goal reached, clamped to [0, 1] for progress bars. */
export function progressFraction(eaten: number, goal: number): number {
  if (goal <= 0) return eaten > 0 ? 1 : 0
  return Math.min(1, Math.max(0, eaten / goal))
}

/** Parse a stored snapshot defensively (it is JSON from the database). */
export function parseSnapshot(value: unknown): FoodSnapshot {
  const v = (value ?? {}) as Partial<FoodSnapshot>
  const p = (v.per100 ?? {}) as Partial<Per100>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  return {
    ...(v.kind === 'quick' ? { kind: 'quick' as const } : {}),
    name: typeof v.name === 'string' ? v.name : 'Unknown food',
    brand: typeof v.brand === 'string' ? v.brand : null,
    per100: {
      kcal: num(p.kcal) ?? 0,
      protein: num(p.protein),
      carbs: num(p.carbs),
      fat: num(p.fat),
      fiber: num(p.fiber),
      sugar: num(p.sugar),
      sat_fat: num(p.sat_fat),
      sodium_mg: num(p.sodium_mg),
    },
  }
}

/** True when a serving label only restates its weight ("40 g", "40g"), so showing both is noise. */
export function isWeightOnlyLabel(label: string, grams: number): boolean {
  const n = Number(/^\s*([\d.,]+)\s*g\s*$/i.exec(label)?.[1]?.replace(',', '.'))
  return Number.isFinite(n) && Math.abs(n - grams) < 0.05
}

export function parseServings(value: unknown): Serving[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (s): s is Serving =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Serving).label === 'string' &&
      typeof (s as Serving).grams === 'number' &&
      (s as Serving).grams > 0,
  )
}
