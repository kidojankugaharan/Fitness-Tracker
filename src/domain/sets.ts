import { isInvalid, parseNonNegative } from './numbers'
import { displayToKg, formatNumber, kgToDisplay, type WeightUnit } from './units'

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

/** What the set logger's inputs hold: text in display units (weight in kg/lb, distance in km). */
export type SetDraft = Record<keyof SetValues, string>

export function draftFromSet(set: SetValues | undefined, unit: WeightUnit): SetDraft {
  return {
    weight_kg: set?.weight_kg != null ? formatNumber(kgToDisplay(set.weight_kg, unit), 2) : '',
    reps: set?.reps != null ? String(set.reps) : '',
    duration_sec: set?.duration_sec != null ? String(set.duration_sec) : '',
    distance_m: set?.distance_m != null ? formatNumber(set.distance_m / 1000, 2) : '',
  }
}

export type ParsedSet = {
  values: SetValues
  /** Fields that hold something that isn't a valid non-negative number. */
  invalid: (keyof SetValues)[]
}

/** Convert logger text to canonical units (kg, metres, whole reps/seconds). */
export function parseSetDraft(draft: SetDraft, unit: WeightUnit): ParsedSet {
  const invalid: (keyof SetValues)[] = []
  const read = (key: keyof SetValues) => {
    const v = parseNonNegative(draft[key])
    if (isInvalid(v)) invalid.push(key)
    return isInvalid(v) ? null : v
  }
  const weight = read('weight_kg')
  const reps = read('reps')
  const duration = read('duration_sec')
  const distanceKm = read('distance_m')
  return {
    values: {
      weight_kg: weight != null ? Math.round(displayToKg(weight, unit) * 100) / 100 : null,
      reps: reps != null ? Math.round(reps) : null,
      duration_sec: duration != null ? Math.round(duration) : null,
      distance_m: distanceKm != null ? Math.round(distanceKm * 1000 * 100) / 100 : null,
    },
    invalid,
  }
}

/**
 * Whether a set can be logged: no invalid input in the fields this exercise type shows, and the
 * essential values present. Weighted types need an explicit weight (0 is allowed for empty bars).
 */
export function isLoggable({ values: v, invalid }: ParsedSet, type: ExerciseType): boolean {
  if (FIELDS_BY_TYPE[type].some((f) => invalid.includes(f))) return false
  switch (type) {
    case 'weight_reps':
      return v.weight_kg != null && (v.reps ?? 0) > 0
    case 'reps':
      return (v.reps ?? 0) > 0
    case 'time':
      return (v.duration_sec ?? 0) > 0
    case 'weight_time':
      return v.weight_kg != null && (v.duration_sec ?? 0) > 0
    case 'distance':
      return (v.distance_m ?? 0) > 0 || (v.duration_sec ?? 0) > 0
  }
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
