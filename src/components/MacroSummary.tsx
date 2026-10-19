import { clsx } from 'clsx'
import { progressFraction, type Macros, type MissingMacros } from '@/domain/macros'
import { kcalToDisplay, type EnergyUnit } from '@/domain/units'
import type { Profile } from '@/lib/supabase/profile'

const NONE_MISSING: MissingMacros = { protein: false, carbs: false, fat: false }

type MacroKey = 'protein' | 'carbs' | 'fat'
const MACRO_COLOR: Record<MacroKey, string> = {
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fat: 'bg-fat',
}

/** Calories remaining (big) plus protein / carbs / fat bars against the user's goals. */
export function MacroSummary({
  eaten,
  profile,
  missing = NONE_MISSING,
}: {
  eaten: Macros
  profile: Profile
  /** Macros where some logged food has no data: their totals are a lower bound. */
  missing?: MissingMacros
}) {
  const unit: EnergyUnit = profile.energy_unit
  const goal = kcalToDisplay(profile.goal_kcal, unit)
  const consumed = kcalToDisplay(eaten.kcal, unit)
  const remaining = Math.round(goal - consumed)
  const over = remaining < 0
  const anyMissing = missing.protein || missing.carbs || missing.fat

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={clsx('eyebrow', over && 'text-danger!')}>{over ? 'Over goal' : 'Remaining'}</p>
          <p className={clsx('numeric mt-1 text-[4rem] leading-none', over && 'text-danger')}>
            {Math.abs(remaining).toLocaleString()}
            <span className="eyebrow ml-1.5 text-base">{unit}</span>
          </p>
        </div>
        <p className="numeric text-muted mt-0.5 text-right text-base">
          {Math.round(consumed)} / {Math.round(goal)} eaten
        </p>
      </div>
      <Bar
        label="Energy"
        fraction={progressFraction(eaten.kcal, profile.goal_kcal)}
        color={over ? 'bg-danger' : 'bg-accent'}
        className="mt-4 h-3"
        glow={!over}
      />
      <div className="mt-5 grid grid-cols-3 gap-4">
        <MacroBar
          macro="protein"
          label="Protein"
          eaten={eaten.protein}
          goal={profile.goal_protein_g}
          partial={missing.protein}
        />
        <MacroBar
          macro="carbs"
          label="Carbs"
          eaten={eaten.carbs}
          goal={profile.goal_carbs_g}
          partial={missing.carbs}
        />
        <MacroBar macro="fat" label="Fat" eaten={eaten.fat} goal={profile.goal_fat_g} partial={missing.fat} />
      </div>
      {anyMissing && (
        <p className="text-muted mt-3 text-xs">
          * Some foods have no data for this, so the total may be higher.
        </p>
      )}
    </div>
  )
}

function MacroBar({
  macro,
  label,
  eaten,
  goal,
  partial,
}: {
  macro: MacroKey
  label: string
  eaten: number
  goal: number
  partial: boolean
}) {
  const over = eaten > goal * 1.05
  return (
    <div>
      <p className="eyebrow flex items-center gap-1.5">
        <span aria-hidden="true" className={clsx('size-2 rounded-full', MACRO_COLOR[macro])} />
        {label}
      </p>
      <p className="numeric mt-1 text-xl leading-none">
        {Math.round(eaten)}
        {partial && <span aria-label="incomplete">*</span>}
        <span className="text-muted text-sm font-semibold"> / {goal} g</span>
      </p>
      <Bar
        label={label}
        fraction={progressFraction(eaten, goal)}
        color={over ? 'bg-danger' : MACRO_COLOR[macro]}
        className="mt-2 h-1.5"
      />
    </div>
  )
}

function Bar({
  label,
  fraction,
  color,
  glow = false,
  className,
}: {
  label: string
  fraction: number
  color: string
  glow?: boolean
  className?: string
}) {
  return (
    <div
      className={clsx('bg-surface-3 overflow-hidden rounded-full', className)}
      role="progressbar"
      aria-label={`${label} goal progress`}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx(
          'h-full rounded-full transition-[width] duration-500',
          color,
          glow && 'shadow-[0_0_12px_rgb(47_123_255/0.8)]',
        )}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  )
}
