import { clsx } from 'clsx'
import { dismissToast, useToasts } from '@/lib/toast'

export function Toaster() {
  const toasts = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={clsx(
            'pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border py-1 pr-1 pl-4 text-sm font-medium shadow-[0_12px_32px_-8px_rgb(0_0_0/0.8)]',
            t.tone === 'error'
              ? 'border-danger/50 bg-[#2a0f14] text-white'
              : 'border-border-strong bg-surface-3 text-text',
          )}
        >
          <button type="button" onClick={() => dismissToast(t.id)} className="min-h-11 flex-1 py-2 text-left">
            {t.message}
          </button>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                dismissToast(t.id)
                t.action!.run()
              }}
              className="font-display text-accent-bright min-h-11 shrink-0 rounded-lg px-3 text-base font-bold tracking-wide uppercase"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
