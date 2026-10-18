import { useEffect, useState, type ReactNode } from 'react'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import { AuthContext, type AuthState } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }))

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Drop cached data from the previous user on sign-out.
      if (event === 'SIGNED_OUT') queryClient.clear()
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
