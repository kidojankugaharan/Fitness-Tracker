import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/app/useAuth'
import { FullScreenSpinner } from '@/app/RequireAuth'
import { Button } from '@/components/Button'
import { supabase } from '@/lib/supabase/client'

type Step = { kind: 'email' } | { kind: 'sent'; email: string }

const inputClass =
  'min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent'

export function SignInPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <FullScreenSpinner />
  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setStep({ kind: 'sent', email: email.trim() })
  }

  // A code works inside an installed PWA, where tapping the email link would open a separate browser.
  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (step.kind !== 'sent') return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: step.email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="pt-safe mx-auto flex min-h-full max-w-sm flex-col justify-center px-4">
      <h1 className="text-3xl font-bold tracking-tight">Fitness Tracker</h1>
      <p className="text-muted mt-2">Log food and workouts in seconds.</p>

      {step.kind === 'email' ? (
        <form onSubmit={sendLink} className="mt-8 space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-8 space-y-3">
          <p>
            Check <span className="font-semibold">{step.email}</span> and tap the link, or enter the code from
            the email.
          </p>
          <input
            aria-label="Sign-in code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} tracking-widest`}
            placeholder="123456"
          />
          <Button type="submit" className="w-full" disabled={busy || code.trim().length < 6}>
            {busy ? 'Verifying…' : 'Sign in with code'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setStep({ kind: 'email' })}>
            Use a different email
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
