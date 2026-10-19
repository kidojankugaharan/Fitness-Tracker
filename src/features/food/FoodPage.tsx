import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DateSwitcher } from '@/components/DateSwitcher'
import { BarcodeIcon } from '@/components/icons'
import { MacroSummary } from '@/components/MacroSummary'
import { Card, LoadError, Page } from '@/components/Page'
import { dateFromParam, type LocalDate } from '@/domain/dates'
import {
  isWeightOnlyLabel,
  macrosFor,
  missingMacros,
  parseSnapshot,
  sumMacros,
  type Macros,
} from '@/domain/macros'
import { useToday } from '@/lib/useToday'
import { formatEnergy, formatNumber } from '@/domain/units'
import { useFoodEntries, type FoodEntry } from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'
import { CopyPanel } from './CopyPanel'
import { addFoodPath, scanPath } from './paths'

const DAY = Symbol('whole day')

export function FoodPage() {
  const [params, setParams] = useSearchParams()
  const todayDate = useToday()
  const date: LocalDate = dateFromParam(params.get('date'), todayDate)
  const { data: profile } = useProfile()
  const entriesQuery = useFoodEntries(date)
  const { isPending } = entriesQuery
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const [copying, setCopying] = useState<string | typeof DAY | null>(null)

  const withMacros = useMemo(
    () =>
      entries.map((entry) => {
        const snapshot = parseSnapshot(entry.food_snapshot)
        return { entry, snapshot, macros: macrosFor(snapshot.per100, entry.grams) }
      }),
    [entries],
  )
  const total = sumMacros(withMacros.map((e) => e.macros))
  const missing = missingMacros(withMacros.map((e) => e.snapshot.per100))

  // Meals from settings, plus any meal names on entries that are no longer in settings.
  const meals = useMemo(() => {
    const names = profile?.meal_names ?? []
    return [...names, ...new Set(entries.map((e) => e.meal).filter((m) => !names.includes(m)))]
  }, [profile?.meal_names, entries])

  const setDate = (d: LocalDate) => {
    setCopying(null)
    setParams(d === todayDate ? {} : { date: d }, { replace: true })
  }
  const energyUnit = profile?.energy_unit ?? 'kcal'
  const linkClass =
    'font-display active:bg-surface-2 flex min-h-12 items-center gap-1.5 px-4 text-[0.9375rem] font-bold tracking-wide uppercase'

  return (
    <Page title="Food" action={<DateSwitcher date={date} onChange={setDate} />}>
      {entriesQuery.isError && !entriesQuery.data && (
        <LoadError what="this day's food" onRetry={() => void entriesQuery.refetch()} />
      )}
      {profile && (
        <Card className="border-accent/25 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(47_123_255/0.18),transparent_60%)] p-5">
          <MacroSummary eaten={total} profile={profile} missing={missing} />
        </Card>
      )}

      {meals.map((meal) => {
        const items = withMacros.filter((e) => e.entry.meal === meal)
        const mealKcal = sumMacros(items.map((i) => i.macros)).kcal
        return (
          <Card key={meal} className="overflow-hidden px-0 pt-3 pb-0">
            <div className="flex items-baseline justify-between px-4 pb-2">
              <h2 className="display text-[1.375rem]">{meal}</h2>
              <span className="numeric text-muted text-base">
                {items.length > 0 && formatEnergy(mealKcal, energyUnit)}
              </span>
            </div>
            <ul className="divide-border border-border divide-y border-t">
              {items.map(({ entry, snapshot, macros }) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  name={snapshot.name}
                  brand={snapshot.brand}
                  quick={snapshot.kind === 'quick'}
                  macros={macros}
                  kcal={formatEnergy(macros.kcal, energyUnit)}
                />
              ))}
            </ul>
            {copying === meal && <CopyPanel toDate={date} meal={meal} onDone={() => setCopying(null)} />}
            <div className="border-border bg-surface-2/40 flex border-t">
              <Link to={addFoodPath(date, meal)} className={`text-accent-bright ${linkClass}`}>
                + Add food
              </Link>
              <Link to={scanPath(date, meal)} className={`text-accent-bright ${linkClass}`}>
                <BarcodeIcon className="size-4" />
                Scan
              </Link>
              <button
                type="button"
                onClick={() => setCopying(copying === meal ? null : meal)}
                className={`text-muted ml-auto ${linkClass}`}
              >
                Copy…
              </button>
            </div>
          </Card>
        )
      })}

      {copying === DAY ? (
        <Card className="px-0 pt-3 pb-1">
          <CopyPanel toDate={date} onDone={() => setCopying(null)} />
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setCopying(DAY)}
          className="font-display text-muted active:text-text min-h-12 w-full text-[0.9375rem] font-bold tracking-wide uppercase"
        >
          Copy a whole day…
        </button>
      )}

      {isPending && <p className="text-muted text-center text-sm">Loading…</p>}
    </Page>
  )
}

function EntryRow({
  entry,
  name,
  brand,
  quick,
  macros,
  kcal,
}: {
  entry: FoodEntry
  name: string
  brand: string | null
  quick: boolean
  macros: Macros
  kcal: string
}) {
  const label = entry.serving_label
  const amount = label && !isWeightOnlyLabel(label, entry.grams) ? `${label} · ` : ''
  const detail = quick
    ? `Quick add${macros.protein > 0 ? ` · ${formatNumber(macros.protein, 0)} g protein` : ''}`
    : `${amount}${formatNumber(entry.grams, 1)} g${brand ? ` · ${brand}` : ''}`
  return (
    <li>
      <Link
        to={`/food/entry/${entry.id}`}
        className="active:bg-surface-2 flex min-h-16 items-center justify-between gap-3 px-4 py-2.5"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{name}</span>
          <span className="text-muted block truncate text-sm">{detail}</span>
        </span>
        <span className="numeric shrink-0 text-lg">{kcal}</span>
      </Link>
    </li>
  )
}
