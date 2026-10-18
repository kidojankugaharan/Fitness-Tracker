import { addDays, formatDayLabel, today, type LocalDate } from '@/domain/dates'

export function DateSwitcher({ date, onChange }: { date: LocalDate; onChange: (date: LocalDate) => void }) {
  const isToday = date === today()
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
        className="active:bg-surface-2 size-11 rounded-full text-xl"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => onChange(today())}
        disabled={isToday}
        className="min-w-24 text-center text-sm font-semibold"
      >
        {formatDayLabel(date)}
      </button>
      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(addDays(date, 1))}
        className="active:bg-surface-2 size-11 rounded-full text-xl"
      >
        ›
      </button>
    </div>
  )
}
