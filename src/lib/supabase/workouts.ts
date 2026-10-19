import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/useAuth'
import { today, type LocalDate } from '@/domain/dates'
import { supabase } from './client'
import type { Tables } from './database.types'
import { reconcileWhenIdle, throwUnlessDuplicate } from './writes'

export type Workout = Tables<'workouts'>
export type WorkoutSet = Tables<'workout_sets'>
/** A set from an exercise's history, with the date of the workout it belongs to. */
export type HistorySet = WorkoutSet & { workout: { date: string } | null }
export type WorkoutWithSets = Workout & {
  workout_sets: Pick<WorkoutSet, 'exercise_id' | 'weight_kg' | 'reps' | 'is_warmup'>[]
}

const keys = {
  active: (u: string) => ['workouts', u, 'active'] as const,
  sets: (u: string, workoutId: string) => ['workouts', u, 'sets', workoutId] as const,
  history: (u: string, exerciseId: string) => ['workouts', u, 'history', exerciseId] as const,
  list: (u: string) => ['workouts', u, 'list'] as const,
}

const mutationKeys = {
  addSet: ['workouts', 'add-set'] as const,
  deleteSet: ['workouts', 'delete-set'] as const,
  finish: ['workouts', 'finish'] as const,
  all: ['workouts'] as const,
}

/** Writes to one workout (its sets, then finishing it) run strictly in order. */
const workoutScope = (workoutId: string) => ({ id: `workout:${workoutId}` })

// Supabase returns at most 1000 rows per request, so long histories are read in pages.
const PAGE_SIZE = 1000

const SUMMARY_SELECT = '*, workout_sets(exercise_id, weight_kg, reps, is_warmup)'

/** The in-progress workout (not yet finished), if any. */
export function useActiveWorkout() {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.active(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Finished workouts, newest first, with a light summary of their sets. */
export function useRecentWorkouts(limit = 20) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: [...keys.list(userId), 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(SUMMARY_SELECT)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as WorkoutWithSets[]
    },
  })
}

export function useWorkoutsOnDate(date: LocalDate) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: [...keys.list(userId), 'date', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(SUMMARY_SELECT)
        .eq('date', date)
        .order('started_at')
      if (error) throw error
      return data as WorkoutWithSets[]
    },
  })
}

export function useWorkoutSets(workoutId: string) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.sets(userId, workoutId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', workoutId)
        .order('exercise_order')
        .order('set_index')
      if (error) throw error
      return data
    },
  })
}

/** Every set ever logged for an exercise, newest first. Powers history, pre-fill and all-time PRs. */
export function useExerciseHistory(exerciseId: string) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.history(userId, exerciseId),
    queryFn: async () => {
      const all: HistorySet[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('workout_sets')
          .select('*, workout:workouts(date)')
          .eq('exercise_id', exerciseId)
          .order('completed_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        all.push(...(data as HistorySet[]))
        if (data.length < PAGE_SIZE) return all
      }
    },
  })
}

export function useStartWorkout() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').insert({ id, user_id: userId, date: today() })
      throwUnlessDuplicate(error)
      const { data, error: readError } = await supabase.from('workouts').select('*').eq('id', id).single()
      if (readError) throw readError
      return data
    },
    onSuccess: (workout) => qc.setQueryData(keys.active(userId), workout),
  })
}

export function useDeleteWorkout() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.setQueryData(keys.active(userId), null)
      qc.invalidateQueries({ queryKey: ['workouts', userId] })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Set logging and finishing: registered as mutation defaults so they survive going offline and
// reloading the app (see registerWorkoutMutations). Variables carry everything the write needs.
// ─────────────────────────────────────────────────────────────

type FinishVars = { workoutId: string; userId: string; endedAt: string }

/** Apply an update to a set in both the workout's set list and the exercise's history cache. */
function patchSetCaches(
  qc: QueryClient,
  set: Pick<WorkoutSet, 'user_id' | 'workout_id' | 'exercise_id'>,
  update: (sets: WorkoutSet[]) => WorkoutSet[],
) {
  qc.setQueryData<WorkoutSet[]>(keys.sets(set.user_id, set.workout_id), (old) => (old ? update(old) : old))
  qc.setQueryData<HistorySet[]>(keys.history(set.user_id, set.exercise_id), (old) =>
    old ? (update(old) as HistorySet[]) : old,
  )
}

