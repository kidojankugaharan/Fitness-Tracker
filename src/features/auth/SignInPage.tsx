import type { AuthError } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/app/useAuth'
import { FullScreenSpinner } from '@/app/RequireAuth'
import { Button } from '@/components/Button'
import { BoltIcon } from '@/components/icons'
import {
  sendSignInEmail,
  signInWithPassword as passwordSignIn,
  verifySignInCode,
} from '@/lib/supabase/account'

// Password sign-in sends no email, so it is the default. Email codes/links are the fallback for a
// first sign-in or a forgotten password; Supabase's built-in mailer allows only a few emails per
// hour, so sends are throttled client-side too.
type Mode = { kind: 'password' } | { kind: 'email' } | { kind: 'sent'; email: string }

const RESEND_COOLDOWN_SEC = 60
const LAST_SENT_KEY = 'auth:last-email-sent-at'

const inputClass =
  'border-border-strong bg-surface-2 focus:border-accent aria-invalid:border-danger min-h-12 rounded-xl border px-4 text-base outline-none transition-colors w-full'

export function SignInPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>({ kind: 'password' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cooldown = useCooldown()

  if (loading) return <FullScreenSpinner />
  if (session) {
    return <Navigate to={safeReturnPath((location.state as { from?: unknown } | null)?.from)} replace />
  }

  const switchMode = (next: Mode) => {
    setError(null)
    setMode(next)
  }

  async function signInWithPassword(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await passwordSignIn(email.trim(), password)
    setBusy(false)
    if (error) setError(friendlyError(error))
  }

  async function sendEmail(e: FormEvent) {
    e.preventDefault()
    if (cooldown.remaining > 0) return
    setBusy(true)
    setError(null)
    const { error } = await sendSignInEmail(email.trim())
    setBusy(false)
    if (error) {
      setError(friendlyError(error))
      if (error.status === 429) cooldown.start()
      return
    }
    cooldown.start()
    setMode({ kind: 'sent', email: email.trim() })
  }

  // A code works inside an installed PWA, where tapping the email link would open a separate browser.
  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (mode.kind !== 'sent') return
    setBusy(true)
    setError(null)
    const { error } = await verifySignInCode(mode.email, code.trim())
    setBusy(false)
    if (error) setError(friendlyError(error))
  }

  const emailField = (
    <>
      <label className="eyebrow block" htmlFor="email">
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
    </>
  )

  return (
    <div className="pt-safe relative mx-auto flex min-h-full max-w-sm flex-col justify-center px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_70%_at_50%_0%,rgb(47_123_255/0.28),transparent_70%)]"
      />
      <div className="relative">
        <span className="bg-accent mb-5 grid size-14 place-items-center rounded-2xl shadow-[0_10px_30px_-8px_rgb(47_123_255/0.9)]">
          <BoltIcon className="size-8 text-white" />
        </span>
        <h1 className="display text-[3.25rem] leading-[0.9]">Fitness Tracker</h1>
        <p className="text-muted mt-3 text-base">Log food and workouts in seconds.</p>
      </div>

      {mode.kind === 'password' && (
        <form onSubmit={signInWithPassword} className="mt-8 space-y-3">
          {emailField}
          <label className="eyebrow block" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => switchMode({ kind: 'email' })}>
            No password yet? Sign in with an email code
          </Button>
        </form>
      )}

      {mode.kind === 'email' && (
        <form onSubmit={sendEmail} className="mt-8 space-y-3">
          {emailField}
          <Button type="submit" className="w-full" disabled={busy || cooldown.remaining > 0}>
            {busy
              ? 'Sending…'
              : cooldown.remaining > 0
                ? `Email sent — wait ${cooldown.remaining}s`
                : 'Email me a sign-in code'}
          </Button>
          <p className="text-muted text-sm">
            After signing in, set a password in Settings so you won't need emails again.
          </p>
          <Button variant="ghost" className="w-full" onClick={() => switchMode({ kind: 'password' })}>
            Sign in with password
          </Button>
        </form>
      )}

      {mode.kind === 'sent' && (
        <form onSubmit={verifyCode} className="mt-8 space-y-3">
          <p>
            Check <span className="font-semibold">{mode.email}</span> and tap the link, or enter the code from
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
          <Button variant="ghost" className="w-full" onClick={() => switchMode({ kind: 'email' })}>
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

function friendlyError(error: AuthError): string {
  // Prefer the error code; fall back to the message in case a response arrives without one.
  const code =
    error.code ??
    (/rate limit/i.test(error.message)
      ? 'over_email_send_rate_limit'
      : /invalid login credentials/i.test(error.message)
        ? 'invalid_credentials'
        : undefined)
  switch (code) {
    case 'over_email_send_rate_limit':
      return 'Too many sign-in emails were sent recently. Wait a few minutes, or sign in with your password.'
    case 'invalid_credentials':
      return "Email or password is incorrect. If you haven't set a password yet, sign in with an email code."
    case 'otp_expired':
      return 'That code has expired or was already used. Request a new one.'
    default:
      return error.message
  }
}

// In-memory fallback for when localStorage is unavailable (private mode).
let lastSentInMemory = 0

function secondsUntilResend(): number {
  let last = lastSentInMemory
  try {
    last = Math.max(last, Number(localStorage.getItem(LAST_SENT_KEY) ?? 0))
  } catch {
    // Storage unavailable: use the in-memory value.
  }
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SEC - (Date.now() - last) / 1000))
}

/** Seconds until another email may be sent; persisted so a page refresh can't bypass it. */
function useCooldown() {
  const [remaining, setRemaining] = useState(secondsUntilResend)

  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining(secondsUntilResend()), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  return {
    remaining,
    start: () => {
      lastSentInMemory = Date.now()
      try {
        localStorage.setItem(LAST_SENT_KEY, String(lastSentInMemory))
      } catch {
        // Storage unavailable: the in-memory value still applies until reload.
      }
      setRemaining(RESEND_COOLDOWN_SEC)
    },
  }
}

/** Only return to paths inside this app (never `//evil.example` or an absolute URL). */
function safeReturnPath(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}
