import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { FullScreenSpinner } from '@/app/RequireAuth'
import { Card, EmptyState, Page } from '@/components/Page'
import { formatDayLabel } from '@/domain/dates'
import { annotatePRs, summarizeRecords } from '@/domain/prs'
import { formatSet } from '@/domain/sets'
import { formatWeight, type WeightUnit } from '@/domain/units'
import { useExerciseMap } from '@/lib/supabase/exercises'
import { useProfile } from '@/lib/supabase/profile'
import { useExerciseHistory, type HistorySet } from '@/lib/supabase/workouts'

export function ExerciseHistoryPage() {
  const { exerciseId = '' } = useParams()
  const exercise = useExerciseMap().get(exerciseId)
  const history = useExerciseHistory(exerciseId)
  const units: WeightUnit = useProfile().data?.units ?? 'kg'

  const sessions = useMemo(() => groupByWorkout(history.data ?? []), [history.data])
  const records = useMemo(() => summarizeRecords(history.data ?? []), [history.data])
  const prs = useMemo(() => annotatePRs(history.data ?? []), [history.data])

  if (!exercise || history.isPending) return <FullScreenSpinner />

  const showWeights = exercise.type === 'weight_reps'

  return (
    <Page
      title={exercise.name}
      action={
        <Link to="/workout" className="text-accent text-sm font-semibold">
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
              <h2 className="font-semibold">Records</h2>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
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
                <table className="mt-4 w-full text-sm">
                  <thead className="text-muted text-left">
                    <tr>
                      <th className="font-medium">Reps</th>
                      <th className="font-medium">Best weight</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {records.repMaxes.map(({ reps, set }) => (
                      <tr key={reps}>
                        <td className="py-0.5">{reps}</td>
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
              <p className="font-semibold">{date ? formatDayLabel(date) : 'Workout'}</p>
              <ol className="mt-1 space-y-1 text-sm tabular-nums">
                {sets.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="text-muted w-5">{s.is_warmup ? 'W' : ''}</span>
                    <span>{formatSet(s, exercise.type, units)}</span>
                    {prs.has(s.id) && (
                      <span className="bg-accent text-accent-contrast rounded-full px-2 text-xs font-bold">
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
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
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
