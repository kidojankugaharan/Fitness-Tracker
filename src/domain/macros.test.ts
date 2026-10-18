import { describe, expect, it } from 'vitest'
import {
  isWeightOnlyLabel,
  macrosFor,
  parseServings,
  parseSnapshot,
  progressFraction,
  sumMacros,
  type Per100,
} from './macros'

const oats: Per100 = {
  kcal: 389,
  protein: 16.9,
  carbs: 66.3,
  fat: 6.9,
  fiber: 10.6,
  sugar: null,
  sat_fat: null,
  sodium_mg: null,
}

describe('macrosFor', () => {
  it('scales per-100g values by grams', () => {
    const m = macrosFor(oats, 50)
    expect(m.kcal).toBeCloseTo(194.5)
    expect(m.protein).toBeCloseTo(8.45)
    expect(m.carbs).toBeCloseTo(33.15)
    expect(m.fat).toBeCloseTo(3.45)
  })

  it('treats unknown nutrients as 0', () => {
    const m = macrosFor({ ...oats, protein: null, fat: null }, 100)
    expect(m.protein).toBe(0)
    expect(m.fat).toBe(0)
  })
})

describe('sumMacros', () => {
  it('adds entries and handles an empty day', () => {
    expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
    const total = sumMacros([macrosFor(oats, 100), macrosFor(oats, 50)])
    expect(total.kcal).toBeCloseTo(583.5)
  })
})

describe('progressFraction', () => {
  it('clamps to [0, 1]', () => {
    expect(progressFraction(50, 100)).toBe(0.5)
    expect(progressFraction(150, 100)).toBe(1)
    expect(progressFraction(10, 0)).toBe(1)
    expect(progressFraction(0, 0)).toBe(0)
  })
})

describe('parsing stored JSON', () => {
  it('parses a snapshot and fills gaps safely', () => {
    expect(parseSnapshot({ name: 'Oats', per100: { kcal: 389, protein: 'x' } })).toEqual({
      name: 'Oats',
      brand: null,
      per100: {
        kcal: 389,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sat_fat: null,
        sodium_mg: null,
      },
    })
    expect(parseSnapshot(null).name).toBe('Unknown food')
  })

  it('keeps only valid servings', () => {
    expect(
      parseServings([{ label: '1 cup', grams: 80 }, { label: 'bad', grams: 0 }, 'x', { label: 2, grams: 5 }]),
    ).toEqual([{ label: '1 cup', grams: 80 }])
    expect(parseServings({})).toEqual([])
  })
})

describe('isWeightOnlyLabel', () => {
  it('detects labels that just restate the weight', () => {
    expect(isWeightOnlyLabel('40 g', 40)).toBe(true)
    expect(isWeightOnlyLabel('40g', 40)).toBe(true)
    expect(isWeightOnlyLabel('12,5 g', 12.5)).toBe(true)
    expect(isWeightOnlyLabel('40 g', 30)).toBe(false)
    expect(isWeightOnlyLabel('1 slice', 30)).toBe(false)
    expect(isWeightOnlyLabel('2 scoops (60 g)', 60)).toBe(false)
  })
})
