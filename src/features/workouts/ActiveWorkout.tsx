import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { EmptyState, Page } from '@/components/Page'
import { useExerciseMap } from '@/lib/supabase/exercises'
import { useProfile } from '@/lib/supabase/profile'
import { useDeleteWorkout, useFinishWorkout, useWorkoutSets, type Workout } from '@/lib/supabase/workouts'
import { ExerciseBlock } from './ExerciseBlock'
import { ExercisePicker } from './ExercisePicker'

// Exercises added to the workout but without a logged set yet only exist on this device.
const pendingKey = (workoutId: string) => `workout:${workoutId}:pending-exercises`

function loadPending(workoutId: string): string[] {
  try {
    const raw = localStorage.getItem(pendingKey(workoutId))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function savePending(workoutId: string, ids: string[]) {
  try {
    localStorage.setItem(pendingKey(workoutId), JSON.stringify(ids))
  } catch {
    // Storage unavailable (private mode): pending exercises just won't survive a reload.
  }
}

export function ActiveWorkout({ workout }: { workout: Workout }) {
  const { data: sets = [] } = useWorkoutSets(workout.id)
  const exercises = useExerciseMap()
  const units = useProfile().data?.units ?? 'kg'
  const finish = useFinishWorkout()
  const discard = useDeleteWorkout()
  const [pending, setPending] = useState(() => loadPending(workout.id))
  const [picking, setPicking] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Exercise order: as logged, then any added-but-empty exercises.
  const order = useMemo(() => {
    const logged = [...sets].sort((a, b) => a.exercise_order - b.exercise_order).map((s) => s.exercise_id)
    return [...new Set([...logged, ...pending])]
  }, [sets, pending])

  const updatePending = (ids: string[]) => {
    setPending(ids)
    savePending(workout.id, ids)
  }

  const end = (kind: 'finish' | 'discard') => {
    savePending(workout.id, [])
    if (kind === 'discard' || sets.length === 0) discard.mutate(workout.id)
    else finish.mutate(workout.id)
  }

  const started = new Date(workout.started_at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (picking) {
    return (
      <ExercisePicker
        excludeIds={order}
        onClose={() => setPicking(false)}
        onPick={(exercise) => {
          if (!order.includes(exercise.id)) updatePending([...pending, exercise.id])
          setPicking(false)
        }}
      />
    )
  }

  return (
    <Page title="Workout" action={<span className="text-muted text-sm">Started {started}</span>}>
      {order.length === 0 && (
        <EmptyState title="Add your first exercise" body="Pick from the library or create your own." />
      )}

      {order.map((exerciseId, index) => {
        const exercise = exercises.get(exerciseId)
        if (!exercise) return null
        return (
          <ExerciseBlock
            key={exerciseId}
            workout={workout}
            exercise={exercise}
            exerciseOrder={index}
            sets={sets.filter((s) => s.exercise_id === exerciseId)}
            units={units}
            onRemove={
              sets.some((s) => s.exercise_id === exerciseId)
                ? undefined
                : () => updatePending(pending.filter((id) => id !== exerciseId))
            }
          />
        )
      })}

      <Button variant="secondary" className="w-full" onClick={() => setPicking(true)}>
        + Add exercise
      </Button>

      <div className="flex gap-3 pt-4">
        {confirmDiscard ? (
          <>
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmDiscard(false)}>
              Keep
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => end('discard')}>
              Discard workout
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmDiscard(true)}>
              Discard
            </Button>
            <Button className="flex-[2]" disabled={finish.isPending} onClick={() => end('finish')}>
              Finish workout
            </Button>
          </>
        )}
      </div>
    </Page>
  )
}
