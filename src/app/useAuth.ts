import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = { session: Session | null; loading: boolean }

export const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

/** For components rendered inside <RequireAuth>, where a session is guaranteed. */
export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error('useSession must be used inside <RequireAuth>')
  return session
}
