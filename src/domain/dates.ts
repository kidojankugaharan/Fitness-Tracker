// Logging days are local calendar dates stored as 'YYYY-MM-DD' strings.
// Never derive a log day from a UTC timestamp (an 11pm meal would land on tomorrow).

export type LocalDate = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function toLocalDate(date: Date): LocalDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today(now: Date = new Date()): LocalDate {
  return toLocalDate(now)
}

/** Parse a LocalDate into a Date at local midnight. */
export function parseLocalDate(value: LocalDate): Date {
  if (!ISO_DATE.test(value)) throw new Error(`Invalid local date: ${value}`)
  const [y, m, d] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(y, m - 1, d)
  if (toLocalDate(date) !== value) throw new Error(`Invalid local date: ${value}`)
  return date
}

export function addDays(value: LocalDate, days: number): LocalDate {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return toLocalDate(date)
}

/** Human label relative to `now`: Today, Yesterday, Tomorrow, or e.g. "Mon, 12 Oct". */
export function formatDayLabel(value: LocalDate, now: Date = new Date()): string {
  const t = today(now)
  if (value === t) return 'Today'
  if (value === addDays(t, -1)) return 'Yesterday'
  if (value === addDays(t, 1)) return 'Tomorrow'
  return parseLocalDate(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
