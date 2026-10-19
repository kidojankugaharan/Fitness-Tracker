import { useMemo } from 'react'
import { Link } from 'react-router'
import { MacroSummary } from '@/components/MacroSummary'
import { Card, LoadError, Page } from '@/components/Page'
import { formatDayLabel } from '@/domain/dates'
import { macrosFor, missingMacros, parseSnapshot, sumMacros } from '@/domain/macros'
import { addFoodPath, scanPath } from '@/features/food/paths'
import { WorkoutSummaryCard } from '@/features/workouts/WorkoutPage'
import { useFoodEntries } from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'
import { useActiveWorkout, useWorkoutsOnDate } from '@/lib/supabase/workouts'
import { useToday } from '@/lib/useToday'

export function TodayPage() {
  const date = useToday()
  const profileQuery = useProfile()
  const { data: profile, error } = profileQuery
  const entriesQuery = useFoodEntries(date)
  const workoutsQuery = useWorkoutsOnDate(date)
  const { data: active } = useActiveWorkout()
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const workouts = workoutsQuery.data ?? []

  const { eaten, missing } = useMemo(() => {
    const foods = entries.map((e) => ({ per100: parseSnapshot(e.food_snapshot).per100, grams: e.grams }))
    return {
      eaten: sumMacros(foods.map((f) => macrosFor(f.per100, f.grams))),
      missing: missingMacros(foods.map((f) => f.per100)),
    }
  }, [entries])
  const finished = workouts.filter((w) => w.ended_at)

  return (
    <Page title={formatDayLabel(date)}>
      {error && <LoadError what="your goals" onRetry={() => void profileQuery.refetch()} />}
      {entriesQuery.isError && !entriesQuery.data && (
        <LoadError what="today's food" onRetry={() => void entriesQuery.refetch()} />
      )}

      <Link to="/food" className="block">
        <Card>
          {profile ? (
            <MacroSummary eaten={eaten} profile={profile} missing={missing} />
          ) : (
            <div className="h-32" />
          )}
        </Card>
      </Link>

      <div className="grid grid-cols-3 gap-3">
        <Link
          to={scanPath(date)}
          className="bg-accent text-accent-contrast rounded-2xl p-4 text-center font-semibold active:opacity-80"
        >
          Scan food
        </Link>
        <Link
          to={addFoodPath(date)}
          className="bg-surface-2 rounded-2xl p-4 text-center font-semibold active:opacity-80"
        >
          + Log food
        </Link>
        <Link
          to="/workout"
          className="bg-surface-2 rounded-2xl p-4 text-center font-semibold active:opacity-80"
        >
          {active ? 'Resume workout' : '+ Workout'}
        </Link>
      </div>

      {finished.map((w) => (
        <WorkoutSummaryCard key={w.id} workout={w} />
      ))}
      {workoutsQuery.isError && !workoutsQuery.data && (
        <LoadError what="today's workouts" onRetry={() => void workoutsQuery.refetch()} />
      )}
      {!active && workoutsQuery.isSuccess && finished.length === 0 && (
        <Card>
          <p className="font-semibold">Workout</p>
          <p className="text-muted mt-1 text-sm">No workout logged today.</p>
        </Card>
      )}
    </Page>
  )
}