function reconcileSet(qc: QueryClient, set: WorkoutSet) {
  reconcileWhenIdle(
    qc,
    mutationKeys.all,
    keys.sets(set.user_id, set.workout_id),
    keys.history(set.user_id, set.exercise_id),
    keys.list(set.user_id),
  )
}

export function registerWorkoutMutations(qc: QueryClient) {
  qc.setMutationDefaults(mutationKeys.addSet, {
    mutationFn: async (row: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').insert(row)
      throwUnlessDuplicate(error)
    },
    onSettled: (_d, _e, row: WorkoutSet) => reconcileSet(qc, row),
  })

  qc.setMutationDefaults(mutationKeys.deleteSet, {
    mutationFn: async (set: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', set.id)
      if (error) throw error
    },
    onSettled: (_d, _e, set: WorkoutSet) => reconcileSet(qc, set),
  })

  qc.setMutationDefaults(mutationKeys.finish, {
    mutationFn: async ({ workoutId, endedAt }: FinishVars) => {
      const { error } = await supabase.from('workouts').update({ ended_at: endedAt }).eq('id', workoutId)
      if (error) throw error
    },
    onSettled: (_d, _e, { userId }: FinishVars) =>
      reconcileWhenIdle(qc, mutationKeys.all, keys.active(userId), keys.list(userId)),
  })
}

// Set and finish hooks are scoped per workout: a delete or finish issued while a set is still
// saving (or queued offline) waits for it, so the server sees the writes in the order made.

export function useAddSet(workoutId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, WorkoutSet>({
    mutationKey: mutationKeys.addSet,
    scope: workoutScope(workoutId),
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: keys.sets(row.user_id, row.workout_id) })
      await qc.cancelQueries({ queryKey: keys.history(row.user_id, row.exercise_id) })
      const date = qc.getQueryData<Workout>(keys.active(row.user_id))?.date ?? today()
      qc.setQueryData<WorkoutSet[]>(keys.sets(row.user_id, row.workout_id), (old) => [
        ...(old ?? []).filter((s) => s.id !== row.id),
        row,
      ])
      qc.setQueryData<HistorySet[]>(keys.history(row.user_id, row.exercise_id), (old) =>
        old ? [{ ...row, workout: { date } }, ...old.filter((s) => s.id !== row.id)] : old,
      )
    },
    onError: (_e, row) => patchSetCaches(qc, row, (sets) => sets.filter((s) => s.id !== row.id)),
  })
}

/** Build a complete set row client-side, so the optimistic row and the stored row share an id. */
export function newSetRow(
  userId: string,
  input: Pick<
    WorkoutSet,
    | 'workout_id'
    | 'exercise_id'
    | 'exercise_order'
    | 'set_index'
    | 'weight_kg'
    | 'reps'
    | 'duration_sec'
    | 'distance_m'
    | 'is_warmup'
  >,
): WorkoutSet {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    rpe: null,
    notes: null,
    completed_at: now,
    created_at: now,
    ...input,
  }
}

export function useDeleteSet(workoutId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, WorkoutSet>({
    mutationKey: mutationKeys.deleteSet,
    scope: workoutScope(workoutId),
    onMutate: (set) => patchSetCaches(qc, set, (sets) => sets.filter((s) => s.id !== set.id)),
    onError: (_e, set) =>
      patchSetCaches(qc, set, (sets) => (sets.some((s) => s.id === set.id) ? sets : [...sets, set])),
  })
}

export function useFinishWorkout(workoutId: string) {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation<void, Error, FinishVars, { previous: Workout | null | undefined }>({
    mutationKey: mutationKeys.finish,
    scope: workoutScope(workoutId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: keys.active(userId) })
      const previous = qc.getQueryData<Workout | null>(keys.active(userId))
      qc.setQueryData(keys.active(userId), null)
      return { previous }
    },
    onError: (_e, _v, context) => qc.setQueryData(keys.active(userId), context?.previous ?? null),
  })
}
