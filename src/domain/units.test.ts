import { describe, expect, it } from 'vitest'
import { displayToKg, formatEnergy, formatNumber, formatWeight, kgToDisplay } from './units'

describe('weight conversion', () => {
  it('is identity for kg', () => {
    expect(kgToDisplay(100, 'kg')).toBe(100)
    expect(displayToKg(100, 'kg')).toBe(100)
  })

  it('converts kg to lb and back', () => {
    expect(kgToDisplay(100, 'lb')).toBeCloseTo(220.462, 3)
    expect(displayToKg(225, 'lb')).toBeCloseTo(102.058, 3)
    expect(displayToKg(kgToDisplay(82.5, 'lb'), 'lb')).toBeCloseTo(82.5, 10)
  })
})

describe('formatting', () => {
  it('drops trailing zeros', () => {
    expect(formatNumber(82.5)).toBe('82.5')
    expect(formatNumber(100)).toBe('100')
    expect(formatNumber(-0.01)).toBe('0')
  })

  it('formats weights in the chosen unit', () => {
    expect(formatWeight(102.5, 'kg')).toBe('102.5 kg')
    expect(formatWeight(1.25, 'kg')).toBe('1.25 kg')
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })

  it('formats energy', () => {
    expect(formatEnergy(2200, 'kcal')).toBe('2200 kcal')
    expect(formatEnergy(100, 'kJ')).toBe('418 kJ')
  })
})
