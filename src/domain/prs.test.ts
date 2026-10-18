import { describe, expect, it } from 'vitest'
import { annotatePRs, estimate1RM, summarizeRecords, type SetLike } from './prs'

let n = 0
function set(weight_kg: number | null, reps: number | null, extra: Partial<SetLike> = {}): SetLike {
  n += 1
  return {
    id: `s${n}`,
    weight_kg,
    reps,
    duration_sec: null,
    distance_m: null,
    is_warmup: false,
    completed_at: `2026-10-${String(n).padStart(2, '0')}T10:00:00Z`,
    ...extra,
  }
}

describe('estimate1RM', () => {
  it('uses Epley and returns the weight for singles', () => {
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 2)
  })

  it('refuses unreliable or empty input', () => {
    expect(estimate1RM(100, 13)).toBeNull()
    expect(estimate1RM(0, 5)).toBeNull()
    expect(estimate1RM(null, 5)).toBeNull()
    expect(estimate1RM(100, 0)).toBeNull()
  })
})

describe('annotatePRs', () => {
  it('never marks the first set, and ignores ties', () => {
    const a = set(100, 5)
    const b = set(100, 5)
    expect(annotatePRs([a, b]).size).toBe(0)
  })

  it('flags each record a set beats', () => {
    const a = set(100, 5) // baseline
    const b = set(105, 3) // heavier, but lower e1RM (115.5 < 116.7) and volume
    const c = set(100, 8) // more volume and e1RM, not heavier
    const prs = annotatePRs([a, b, c])
    expect(prs.get(b.id)).toEqual(['weight'])
    expect(prs.get(c.id)?.sort()).toEqual(['e1rm', 'volume'])
    expect(prs.has(a.id)).toBe(false)
  })

  it('processes sets in completion order regardless of input order', () => {
    const a = set(100, 5)
    const b = set(110, 5)
    expect(annotatePRs([b, a]).get(b.id)).toContain('weight')
  })

  it('ignores warm-ups and incomplete sets', () => {
    const warm = set(200, 1, { is_warmup: true })
    const a = set(100, 5)
    const b = set(110, 5)
    const pending = set(300, 5, { completed_at: null })
    const prs = annotatePRs([warm, a, b, pending])
    expect(prs.get(b.id)).toContain('weight')
    expect(prs.has(pending.id)).toBe(false)
  })

  it('tracks rep PRs for bodyweight sets and duration PRs for timed sets', () => {
    const p1 = set(null, 8)
    const p2 = set(null, 10)
    const t1 = set(null, null, { duration_sec: 60 })
    const t2 = set(null, null, { duration_sec: 90 })
    const prs = annotatePRs([p1, p2, t1, t2])
    expect(prs.get(p2.id)).toEqual(['reps'])
    expect(prs.get(t2.id)).toEqual(['duration'])
  })
})

describe('summarizeRecords', () => {
  it('summarizes bests and rep maxes', () => {
    const a = set(100, 5)
    const b = set(120, 1)
    const c = set(90, 11)
    const d = set(95, 5)
    const s = summarizeRecords([a, b, c, d, set(150, 1, { is_warmup: true })])
    expect(s.heaviest?.id).toBe(b.id)
    expect(s.bestE1RM?.set.id).toBe(c.id) // 90 × (1 + 11/30) = 123 > 120
    expect(s.bestVolume?.set.id).toBe(c.id)
    expect(s.repMaxes.map((r) => [r.reps, r.set.weight_kg])).toEqual([
      [1, 120],
      [5, 100],
      [11, 90],
    ])
  })
})
