import { clsx } from 'clsx'
import { useState } from 'react'
import { useSession } from '@/app/useAuth'
import { Button } from '@/components/Button'
import { Card, Page } from '@/components/Page'
import { showToast } from '@/lib/toast'
import { supabase } from '@/lib/supabase/client'
import { useProfile, useUpdateProfile, type Profile } from '@/lib/supabase/profile'

const GOAL_FIELDS = [
  { key: 'goal_kcal', label: 'Calories', unit: 'kcal', max: 20000 },
  { key: 'goal_protein_g', label: 'Protein', unit: 'g', max: 1000 },
  { key: 'goal_carbs_g', label: 'Carbs', unit: 'g', max: 2000 },
  { key: 'goal_fat_g', label: 'Fat', unit: 'g', max: 1000 },
] as const

type GoalKey = (typeof GOAL_FIELDS)[number]['key']

function GoalsForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [values, setValues] = useState<Record<GoalKey, string>>(() => ({
    goal_kcal: String(profile.goal_kcal),
    goal_protein_g: String(profile.goal_protein_g),
    goal_carbs_g: String(profile.goal_carbs_g),
    goal_fat_g: String(profile.goal_fat_g),
  }))

  const parsed = Object.fromEntries(
    GOAL_FIELDS.map(({ key, max }) => {
      const n = Number(values[key])
      return [key, Number.isInteger(n) && n >= 0 && n <= max ? n : null]
    }),
  ) as Record<GoalKey, number | null>
  const valid = Object.values(parsed).every((v) => v !== null)
  const dirty = GOAL_FIELDS.some(({ key }) => parsed[key] !== profile[key])
  const macroKcal =
    (parsed.goal_protein_g ?? 0) * 4 + (parsed.goal_carbs_g ?? 0) * 4 + (parsed.goal_fat_g ?? 0) * 9

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          update.mutate(parsed as Record<GoalKey, number>, {
            onSuccess: () => showToast('Goals saved', 'info', 2000),
          })
        }}
      >
        <h2 className="font-semibold">Daily goals</h2>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_FIELDS.map(({ key, label, unit }) => (
            <label key={key} className="block">
              <span className="text-muted mb-1 block text-xs font-medium">
                {label} ({unit})
              </span>
              <input
                inputMode="numeric"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                aria-invalid={parsed[key] === null}
                className="border-border bg-surface-2 aria-invalid:border-danger min-h-11 w-full rounded-xl border px-3 text-base tabular-nums"
              />
            </label>
          ))}
        </div>
        <p className="text-muted text-sm">Macros add up to {macroKcal} kcal.</p>
        <Button type="submit" className="w-full" disabled={!valid || !dirty || update.isPending}>
          Save goals
        </Button>
      </form>
    </Card>
  )
}

export function SettingsPage() {
  const session = useSession()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()

  return (
    <Page title="Settings">
      <Card>
        <p className="text-muted text-sm">Signed in as</p>
        <p className="font-semibold break-all">{session.user.email}</p>
      </Card>

      {profile && (
        <Card className="space-y-4">
          <Segmented
            label="Weight"
            value={profile.units}
            options={['kg', 'lb'] as const}
            onChange={(units) => update.mutate({ units })}
          />
          <Segmented
            label="Energy"
            value={profile.energy_unit}
            options={['kcal', 'kJ'] as const}
            onChange={(energy_unit) => update.mutate({ energy_unit })}
          />
        </Card>
      )}

      {profile && <GoalsForm key={profile.updated_at} profile={profile} />}

      <Button variant="danger" className="w-full" onClick={() => supabase.auth.signOut()}>
        Sign out
      </Button>
    </Page>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="bg-surface-2 flex rounded-xl p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            onClick={() => option !== value && onChange(option)}
            className={clsx(
              'min-h-9 min-w-14 rounded-lg px-3 text-sm font-semibold',
              option === value ? 'bg-surface text-text shadow-sm' : 'text-muted',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
