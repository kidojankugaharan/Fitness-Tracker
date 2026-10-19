import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '@/domain/sets'
import { adjustRest, alertRestOver, stopRest, unlockAudio, useRestTimer } from '@/lib/restTimer'

// How long the "Rest over" state stays visible before the bar disappears.
const DONE_VISIBLE_MS = 6000

/** Countdown bar shown above the tab bar while a rest timer is running (on any screen). */
export function RestTimerBar() {
  const timer = useRestTimer()
  const [now, setNow] = useState(() => Date.now())
  const alertedFor = useRef<number | null>(null)

  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [timer])

  // A timer restored after a reload has no sound permission yet: take the next tap anywhere.
  const running = timer !== null
  useEffect(() => {
    if (!running) return
    document.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => document.removeEventListener('pointerdown', unlockAudio)
  }, [running])

  const remainingMs = timer ? timer.endsAt - now : 0
  const done = timer != null && remainingMs <= 0

  useEffect(() => {
    if (!timer || !done) return
    // Alert once per timer, and only if it ended recently (not when reopening the app much later).
    if (alertedFor.current !== timer.endsAt && now - timer.endsAt < 3000) alertRestOver()
    alertedFor.current = timer.endsAt
    const id = setTimeout(stopRest, Math.max(0, DONE_VISIBLE_MS - (now - timer.endsAt)))
    return () => clearTimeout(id)
  }, [timer, done, now])

  if (!timer) return null

  const fraction = done ? 1 : 1 - remainingMs / (timer.durationSec * 1000)
  const secondsLeft = Math.ceil(remainingMs / 1000)
  const button =
    'font-display bg-surface-2 active:bg-surface-3 min-h-11 min-w-12 rounded-xl px-2.5 text-base font-bold tracking-wide uppercase'

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className="border-border bg-surface/95 fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t backdrop-blur-md"
    >
      <div className="bg-surface-3 h-1">
        <div
          className={done ? 'bg-accent h-full' : 'bg-accent h-full transition-[width] duration-200'}
          style={{ width: `${Math.min(1, Math.max(0, fraction)) * 100}%` }}
        />
      </div>
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-1.5">
        <div className="min-w-0 flex-1">
          <p className={done ? 'display text-success text-2xl' : 'numeric text-3xl leading-none'}>
            {done ? 'Rest over — go!' : formatDuration(secondsLeft)}
          </p>
          {timer.label && <p className="text-muted truncate text-xs">{timer.label}</p>}
        </div>
        {!done && (
          <>
            <button
              type="button"
              className={button}
              onClick={() => adjustRest(-15)}
              aria-label="15 seconds less"
            >
              −15s
            </button>
            <button
              type="button"
              className={button}
              onClick={() => adjustRest(15)}
              aria-label="15 seconds more"
            >
              +15s
            </button>
          </>
        )}
        <button type="button" className={`${button} text-muted`} onClick={stopRest}>
          {done ? 'Dismiss' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
