import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { FullScreenSpinner } from '@/app/RequireAuth'
import { Button } from '@/components/Button'
import { EmptyState, SubPage } from '@/components/Page'
import { parseSnapshot } from '@/domain/macros'
import {
  useDeleteFoodEntry,
  useFoodEntry,
  useFoodServings,
  useUpdateFoodEntry,
  type FoodEntry,
} from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'
import { AmountForm } from './AmountForm'
import { diaryPath } from './paths'
import { QuickAddForm } from './QuickAddForm'

export function EditEntryPage() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const entry = useFoodEntry(entryId)
  const update = useUpdateFoodEntry()
  const foodId = entry.data?.food_id
  const servings = useFoodServings(foodId)

  if (entry.isPending || (foodId && servings.isPending)) return <FullScreenSpinner />
  if (!entry.data) {
    return (
      <SubPage title="Entry" onBack={() => navigate('/food')}>
        <EmptyState title="Entry not found" body="It may have been deleted." />
      </SubPage>
    )
  }

  const e = entry.data
  const snapshot = parseSnapshot(e.food_snapshot)
  const back = () => navigate(diaryPath(e.date))
  const meals = profile?.meal_names ?? [e.meal]

  if (snapshot.kind === 'quick') {
    return (
      <SubPage title="Edit quick add" onBack={back}>
        <QuickAddForm
          meals={meals}
          initial={{ meal: e.meal, snapshot }}
          submitLabel="Save"
          onSubmit={(r) => {
            update.mutate({ entry: e, patch: { food_snapshot: r.snapshot, meal: r.meal } })
            back()
          }}
          footer={<DeleteEntry entry={e} onDeleted={back} />}
        />
      </SubPage>
    )
  }

  return (
    <SubPage title="Edit entry" onBack={back}>
      <AmountForm
        name={snapshot.name}
        brand={snapshot.brand}
        per100={snapshot.per100}
        servings={servings.data ?? []}
        meals={meals}
        energyUnit={profile?.energy_unit ?? 'kcal'}
        initial={{ grams: e.grams, servingLabel: servingLabelBase(e.serving_label), meal: e.meal }}
        submitLabel="Save"
        onSubmit={(r) => {
          update.mutate({ entry: e, patch: { grams: r.grams, meal: r.meal, serving_label: r.servingLabel } })
          back()
        }}
        footer={<DeleteEntry entry={e} onDeleted={back} />}
      />
    </SubPage>
  )
}

function DeleteEntry({ entry, onDeleted }: { entry: FoodEntry; onDeleted: () => void }) {
  const remove = useDeleteFoodEntry()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button variant="danger" className="w-full" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    )
  }
  return (
    <div className="flex gap-2">
      <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <Button
        variant="danger"
        className="flex-1"
        onClick={() => {
          remove.mutate(entry)
          onDeleted()
        }}
      >
        Delete entry
      </Button>
    </div>
  )
}

/** Stored labels look like "2 × 1 slice"; the form needs the base serving label ("1 slice"). */
function servingLabelBase(label: string | null): string | null {
  if (!label) return null
  const match = /^[\d.]+ × (.+)$/.exec(label)
  return match ? match[1]! : label
}
