import { clsx } from 'clsx'
import { useSession } from '@/app/useAuth'
import { Button } from '@/components/Button'
import { Card, Page } from '@/components/Page'
import { supabase } from '@/lib/supabase/client'
import { useProfile, useUpdateProfile } from '@/lib/supabase/profile'

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
          {update.error && <p className="text-danger text-sm">Couldn't save: {update.error.message}</p>}
        </Card>
      )}

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
