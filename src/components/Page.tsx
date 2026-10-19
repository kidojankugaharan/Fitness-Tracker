import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function Page({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4">
      <header className="pt-safe bg-bg/90 sticky top-0 z-10 -mx-4 px-4 backdrop-blur">
        <div className="flex h-14 items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {action}
        </div>
      </header>
      <div className="space-y-3 pb-6">{children}</div>
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={clsx('border-border bg-surface rounded-2xl border p-4', className)}>
      {children}
    </section>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-muted mt-1 text-sm">{body}</p>
    </Card>
  )
}

/** A pushed screen with a back button instead of a tab title. */
export function SubPage({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4">
      <header className="pt-safe bg-bg/90 sticky top-0 z-10 -mx-4 px-4 backdrop-blur">
        <div className="flex h-14 items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="active:bg-surface-2 -ml-2 size-11 rounded-full text-2xl"
          >
            ‹
          </button>
          <h1 className="truncate text-xl font-bold">{title}</h1>
        </div>
      </header>
      <div className="pb-6">{children}</div>
    </div>
  )
}

/**
 * Shown when data couldn't be loaded. Never render "empty" for a failed load: at the gym that
 * looks like lost data and invites logging things twice.
 */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Card className="space-y-2 text-center">
      <p className="font-semibold">Couldn't load {what}</p>
      <p className="text-muted text-sm">Check your connection — nothing has been lost.</p>
      <button type="button" onClick={onRetry} className="text-accent min-h-11 px-4 font-semibold">
        Try again
      </button>
    </Card>
  )
}
