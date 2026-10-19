import { useMemo } from 'react'
import { Link } from 'react-router'
import { MacroSummary } from '@/components/MacroSummary'
import { Card, Page } from '@/components/Page'
import { formatDayLabel, today } from '@/domain/dates'
import { macrosFor, parseSnapshot, sumMacros } from '@/domain/macros'
import { addFoodPath, scanPath } from '@/features/food/paths'
import { WorkoutSummaryCard } from '@/features/workouts/WorkoutPage'
import { useFoodEntries } from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'
import { useActiveWorkout, useWorkoutsOnDate } from '@/lib/supabase/workouts'

export function TodayPage() {
  const date = today()
  const { data: profile, error } = useProfile()
  const { data: entries = [] } = useFoodEntries(date)
  const { data: workouts = [] } = useWorkoutsOnDate(date)
  const { data: active } = useActiveWorkout()

  const eaten = useMemo(
    () => sumMacros(entries.map((e) => macrosFor(parseSnapshot(e.food_snapshot).per100, e.grams))),
    [entries],
  )
  const finished = workouts.filter((w) => w.ended_at)

  return (
    <Page title={formatDayLabel(date)}>
      {error && (
        <Card>
          <p className="text-danger">Couldn't load your profile: {error.message}</p>
        </Card>
      )}

      <Link to="/food" className="block">
        <Card>{profile ? <MacroSummary eaten={eaten} profile={profile} /> : <div className="h-32" />}</Card>
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
      {!active && finished.length === 0 && (
        <Card>
          <p className="font-semibold">Workout</p>
          <p className="text-muted mt-1 text-sm">No workout logged today.</p>
        </Card>
      )}
    </Page>
  )
}
