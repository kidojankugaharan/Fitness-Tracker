import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/app/useAuth'
import { Button } from '@/components/Button'
import { NumberStepper } from '@/components/NumberStepper'
import { Card } from '@/components/Page'
import { annotatePRs, PR_LABELS, type PRKind } from '@/domain/prs'
import {
  draftFromSet,
  FIELDS_BY_TYPE,
  formatSet,
  isLoggable,
  parseSetDraft,
  type SetDraft,
  type SetValues,
} from '@/domain/sets'
import type { WeightUnit } from '@/domain/units'
import { startRest } from '@/lib/restTimer'
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
import { showToast } from '@/lib/toast'

type Props = {
  workout: Workout
  exercise: Exercise
  exerciseOrder: number
  sets: WorkoutSet[]
  units: WeightUnit
  /** Rest timer length started after each logged set; 0 disables it. */
  restSec: number
  onRemove?: () => void
}

export function ExerciseBlock({ workout, exercise, exerciseOrder, sets, units, restSec, onRemove }: Props) {
  const userId = useSession().user.id
  const history = useExerciseHistory(exercise.id)
  const addSet = useAddSet(workout.id)
  const deleteSet = useDeleteSet(workout.id)
  const [draft, setDraft] = useState<Partial<SetDraft>>({})
  const [warmup, setWarmup] = useState(false)

  const ordered = useMemo(() => [...sets].sort((a, b) => a.set_index - b.set_index), [sets])
  const prs = useMemo(() => annotatePRs(history.data ?? []), [history.data])
  const lastSession = useMemo(
    () => previousSession(history.data ?? [], workout.id),
    [history.data, workout.id],
  )

  // Pre-fill: the set just logged in this workout, else the first set from last time.
  const source = ordered.at(-1) ?? lastSession[0]
  const values: SetDraft = { ...draftFromSet(source, units), ...draft }
  const fields = FIELDS_BY_TYPE[exercise.type]
  const parsed = parseSetDraft(values, units)
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
        ...parsed.values,
      }),
    )
    setDraft({})
    setWarmup(false)
    navigator.vibrate?.(10)
    startRest(restSec, exercise.name)
  }

  const removeSet = (set: WorkoutSet) => {
    deleteSet.mutate(set)
    showToast(`Set deleted: ${formatSet(set, exercise.type, units)}`, 'info', 6000, {
      label: 'Undo',
      run: () => addSet.mutate(set),
    })
  }

  let workingIndex = 0
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/workout/exercise/${exercise.id}`} className="display text-[1.5rem] active:opacity-70">
          {exercise.name}
        </Link>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="font-display text-muted min-h-11 px-2 text-sm font-bold tracking-wide uppercase"
          >
            Remove
          </button>
        )}
      </div>

      {lastSession.length > 0 && (
        <p className="text-muted bg-surface-2 rounded-lg px-3 py-2 text-sm">
          <span className="eyebrow">Last time:</span>{' '}
          {lastSession.map((s) => formatSet(s, exercise.type, units)).join(', ')}
        </p>
      )}

      {ordered.length > 0 && (
        <ol className="divide-border border-border divide-y border-y">
          {ordered.map((set) => {
            const label = set.is_warmup ? 'W' : String(++workingIndex)
            return (
              <SetRow
                key={set.id}
                label={label}
                text={formatSet(set, exercise.type, units)}
                prs={prs.get(set.id)}
                onDelete={() => removeSet(set)}
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
            invalid={parsed.invalid.includes(field)}
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
            'font-display min-h-12 rounded-xl border px-4 text-[0.9375rem] font-bold tracking-wide uppercase transition-colors',
            warmup
              ? 'border-warning bg-warning/15 text-warning'
              : 'border-border-strong bg-surface-2 text-muted',
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
    <li className="flex min-h-12 items-center gap-3">
      <span
        className={clsx(
          'numeric grid size-7 shrink-0 place-items-center rounded-md text-sm',
          label === 'W' ? 'bg-warning/15 text-warning' : 'bg-surface-3 text-muted',
        )}
      >
        {label}
      </span>
      <span className="numeric flex-1 text-xl">{text}</span>
      {prs && prs.length > 0 && (
        <span
          className="font-display bg-success rounded-md px-2 py-0.5 text-sm font-extrabold tracking-wider text-black uppercase"
          title={prs.map((k) => PR_LABELS[k]).join(', ')}
        >
          PR
        </span>
      )}
      <button
        type="button"
        aria-label={`Delete set ${label}`}
        onClick={onDelete}
        className="text-muted active:bg-surface-2 active:text-danger size-11 rounded-full text-xl"
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
