import { FullScreenSpinner } from '@/app/RequireAuth'
import { Button } from '@/components/Button'
import { Card, EmptyState, Page } from '@/components/Page'
import { formatDayLabel } from '@/domain/dates'
import { useExerciseMap } from '@/lib/supabase/exercises'
import {
  useActiveWorkout,
  useRecentWorkouts,
  useStartWorkout,
  type WorkoutWithSets,
} from '@/lib/supabase/workouts'
import { ActiveWorkout } from './ActiveWorkout'

export function WorkoutPage() {
  const active = useActiveWorkout()
  if (active.isPending) return <FullScreenSpinner />
  if (active.data) return <ActiveWorkout workout={active.data} />
  return <StartWorkout />
}

function StartWorkout() {
  const start = useStartWorkout()
  const recent = useRecentWorkouts()

  return (
    <Page title="Workout">
      <Button className="w-full text-lg" disabled={start.isPending} onClick={() => start.mutate()}>
        {start.isPending ? 'Starting…' : 'Start workout'}
      </Button>

      <h2 className="text-muted pt-3 text-sm font-semibold tracking-wide uppercase">History</h2>
      {recent.data?.length === 0 && (
        <EmptyState title="No workouts yet" body="Start your first workout and it will show up here." />
      )}
      {recent.data?.map((w) => (
        <WorkoutSummaryCard key={w.id} workout={w} />
      ))}
    </Page>
  )
}

export function WorkoutSummaryCard({ workout }: { workout: WorkoutWithSets }) {
  const exercises = useExerciseMap()
  const working = workout.workout_sets.filter((s) => !s.is_warmup)
  const names = [...new Set(workout.workout_sets.map((s) => s.exercise_id))].map(
    (id) => exercises.get(id)?.name ?? 'Exercise',
  )
  const minutes = workout.ended_at
    ? Math.round((Date.parse(workout.ended_at) - Date.parse(workout.started_at)) / 60_000)
    : null

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">{formatDayLabel(workout.date)}</p>
        <p className="text-muted text-sm tabular-nums">
          {working.length} sets{minutes != null && ` · ${minutes} min`}
        </p>
      </div>
      <p className="text-muted mt-1 text-sm">{names.join(', ') || 'No exercises logged'}</p>
    </Card>
  )
}
