import { formatNumber, kgToDisplay, type WeightUnit } from './units'

export type ExerciseType = 'weight_reps' | 'reps' | 'time' | 'distance' | 'weight_time'

export type SetValues = {
  weight_kg: number | null
  reps: number | null
  duration_sec: number | null
  distance_m: number | null
}

/** Which inputs the set logger shows for each exercise type. */
export const FIELDS_BY_TYPE: Record<ExerciseType, (keyof SetValues)[]> = {
  weight_reps: ['weight_kg', 'reps'],
  reps: ['reps'],
  time: ['duration_sec'],
  distance: ['distance_m', 'duration_sec'],
  weight_time: ['weight_kg', 'duration_sec'],
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** "1:15" → 75, "90" → 90, "1:02:05" → 3725. Returns null for anything unparseable. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':')
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0)
}

export function formatSet(set: SetValues, type: ExerciseType, unit: WeightUnit): string {
  const parts: string[] = []
  const weight = set.weight_kg != null ? `${formatNumber(kgToDisplay(set.weight_kg, unit), 2)} ${unit}` : null
  switch (type) {
    case 'weight_reps':
      return `${weight ?? `0 ${unit}`} × ${set.reps ?? 0}`
    case 'reps':
      return `${set.reps ?? 0} reps`
    case 'time':
      return formatDuration(set.duration_sec ?? 0)
    case 'distance':
      if (set.distance_m != null) parts.push(`${formatNumber(set.distance_m / 1000, 2)} km`)
      if (set.duration_sec != null) parts.push(formatDuration(set.duration_sec))
      return parts.join(' · ') || '—'
    case 'weight_time':
      if (weight) parts.push(weight)
      parts.push(formatDuration(set.duration_sec ?? 0))
      return parts.join(' · ')
  }
}
