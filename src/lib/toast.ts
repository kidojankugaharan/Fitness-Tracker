import { useSyncExternalStore } from 'react'

export type Toast = { id: number; message: string; tone: 'error' | 'info' }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function showToast(message: string, tone: Toast['tone'] = 'error', durationMs = 5000) {
  const id = nextId++
  toasts = [...toasts.slice(-2), { id, message, tone }]
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
