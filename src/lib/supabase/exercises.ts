import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/useAuth'
import { supabase } from './client'
import type { ExerciseCategory, ExerciseType, Tables } from './database.types'

export type Exercise = Tables<'exercises'>

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Legs',
  'Arms',
  'Core',
  'Cardio',
  'Other',
]

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight & reps',
  reps: 'Reps only',
  time: 'Time',
  distance: 'Distance & time',
  weight_time: 'Weight & time',
}

const exercisesKey = (userId: string) => ['exercises', userId] as const

/** Global library + the user's own exercises (excluding archived), sorted by name. */
export function useExercises() {
  const userId = useSession().user.id
  return useQuery({
    queryKey: exercisesKey(userId),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('*').eq('archived', false).order('name')
      if (error) throw error
      return data
    },
  })
}

export function useExerciseMap(): Map<string, Exercise> {
  const { data } = useExercises()
  const map = new Map<string, Exercise>()
  for (const e of data ?? []) map.set(e.id, e)
  return map
}

export function useCreateExercise() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; category: ExerciseCategory; type: ExerciseType }) => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({ ...input, name: input.name.trim(), user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (exercise) => {
      qc.setQueryData<Exercise[]>(exercisesKey(userId), (old) =>
        [...(old ?? []), exercise].sort((a, b) => a.name.localeCompare(b.name)),
      )
    },
  })
}
