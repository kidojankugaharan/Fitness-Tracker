import { today, type LocalDate } from '@/domain/dates'

const withQuery = (path: string, params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]))
  return q.size > 0 ? `${path}?${q}` : path
}

export const diaryPath = (date: LocalDate) =>
  withQuery('/food', { date: date === today() ? undefined : date })
export const addFoodPath = (date: LocalDate, meal?: string) => withQuery('/food/add', { date, meal })
export const scanPath = (date: LocalDate, meal?: string) => withQuery('/food/scan', { date, meal })
export const barcodePath = (code: string, date: LocalDate, meal?: string) =>
  withQuery(`/food/barcode/${encodeURIComponent(code)}`, { date, meal })
