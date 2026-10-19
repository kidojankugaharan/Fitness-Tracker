import { useSyncExternalStore } from 'react'

export type ToastAction = { label: string; run: () => void }
export type Toast = { id: number; message: string; tone: 'error' | 'info'; action?: ToastAction }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Show a message; an optional action (e.g. Retry, Undo) appears as a button on the toast. */
export function showToast(
  message: string,
  tone: Toast['tone'] = 'error',
  durationMs = 5000,
  action?: ToastAction,
) {
  const id = nextId++
  toasts = [...toasts.slice(-2), { id, message, tone, action }]
  emit()
  setTimeout(() => dismissToast(id), durationMs)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => toasts,
  )
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return 'Something went wrong'
}
