import { clsx } from 'clsx'
import { dismissToast, useToasts } from '@/lib/toast'

export function Toaster() {
  const toasts = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={clsx(
            'pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-left text-sm font-medium shadow-lg',
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-text text-bg',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
