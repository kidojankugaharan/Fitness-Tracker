import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/useAuth'
import { supabase } from './client'
import type { Tables, TablesUpdate } from './database.types'

export type Profile = Tables<'profiles'>

const profileKey = (userId: string) => ['profile', userId] as const

export function useProfile() {
  const userId = useSession().user.id
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  const key = profileKey(userId)

  return useMutation({
    mutationFn: async (patch: TablesUpdate<'profiles'>) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    // Optimistic: apply the patch immediately, roll back on failure.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Profile>(key)
      if (previous) qc.setQueryData<Profile>(key, { ...previous, ...patch })
      return { previous }
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  })
}
