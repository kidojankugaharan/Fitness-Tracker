import { describe, expect, it } from 'vitest'
import { draftFromSet, formatDuration, formatSet, isLoggable, parseSetDraft } from './sets'

const empty = { weight_kg: null, reps: null, duration_sec: null, distance_m: null }
const blankDraft = { weight_kg: '', reps: '', duration_sec: '', distance_m: '' }

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(3725)).toBe('1:02:05')
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

describe('set drafts', () => {
  it('round-trips a set through the logger in display units', () => {
    const draft = draftFromSet({ ...empty, weight_kg: 102.5, reps: 5 }, 'kg')
    expect(draft).toEqual({ weight_kg: '102.5', reps: '5', duration_sec: '', distance_m: '' })
    expect(parseSetDraft(draft, 'kg')).toEqual({
      values: { ...empty, weight_kg: 102.5, reps: 5 },
      invalid: [],
    })
  })

  it('converts lb and km to canonical units', () => {
    const { values } = parseSetDraft({ ...blankDraft, weight_kg: '225', distance_m: '5,5' }, 'lb')
    expect(values.weight_kg).toBeCloseTo(102.06, 2)
    expect(values.distance_m).toBe(5500)
  })

  it('reports invalid fields instead of treating them as blank', () => {
    expect(parseSetDraft({ ...blankDraft, weight_kg: '-5', reps: '5' }, 'kg').invalid).toEqual(['weight_kg'])
    expect(parseSetDraft({ ...blankDraft, weight_kg: 'abc', reps: '5' }, 'kg').invalid).toEqual(['weight_kg'])
  })
})

describe('isLoggable', () => {
  const parse = (d: Partial<typeof blankDraft>) => parseSetDraft({ ...blankDraft, ...d }, 'kg')

  it('requires an explicit weight for weighted sets, allowing 0', () => {
    expect(isLoggable(parse({ weight_kg: '100', reps: '5' }), 'weight_reps')).toBe(true)
    expect(isLoggable(parse({ weight_kg: '0', reps: '5' }), 'weight_reps')).toBe(true)
    expect(isLoggable(parse({ reps: '5' }), 'weight_reps')).toBe(false)
    expect(isLoggable(parse({ weight_kg: '-5', reps: '5' }), 'weight_reps')).toBe(false)
    expect(isLoggable(parse({ weight_kg: '40' }), 'weight_time')).toBe(false)
    expect(isLoggable(parse({ weight_kg: '40', duration_sec: '30' }), 'weight_time')).toBe(true)
  })

  it('ignores invalid text in fields the exercise type does not show', () => {
    expect(isLoggable(parse({ reps: '10', weight_kg: 'x' }), 'reps')).toBe(true)
    expect(isLoggable(parse({ reps: '0' }), 'reps')).toBe(false)
    expect(isLoggable(parse({ distance_m: '5' }), 'distance')).toBe(true)
    expect(isLoggable(parse({ duration_sec: 'soon' }), 'time')).toBe(false)
  })
})
