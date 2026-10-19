import { onlineManager, useMutationState } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * Thin banner when offline or when writes are waiting to sync, so a log made without signal is
 * never mistaken for one that reached the server (and never silently lost).
 */
export function SyncStatus() {
  const online = useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () =>
    onlineManager.isOnline(),
  )
  const pending = useMutationState({ filters: { status: 'pending' }, select: (m) => m.state.isPaused })
  const waiting = pending.filter(Boolean).length

  if (online && waiting === 0) return null

  const message =
    waiting > 0
      ? `${waiting} change${waiting === 1 ? '' : 's'} saved on this phone — will sync when you're back online`
      : "You're offline — showing your last saved data"

  return (
    <div
      role="status"
      className="pt-safe bg-text text-bg sticky top-0 z-30 text-center text-xs font-semibold"
    >
      <p className="px-4 py-1.5">{message}</p>
    </div>
  )
}
