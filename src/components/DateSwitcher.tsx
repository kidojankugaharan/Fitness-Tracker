import { addDays, formatDayLabel, today, type LocalDate } from '@/domain/dates'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

export function DateSwitcher({ date, onChange }: { date: LocalDate; onChange: (date: LocalDate) => void }) {
  const isToday = date === today()
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
        className="bg-surface-2 active:bg-surface-3 grid size-11 place-items-center rounded-full"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange(today())}
        disabled={isToday}
        className="font-display min-h-11 min-w-20 text-center text-base font-bold tracking-wide uppercase disabled:opacity-100"
      >
        {formatDayLabel(date)}
      </button>
      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(addDays(date, 1))}
        className="bg-surface-2 active:bg-surface-3 grid size-11 place-items-center rounded-full"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  )
}
