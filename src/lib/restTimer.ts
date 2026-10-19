import { useSyncExternalStore } from 'react'

// Rest timer between sets. State is an absolute end time (not a countdown), persisted to
// localStorage, so it stays correct across tab switches, reloads and a backgrounded phone.

export type RestTimer = { endsAt: number; durationSec: number; label: string | null } | null

const STORAGE_KEY = 'rest-timer'
const MIN_SEC = 5

let state: RestTimer = load()
const listeners = new Set<() => void>()
let audio: AudioContext | null = null

function load(): RestTimer {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as RestTimer) : null
    // Drop timers that ended long ago (e.g. app reopened the next day).
    return parsed && parsed.endsAt > Date.now() - 60_000 ? parsed : null
  } catch {
    return null
  }
}

function set(next: RestTimer) {
  state = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: the timer still works for this page load.
  }
  for (const l of listeners) l()
}

/** Start (or restart) the timer. Call from a tap handler so the alert sound is allowed to play later. */
export function startRest(durationSec: number, label: string | null = null) {
  if (durationSec <= 0) return
  unlockAudio()
  set({ endsAt: Date.now() + durationSec * 1000, durationSec, label })
}

export function adjustRest(deltaSec: number) {
  if (!state) return
  const remaining = Math.max(MIN_SEC * 1000, state.endsAt - Date.now() + deltaSec * 1000)
  set({
    ...state,
    endsAt: Date.now() + remaining,
    durationSec: Math.max(MIN_SEC, state.durationSec + deltaSec),
  })
}

export function stopRest() {
  set(null)
}

export function useRestTimer(): RestTimer {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

/** Vibrate and play two short beeps. Silently does nothing where unsupported. */
export function alertRestOver() {
  navigator.vibrate?.([200, 100, 200])
  if (!audio) return
  try {
    const t = audio.currentTime
    for (const offset of [0, 0.25]) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t + offset)
      gain.gain.exponentialRampToValueAtTime(0.3, t + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18)
      osc.connect(gain).connect(audio.destination)
      osc.start(t + offset)
      osc.stop(t + offset + 0.2)
    }
  } catch {
    // Audio can fail if the context was closed by the browser; vibration already fired.
  }
}
