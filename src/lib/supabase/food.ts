import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/useAuth'
import { barcodeVariants, canonicalBarcode } from '@/domain/barcode'
import type { LocalDate } from '@/domain/dates'
import { parseServings, type FoodSnapshot, type Per100, type Serving } from '@/domain/macros'
import { lookupFdcBarcode } from '@/lib/fdc/client'
import { lookupOffBarcodeVariants, OFF_MIN_QUERY_LENGTH, searchOff } from '@/lib/off/client'
import type { OffFood } from '@/lib/off/mapper'
import { supabase } from './client'
import type { Tables } from './database.types'
import { reconcileWhenIdle, stableUuid, throwUnlessDuplicate } from './writes'

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

// Every key that can hold private rows includes the user id, so one account never sees another's
// cached data (auth.tsx also clears the cache whenever the signed-in user changes).
const keys = {
  all: (u: string) => ['food', u] as const,
  entries: (u: string, date: LocalDate) => ['food', u, 'entries', date] as const,
  entry: (u: string, id: string) => ['food', u, 'entry', id] as const,
  recents: (u: string) => ['food', u, 'recents'] as const,
  localSearch: (u: string, q: string) => ['food', u, 'local-search', q] as const,
  barcode: (u: string, canonical: string) => ['food', u, 'barcode', canonical] as const,
  servings: (u: string, foodId: string | null | undefined) => ['food', u, 'servings', foodId] as const,
}

