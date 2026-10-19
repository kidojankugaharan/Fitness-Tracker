import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { FullScreenSpinner } from '@/app/RequireAuth'
import { Button } from '@/components/Button'
import { Card, SubPage } from '@/components/Page'
import { dateFromParam } from '@/domain/dates'
import { suggestMeal } from '@/domain/meals'
import { useAddFoodEntry, useBarcodeLookup, type BarcodeLookup, type FoodChoice } from '@/lib/supabase/food'
import { useProfile } from '@/lib/supabase/profile'
import { AmountForm } from './AmountForm'
import { CustomFoodForm } from './CustomFoodForm'
import { diaryPath, scanPath } from './paths'

export function BarcodeResultPage() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const date = dateFromParam(params.get('date'))
  const meal = params.get('meal') ?? suggestMeal(profile?.meal_names ?? [])
  const lookup = useBarcodeLookup(code)
  const add = useAddFoodEntry()
  // A food the user just created for this barcode (when OFF didn't have it).
  const [created, setCreated] = useState<FoodChoice | null>(null)
  const [creating, setCreating] = useState(false)

  const back = () => navigate(diaryPath(date))
  const scanAgain = () => navigate(scanPath(date, meal), { replace: true })

  if (lookup.isPending && !creating) return <FullScreenSpinner />

  // "Enter it manually" sets creating, which falls through to the label form below.
  if (lookup.error && !creating) {
    return (
      <SubPage title="Barcode" onBack={back}>
        <Card className="space-y-3">
          <p className="text-danger">{lookup.error.message}</p>
          <Button className="w-full" onClick={() => lookup.refetch()}>
            Try again
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setCreating(true)}>
            Enter it manually
          </Button>
        </Card>
      </SubPage>
    )
  }

  const result: BarcodeLookup = lookup.data ?? { status: 'not_found' }
  const choice = created ?? (result.status === 'found' ? result.choice : null)

  if (choice && !creating) {
    const defaultServing = choice.servings[0]
    return (
      <SubPage title="Add food" onBack={back}>
        <AmountForm
          name={choice.name}
          brand={choice.brand}
          per100={choice.per100}
          servings={choice.servings}
          meals={profile?.meal_names ?? [meal]}
          energyUnit={profile?.energy_unit ?? 'kcal'}
          initial={{ grams: defaultServing?.grams ?? 100, servingLabel: defaultServing?.label ?? null, meal }}
          submitLabel="Add to diary"
          secondaryLabel="Add & scan next"
          onSubmit={(r, again) => {
            add.add({ choice, date, meal: r.meal, grams: r.grams, servingLabel: r.servingLabel })
            if (again) navigate(scanPath(date, r.meal), { replace: true, state: { ignore: code } })
            else back()
          }}
          footer={
            <p className="text-muted text-center text-xs">
              Barcode {code} · Wrong product?{' '}
              <button type="button" className="text-accent font-semibold" onClick={() => setCreating(true)}>
                Enter it yourself
              </button>
            </p>
          }
        />
      </SubPage>
    )
  }

  const prefill = result.status === 'incomplete' ? result : null

  return (
    <SubPage title="New food" onBack={back}>
      {!creating && (
        <Card className="mb-4">
          <p className="font-semibold">{prefill ? 'Nutrition info missing' : 'Not in Open Food Facts yet'}</p>
          <p className="text-muted mt-1 text-sm">
            {prefill
              ? `${prefill.name ?? 'This product'} has no calorie data. Enter it from the label once and it's saved for next time.`
              : `Barcode ${code} wasn't found. Enter it from the label once and it's saved for next time.`}
          </p>
          <Button variant="ghost" className="mt-2 w-full" onClick={scanAgain}>
            Scan again
          </Button>
        </Card>
      )}
      <CustomFoodForm
        barcode={code}
        energyUnit={profile?.energy_unit ?? 'kcal'}
        initialName={prefill?.name ?? (result.status === 'found' ? result.choice.name : null)}
        initialBrand={prefill?.brand ?? (result.status === 'found' ? result.choice.brand : null)}
        onCreated={(food) => {
          setCreated(food)
          setCreating(false)
        }}
        onCancel={creating ? () => setCreating(false) : undefined}
      />
    </SubPage>
  )
}
