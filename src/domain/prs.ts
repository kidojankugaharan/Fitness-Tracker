// Personal records, derived from logged sets (never hand-entered). Warm-up sets never count.

export type SetLike = {
  id: string
  weight_kg: number | null
  reps: number | null
  duration_sec: number | null
  distance_m: number | null
  is_warmup: boolean
  completed_at: string | null
}

export type PRKind = 'weight' | 'e1rm' | 'volume' | 'reps' | 'duration' | 'distance'

export const PR_LABELS: Record<PRKind, string> = {
  weight: 'Heaviest',
  e1rm: 'Best e1RM',
  volume: 'Best volume',
  reps: 'Most reps',
  duration: 'Longest',
  distance: 'Farthest',
}

/** Rep counts above this give unreliable 1RM estimates, so they are ignored for e1RM. */
export const MAX_E1RM_REPS = 12

/** Estimated one-rep max (Epley). Returns null when it can't be estimated sensibly. */
export function estimate1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || weightKg <= 0 || reps < 1 || reps > MAX_E1RM_REPS) return null
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

type Bests = Record<PRKind, number>

function metrics(set: SetLike): Partial<Bests> {
  const m: Partial<Bests> = {}
  const w = set.weight_kg ?? 0
  const r = set.reps ?? 0
  if (w > 0) m.weight = w
  const e = estimate1RM(set.weight_kg, set.reps)
  if (e != null) m.e1rm = e
  if (w > 0 && r > 0) m.volume = w * r
  // Rep PRs only make sense for bodyweight-style sets (no weight logged).
  if (w === 0 && r > 0) m.reps = r
  if ((set.duration_sec ?? 0) > 0) m.duration = set.duration_sec!
  if ((set.distance_m ?? 0) > 0) m.distance = set.distance_m!
  return m
}

const byCompletion = (a: SetLike, b: SetLike) => (a.completed_at ?? '').localeCompare(b.completed_at ?? '')

/**
 * Walk one exercise's sets in completion order and return, for each set that beat every earlier
 * set, which records it set. The very first set of an exercise has nothing to beat, so it is not a PR.
 * Ties are not PRs.
 */
export function annotatePRs(sets: SetLike[]): Map<string, PRKind[]> {
  const result = new Map<string, PRKind[]>()
  const best: Partial<Bests> = {}
  let seenAny = false

  for (const set of sets.filter((s) => !s.is_warmup && s.completed_at).sort(byCompletion)) {
    const m = metrics(set)
    const kinds: PRKind[] = []
    for (const [kind, value] of Object.entries(m) as [PRKind, number][]) {
      const prev = best[kind]
      if (seenAny && (prev == null || value > prev)) kinds.push(kind)
      if (prev == null || value > prev) best[kind] = value
    }
    if (kinds.length > 0) result.set(set.id, kinds)
    seenAny = true
  }
  return result
}

export type RecordSummary = {
  heaviest: SetLike | null
  bestE1RM: { set: SetLike; value: number } | null
  bestVolume: { set: SetLike; value: number } | null
  mostReps: SetLike | null
  /** Heaviest weight lifted for each rep count from 1 to MAX_E1RM_REPS. */
  repMaxes: { reps: number; set: SetLike }[]
}

export function summarizeRecords(sets: SetLike[]): RecordSummary {
  const working = sets.filter((s) => !s.is_warmup && s.completed_at)
  const summary: RecordSummary = {
    heaviest: null,
    bestE1RM: null,
    bestVolume: null,
    mostReps: null,
    repMaxes: [],
  }
  const repMax = new Map<number, SetLike>()

  for (const set of working) {
    const w = set.weight_kg ?? 0
    const r = set.reps ?? 0
    if (w > 0 && (!summary.heaviest || w > (summary.heaviest.weight_kg ?? 0))) summary.heaviest = set
    const e = estimate1RM(set.weight_kg, set.reps)
    if (e != null && (!summary.bestE1RM || e > summary.bestE1RM.value)) summary.bestE1RM = { set, value: e }
    if (w > 0 && r > 0 && (!summary.bestVolume || w * r > summary.bestVolume.value)) {
      summary.bestVolume = { set, value: w * r }
    }
    if (r > 0 && (!summary.mostReps || r > (summary.mostReps.reps ?? 0))) summary.mostReps = set
    if (w > 0 && r >= 1 && r <= MAX_E1RM_REPS) {
      const current = repMax.get(r)
      if (!current || w > (current.weight_kg ?? 0)) repMax.set(r, set)
    }
  }

  summary.repMaxes = [...repMax.entries()].sort(([a], [b]) => a - b).map(([reps, set]) => ({ reps, set }))
  return summary
}
