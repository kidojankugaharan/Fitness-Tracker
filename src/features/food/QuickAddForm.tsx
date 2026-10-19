import { useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { quickAddSnapshot, type FoodSnapshot } from '@/domain/macros'
import { isInvalid, parseNonNegative } from '@/domain/numbers'
import { energyLabel, energyToKcal, formatNumber, kcalToDisplay, type EnergyUnit } from '@/domain/units'

type Props = {
  meals: string[]
  energyUnit: EnergyUnit
  initial: { meal: string; snapshot?: FoodSnapshot }
  submitLabel: string
  onSubmit: (result: { snapshot: FoodSnapshot; meal: string }) => void
  footer?: ReactNode
}

const inputClass =
  'border-border bg-surface-2 aria-invalid:border-danger min-h-11 w-full rounded-xl border px-3 text-base'

const toText = (v: number | null | undefined) => (v == null ? '' : formatNumber(v, 1))

/** Log calories (and optionally macros) without picking a food — e.g. a restaurant meal. */
export function QuickAddForm({ meals, energyUnit, initial, submitLabel, onSubmit, footer }: Props) {
  const s = initial.snapshot
  const [name, setName] = useState(s && s.name !== 'Quick add' ? s.name : '')
  const [energy, setEnergy] = useState(s ? toText(kcalToDisplay(s.per100.kcal, energyUnit)) : '')
  const [protein, setProtein] = useState(toText(s?.per100.protein))
  const [carbs, setCarbs] = useState(toText(s?.per100.carbs))
  const [fat, setFat] = useState(toText(s?.per100.fat))
  const [meal, setMeal] = useState(initial.meal)

  const values = {
    energy: parseNonNegative(energy),
    protein: parseNonNegative(protein),
    carbs: parseNonNegative(carbs),
    fat: parseNonNegative(fat),
  }
  const valid = values.energy != null && values.energy > 0 && !Object.values(values).some(isInvalid)

  const field = (label: string, value: string, set: (v: string) => void, required = false) => (
    <label className="block">
      <span className="text-muted mb-1 block text-xs font-medium">{label}</span>
      <input
        inputMode="decimal"
        required={required}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={isInvalid(parseNonNegative(value))}
        className={inputClass}
      />
    </label>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const { energy: typed, ...macros } = values
        onSubmit({
          snapshot: quickAddSnapshot({ name, ...macros, kcal: energyToKcal(typed!, energyUnit) }),
          meal,
        })
      }}
    >
      <h2 className="text-xl font-bold">Quick add</h2>
      <label className="block">
        <span className="text-muted mb-1 block text-xs font-medium">Description (optional)</span>
        <input
          maxLength={200}
          placeholder="Quick add"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      {field(energyLabel(energyUnit), energy, setEnergy, true)}
      <div className="grid grid-cols-3 gap-3">
        {field('Protein (g)', protein, setProtein)}
        {field('Carbs (g)', carbs, setCarbs)}
        {field('Fat (g)', fat, setFat)}
      </div>
      <label className="block">
        <span className="text-muted mb-1 block text-xs font-medium">Meal</span>
        <select value={meal} onChange={(e) => setMeal(e.target.value)} className={inputClass}>
          {[...new Set([...meals, initial.meal])].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <Button type="submit" className="w-full text-lg" disabled={!valid}>
        {submitLabel}
      </Button>
      {footer}
    </form>
  )
}
