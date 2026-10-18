import { describe, expect, it } from 'vitest'
import { addDays, formatDayLabel, parseLocalDate, toLocalDate, today } from './dates'

describe('local dates', () => {
  it('uses the local calendar day, not UTC', () => {
    // 23:30 local time on Oct 18 stays Oct 18 regardless of timezone offset.
    expect(toLocalDate(new Date(2026, 9, 18, 23, 30))).toBe('2026-10-18')
    expect(today(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })

  it('round-trips through parse', () => {
    expect(toLocalDate(parseLocalDate('2026-02-28'))).toBe('2026-02-28')
  })

  it('rejects invalid dates', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow()
    expect(() => parseLocalDate('18/10/2026')).toThrow()
  })

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('labels relative days', () => {
    const now = new Date(2026, 9, 18, 12)
    expect(formatDayLabel('2026-10-18', now)).toBe('Today')
    expect(formatDayLabel('2026-10-17', now)).toBe('Yesterday')
    expect(formatDayLabel('2026-10-19', now)).toBe('Tomorrow')
    expect(formatDayLabel('2026-10-12', now)).not.toBe('Today')
  })
})
