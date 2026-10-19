import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { ChevronLeftIcon } from './icons'

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
      <header className="pt-safe bg-bg/85 sticky top-0 z-10 -mx-4 px-4 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3">
          <h1 className="display truncate text-[2rem]">{title}</h1>
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
    <Card className="border-border-strong border-dashed bg-transparent py-6 text-center">
      <p className="display text-xl">{title}</p>
      <p className="text-muted mt-1.5 text-sm">{body}</p>
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
      <header className="pt-safe bg-bg/85 sticky top-0 z-10 -mx-4 px-4 backdrop-blur-md">
        <div className="flex h-16 items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="bg-surface-2 active:bg-surface-3 -ml-1 grid size-11 shrink-0 place-items-center rounded-full"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <h1 className="display truncate text-[1.625rem]">{title}</h1>
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
    <Card className="border-danger/40 bg-danger-soft space-y-2 text-center">
      <p className="font-semibold">Couldn't load {what}</p>
      <p className="text-muted text-sm">Check your connection — nothing has been lost.</p>
      <button
        type="button"
        onClick={onRetry}
        className="font-display text-accent-bright min-h-11 px-4 font-bold tracking-wide uppercase"
      >
        Try again
      </button>
    </Card>
  )
}
