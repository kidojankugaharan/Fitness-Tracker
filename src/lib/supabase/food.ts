import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/useAuth'
import type { LocalDate } from '@/domain/dates'
import { parseServings, type FoodSnapshot, type Per100, type Serving } from '@/domain/macros'
import { OFF_MIN_QUERY_LENGTH, searchOff } from '@/lib/off/client'
import type { OffFood } from '@/lib/off/mapper'
import { supabase } from './client'
import type { Tables } from './database.types'

export type FoodRow = Tables<'foods'>
export type FoodEntry = Tables<'food_entries'>

/** A food the user can log: either already in our database, or a fresh Open Food Facts result. */
export type FoodChoice = {
  key: string
  foodId: string | null
  off: OffFood | null
  name: string
  brand: string | null
  per100: Per100
  servings: Serving[]
}

export function choiceFromRow(f: FoodRow): FoodChoice {
  return {
    key: `db:${f.id}`,
    foodId: f.id,
    off: null,
    name: f.name,
    brand: f.brand,
    per100: {
      kcal: f.kcal_100g,
      protein: f.protein_100g,
      carbs: f.carbs_100g,
      fat: f.fat_100g,
      fiber: f.fiber_100g,
      sugar: f.sugar_100g,
      sat_fat: f.sat_fat_100g,
      sodium_mg: f.sodium_mg_100g,
    },
    servings: parseServings(f.servings),
  }
}

export function choiceFromOff(f: OffFood): FoodChoice {
  return { key: `off:${f.off_code}`, foodId: null, off: f, ...f }
}

const keys = {
  entries: (u: string, date: LocalDate) => ['food', u, 'entries', date] as const,
  entry: (u: string, id: string) => ['food', u, 'entry', id] as const,
  recents: (u: string) => ['food', u, 'recents'] as const,
}

export function useFoodEntries(date: LocalDate) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.entries(userId, date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('date', date)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useFoodEntry(id: string) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.entry(userId, id),
    queryFn: async () => {
      const { data, error } = await supabase.from('food_entries').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

/** Serving sizes for a stored food (entry snapshots only keep nutrition). */
export function useFoodServings(foodId: string | null | undefined) {
  return useQuery({
    queryKey: ['food', 'servings', foodId],
    enabled: !!foodId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('foods').select('servings').eq('id', foodId!).maybeSingle()
      if (error) throw error
      return parseServings(data?.servings)
    },
  })
}

/** Foods the user logged recently, most recent first. */
export function useRecentFoods() {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.recents(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_foods')
        .select('use_count, last_used_at, is_favorite, food:foods(*)')
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .limit(30)
      if (error) throw error
      return data.flatMap((r) => (r.food ? [choiceFromRow(r.food)] : []))
    },
  })
}