const mutationKeys = {
  addEntry: ['food', 'add-entry'] as const,
  updateEntry: ['food', 'update-entry'] as const,
  deleteEntry: ['food', 'delete-entry'] as const,
  entries: ['food'] as const,
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
      const { data, error } = await supabase.from('food_entries').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Serving sizes for a stored food (entry snapshots only keep nutrition). */
export function useFoodServings(foodId: string | null | undefined) {
  const userId = useSession().user.id
  return useQuery({
    queryKey: keys.servings(userId, foodId),
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
  const userId = useSession().user.id
  const q = sanitizeSearch(query)
  return useQuery({
    queryKey: keys.localSearch(userId, q),
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

export type BarcodeLookup =
  | { status: 'found'; choice: FoodChoice }
  | { status: 'incomplete'; name: string | null; brand: string | null }
  | { status: 'not_found' }

/**
 * Resolve a scanned barcode: the user's own foods first (custom foods they created for it), then the
 * shared barcode cache, then the Open Food Facts API, then USDA FoodData Central. Any spelling of the same product
 * (UPC-A, UPC-E, EAN-13) matches. Repeat scans never leave our database.
 */
export function useBarcodeLookup(code: string) {
  const userId = useSession().user.id
  const canonical = canonicalBarcode(code)
  return useQuery<BarcodeLookup>({
    queryKey: keys.barcode(userId, canonical),
    staleTime: 5 * 60_000,
    // A remembered miss may be out of date (a food was just created for this code, or the saved
    // copy predates it), so misses are always re-checked when the screen opens.
    refetchOnMount: (query) => (query.state.data?.status === 'found' ? true : 'always'),
    retry: 1,
    queryFn: async ({ signal }): Promise<BarcodeLookup> => {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .in('off_code', barcodeVariants(code))
        .order('updated_at', { ascending: false })
      if (error) throw error
      const local = data.find((f) => f.user_id !== null) ?? data[0]
      if (local) return { status: 'found', choice: choiceFromRow(local) }

      let off: Awaited<ReturnType<typeof lookupOffBarcodeVariants>> | Error
      try {
        off = await lookupOffBarcodeVariants(canonical, barcodeVariants(code), signal)
        if (off.status === 'found') return { status: 'found', choice: choiceFromOff(off.food) }
      } catch (error) {
        if (signal.aborted) throw error
        off = error instanceof Error ? error : new Error('Open Food Facts lookup failed')
      }
      // Second source: USDA FoodData Central (US branded foods, often the same UPC in Canada).
      // Cached into our database like an OFF product once logged, so it's never fetched again.
      const fdc = await lookupFdcBarcode(canonical, signal)
      if (fdc) return { status: 'found', choice: choiceFromOff(fdc) }
      if (off instanceof Error) throw off
      return off
    },
  })
}

export type CustomFoodInput = {
  name: string
  brand: string | null
  barcode: string | null
  per100: Per100
  servings: Serving[]
}

/** Create a food owned by the user (e.g. for a barcode Open Food Facts doesn't know). */
export function useCreateCustomFood() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, id }: { input: CustomFoodInput; id: string }) => {
      const { error } = await supabase.from('foods').insert({
        id,
        user_id: userId,
        source: 'custom',
        off_code: input.barcode ? canonicalBarcode(input.barcode) : null,
        name: input.name.trim(),
        brand: input.brand?.trim() || null,
        kcal_100g: input.per100.kcal,
        protein_100g: input.per100.protein,
        carbs_100g: input.per100.carbs,
        fat_100g: input.per100.fat,
        fiber_100g: input.per100.fiber,
        sugar_100g: input.per100.sugar,
        sat_fat_100g: input.per100.sat_fat,
        sodium_mg_100g: input.per100.sodium_mg,
        servings: input.servings,
      })
      throwUnlessDuplicate(error)
      const { data, error: readError } = await supabase.from('foods').select('*').eq('id', id).single()
      if (readError) throw readError
      return choiceFromRow(data)
    },
    onSuccess: (_choice, { input }) => {
      qc.invalidateQueries({ queryKey: ['food', userId, 'local-search'] })
      if (input.barcode) qc.removeQueries({ queryKey: keys.barcode(userId, canonicalBarcode(input.barcode)) })
    },
  })
}

/** Copy one meal (or a whole day) from another date onto `toDate`. Returns how many were copied. */
export function useCopyEntries() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      fromDate,
      toDate,
      meal,
      copyId,
    }: {
      fromDate: LocalDate
      toDate: LocalDate
      meal?: string
      /** Generated once per tap: Retry reuses it, so the copied rows get the same ids again. */
      copyId: string
    }) => {
      let query = supabase.from('food_entries').select('*').eq('date', fromDate).order('created_at')
      if (meal) query = query.eq('meal', meal)
      const { data: source, error } = await query
      if (error) throw error
      if (source.length === 0) return 0
      // Ids derive from the copy and the source entry, so a retry after a lost response can't duplicate.
      const ids = await Promise.all(source.map((e) => stableUuid(copyId, toDate, e.id)))
      const rows = source.map((e, i) => ({
        id: ids[i]!,
        user_id: userId,
        date: toDate,
        meal: e.meal,
        food_id: e.food_id,
        food_snapshot: e.food_snapshot,
        grams: e.grams,
        serving_label: e.serving_label,
      }))
      const { error: insertError } = await supabase.from('food_entries').insert(rows)
      throwUnlessDuplicate(insertError)
      return rows.length
    },
    // A copy is one request; never retry it automatically (the toast offers a manual retry).
    retry: 0,
    onSuccess: (_n, { toDate }) => qc.invalidateQueries({ queryKey: keys.entries(userId, toDate) }),
  })
}

// ─────────────────────────────────────────────────────────────
// Diary writes. Registered as mutation defaults (see registerFoodMutations) so that writes made
// offline are persisted and replayed after a reload: the mutation function must not close over
// component state, so everything it needs travels in the variables.
// ─────────────────────────────────────────────────────────────

/** A food entry to log: a chosen food, or a quick-add snapshot with no food behind it. */
export type NewEntryInput = {
  date: LocalDate
  meal: string
  grams: number
  servingLabel: string | null
} & ({ choice: FoodChoice } | { quick: FoodSnapshot })

type AddEntryVars = { row: FoodEntry; off: OffFood | null }
type UpdateEntryVars = {
  entry: FoodEntry
  patch: Partial<Pick<FoodEntry, 'grams' | 'meal' | 'serving_label' | 'food_snapshot'>>
}

