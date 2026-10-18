import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/useAuth'
import { today, type LocalDate } from '@/domain/dates'
import { supabase } from './client'
import type { Tables, TablesUpdate } from './database.types'

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

/** Every set ever logged for an exercise, newest first. Powers history, pre-fill and PRs. */
export function useExerciseHistory(exerciseId: string) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.history(userId, exerciseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*, workout:workouts(date)')
        .eq('exercise_id', exerciseId)
        .order('completed_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      return data as HistorySet[]
    },
  })
}

export function useStartWorkout() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id: userId, date: today() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (workout) => qc.setQueryData(keys.active(userId), workout),
  })
}

export function useFinishWorkout() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase
        .from('workouts')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', workoutId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.setQueryData(keys.active(userId), null)
      qc.invalidateQueries({ queryKey: keys.list(userId) })
    },
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

type NewSet = Pick<
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
>

/** Apply an update to a set in both the workout's set list and the exercise's history cache. */
function patchSetCaches(
  qc: QueryClient,
  userId: string,
  set: Pick<WorkoutSet, 'workout_id' | 'exercise_id'>,
  update: (sets: WorkoutSet[]) => WorkoutSet[],
) {
  qc.setQueryData<WorkoutSet[]>(keys.sets(userId, set.workout_id), (old) => update(old ?? []))
  qc.setQueryData<HistorySet[]>(keys.history(userId, set.exercise_id), (old) =>
    old ? (update(old) as HistorySet[]) : old,
  )
}

export function useAddSet() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').insert(row)
      if (error) throw error
    },
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: keys.sets(userId, row.workout_id) })
      const date = qc.getQueryData<Workout>(keys.active(userId))?.date ?? today()
      qc.setQueryData<WorkoutSet[]>(keys.sets(userId, row.workout_id), (old) => [...(old ?? []), row])
      qc.setQueryData<HistorySet[]>(keys.history(userId, row.exercise_id), (old) =>
        old ? [{ ...row, workout: { date } }, ...old] : old,
      )
    },
    onError: (_e, row) => patchSetCaches(qc, userId, row, (sets) => sets.filter((s) => s.id !== row.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(userId) }),
  })
}

/** Build a complete set row client-side, so the optimistic row and the stored row share an id. */
export function newSetRow(userId: string, input: NewSet): WorkoutSet {
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

export function useUpdateSet() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ set, patch }: { set: WorkoutSet; patch: TablesUpdate<'workout_sets'> }) => {
      const { error } = await supabase.from('workout_sets').update(patch).eq('id', set.id)
      if (error) throw error
    },
    onMutate: ({ set, patch }) =>
      patchSetCaches(qc, userId, set, (sets) => sets.map((s) => (s.id === set.id ? { ...s, ...patch } : s))),
    onError: (_e, { set }) =>
      patchSetCaches(qc, userId, set, (sets) => sets.map((s) => (s.id === set.id ? { ...s, ...set } : s))),
  })
}

export function useDeleteSet() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (set: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', set.id)
      if (error) throw error
    },
    onMutate: (set) => patchSetCaches(qc, userId, set, (sets) => sets.filter((s) => s.id !== set.id)),
    onError: (_e, set) => {
      qc.invalidateQueries({ queryKey: keys.sets(userId, set.workout_id) })
      qc.invalidateQueries({ queryKey: keys.history(userId, set.exercise_id) })
    },
  })
}
