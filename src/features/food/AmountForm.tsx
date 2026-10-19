import { useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { NumberStepper } from '@/components/NumberStepper'
import { isWeightOnlyLabel, macrosFor, type Per100, type Serving } from '@/domain/macros'
import { formatEnergy, formatNumber, type EnergyUnit } from '@/domain/units'

export type AmountResult = { grams: number; servingLabel: string | null; meal: string }

type Props = {
  name: string
  brand: string | null
  per100: Per100
  servings: Serving[]
  meals: string[]
  energyUnit: EnergyUnit
  initial: { grams: number; servingLabel: string | null; meal: string }
  submitLabel: string
  /** Optional second action, e.g. "Add & scan next"; onSubmit then receives again = true. */
  secondaryLabel?: string
  busy?: boolean
  onSubmit: (result: AmountResult, again: boolean) => void
  footer?: ReactNode
}

const GRAMS = '__grams__'

/** Pick an amount (grams or a serving) and meal, with a live macro preview. */
export function AmountForm({
  name,
  brand,
  per100,
  servings,
  meals,
  energyUnit,
  initial,
  submitLabel,
  secondaryLabel,
  busy,
  onSubmit,
  footer,
}: Props) {
  const initialServing = servings.find((s) => s.label === initial.servingLabel)
  const [unit, setUnit] = useState(initialServing ? initialServing.label : GRAMS)
  const [quantity, setQuantity] = useState(
    formatNumber(initialServing ? initial.grams / initialServing.grams : initial.grams, 2),
  )
  const [meal, setMeal] = useState(initial.meal)

  const serving = servings.find((s) => s.label === unit)
  const qty = Number(quantity.replace(',', '.'))
  const grams = Number.isFinite(qty) && qty > 0 ? qty * (serving?.grams ?? 1) : 0
  const m = macrosFor(per100, grams)

  const changeUnit = (next: string) => {
    // Keep the same amount of food when switching between grams and a serving.
    const nextServing = servings.find((s) => s.label === next)
    setQuantity(formatNumber(nextServing ? grams / nextServing.grams : grams, 2) || '0')
    setUnit(next)
  }

  const submit = (again: boolean) => {
    if (grams <= 0) return
    onSubmit(
      {
        grams: Math.round(grams * 100) / 100,
        servingLabel: serving ? formatServing(qty, serving) : null,
        meal,
      },
      again,
    )
  }

  const selectClass =
    'border-border-strong bg-surface-2 focus:border-accent aria-invalid:border-danger min-h-12 rounded-xl border px-4 text-base outline-none transition-colors w-full'

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
    >
      <div>
        <h2 className="display text-[1.75rem]">{name}</h2>
        {brand && <p className="text-muted">{brand}</p>}
      </div>

      <div className="flex items-end gap-2 [&_select]:min-h-14">
        <NumberStepper
          label="Amount"
          value={quantity}
          onChange={setQuantity}
          step={serving ? 0.5 : 10}
          decimals={2}
        />
        <label className="w-40 shrink-0">
          <span className="eyebrow mb-1.5 block">Unit</span>
          <select
            aria-label="Unit"
            value={unit}
            onChange={(e) => changeUnit(e.target.value)}
            className={selectClass}
          >
            <option value={GRAMS}>grams</option>
            {servings.map((s) => (
              <option key={s.label} value={s.label}>
                {isWeightOnlyLabel(s.label, s.grams) ? s.label : `${s.label} (${formatNumber(s.grams, 1)} g)`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="eyebrow mb-1.5 block">Meal</span>
        <select value={meal} onChange={(e) => setMeal(e.target.value)} className={selectClass}>
          {[...new Set([...meals, initial.meal])].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>

      <div className="bg-surface border-border grid grid-cols-4 gap-2 rounded-2xl border p-4 text-center">
        <Preview label={energyUnit} value={formatEnergy(m.kcal, energyUnit).split(' ')[0]!} />
        <Preview label="Protein" value={`${formatNumber(m.protein, 1)} g`} unknown={per100.protein == null} />
        <Preview label="Carbs" value={`${formatNumber(m.carbs, 1)} g`} unknown={per100.carbs == null} />
        <Preview label="Fat" value={`${formatNumber(m.fat, 1)} g`} unknown={per100.fat == null} />
      </div>

      <Button type="submit" className="w-full text-lg" disabled={busy || grams <= 0}>
        {submitLabel}
      </Button>
      {secondaryLabel && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy || grams <= 0}
          onClick={() => submit(true)}
        >
          {secondaryLabel}
        </Button>
      )}
      {footer}
    </form>
  )
}

function Preview({ label, value, unknown }: { label: string; value: string; unknown?: boolean }) {
  return (
    <div>
      <p className="numeric text-2xl leading-none">{unknown ? '?' : value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  )
}

/** "2 × 1 slice (30 g)" style label stored on the entry for display. */
function formatServing(qty: number, serving: Serving): string {
  return qty === 1 ? serving.label : `${formatNumber(qty, 2)} × ${serving.label}`
}
