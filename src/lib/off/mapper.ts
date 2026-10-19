import { KJ_PER_KCAL } from '@/domain/units'
import type { Per100, Serving } from '@/domain/macros'

/** The subset of an Open Food Facts product we request (search-a-licious hit or v2 product). */
export type OffProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  /** An array in search-a-licious hits, a comma-separated string in the v2 product API. */
  brands?: string[] | string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

/** An OFF product normalized to our per-100g shape. Not yet in our database. */
export type OffFood = {
  off_code: string
  name: string
  brand: string | null
  per100: Per100
  servings: Serving[]
}

export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'serving_size',
  'serving_quantity',
  'nutriments',
].join(',')

// Anything above this per 100 g is bad data (pure fat is ~900 kcal).
const MAX_KCAL_100G = 900
const MAX_GRAMS_100G = 100

function num(value: unknown): number | null {
  // Number('') is 0: blank strings must count as missing, not as a real zero.
  if (typeof value === 'string' && value.trim() === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Where a product's nutrition lives. Most products have per-100 g values; some only list them "as
 * prepared" (powders made up with milk/water), and some only per serving (scaled to 100 g here).
 */
type NutrientSource = { suffix: '_100g' | '_prepared_100g' | '_serving'; scale: number; prepared: boolean }

function nutrientSource(p: OffProduct): NutrientSource | null {
  const n = p.nutriments
  const hasEnergy = (suffix: string) =>
    num(n?.[`energy-kcal${suffix}`]) != null ||
    num(n?.[`energy-kj${suffix}`]) != null ||
    num(n?.[`energy${suffix}`]) != null
  if (hasEnergy('_100g')) return { suffix: '_100g', scale: 1, prepared: false }
  if (hasEnergy('_prepared_100g')) return { suffix: '_prepared_100g', scale: 1, prepared: true }
  const servingGrams = num(p.serving_quantity)
  if (servingGrams != null && servingGrams > 0 && hasEnergy('_serving')) {
    return { suffix: '_serving', scale: 100 / servingGrams, prepared: false }
  }
  return null
}

function nutrient(n: OffProduct['nutriments'], key: string, src: NutrientSource): number | null {
  const v = num(n?.[`${key}${src.suffix}`])
  return v == null ? null : v * src.scale
}

function grams100(n: OffProduct['nutriments'], key: string, src: NutrientSource): number | null {
  const v = nutrient(n, key, src)
  return v != null && v <= MAX_GRAMS_100G ? round(v) : null
}

function round(v: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

function firstBrand(brands: OffProduct['brands']): string | null {
  const list = Array.isArray(brands) ? brands : (brands ?? '').split(',')
  const brand = list.map((b) => b.trim()).find(Boolean)
  return brand ?? null
}

/** Map an OFF product to an OffFood, or null if it lacks a name, barcode or usable energy value. */
export function mapOffProduct(p: OffProduct): OffFood | null {
  const code = p.code?.trim()
  // English first: Canadian products are bilingual and the main-language name is often French.
  const name = (p.product_name_en || p.product_name || '').trim()
  if (!code || !name) return null

  const n = p.nutriments
  const src = nutrientSource(p)
  if (!src) return null
  const kj = nutrient(n, 'energy-kj', src) ?? nutrient(n, 'energy', src)
  const kcal = nutrient(n, 'energy-kcal', src) ?? (kj != null ? kj / KJ_PER_KCAL : null)
  if (kcal == null || kcal > MAX_KCAL_100G) return null

  const sodiumG = nutrient(n, 'sodium', src)
  const servingGrams = num(p.serving_quantity)
  const servings: Serving[] =
    servingGrams != null && servingGrams > 0
      ? [{ label: p.serving_size?.trim() || '1 serving', grams: round(servingGrams, 1) }]
      : []

  return {
    off_code: code,
    name: src.prepared ? `${name} (prepared)` : name,
    brand: firstBrand(p.brands),
    per100: {
      kcal: round(kcal, 1),
      protein: grams100(n, 'proteins', src),
      carbs: grams100(n, 'carbohydrates', src),
      fat: grams100(n, 'fat', src),
      fiber: grams100(n, 'fiber', src),
      sugar: grams100(n, 'sugars', src),
      sat_fat: grams100(n, 'saturated-fat', src),
      sodium_mg: sodiumG != null && sodiumG <= MAX_GRAMS_100G ? round(sodiumG * 1000, 1) : null,
    },
    servings,
  }
}
