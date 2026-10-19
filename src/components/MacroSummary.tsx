import { clsx } from 'clsx'
import { progressFraction, type Macros, type MissingMacros } from '@/domain/macros'
import { kcalToDisplay, type EnergyUnit } from '@/domain/units'
import type { Profile } from '@/lib/supabase/profile'

const NONE_MISSING: MissingMacros = { protein: false, carbs: false, fat: false }

/** Calories remaining plus protein / carbs / fat bars against the user's goals. */
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
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted text-sm">{over ? 'Over goal' : 'Remaining'}</p>
          <p className={clsx('text-4xl font-bold tabular-nums', over && 'text-danger')}>
            {Math.abs(remaining)}
            <span className="text-muted ml-1 text-base font-medium">{unit}</span>
          </p>
        </div>
        <p className="text-muted text-right text-sm tabular-nums">
          {Math.round(consumed)} / {Math.round(goal)} eaten
        </p>
      </div>
      <Bar
        label="Energy"
        fraction={progressFraction(eaten.kcal, profile.goal_kcal)}
        over={over}
        className="mt-3"
      />
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <MacroBar
          label="Protein"
          eaten={eaten.protein}
          goal={profile.goal_protein_g}
          partial={missing.protein}
        />
        <MacroBar label="Carbs" eaten={eaten.carbs} goal={profile.goal_carbs_g} partial={missing.carbs} />
        <MacroBar label="Fat" eaten={eaten.fat} goal={profile.goal_fat_g} partial={missing.fat} />
      </div>
      {anyMissing && (
        <p className="text-muted mt-2 text-xs">
          * Some foods have no data for this, so the total may be higher.
        </p>
      )}
    </div>
  )
}

function MacroBar({
  label,
  eaten,
  goal,
  partial,
}: {
  label: string
  eaten: number
  goal: number
  partial: boolean
}) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="font-semibold tabular-nums">
        {Math.round(eaten)}
        {partial && <span aria-label="incomplete">*</span>}
        <span className="text-muted font-normal"> / {goal} g</span>
      </p>
      <Bar
        label={label}
        fraction={progressFraction(eaten, goal)}
        over={eaten > goal * 1.05}
        className="mt-1"
      />
    </div>
  )
}

function Bar({
  label,
  fraction,
  over,
  className,
}: {
  label: string
  fraction: number
  over?: boolean
  className?: string
}) {
  return (
    <div
      className={clsx('bg-surface-2 h-2 overflow-hidden rounded-full', className)}
      role="progressbar"
      aria-label={`${label} goal progress`}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx('h-full rounded-full transition-[width]', over ? 'bg-danger' : 'bg-accent')}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  )
}
