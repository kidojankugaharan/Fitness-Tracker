import { FullScreenSpinner } from '@/app/RequireAuth'
import { Button } from '@/components/Button'
import { Card, EmptyState, LoadError, Page } from '@/components/Page'
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
  // A failed lookup must not look like "no workout in progress": that invites starting a second one.
  if (active.isError) {
    return (
      <Page title="Workout">
        <LoadError what="your workout" onRetry={() => active.refetch()} />
      </Page>
    )
  }
  return <StartWorkout />
}

function StartWorkout() {
  const start = useStartWorkout()
  const recent = useRecentWorkouts()

  return (
    <Page title="Workout">
      <Button
        className="min-h-16 w-full text-2xl"
        disabled={start.isPending}
        onClick={() => start.mutate(crypto.randomUUID())}
      >
        {start.isPending ? 'Starting…' : 'Start workout'}
      </Button>

      <h2 className="eyebrow px-1 pt-4">History</h2>
      {recent.isError && <LoadError what="your history" onRetry={() => recent.refetch()} />}
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
    <Card className="border-l-accent border-l-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="display text-xl">{formatDayLabel(workout.date)}</p>
        <p className="numeric text-muted text-base">
          {working.length} sets{minutes != null && ` · ${minutes} min`}
        </p>
      </div>
      <p className="text-muted mt-1.5 text-sm">{names.join(', ') || 'No exercises logged'}</p>
    </Card>
  )
}
