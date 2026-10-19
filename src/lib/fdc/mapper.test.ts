import { describe, expect, it } from 'vitest'
import { mapFdcFood, type FdcFood } from './mapper'

// Shaped like a real FoodData Central branded search result (Diet Coke, fdcId 2742723).
const dietCoke: FdcFood = {
  fdcId: 2742723,
  description: 'Diet Coke Fridge Pack Cans, 12 fl oz, 12 Pack',
  brandName: 'Coca-Cola light/diet Coke',
  brandOwner: 'Coca-Cola',
  gtinUpc: '00049000028911',
  servingSize: 355,
  servingSizeUnit: 'MLT',
  householdServingFullText: '1 Can',
  foodNutrients: [
    { nutrientId: 1003, unitName: 'G', value: 0 },
    { nutrientId: 1004, unitName: 'G', value: 0 },
    { nutrientId: 1005, unitName: 'G', value: 0 },
    { nutrientId: 1008, unitName: 'KCAL', value: 0 },
    { nutrientId: 2000, unitName: 'G', value: 0 },
    { nutrientId: 1093, unitName: 'MG', value: 11 },
    { nutrientId: 1258, unitName: 'G', value: 0 },
  ],
}

describe('mapFdcFood', () => {
  it('maps a branded food, keyed by our canonical barcode', () => {
    expect(mapFdcFood(dietCoke, '0049000028911')).toEqual({
      off_code: '0049000028911',
      name: 'Diet Coke Fridge Pack Cans, 12 fl oz, 12 Pack',
      brand: 'Coca-Cola light/diet Coke',
      per100: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: 0, sat_fat: 0, sodium_mg: 11 },
      servings: [{ label: '1 Can', grams: 355 }],
    })
  })

  it('tidies all-caps names and falls back to the brand owner', () => {
    const food = mapFdcFood(
      {
        fdcId: 1,
        description: 'PROTEIN BAR, CHOCOLATE CHIP COOKIE DOUGH',
        brandOwner: 'QUEST NUTRITION, LLC',
        servingSize: 60,
        servingSizeUnit: 'g',
        foodNutrients: [
          { nutrientId: 1008, unitName: 'KCAL', value: 333 },
          { nutrientId: 1003, unitName: 'G', value: 35 },
        ],
      },
      '0888849000210',
    )
    expect(food?.name).toBe('Protein Bar, Chocolate Chip Cookie Dough')
    expect(food?.brand).toBe('Quest Nutrition, Llc')
    expect(food?.servings).toEqual([{ label: '60 g', grams: 60 }])
    expect(food?.per100.carbs).toBeNull() // missing stays missing, never 0
  })

  it('uses kJ or Atwater energy when kcal is missing, and rejects foods without energy', () => {
    const base = { fdcId: 2, description: 'Oats', servingSize: 40, servingSizeUnit: 'G' }
    expect(
      mapFdcFood({ ...base, foodNutrients: [{ nutrientId: 1008, unitName: 'kJ', value: 1569 }] }, '1')?.per100
        .kcal,
    ).toBe(375)
    expect(
      mapFdcFood({ ...base, foodNutrients: [{ nutrientId: 2047, unitName: 'KCAL', value: 380 }] }, '1')
        ?.per100.kcal,
    ).toBe(380)
    expect(mapFdcFood({ ...base, foodNutrients: [{ nutrientId: 1003, value: 13 }] }, '1')).toBeNull()
  })
})
