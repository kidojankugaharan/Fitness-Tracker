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

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

/** Email a one-time code / magic link. Supabase's built-in mailer allows only a few per hour. */
export function sendSignInEmail(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
}

export function verifySignInCode(email: string, code: string) {
  return supabase.auth.verifyOtp({ email, token: code, type: 'email' })
}
