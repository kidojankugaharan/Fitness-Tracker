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

function grams100(nutriments: OffProduct['nutriments'], key: string): number | null {
  const v = num(nutriments?.[`${key}_100g`])
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
  const name = (p.product_name || p.product_name_en || '').trim()
  if (!code || !name) return null

  const n = p.nutriments
  const kj = num(n?.['energy-kj_100g']) ?? num(n?.['energy_100g'])
  const kcal = num(n?.['energy-kcal_100g']) ?? (kj != null ? kj / KJ_PER_KCAL : null)
  if (kcal == null || kcal > MAX_KCAL_100G) return null

  const sodiumG = num(n?.['sodium_100g'])
  const servingGrams = num(p.serving_quantity)
  const servings: Serving[] =
    servingGrams != null && servingGrams > 0
      ? [{ label: p.serving_size?.trim() || '1 serving', grams: round(servingGrams, 1) }]
      : []

  return {
    off_code: code,
    name,
    brand: firstBrand(p.brands),
    per100: {
      kcal: round(kcal, 1),
      protein: grams100(n, 'proteins'),
      carbs: grams100(n, 'carbohydrates'),
      fat: grams100(n, 'fat'),
      fiber: grams100(n, 'fiber'),
      sugar: grams100(n, 'sugars'),
      sat_fat: grams100(n, 'saturated-fat'),
      sodium_mg: sodiumG != null && sodiumG <= MAX_GRAMS_100G ? round(sodiumG * 1000, 1) : null,
    },
    servings,
  }
}
