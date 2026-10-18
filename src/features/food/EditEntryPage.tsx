import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { FullScreenSpinner } from '@/app/RequireAuth'
import { Button } from '@/components/Button'
import { EmptyState, SubPage } from '@/components/Page'
import { today } from '@/domain/dates'
import { parseSnapshot } from '@/domain/macros'
import { useDeleteFoodEntry, useFoodEntry, useFoodServings, useUpdateFoodEntry } from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'
import { AmountForm } from './AmountForm'

export function EditEntryPage() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const entry = useFoodEntry(entryId)
  const update = useUpdateFoodEntry()
  const remove = useDeleteFoodEntry()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const foodId = entry.data?.food_id
  const servings = useFoodServings(foodId)

  const back = (date?: string) => navigate(!date || date === today() ? '/food' : `/food?date=${date}`)

  if (entry.isPending || (foodId && servings.isPending)) return <FullScreenSpinner />
  if (!entry.data) {
    return (
      <SubPage title="Entry" onBack={() => back()}>
        <EmptyState title="Entry not found" body="It may have been deleted." />
      </SubPage>
    )
  }

  const e = entry.data
  const snapshot = parseSnapshot(e.food_snapshot)

  return (
    <SubPage title="Edit entry" onBack={() => back(e.date)}>
      <AmountForm
        name={snapshot.name}
        brand={snapshot.brand}
        per100={snapshot.per100}
        servings={servings.data ?? []}
        meals={profile?.meal_names ?? [e.meal]}
        energyUnit={profile?.energy_unit ?? 'kcal'}
        initial={{ grams: e.grams, servingLabel: servingLabelBase(e.serving_label), meal: e.meal }}
        submitLabel="Save"
        onSubmit={(r) => {
          update.mutate({ entry: e, patch: { grams: r.grams, meal: r.meal, serving_label: r.servingLabel } })
          back(e.date)
        }}
        footer={
          confirmDelete ? (
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  remove.mutate(e)
                  back(e.date)
                }}
              >
                Delete entry
              </Button>
            </div>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )
        }
      />
    </SubPage>
  )
}

/** Stored labels look like "2 × 1 slice"; the form needs the base serving label ("1 slice"). */
function servingLabelBase(label: string | null): string | null {
  if (!label) return null
  const match = /^[\d.]+ × (.+)$/.exec(label)
  return match ? match[1]! : label
}
