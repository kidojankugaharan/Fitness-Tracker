import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { FullScreenSpinner } from '@/app/RequireAuth'
import { Card, EmptyState, LoadError, Page } from '@/components/Page'
import { formatDayLabel } from '@/domain/dates'
import { annotatePRs, summarizeRecords } from '@/domain/prs'
import { formatSet } from '@/domain/sets'
import { formatWeight, type WeightUnit } from '@/domain/units'
import { useExercises } from '@/lib/supabase/exercises'
import { useProfile } from '@/lib/supabase/profile'
import { useExerciseHistory, type HistorySet } from '@/lib/supabase/workouts'

export function ExerciseHistoryPage() {
  const { exerciseId = '' } = useParams()
  const exercises = useExercises()
  const exercise = exercises.data?.find((e) => e.id === exerciseId)
  const history = useExerciseHistory(exerciseId)
  const units: WeightUnit = useProfile().data?.units ?? 'kg'

  const sessions = useMemo(() => groupByWorkout(history.data ?? []), [history.data])
  const records = useMemo(() => summarizeRecords(history.data ?? []), [history.data])
  const prs = useMemo(() => annotatePRs(history.data ?? []), [history.data])

  const back = (
    <Link
      to="/workout"
      className="font-display text-accent-bright text-base font-bold tracking-wide uppercase"
    >
      Done
    </Link>
  )
  if (exercises.isError || history.isError) {
    return (
      <Page title="Exercise" action={back}>
        <LoadError
          what="this exercise"
          onRetry={() => {
            void exercises.refetch()
            void history.refetch()
          }}
        />
      </Page>
    )
  }
  if (exercises.isSuccess && !exercise) {
    return (
      <Page title="Exercise" action={back}>
        <EmptyState title="Exercise not found" body="It may have been deleted." />
      </Page>
    )
  }
  if (!exercise || history.isPending) return <FullScreenSpinner />

  const showWeights = exercise.type === 'weight_reps'

  return (
    <Page
      title={exercise.name}
      action={
        <Link
          to="/workout"
          className="font-display text-accent-bright text-base font-bold tracking-wide uppercase"
        >
          Done
        </Link>
      }
    >
      {sessions.length === 0 ? (
        <EmptyState title="No history yet" body="Log a set of this exercise to start tracking it." />
      ) : (
        <>
          {showWeights && (
            <Card>
              <h2 className="display text-xl">Records</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                <Stat
                  label="Heaviest"
                  value={records.heaviest ? formatWeight(records.heaviest.weight_kg ?? 0, units) : '—'}
                />
                <Stat
                  label="Best e1RM"
                  value={records.bestE1RM ? formatWeight(records.bestE1RM.value, units) : '—'}
                />
                <Stat
                  label="Best set"
                  value={records.bestVolume ? formatSet(records.bestVolume.set, exercise.type, units) : '—'}
                />
              </dl>
              {records.repMaxes.length > 0 && (
                <table className="border-border mt-4 w-full border-t text-left">
                  <thead>
                    <tr>
                      <th className="eyebrow pt-3 pb-1">Reps</th>
                      <th className="eyebrow pt-3 pb-1">Best weight</th>
                    </tr>
                  </thead>
                  <tbody className="numeric text-lg">
                    {records.repMaxes.map(({ reps, set }) => (
                      <tr key={reps}>
                        <td className="py-1">{reps}</td>
                        <td>{formatWeight(set.weight_kg ?? 0, units)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {sessions.map(({ workoutId, date, sets }) => (
            <Card key={workoutId}>
              <p className="display text-xl">{date ? formatDayLabel(date) : 'Workout'}</p>
              <ol className="numeric mt-2 space-y-1.5 text-lg">
                {sets.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-warning w-5 text-sm">{s.is_warmup ? 'W' : ''}</span>
                    <span>{formatSet(s, exercise.type, units)}</span>
                    {prs.has(s.id) && (
                      <span className="font-display bg-success rounded-md px-2 py-0.5 text-sm font-extrabold tracking-wider text-black uppercase">
                        PR
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </>
      )}
    </Page>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="numeric mt-1 text-xl leading-tight">{value}</dd>
    </div>
  )
}

/** History arrives newest first; keep that order for sessions and sort each session's sets. */
function groupByWorkout(history: HistorySet[]) {
  const groups = new Map<string, { workoutId: string; date: string | null; sets: HistorySet[] }>()
  for (const s of history) {
    const g = groups.get(s.workout_id) ?? { workoutId: s.workout_id, date: s.workout?.date ?? null, sets: [] }
    g.sets.push(s)
    groups.set(s.workout_id, g)
  }
  for (const g of groups.values()) g.sets.sort((a, b) => a.set_index - b.set_index)
  return [...groups.values()]
}
