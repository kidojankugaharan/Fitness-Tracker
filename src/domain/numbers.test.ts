import { describe, expect, it } from 'vitest'
import { isInvalid, parseNonNegative } from './numbers'

describe('parseNonNegative', () => {
  it('parses numbers, including comma decimals', () => {
    expect(parseNonNegative('82.5')).toBe(82.5)
    expect(parseNonNegative(' 12,5 ')).toBe(12.5)
    expect(parseNonNegative('0')).toBe(0)
    expect(parseNonNegative('.5')).toBe(0.5)
  })

  it('distinguishes blank from invalid', () => {
    expect(parseNonNegative('')).toBeNull()
    expect(parseNonNegative('   ')).toBeNull()
    for (const bad of ['-5', 'abc', '1e3', '1.2.3', '.', '5kg']) {
      expect(isInvalid(parseNonNegative(bad))).toBe(true)
    }
    expect(isInvalid(null)).toBe(false)
  })
})
