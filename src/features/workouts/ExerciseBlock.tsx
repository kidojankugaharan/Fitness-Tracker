import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/app/useAuth'
import { Button } from '@/components/Button'
import { NumberStepper } from '@/components/NumberStepper'
import { Card } from '@/components/Page'
import { annotatePRs, PR_LABELS, type PRKind } from '@/domain/prs'
import { FIELDS_BY_TYPE, formatSet, type SetValues } from '@/domain/sets'
import { displayToKg, formatNumber, kgToDisplay, type WeightUnit } from '@/domain/units'
import type { Exercise } from '@/lib/supabase/exercises'
import {
  newSetRow,
  useAddSet,
  useDeleteSet,
  useExerciseHistory,
  type HistorySet,
  type Workout,
  type WorkoutSet,
} from '@/lib/supabase/workouts'

type Draft = Record<keyof SetValues, string>

type Props = {
  workout: Workout
  exercise: Exercise
  exerciseOrder: number
  sets: WorkoutSet[]
  units: WeightUnit
  onRemove?: () => void
}

export function ExerciseBlock({ workout, exercise, exerciseOrder, sets, units, onRemove }: Props) {
  const userId = useSession().user.id
  const history = useExerciseHistory(exercise.id)
  const addSet = useAddSet()
  const deleteSet = useDeleteSet()
  const [draft, setDraft] = useState<Partial<Draft>>({})
  const [warmup, setWarmup] = useState(false)

  const ordered = useMemo(() => [...sets].sort((a, b) => a.set_index - b.set_index), [sets])
  const prs = useMemo(() => annotatePRs(history.data ?? []), [history.data])
  const lastSession = useMemo(
    () => previousSession(history.data ?? [], workout.id),
    [history.data, workout.id],
  )

  // Pre-fill: the set just logged in this workout, else the first set from last time.
  const source = ordered.at(-1) ?? lastSession[0]
  const prefill = toDraft(source, units)
  const values: Draft = { ...prefill, ...draft }
  const fields = FIELDS_BY_TYPE[exercise.type]
  const parsed = parseDraft(values, units)
  const canLog = isLoggable(parsed, exercise.type)

  const logSet = () => {
    if (!canLog) return
    addSet.mutate(
      newSetRow(userId, {
        workout_id: workout.id,
        exercise_id: exercise.id,
        exercise_order: exerciseOrder,
        set_index: (ordered.at(-1)?.set_index ?? -1) + 1,
        is_warmup: warmup,
        ...parsed,
      }),
    )
    setDraft({})
    setWarmup(false)
    navigator.vibrate?.(10)
  }

  let workingIndex = 0
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/workout/exercise/${exercise.id}`} className="text-lg font-semibold">
          {exercise.name}
        </Link>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-muted text-sm">
            Remove
          </button>
        )}
      </div>

      {lastSession.length > 0 && (
        <p className="text-muted text-sm">
          Last time: {lastSession.map((s) => formatSet(s, exercise.type, units)).join(', ')}
        </p>
      )}

      {ordered.length > 0 && (
        <ol className="divide-border divide-y">
          {ordered.map((set) => {
            const label = set.is_warmup ? 'W' : String(++workingIndex)
            return (
              <SetRow
                key={set.id}
                label={label}
                text={formatSet(set, exercise.type, units)}
                prs={prs.get(set.id)}
                onDelete={() => deleteSet.mutate(set)}
              />
            )
          })}
        </ol>
      )}

      <div className="flex gap-2">
        {fields.map((field) => (
          <NumberStepper
            key={field}
            {...stepperProps(field, units)}
            value={values[field]}
            onChange={(v) => setDraft((d) => ({ ...d, [field]: v }))}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={warmup}
          onClick={() => setWarmup((w) => !w)}
          className={clsx(
            'min-h-11 rounded-xl px-3 text-sm font-semibold',
            warmup ? 'bg-text text-bg' : 'bg-surface-2 text-muted',
          )}
        >
          Warm-up
        </button>
        <Button className="flex-1" disabled={!canLog} onClick={logSet}>
          Log set
        </Button>
      </div>
    </Card>
  )
}

function SetRow({
  label,
  text,
  prs,
  onDelete,
}: {
  label: string
  text: string
  prs?: PRKind[]
  onDelete: () => void
}) {
  return (
    <li className="flex min-h-11 items-center gap-3">
      <span className="text-muted w-5 text-center text-sm font-semibold">{label}</span>
      <span className="flex-1 font-medium tabular-nums">{text}</span>
      {prs && prs.length > 0 && (
        <span
          className="bg-accent text-accent-contrast rounded-full px-2 py-0.5 text-xs font-bold"
          title={prs.map((k) => PR_LABELS[k]).join(', ')}
        >
          PR
        </span>
      )}
      <button
        type="button"
        aria-label={`Delete set ${label}`}
        onClick={onDelete}
        className="text-muted active:bg-surface-2 size-9 rounded-full text-lg"
      >
        ×
      </button>
    </li>
  )
}

/** Sets from the most recent earlier workout for this exercise, in set order. */
function previousSession(history: HistorySet[], currentWorkoutId: string): HistorySet[] {
  const last = history.find((s) => s.workout_id !== currentWorkoutId && !s.is_warmup)
  if (!last) return []
  return history
    .filter((s) => s.workout_id === last.workout_id && !s.is_warmup)
    .sort((a, b) => a.set_index - b.set_index)
}

function stepperProps(field: keyof SetValues, units: WeightUnit) {
  switch (field) {
    case 'weight_kg':
      return { label: `Weight (${units})`, step: units === 'kg' ? 2.5 : 5 }
    case 'reps':
      return { label: 'Reps', step: 1, decimals: 0, inputMode: 'numeric' as const }
    case 'duration_sec':
      return { label: 'Seconds', step: 15, decimals: 0, inputMode: 'numeric' as const }
    case 'distance_m':
      return { label: 'Distance (km)', step: 0.5 }
  }
}

function toDraft(set: SetValues | undefined, units: WeightUnit): Draft {
  return {
    weight_kg: set?.weight_kg != null ? formatNumber(kgToDisplay(set.weight_kg, units), 2) : '',
    reps: set?.reps != null ? String(set.reps) : '',
    duration_sec: set?.duration_sec != null ? String(set.duration_sec) : '',
    distance_m: set?.distance_m != null ? formatNumber(set.distance_m / 1000, 2) : '',
  }
}

function parseDraft(d: Draft, units: WeightUnit): SetValues {
  const n = (s: string) => {
    if (s.trim() === '') return null
    const v = Number(s.replace(',', '.'))
    return Number.isFinite(v) && v >= 0 ? v : null
  }
  const weight = n(d.weight_kg)
  const distanceKm = n(d.distance_m)
  const reps = n(d.reps)
  const duration = n(d.duration_sec)
  return {
    weight_kg: weight != null ? Math.round(displayToKg(weight, units) * 100) / 100 : null,
    reps: reps != null ? Math.round(reps) : null,
    duration_sec: duration != null ? Math.round(duration) : null,
    distance_m: distanceKm != null ? Math.round(distanceKm * 1000 * 100) / 100 : null,
  }
}

function isLoggable(v: SetValues, type: Exercise['type']): boolean {
  switch (type) {
    case 'weight_reps':
    case 'reps':
      return (v.reps ?? 0) > 0
    case 'time':
    case 'weight_time':
      return (v.duration_sec ?? 0) > 0
    case 'distance':
      return (v.distance_m ?? 0) > 0 || (v.duration_sec ?? 0) > 0
  }
}
