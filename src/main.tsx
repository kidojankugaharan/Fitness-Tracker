import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/app/auth'
import { preloadScreens, router } from '@/app/router'
import { Toaster } from '@/components/Toaster'
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
  initOnlineState,
  persister,
  queryClient,
  resumeRestoredWrites,
  shouldPersistMutation,
} from '@/lib/queryClient'
import { registerFoodMutations } from '@/lib/supabase/food'
import { registerWorkoutMutations } from '@/lib/supabase/workouts'
import './index.css'

// Must run before the persisted cache is restored: queued offline writes are replayed using these.
registerFoodMutations(queryClient)
registerWorkoutMutations(queryClient)
// Reopened with no signal: queued writes must wait, not use up their retries and be dropped.
initOnlineState()
preloadScreens()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        buster: CACHE_BUSTER,
        dehydrateOptions: { shouldDehydrateMutation: shouldPersistMutation },
      }}
      onSuccess={resumeRestoredWrites}
    >
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
