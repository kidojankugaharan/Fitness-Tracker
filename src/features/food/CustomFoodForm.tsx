import { clsx } from 'clsx'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { per100FromLabel, type Serving } from '@/domain/macros'
import { formatNumber } from '@/domain/units'
import { useCreateCustomFood, type FoodChoice } from '@/lib/supabase/food'

type Basis = 'serving' | '100g'

type Props = {
  barcode: string | null
  initialName?: string | null
  initialBrand?: string | null
  onCreated: (choice: FoodChoice) => void
  onCancel?: () => void
}

const NUTRIENTS = [
  { key: 'kcal', label: 'Calories (kcal)', required: true },
  { key: 'protein', label: 'Protein (g)', required: false },
  { key: 'carbs', label: 'Carbs (g)', required: false },
  { key: 'fat', label: 'Fat (g)', required: false },
] as const

const EXTRA_NUTRIENTS = [
  { key: 'fiber', label: 'Fiber (g)' },
  { key: 'sugar', label: 'Sugar (g)' },
  { key: 'sat_fat', label: 'Saturated fat (g)' },
  { key: 'sodium_mg', label: 'Sodium (mg)' },
] as const

type NutrientKey = (typeof NUTRIENTS)[number]['key'] | (typeof EXTRA_NUTRIENTS)[number]['key']

const inputClass =
  'border-border bg-surface-2 aria-invalid:border-danger min-h-11 w-full rounded-xl border px-3 text-base'

function parse(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

/** Enter a food from its nutrition label, as printed (per serving or per 100 g). */
export function CustomFoodForm({ barcode, initialName, initialBrand, onCreated, onCancel }: Props) {
  const create = useCreateCustomFood()
  const [name, setName] = useState(initialName ?? '')
  const [brand, setBrand] = useState(initialBrand ?? '')
  const [basis, setBasis] = useState<Basis>('serving')
  const [servingGrams, setServingGrams] = useState('')
  const [servingLabel, setServingLabel] = useState('')
  const [values, setValues] = useState<Record<NutrientKey, string>>({
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    sugar: '',
    sat_fat: '',
    sodium_mg: '',
  })

  const parsed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parse(v)])) as Record<
    NutrientKey,
    number | null
  >
  const grams = parse(servingGrams)
  const servingValid = basis === '100g' ? grams === null || (grams ?? 0) > 0 : (grams ?? 0) > 0
  const anyInvalid = Object.values(parsed).some((v) => Number.isNaN(v))
  const valid = name.trim() !== '' && parsed.kcal != null && !anyInvalid && servingValid
  const basisGrams = basis === '100g' ? 100 : (grams ?? 0)
  const per100 = valid ? per100FromLabel({ ...parsed, kcal: parsed.kcal! }, basisGrams) : null
  // More energy than pure fat: almost certainly a typo in the serving size or calories.
  const tooDense = per100 != null && per100.kcal > 900

  const submit = () => {
    if (!per100 || tooDense) return
    const servings: Serving[] =
      grams && grams > 0
        ? [{ label: servingLabel.trim() || `1 serving (${formatNumber(grams, 1)} g)`, grams }]
        : []
    create.mutate(
      { name, brand: brand || null, barcode, per100, servings },
      { onSuccess: (choice) => onCreated(choice) },
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div>
        <h2 className="text-xl font-bold">New food</h2>
        {barcode && (
          <p className="text-muted text-sm">Barcode {barcode} — saved so the next scan finds it.</p>
        )}
      </div>

      <label className="block">
        <span className="text-muted mb-1 block text-xs font-medium">Name</span>
        <input
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="text-muted mb-1 block text-xs font-medium">Brand (optional)</span>
        <input
          maxLength={200}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={inputClass}
        />
      </label>

      <div>
        <span className="text-muted mb-1 block text-xs font-medium">Label values are per</span>
        <div role="radiogroup" aria-label="Label values are per" className="bg-surface-2 flex rounded-xl p-1">
          {(
            [
              ['serving', 'Serving'],
              ['100g', '100 g'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={basis === value}
              onClick={() => setBasis(value)}
              className={clsx(
                'min-h-10 flex-1 rounded-lg text-sm font-semibold',
                basis === value ? 'bg-surface text-text shadow-sm' : 'text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-muted mb-1 block text-xs font-medium">
            Serving size (g){basis === '100g' && ' — optional'}
          </span>
          <input
            inputMode="decimal"
            value={servingGrams}
            onChange={(e) => setServingGrams(e.target.value)}
            aria-invalid={!servingValid && servingGrams !== ''}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-muted mb-1 block text-xs font-medium">Serving name (optional)</span>
          <input
            maxLength={60}
            placeholder="1 bar"
            value={servingLabel}
            onChange={(e) => setServingLabel(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {NUTRIENTS.map(({ key, label, required }) => (
          <NutrientInput
            key={key}
            label={label}
            required={required}
            value={values[key]}
            invalid={Number.isNaN(parsed[key])}
            onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
          />
        ))}
      </div>

      <details className="group">
        <summary className="text-accent cursor-pointer text-sm font-semibold">More nutrients</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {EXTRA_NUTRIENTS.map(({ key, label }) => (
            <NutrientInput
              key={key}
              label={label}
              value={values[key]}
              invalid={Number.isNaN(parsed[key])}
              onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
            />
          ))}
        </div>
      </details>

      {tooDense && (
        <p className="text-danger text-sm">
          That's over 900 kcal per 100 g — check the serving size and calories.
        </p>
      )}

      <Button type="submit" className="w-full text-lg" disabled={!valid || tooDense || create.isPending}>
        {create.isPending ? 'Saving…' : 'Save food'}
      </Button>
      {onCancel && (
        <Button variant="ghost" className="w-full" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </form>
  )
}

function NutrientInput({
  label,
  value,
  invalid,
  required,
  onChange,
}: {
  label: string
  value: string
  invalid: boolean
  required?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-muted mb-1 block text-xs font-medium">{label}</span>
      <input
        inputMode="decimal"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className={inputClass}
      />
    </label>
  )
}
