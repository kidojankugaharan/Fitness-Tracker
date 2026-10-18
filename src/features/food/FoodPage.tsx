import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DateSwitcher } from '@/components/DateSwitcher'
import { MacroSummary } from '@/components/MacroSummary'
import { Card, Page } from '@/components/Page'
import { today, type LocalDate } from '@/domain/dates'
import { isWeightOnlyLabel, macrosFor, parseSnapshot, sumMacros } from '@/domain/macros'
import { formatEnergy, formatNumber } from '@/domain/units'
import { useFoodEntries, type FoodEntry } from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'

export function FoodPage() {
  const [params, setParams] = useSearchParams()
  const date: LocalDate = params.get('date') ?? today()
  const { data: profile } = useProfile()
  const { data: entries = [], isPending } = useFoodEntries(date)

  const withMacros = useMemo(
    () =>
      entries.map((entry) => {
        const snapshot = parseSnapshot(entry.food_snapshot)
        return { entry, snapshot, macros: macrosFor(snapshot.per100, entry.grams) }
      }),
    [entries],
  )
  const total = sumMacros(withMacros.map((e) => e.macros))

  // Meals from settings, plus any meal names on entries that are no longer in settings.
  const meals = useMemo(() => {
    const names = profile?.meal_names ?? []
    return [...names, ...new Set(entries.map((e) => e.meal).filter((m) => !names.includes(m)))]
  }, [profile?.meal_names, entries])

  const setDate = (d: LocalDate) => setParams(d === today() ? {} : { date: d }, { replace: true })
  const energyUnit = profile?.energy_unit ?? 'kcal'

  return (
    <Page title="Food" action={<DateSwitcher date={date} onChange={setDate} />}>
      {profile && (
        <Card>
          <MacroSummary eaten={total} profile={profile} />
        </Card>
      )}

      {meals.map((meal) => {
        const items = withMacros.filter((e) => e.entry.meal === meal)
        const mealKcal = sumMacros(items.map((i) => i.macros)).kcal
        return (
          <Card key={meal} className="px-0 py-2">
            <div className="flex items-center justify-between px-4 py-1">
              <h2 className="font-semibold">{meal}</h2>
              <span className="text-muted text-sm tabular-nums">
                {items.length > 0 && formatEnergy(mealKcal, energyUnit)}
              </span>
            </div>
            <ul>
              {items.map(({ entry, snapshot, macros }) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  name={snapshot.name}
                  brand={snapshot.brand}
                  kcal={formatEnergy(macros.kcal, energyUnit)}
                />
              ))}
            </ul>
            <Link
              to={`/food/add?${new URLSearchParams({ date, meal })}`}
              className="text-accent active:bg-surface-2 flex min-h-11 items-center px-4 text-sm font-semibold"
            >
              + Add food
            </Link>
          </Card>
        )
      })}

      {isPending && <p className="text-muted text-center text-sm">Loading…</p>}
    </Page>
  )
}

function EntryRow({
  entry,
  name,
  brand,
  kcal,
}: {
  entry: FoodEntry
  name: string
  brand: string | null
  kcal: string
}) {
  const label = entry.serving_label
  const amount = label && !isWeightOnlyLabel(label, entry.grams) ? `${label} · ` : ''
  return (
    <li>
      <Link
        to={`/food/entry/${entry.id}`}
        className="active:bg-surface-2 flex min-h-14 items-center justify-between gap-3 px-4 py-2"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          <span className="text-muted block truncate text-sm">
            {amount}
            {formatNumber(entry.grams, 1)} g{brand && ` · ${brand}`}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{kcal}</span>
      </Link>
    </li>
  )
}
