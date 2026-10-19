import { useEffect, useState } from 'react'
import { msUntilMidnight, today, type LocalDate } from '@/domain/dates'

/**
 * Today's local date, updated at midnight and whenever the app comes back to the foreground
 * (a phone suspends timers while the app is in the background).
 */
export function useToday(): LocalDate {
  const [value, setValue] = useState(today)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      setValue(today())
      clearTimeout(timer)
      timer = setTimeout(refresh, msUntilMidnight())
    }
    timer = setTimeout(refresh, msUntilMidnight())
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return value
}
