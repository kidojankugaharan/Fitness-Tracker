import { MutationCache, QueryClient } from '@tanstack/react-query'
import { errorMessage, showToast } from './toast'

export const queryClient = new QueryClient({
  // Every failed write surfaces as a non-blocking toast; optimistic updates roll back in each hook.
  mutationCache: new MutationCache({
    onError: (error) => showToast(`Couldn't save: ${errorMessage(error)}`),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 1 },
  },
})
