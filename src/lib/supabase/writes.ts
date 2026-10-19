import type { PostgrestError } from '@supabase/supabase-js'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

// Rules for every write in the app:
// - Inserts carry a client-generated UUID. If a retry hits Postgres' unique_violation (23505) on that
//   id, the earlier attempt already committed (its response was lost), so the write counts as done.
// - Writes to the same row share a mutation `scope`, so they run strictly one after another.
// - After a write settles, affected queries are refetched, but only once no other write in the same
//   group is still pending, so a refetch can't wipe out another write's optimistic change.

export function throwUnlessDuplicate(error: PostgrestError | null) {
  if (error && error.code !== '23505') throw error
}

/** Refetch `queryKey` once the last pending mutation under `mutationKey` has settled. */
export function reconcileWhenIdle(qc: QueryClient, mutationKey: QueryKey, ...queryKeys: QueryKey[]) {
  // During onSettled the settling mutation itself still counts as pending.
  if (qc.isMutating({ mutationKey }) > 1) return
  for (const queryKey of queryKeys) void qc.invalidateQueries({ queryKey })
}
