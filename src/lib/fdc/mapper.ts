import type { Per100, Serving } from '@/domain/macros'
import { KJ_PER_KCAL } from '@/domain/units'
import type { OffFood } from '@/lib/off/mapper'

/** A USDA FoodData Central branded food, as returned by /api/fdc-barcode (values per 100 g/ml). */
export type FdcFood = {
  fdcId: number
  description: string
  brandName?: string
  brandOwner?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients: { nutrientId: number; unitName?: string; value?: number }[]
}

// FDC nutrient ids.
const ENERGY = [1008, 2047, 2048] // Energy; Atwater general / specific factors
const PROTEIN = 1003
const FAT = 1004
const CARBS = 1005
const FIBER = 1079
const SUGARS = [2000, 1063]
const SAT_FAT = 1258
const SODIUM = 1093 // mg

const MAX_KCAL_100G = 900

const round = (v: number, decimals = 2) => Math.round(v * 10 ** decimals) / 10 ** decimals

/** "DIET COKE FRIDGE PACK" → "Diet Coke Fridge Pack"; mixed-case names are kept as written. */
function tidy(text: string | undefined): string | null {
  const t = text?.trim().replace(/\s+/g, ' ')
  if (!t) return null
  if (t !== t.toUpperCase()) return t
  return t
    .toLowerCase()
    .replace(/(^|[\s(/&-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase())
}

/** Map an FDC food to the same shape as an Open Food Facts food, keyed by our canonical barcode. */
export function mapFdcFood(food: FdcFood, canonicalCode: string): OffFood | null {
  const name = tidy(food.description)
  if (!name) return null
  const value = (ids: number | number[], max = 100) => {
    for (const id of [ids].flat()) {
      const n = food.foodNutrients.find((x) => x.nutrientId === id)
      if (n?.value == null || !Number.isFinite(n.value) || n.value < 0) continue
      const v = n.unitName?.toUpperCase() === 'KJ' ? n.value / KJ_PER_KCAL : n.value
      if (v <= max) return v
    }
    return null
  }

  const kcal = value(ENERGY, MAX_KCAL_100G)
  if (kcal == null) return null
  const grams = (id: number | number[]) => {
    const v = value(id)
    return v == null ? null : round(v)
  }
  const sodium = value(SODIUM, 100_000)
  const per100: Per100 = {
    kcal: round(kcal, 1),
    protein: grams(PROTEIN),
    carbs: grams(CARBS),
    fat: grams(FAT),
    fiber: grams(FIBER),
    sugar: grams(SUGARS),
    sat_fat: grams(SAT_FAT),
    sodium_mg: sodium == null ? null : round(sodium, 1),
  }

  // Branded serving sizes are in g or ml; ml is treated as g (as the label's per-100 values are).
  const unit = food.servingSizeUnit?.toUpperCase()
  const size = food.servingSize
  const servings: Serving[] =
    size != null && size > 0 && (unit === 'G' || unit === 'GRM' || unit === 'ML' || unit === 'MLT')
      ? [
          {
            label:
              food.householdServingFullText?.trim() ||
              `${round(size, 1)} ${unit.startsWith('M') ? 'ml' : 'g'}`,
            grams: round(size, 1),
          },
        ]
      : []

  return {
    off_code: canonicalCode,
    name,
    brand: tidy(food.brandName) ?? tidy(food.brandOwner),
    per100,
    servings,
  }
}
