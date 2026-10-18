import { clsx } from 'clsx'
import { progressFraction, type Macros } from '@/domain/macros'
import { kcalToDisplay, type EnergyUnit } from '@/domain/units'
import type { Profile } from '@/lib/supabase/profile'

/** Calories remaining plus protein / carbs / fat bars against the user's goals. */
export function MacroSummary({ eaten, profile }: { eaten: Macros; profile: Profile }) {
  const unit: EnergyUnit = profile.energy_unit
  const goal = kcalToDisplay(profile.goal_kcal, unit)
  const consumed = kcalToDisplay(eaten.kcal, unit)
  const remaining = Math.round(goal - consumed)
  const over = remaining < 0

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
      <Bar fraction={progressFraction(eaten.kcal, profile.goal_kcal)} over={over} className="mt-3" />
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <MacroBar label="Protein" eaten={eaten.protein} goal={profile.goal_protein_g} />
        <MacroBar label="Carbs" eaten={eaten.carbs} goal={profile.goal_carbs_g} />
        <MacroBar label="Fat" eaten={eaten.fat} goal={profile.goal_fat_g} />
      </div>
    </div>
  )
}

function MacroBar({ label, eaten, goal }: { label: string; eaten: number; goal: number }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="font-semibold tabular-nums">
        {Math.round(eaten)}
        <span className="text-muted font-normal"> / {goal} g</span>
      </p>
      <Bar fraction={progressFraction(eaten, goal)} over={eaten > goal * 1.05} className="mt-1" />
    </div>
  )
}

function Bar({ fraction, over, className }: { fraction: number; over?: boolean; className?: string }) {
  return (
    <div
      className={clsx('bg-surface-2 h-2 overflow-hidden rounded-full', className)}
      role="progressbar"
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
