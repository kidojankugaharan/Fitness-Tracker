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

describe('blank nutrient strings', () => {
  it('treats them as missing, so kJ can still provide energy', () => {
    const food = mapOffProduct({
      code: '1',
      product_name: 'X',
      nutriments: { 'energy-kcal_100g': '', 'energy-kj_100g': '418.4', proteins_100g: ' ', fat_100g: '3' },
    })
    expect(food?.per100.kcal).toBe(100)
    expect(food?.per100.protein).toBeNull()
    expect(food?.per100.fat).toBe(3)
  })

  it('rejects a product whose only energy value is blank', () => {
    expect(mapOffProduct({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': '' } })).toBeNull()
  })

  it('falls back to "as prepared" values and says so in the name', () => {
    const food = mapOffProduct({
      code: '7613035676497',
      product_name: 'Ricoré',
      nutriments: {
        'energy-kcal_prepared_100g': 50,
        carbohydrates_prepared_100g: 5,
        proteins_prepared_100g: 3,
      },
    })
    expect(food?.name).toBe('Ricoré (prepared)')
    expect(food?.per100).toMatchObject({ kcal: 50, carbs: 5, protein: 3, fat: null })
  })

  it('scales per-serving-only nutrition to 100 g', () => {
    const food = mapOffProduct({
      code: '0060383000000',
      product_name: 'Granola bar',
      serving_size: '40 g',
      serving_quantity: 40,
      nutriments: { 'energy-kcal_serving': 180, proteins_serving: 4, fat_serving: 6 },
    })
    expect(food?.per100).toMatchObject({ kcal: 450, protein: 10, fat: 15, carbs: null })
  })
})
