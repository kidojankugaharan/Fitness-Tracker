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
            'pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl py-1 pr-1 pl-4 text-sm font-medium shadow-lg',
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-text text-bg',
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
              className="min-h-11 shrink-0 rounded-lg px-3 font-bold underline underline-offset-2"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
