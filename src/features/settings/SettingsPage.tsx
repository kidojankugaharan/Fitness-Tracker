import { useState } from 'react'
import { useSession } from '@/app/useAuth'
import { formatDuration } from '@/domain/sets'
import { Button } from '@/components/Button'
import { Card, Page } from '@/components/Page'
import { Segmented } from '@/components/Segmented'
import { energyLabel, energyToKcal, kcalToDisplay, type EnergyUnit } from '@/domain/units'
import { stopRest } from '@/lib/restTimer'
import { showToast } from '@/lib/toast'
import { MIN_PASSWORD_LENGTH, signOut, useSetPassword } from '@/lib/supabase/account'
import { useProfile, useUpdateProfile, type Profile } from '@/lib/supabase/profile'

/** Lets magic-link users add a password so future sign-ins need no email. */
function PasswordForm() {
  const setPassword = useSetPassword()
  const [password, setValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const mismatch = confirm.length > 0 && confirm !== password
  const valid = password.length >= MIN_PASSWORD_LENGTH && confirm === password

  const inputClass =
    'border-border-strong bg-surface-2 focus:border-accent aria-invalid:border-danger min-h-12 rounded-xl border px-4 text-base outline-none transition-colors w-full'

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          setPassword.mutate(password, {
            onSuccess: () => {
              setValue('')
              setConfirm('')
              showToast('Password saved — use it to sign in without email', 'info', 3000)
            },
          })
        }}
      >
        <div>
          <h2 className="display text-xl">Password</h2>
          <p className="text-muted text-sm">
            Set one to sign in on other devices without waiting for an email.
          </p>
        </div>
        <label className="block">
          <span className="eyebrow mb-1.5 block">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={tooShort}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            className={inputClass}
          />
        </label>
        {tooShort && <p className="text-danger text-sm">At least {MIN_PASSWORD_LENGTH} characters.</p>}
        {mismatch && <p className="text-danger text-sm">Passwords don't match.</p>}
        <Button type="submit" className="w-full" disabled={!valid || setPassword.isPending}>
          {setPassword.isPending ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </Card>
  )
}

const REST_OPTIONS_SEC = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]

const GOAL_FIELDS = [
  { key: 'goal_kcal', label: 'Energy', unit: 'kcal', max: 20000 },
  { key: 'goal_protein_g', label: 'Protein', unit: 'g', max: 1000 },
  { key: 'goal_carbs_g', label: 'Carbs', unit: 'g', max: 2000 },
  { key: 'goal_fat_g', label: 'Fat', unit: 'g', max: 1000 },
] as const

type GoalKey = (typeof GOAL_FIELDS)[number]['key']

function GoalsForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const unit: EnergyUnit = profile.energy_unit
  // The energy goal is typed in the display unit; it is stored in kcal.
  const [values, setValues] = useState<Record<GoalKey, string>>(() => ({
    goal_kcal: String(Math.round(kcalToDisplay(profile.goal_kcal, unit))),
    goal_protein_g: String(profile.goal_protein_g),
    goal_carbs_g: String(profile.goal_carbs_g),
    goal_fat_g: String(profile.goal_fat_g),
  }))

  const parsed = Object.fromEntries(
    GOAL_FIELDS.map(({ key, max }) => {
      const typed = Number(values[key])
      if (values[key].trim() === '' || !Number.isFinite(typed) || typed < 0) return [key, null]
      const n = key === 'goal_kcal' ? Math.round(energyToKcal(typed, unit)) : typed
      return [key, Number.isInteger(n) && n <= max ? n : null]
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
          // mutateAsync, not mutate callbacks: saving remounts this form (its key is the saved goals),
          // which would drop per-call callbacks. Errors are already shown by the global handler.
          update
            .mutateAsync(parsed as Record<GoalKey, number>)
            .then(() => showToast('Goals saved', 'info', 2000))
            .catch(() => {})
        }}
      >
        <h2 className="display text-xl">Daily goals</h2>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_FIELDS.map(({ key, label, unit: fieldUnit }) => (
            <label key={key} className="block">
              <span className="eyebrow mb-1.5 block">
                {key === 'goal_kcal' ? energyLabel(unit) : `${label} (${fieldUnit})`}
              </span>
              <input
                inputMode="numeric"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                aria-invalid={parsed[key] === null}
                className="border-border-strong bg-surface-2 focus:border-accent aria-invalid:border-danger numeric min-h-12 w-full rounded-xl border px-4 text-base text-xl transition-colors outline-none"
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
        <p className="eyebrow">Signed in as</p>
        <p className="font-semibold break-all">{session.user.email}</p>
      </Card>

      {profile && (
        <Card className="space-y-4">
          <Segmented
            inline
            label="Weight"
            value={profile.units}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
            onChange={(units) => update.mutate({ units })}
          />
          <Segmented
            inline
            label="Energy"
            value={profile.energy_unit}
            options={[
              { value: 'kcal', label: 'kcal' },
              { value: 'kJ', label: 'kJ' },
            ]}
            onChange={(energy_unit) => update.mutate({ energy_unit })}
          />
          <label className="flex items-center justify-between gap-4">
            <span className="font-medium">Rest timer</span>
            <select
              value={profile.rest_timer_default_sec}
              onChange={(e) => {
                const sec = Number(e.target.value)
                if (sec === 0) stopRest() // turning the timer off also stops one that's running
                update.mutate({ rest_timer_default_sec: sec })
              }}
              className="numeric bg-surface-2 border-border-strong min-h-11 rounded-xl border px-3 text-base"
            >
              {REST_OPTIONS_SEC.map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 0 ? 'Off' : formatDuration(sec)}
                </option>
              ))}
            </select>
          </label>
        </Card>
      )}

      {/* Remount (resetting unsaved edits) only when the saved goals or energy unit change. */}
      {profile && (
        <GoalsForm
          key={[
            profile.goal_kcal,
            profile.goal_protein_g,
            profile.goal_carbs_g,
            profile.goal_fat_g,
            profile.energy_unit,
          ].join()}
          profile={profile}
        />
      )}

      <PasswordForm />

      <Button variant="danger" className="w-full" onClick={() => signOut()}>
        Sign out
      </Button>
    </Page>
  )
}
