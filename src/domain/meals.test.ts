import { describe, expect, it } from 'vitest'
import { suggestMeal } from './meals'

const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const at = (h: number, m = 0) => new Date(2026, 9, 19, h, m)

describe('suggestMeal', () => {
  it('picks a meal by time of day', () => {
    expect(suggestMeal(meals, at(7))).toBe('Breakfast')
    expect(suggestMeal(meals, at(10, 29))).toBe('Breakfast')
    expect(suggestMeal(meals, at(10, 30))).toBe('Lunch')
    expect(suggestMeal(meals, at(18))).toBe('Dinner')
    expect(suggestMeal(meals, at(22))).toBe('Snacks')
    expect(suggestMeal(meals, at(1))).toBe('Breakfast')
  })

  it('falls back to the first meal for custom meal setups', () => {
    expect(suggestMeal(['Meal 1', 'Meal 2', 'Meal 3'], at(18))).toBe('Meal 1')
    expect(suggestMeal([], at(18))).toBe('Snacks')
  })
})
