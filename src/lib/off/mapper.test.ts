import { describe, expect, it } from 'vitest'
import { mapOffProduct } from './mapper'

describe('mapOffProduct', () => {
  it('maps a search-a-licious hit (brands as array)', () => {
    const food = mapOffProduct({
      code: '0894700010137',
      brands: ['Chobani'],
      product_name: 'Nonfat Greek Yogurt',
      nutriments: {
        carbohydrates_100g: 3.53,
        'energy-kcal_100g': 52.9,
        fat_100g: 0,
        proteins_100g: 9.41,
        sodium_100g: 0.0382,
        sugars_100g: 3.53,
      },
    })
    expect(food).toEqual({
      off_code: '0894700010137',
      name: 'Nonfat Greek Yogurt',
      brand: 'Chobani',
      per100: {
        kcal: 52.9,
        protein: 9.41,
        carbs: 3.53,
        fat: 0,
        fiber: null,
        sugar: 3.53,
        sat_fat: null,
        sodium_mg: 38.2,
      },
      servings: [],
    })
  })

  it('maps a v2 product (brands as string) with a serving', () => {
    const food = mapOffProduct({
      code: '3017624010701',
      brands: 'Ferrero, Nutella',
      product_name: 'Nutella',
      serving_size: '15 g',
      serving_quantity: '15',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
    })
    expect(food?.brand).toBe('Ferrero')
    expect(food?.servings).toEqual([{ label: '15 g', grams: 15 }])
  })

  it('derives kcal from kJ when kcal is missing', () => {
    const food = mapOffProduct({ code: '1', product_name: 'X', nutriments: { 'energy-kj_100g': 418.4 } })
    expect(food?.per100.kcal).toBe(100)
  })

  it('rejects products without a name, code or plausible energy', () => {
    expect(mapOffProduct({ code: '1', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull()
    expect(mapOffProduct({ product_name: 'X', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull()
    expect(mapOffProduct({ code: '1', product_name: 'X', nutriments: {} })).toBeNull()
    expect(
      mapOffProduct({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': 5000 } }),
    ).toBeNull()
  })

  it('drops implausible nutrient values instead of trusting them', () => {
    const food = mapOffProduct({
      code: '1',
      product_name: 'X',
      nutriments: { 'energy-kcal_100g': 100, proteins_100g: 250, fat_100g: -1 },
    })
    expect(food?.per100.protein).toBeNull()
    expect(food?.per100.fat).toBeNull()
  })
})
