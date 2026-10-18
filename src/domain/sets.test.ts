import { describe, expect, it } from 'vitest'
import { formatDuration, formatSet, parseDuration } from './sets'

const empty = { weight_kg: null, reps: null, duration_sec: null, distance_m: null }

describe('durations', () => {
  it('formats and parses', () => {
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(parseDuration('1:15')).toBe(75)
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('1:02:05')).toBe(3725)
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('')).toBeNull()
  })
})

describe('formatSet', () => {
  it('formats each exercise type', () => {
    expect(formatSet({ ...empty, weight_kg: 100, reps: 5 }, 'weight_reps', 'kg')).toBe('100 kg × 5')
    expect(formatSet({ ...empty, weight_kg: 100, reps: 5 }, 'weight_reps', 'lb')).toBe('220.46 lb × 5')
    expect(formatSet({ ...empty, reps: 12 }, 'reps', 'kg')).toBe('12 reps')
    expect(formatSet({ ...empty, duration_sec: 60 }, 'time', 'kg')).toBe('1:00')
    expect(formatSet({ ...empty, distance_m: 5000, duration_sec: 1500 }, 'distance', 'kg')).toBe(
      '5 km · 25:00',
    )
    expect(formatSet({ ...empty, weight_kg: 40, duration_sec: 45 }, 'weight_time', 'kg')).toBe('40 kg · 0:45')
  })
})
