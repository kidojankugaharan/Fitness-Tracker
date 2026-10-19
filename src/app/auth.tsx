import { useEffect, useRef, useState, type ReactNode } from 'react'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase/client'
import { AuthContext, type AuthState } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })
  const userIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Drop all cached data and queued writes whenever the signed-in user changes (sign-out, or a
    // different account), so nothing private carries over between accounts.
    const apply = (session: AuthState['session']) => {
      const userId = session?.user.id ?? null
      if (userIdRef.current !== undefined && userIdRef.current !== userId) queryClient.clear()
      userIdRef.current = userId
      setState({ session, loading: false })
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
