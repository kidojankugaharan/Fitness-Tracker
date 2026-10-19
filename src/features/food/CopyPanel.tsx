import { useState } from 'react'
import { Button } from '@/components/Button'
import { addDays, formatDayLabel, today, type LocalDate } from '@/domain/dates'
import { useCopyEntries } from '@/lib/supabase/food'
import { showToast } from '@/lib/toast'

type Props = {
  /** The day being viewed; entries are copied onto it. */
  toDate: LocalDate
  /** Copy just this meal, or the whole day when omitted. */
  meal?: string
  onDone: () => void
}

/** Copy a meal or a whole day from another date (yesterday by default) onto the viewed day. */
export function CopyPanel({ toDate, meal, onDone }: Props) {
  const copy = useCopyEntries()
  const [fromDate, setFromDate] = useState(addDays(toDate, -1))
  const what = meal ?? 'all meals'

  return (
    <div className="bg-surface-2 mx-4 mb-2 space-y-3 rounded-xl p-3">
      <label className="block">
        <span className="text-muted mb-1 block text-xs font-medium">Copy {what} from</span>
        <input
          type="date"
          value={fromDate}
          max={today()}
          onChange={(e) => e.target.value && setFromDate(e.target.value)}
          className="border-border bg-surface min-h-11 w-full rounded-xl border px-3 text-base"
        />
      </label>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="flex-[2]"
          disabled={copy.isPending || fromDate === toDate}
          onClick={() =>
            copy.mutate(
              { fromDate, toDate, meal },
              {
                onSuccess: (count) => {
                  showToast(
                    count === 0
                      ? `Nothing logged for ${what} on ${formatDayLabel(fromDate)}.`
                      : `Copied ${count} item${count === 1 ? '' : 's'} from ${formatDayLabel(fromDate)}.`,
                    'info',
                    2500,
                  )
                  if (count > 0) onDone()
                },
              },
            )
          }
        >
          {copy.isPending ? 'Copying…' : `Copy from ${formatDayLabel(fromDate)}`}
        </Button>
      </div>
    </div>
  )
}
