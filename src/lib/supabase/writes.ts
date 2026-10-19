import type { PostgrestError } from '@supabase/supabase-js'
import { hashKey, type QueryClient, type QueryKey } from '@tanstack/react-query'

// Rules for every write in the app:
// - Inserts carry a client-generated UUID. If a retry hits Postgres' unique_violation (23505) on that
//   id, the earlier attempt already committed (its response was lost), so the write counts as done.
// - Writes to the same row share a mutation `scope`, so they run strictly one after another.
// - After a write settles, affected queries are refetched, but only once no other write in the same
//   group is still pending, so a refetch can't wipe out another write's optimistic change. Keys from
//   writes that settled earlier are kept and refetched together when the group drains.

export function throwUnlessDuplicate(error: PostgrestError | null) {
  if (error && error.code !== '23505') throw error
}

/**
 * True when a request never got an answer from the server (no signal, DNS, dropped connection).
 * supabase-js reports these as errors with an empty code and a "TypeError:"/"FetchError:" message.
 * Such writes are retried until they get through instead of being given up.
 */
export function isTransportError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (typeof error !== 'object' || error === null || !('message' in error)) return false
  const code = 'code' in error ? error.code : undefined
  return (code === '' || code === undefined) && /^(TypeError|FetchError):/.test(String(error.message))
}

const deferred = new Map<string, Map<string, QueryKey>>()

/** Refetch `queryKeys` (plus any deferred by earlier writes) once the group `mutationKey` is idle. */
export function reconcileWhenIdle(qc: QueryClient, mutationKey: QueryKey, ...queryKeys: QueryKey[]) {
  const group = hashKey(mutationKey)
  const pending = deferred.get(group) ?? new Map<string, QueryKey>()
  for (const queryKey of queryKeys) pending.set(hashKey(queryKey), queryKey)
  // During onSettled the settling mutation itself still counts as pending.
  if (qc.isMutating({ mutationKey }) > 1) {
    deferred.set(group, pending)
    return
  }
  deferred.delete(group)
  for (const queryKey of pending.values()) void qc.invalidateQueries({ queryKey })
}

/**
 * A UUID derived from its parts, so rebuilding the same write (e.g. Retry on a copy) produces the
 * same ids and the duplicate is caught by `throwUnlessDuplicate`.
 */
export async function stableUuid(...parts: string[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\u0000')))
  const b = new Uint8Array(digest.slice(0, 16))
  b[6] = (b[6]! & 0x0f) | 0x50 // version 5 (name-based)
  b[8] = (b[8]! & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
