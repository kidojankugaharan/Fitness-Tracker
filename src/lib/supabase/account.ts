import { useMutation } from '@tanstack/react-query'
import { supabase } from './client'

export const MIN_PASSWORD_LENGTH = 8

/** Set or change the signed-in user's password. Needs no email, so it avoids the mail rate limit. */
export function useSetPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        if (error.code === 'reauthentication_needed') {
          throw new Error(
            'For security, sign out and sign in again with an email code, then set your password.',
          )
        }
        if (error.code === 'same_password') throw new Error('That is already your password.')
        throw error
      }
    },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
