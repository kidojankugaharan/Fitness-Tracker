import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { MutationCache, onlineManager, QueryClient, type Mutation } from '@tanstack/react-query'
import { isTransportError } from './supabase/writes'
import { errorMessage, showToast } from './toast'

// Data and queued writes are persisted to this device so the app opens instantly with the last
// known data and offline logs survive closing the app (paused mutations replay when back online).
export const CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
// Bump when cached data shapes change, to discard incompatible persisted caches.
export const CACHE_BUSTER = '2'

export const queryClient: QueryClient = new QueryClient({
  // Every failed write surfaces as a toast with Retry. Optimistic updates roll back in each hook;
  // retrying re-runs the same write with the same ids, so it can never create duplicates.
  mutationCache: new MutationCache({
    onError: (error, variables, _context, mutation) =>
      showToast(`Couldn't save: ${errorMessage(error)}`, 'error', 10_000, {
        label: 'Retry',
        run: () => {
          queryClient
            .getMutationCache()
            .build(queryClient, mutation.options)
            .execute(variables)
            .catch(() => {})
        },
      }),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE_MS,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    // A write that never reached the server (no signal) keeps retrying, with backoff, until it gets
    // through; it stays pending, so it is persisted and replayed if the app is closed meanwhile.
    // Errors the server answered with are retried once, then surface as a toast.
    mutations: { retry: (failures, error) => isTransportError(error) || failures < 1 },
  },
})

function deviceStorage(): Storage | undefined {
  try {
    const probe = '__storage_probe__'
    localStorage.setItem(probe, probe)
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return undefined // private mode / blocked storage: the app still works, just without persistence
  }
}

export const persister = createSyncStoragePersister({
  storage: deviceStorage(),
  key: 'fitness-tracker-cache',
  throttleTime: 500,
})

/**
 * Writes that are persisted to the device until the server acknowledges them: every pending write
 * that can be replayed after a reload (its function is registered with setMutationDefaults), whether
 * it is paused offline or was in flight when the app closed.
 */
export function shouldPersistMutation(mutation: Mutation<unknown, Error, unknown, unknown>): boolean {
  if (mutation.state.status !== 'pending') return false
  const key = mutation.options.mutationKey
  return !!key && !!queryClient.getMutationDefaults(key).mutationFn
}

/** Start with the device's real connectivity (TanStack assumes online until an online/offline event). */
export function initOnlineState() {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) onlineManager.setOnline(navigator.onLine)
}

/** After the persisted cache is restored, replay every write that hadn't been acknowledged yet. */
export function resumeRestoredWrites() {
  for (const mutation of queryClient.getMutationCache().getAll()) {
    if (mutation.state.status === 'pending') void mutation.continue().catch(() => {})
  }
}
