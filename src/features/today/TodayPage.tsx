import { clsx } from 'clsx'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { BarcodeIcon, PlusIcon, WorkoutIcon } from '@/components/icons'
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

const tile =
  'bg-surface border-border active:bg-surface-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 transition active:scale-[0.98]'

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
        <Card className="border-accent/25 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(47_123_255/0.22),transparent_60%)] p-5">
          {profile ? (
            <MacroSummary eaten={eaten} profile={profile} missing={missing} />
          ) : (
            <div className="h-44" />
          )}
        </Card>
      </Link>

      <Link
        to={scanPath(date)}
        className="bg-accent text-accent-contrast flex min-h-16 items-center justify-center gap-3 rounded-2xl shadow-[0_10px_30px_-10px_rgb(47_123_255/0.8)] transition active:scale-[0.98]"
      >
        <BarcodeIcon className="size-7" />
        <span className="display text-2xl">Scan food</span>
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <Link to={addFoodPath(date)} className={tile}>
          <PlusIcon className="text-accent-bright size-5" />
          <span className="display text-lg">Log food</span>
        </Link>
        <Link to="/workout" className={clsx(tile, active && 'border-success/50 text-success')}>
          <WorkoutIcon className={clsx('size-5', active ? 'text-success' : 'text-accent-bright')} />
          <span className="display text-lg">{active ? 'Resume workout' : 'Workout'}</span>
        </Link>
      </div>

      <h2 className="eyebrow px-1 pt-3">Training</h2>

      {finished.map((w) => (
        <WorkoutSummaryCard key={w.id} workout={w} />
      ))}
      {workoutsQuery.isError && !workoutsQuery.data && (
        <LoadError what="today's workouts" onRetry={() => void workoutsQuery.refetch()} />
      )}
      {!active && workoutsQuery.isSuccess && finished.length === 0 && (
        <Card className="border-border-strong border-dashed bg-transparent">
          <p className="display text-lg">Rest day?</p>
          <p className="text-muted mt-1 text-sm">No workout logged today.</p>
        </Card>
      )}
    </Page>
  )
}
