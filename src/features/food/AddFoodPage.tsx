import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { SubPage } from '@/components/Page'
import { today } from '@/domain/dates'
import { formatEnergy, type EnergyUnit } from '@/domain/units'
import { OFF_MIN_QUERY_LENGTH } from '@/lib/off/client'
import {
  useAddFoodEntry,
  useLocalFoodSearch,
  useOffSearch,
  useRecentFoods,
  type FoodChoice,
} from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { AmountForm } from './AmountForm'

// OFF search is limited to ~10 requests/minute: only search after typing pauses.
const OFF_DEBOUNCE_MS = 600

export function AddFoodPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const date = params.get('date') ?? today()
  const meal = params.get('meal') ?? profile?.meal_names[0] ?? 'Snacks'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<FoodChoice | null>(null)
  const add = useAddFoodEntry()
  const energyUnit = profile?.energy_unit ?? 'kcal'

  const back = () => navigate(date === today() ? '/food' : `/food?date=${date}`)

  if (selected) {
    const defaultServing = selected.servings[0]
    return (
      <SubPage title="Add food" onBack={() => setSelected(null)}>
        <AmountForm
          name={selected.name}
          brand={selected.brand}
          per100={selected.per100}
          servings={selected.servings}
          meals={profile?.meal_names ?? [meal]}
          energyUnit={energyUnit}
          initial={{
            grams: defaultServing?.grams ?? 100,
            servingLabel: defaultServing?.label ?? null,
            meal,
          }}
          submitLabel="Add to diary"
          onSubmit={(r) => {
            add.mutate({
              id: crypto.randomUUID(),
              input: { choice: selected, date, meal: r.meal, grams: r.grams, servingLabel: r.servingLabel },
            })
            back()
          }}
        />
      </SubPage>
    )
  }

  return (
    <SubPage title={`Add to ${meal}`} onBack={back}>
      <input
        autoFocus
        type="search"
        enterKeyHint="search"
        aria-label="Search foods"
        placeholder="Search foods"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border-border bg-surface min-h-12 w-full rounded-xl border px-4 text-base outline-none"
      />
      <SearchResults query={query} energyUnit={energyUnit} onPick={setSelected} />
    </SubPage>
  )
}

function SearchResults({
  query,
  energyUnit,
  onPick,
}: {
  query: string
  energyUnit: EnergyUnit
  onPick: (choice: FoodChoice) => void
}) {
  const trimmed = query.trim()
  const debounced = useDebouncedValue(trimmed, OFF_DEBOUNCE_MS)
  const recents = useRecentFoods()
  const local = useLocalFoodSearch(trimmed)
  const off = useOffSearch(debounced)

  // Own/cached foods first; OFF results that are already cached locally are not repeated.
  const localResults = useMemo(() => local.data ?? [], [local.data])
  const offResults = useMemo(() => {
    const seen = new Set(localResults.map((c) => c.name.toLowerCase() + '|' + (c.brand ?? '').toLowerCase()))
    return (off.data ?? []).filter(
      (c) => !seen.has(c.name.toLowerCase() + '|' + (c.brand ?? '').toLowerCase()),
    )
  }, [off.data, localResults])

  if (!trimmed) {
    return (
      <Section title="Recent">
        {recents.data?.length === 0 && (
          <p className="text-muted py-4 text-sm">Foods you log will appear here for one-tap re-logging.</p>
        )}
        <ChoiceList choices={recents.data ?? []} energyUnit={energyUnit} onPick={onPick} />
      </Section>
    )
  }

  const offPending = trimmed.length >= OFF_MIN_QUERY_LENGTH && (debounced !== trimmed || off.isFetching)

  return (
    <>
      {localResults.length > 0 && (
        <Section title="Your foods">
          <ChoiceList choices={localResults} energyUnit={energyUnit} onPick={onPick} />
        </Section>
      )}
      <Section title="Open Food Facts">
        {trimmed.length < OFF_MIN_QUERY_LENGTH && (
          <p className="text-muted py-2 text-sm">Type at least {OFF_MIN_QUERY_LENGTH} letters to search.</p>
        )}
        {offPending && <p className="text-muted py-2 text-sm">Searching…</p>}
        {off.error && (
          <div className="py-2">
            <p className="text-danger text-sm">{off.error.message}</p>
            <Button variant="secondary" className="mt-2" onClick={() => off.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!offPending && off.isSuccess && offResults.length === 0 && (
          <p className="text-muted py-2 text-sm">No results.</p>
        )}
        <ChoiceList choices={offResults} energyUnit={energyUnit} onPick={onPick} />
      </Section>
    </>
  )
}

function ChoiceList({
  choices,
  energyUnit,
  onPick,
}: {
  choices: FoodChoice[]
  energyUnit: EnergyUnit
  onPick: (choice: FoodChoice) => void
}) {
  return (
    <ul className="divide-border divide-y">
      {choices.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => onPick(c)}
            className="active:bg-surface-2 flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.name}</span>
              {c.brand && <span className="text-muted block truncate text-sm">{c.brand}</span>}
            </span>
            <span className="text-muted shrink-0 text-sm tabular-nums">
              {formatEnergy(c.per100.kcal, energyUnit)}/100g
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-4">
      <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  )
}