async function cacheOffFood(off: OffFood): Promise<string> {
  const { data, error } = await supabase.rpc('cache_off_food', {
    p_off_code: canonicalBarcode(off.off_code),
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

export function registerFoodMutations(qc: QueryClient) {
  qc.setMutationDefaults(mutationKeys.addEntry, {
    mutationFn: async ({ row, off }: AddEntryVars) => {
      const foodId = row.food_id ?? (off ? await cacheOffFood(off) : null)
      const { error } = await supabase.from('food_entries').insert({ ...row, food_id: foodId })
      throwUnlessDuplicate(error)
      // Recents are a convenience: never fail the log because of them.
      if (foodId) await supabase.rpc('record_food_use', { p_food_id: foodId })
    },
    onSettled: (_d, _e, { row }: AddEntryVars) =>
      reconcileWhenIdle(
        qc,
        mutationKeys.entries,
        keys.entries(row.user_id, row.date),
        keys.recents(row.user_id),
      ),
  })

  qc.setMutationDefaults(mutationKeys.updateEntry, {
    mutationFn: async ({ entry, patch }: UpdateEntryVars) => {
      const { error } = await supabase.from('food_entries').update(patch).eq('id', entry.id)
      if (error) throw error
    },
    onSettled: (_d, _e, { entry }: UpdateEntryVars) =>
      reconcileWhenIdle(
        qc,
        mutationKeys.entries,
        keys.entries(entry.user_id, entry.date),
        keys.entry(entry.user_id, entry.id),
      ),
  })

  qc.setMutationDefaults(mutationKeys.deleteEntry, {
    mutationFn: async (entry: FoodEntry) => {
      const { error } = await supabase.from('food_entries').delete().eq('id', entry.id)
      if (error) throw error
    },
    onSettled: (_d, _e, entry: FoodEntry) =>
      reconcileWhenIdle(qc, mutationKeys.entries, keys.entries(entry.user_id, entry.date)),
  })
}

export function useAddFoodEntry() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  const mutation = useMutation<void, Error, AddEntryVars>({
    mutationKey: mutationKeys.addEntry,
    // Same scope as edits/deletes: deleting an entry that is still saving waits for the save.
    scope: { id: 'food-entries' },
    onMutate: async ({ row }) => {
      const key = keys.entries(userId, row.date)
      await qc.cancelQueries({ queryKey: key })
      qc.setQueryData<FoodEntry[]>(key, (old) => [...(old ?? []).filter((e) => e.id !== row.id), row])
    },
    onError: (_e, { row }) =>
      qc.setQueryData<FoodEntry[]>(keys.entries(userId, row.date), (old) =>
        old?.filter((e) => e.id !== row.id),
      ),
  })

  /** Log an entry; the row (with its id) is built once, so retries and replays are idempotent. */
  const add = (input: NewEntryInput) => {
    const isChoice = 'choice' in input
    const row: FoodEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      date: input.date,
      meal: input.meal,
      food_id: isChoice ? input.choice.foodId : null,
      food_snapshot: isChoice ? snapshotOf(input.choice) : input.quick,
      grams: input.grams,
      serving_label: input.servingLabel,
      created_at: new Date().toISOString(),
    }
    mutation.mutate({ row, off: isChoice && !input.choice.foodId ? input.choice.off : null })
    return row.id
  }
  return { ...mutation, add }
}

export function useUpdateFoodEntry() {
  const userId = useSession().user.id
  const qc = useQueryClient()
  return useMutation<void, Error, UpdateEntryVars>({
    mutationKey: mutationKeys.updateEntry,
    scope: { id: 'food-entries' },
    onMutate: async ({ entry, patch }) => {
      await qc.cancelQueries({ queryKey: keys.entries(userId, entry.date) })
      await qc.cancelQueries({ queryKey: keys.entry(userId, entry.id) })
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
  return useMutation<void, Error, FoodEntry>({
    mutationKey: mutationKeys.deleteEntry,
    scope: { id: 'food-entries' },
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: keys.entries(userId, entry.date) })
      qc.setQueryData<FoodEntry[]>(keys.entries(userId, entry.date), (old) =>
        old?.filter((e) => e.id !== entry.id),
      )
    },
    onError: (_e, entry) =>
      qc.setQueryData<FoodEntry[]>(keys.entries(userId, entry.date), (old) =>
        old && !old.some((e) => e.id === entry.id) ? [...old, entry] : old,
      ),
  })
}

export { keys as foodKeys }