/** Strip characters that would break PostgREST's `or=(...)` filter syntax or act as wildcards. */
function sanitizeSearch(q: string): string {
  return q.replace(/[%_,()*\\:."]/g, ' ').trim()
}

/** Search foods already in our database (the user's own + the shared OFF cache). Zero OFF calls. */
export function useLocalFoodSearch(query: string) {
  const q = sanitizeSearch(query)
  return useQuery({
    queryKey: ['food', 'local-search', q],
    enabled: q.length >= 2,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
        .limit(20)
      if (error) throw error
      return data.map(choiceFromRow)
    },
  })
}

/** Open Food Facts search. Callers pass a debounced query; results are cached for an hour. */
export function useOffSearch(query: string) {
  const q = query.trim().toLowerCase()
  return useQuery({
    queryKey: ['off', 'search', q],
    enabled: q.length >= OFF_MIN_QUERY_LENGTH,
    staleTime: 60 * 60_000,
    retry: 0,
    queryFn: async ({ signal }) => (await searchOff(q, signal)).map(choiceFromOff),
  })
}

function snapshotOf(choice: FoodChoice): FoodSnapshot {
  return { name: choice.name, brand: choice.brand, per100: choice.per100 }
}

async function ensureFoodId(choice: FoodChoice): Promise<string> {
  if (choice.foodId) return choice.foodId
  if (!choice.off) throw new Error('Food has no id')
  const { off } = choice
  const { data, error } = await supabase.rpc('cache_off_food', {
    p_off_code: off.off_code,
    p_name: off.name,
    p_brand: off.brand,
    p_kcal_100g: off.per100.kcal,
    p_protein_100g: off.per100.protein,
    p_carbs_100g: off.per100.carbs,
    p_fat_100g: off.per100.fat,
    p_fiber_100g: off.per100.fiber,
    p_sugar_100g: off.per100.sugar,
    p_sat_fat_100g: off.per100.sat_fat,
    p_sodium_mg_100g: off.per100.sodium_mg,
    p_servings: off.servings,
  })
  if (error) throw error
  return data
}

export type NewEntryInput = {
  choice: FoodChoice
  date: LocalDate
  meal: string
  grams: number
  servingLabel: string | null
}

export function useAddFoodEntry() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, id }: { input: NewEntryInput; id: string }) => {
      const foodId = await ensureFoodId(input.choice)
      const { error } = await supabase.from('food_entries').insert({
        id,
        user_id: userId,
        date: input.date,
        meal: input.meal,
        food_id: foodId,
        food_snapshot: snapshotOf(input.choice),
        grams: input.grams,
        serving_label: input.servingLabel,
      })
      if (error) throw error
      // Recents are a convenience: never fail the log because of them.
      await supabase.rpc('record_food_use', { p_food_id: foodId })
    },
    onMutate: async ({ input, id }) => {
      const key = keys.entries(userId, input.date)
      await qc.cancelQueries({ queryKey: key })
      const optimistic: FoodEntry = {
        id,
        user_id: userId,
        date: input.date,
        meal: input.meal,
        food_id: input.choice.foodId,
        food_snapshot: snapshotOf(input.choice),
        grams: input.grams,
        serving_label: input.servingLabel,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<FoodEntry[]>(key, (old) => [...(old ?? []), optimistic])
    },
    onError: (_e, { input, id }) =>
      qc.setQueryData<FoodEntry[]>(keys.entries(userId, input.date), (old) =>
        old?.filter((e) => e.id !== id),
      ),
    onSettled: (_d, _e, { input }) => {
      qc.invalidateQueries({ queryKey: keys.entries(userId, input.date) })
      qc.invalidateQueries({ queryKey: keys.recents(userId) })
    },
  })
}

export function useUpdateFoodEntry() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      entry,
      patch,
    }: {
      entry: FoodEntry
      patch: Pick<FoodEntry, 'grams' | 'meal' | 'serving_label'>
    }) => {
      const { error } = await supabase.from('food_entries').update(patch).eq('id', entry.id)
      if (error) throw error
    },
    onMutate: ({ entry, patch }) => {
      qc.setQueryData<FoodEntry[]>(keys.entries(userId, entry.date), (old) =>
        old?.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)),
      )
      qc.setQueryData<FoodEntry>(keys.entry(userId, entry.id), { ...entry, ...patch })
    },
    onError: (_e, { entry }) => {
      qc.setQueryData<FoodEntry[]>(keys.entries(userId, entry.date), (old) =>
        old?.map((e) => (e.id === entry.id ? entry : e)),
      )
      qc.setQueryData<FoodEntry>(keys.entry(userId, entry.id), entry)
    },
  })
}

export function useDeleteFoodEntry() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: FoodEntry) => {
      const { error } = await supabase.from('food_entries').delete().eq('id', entry.id)
      if (error) throw error
    },
    onMutate: (entry) =>
      qc.setQueryData<FoodEntry[]>(keys.entries(userId, entry.date), (old) =>
        old?.filter((e) => e.id !== entry.id),
      ),
    onError: (_e, entry) => qc.invalidateQueries({ queryKey: keys.entries(userId, entry.date) }),
  })
}
