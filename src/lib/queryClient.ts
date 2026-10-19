import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { MutationCache, QueryClient } from '@tanstack/react-query'
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
    mutations: { retry: 1 },
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
