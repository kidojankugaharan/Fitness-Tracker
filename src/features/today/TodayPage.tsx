import { Card, Page } from '@/components/Page'
import { formatDayLabel, today } from '@/domain/dates'
import { formatEnergy } from '@/domain/units'
import { useProfile } from '@/lib/supabase/profile'

export function TodayPage() {
  const { data: profile, isPending, error } = useProfile()

  return (
    <Page title={formatDayLabel(today())}>
      {error && (
        <Card>
          <p className="text-danger">Couldn't load your profile: {error.message}</p>
        </Card>
      )}
      <Card>
        <p className="text-muted text-sm">Calories remaining</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">
          {isPending || !profile ? '—' : formatEnergy(profile.goal_kcal, profile.energy_unit)}
        </p>
        {profile && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <Macro label="Protein" goal={profile.goal_protein_g} />
            <Macro label="Carbs" goal={profile.goal_carbs_g} />
            <Macro label="Fat" goal={profile.goal_fat_g} />
          </div>
        )}
      </Card>
      <Card>
        <p className="font-semibold">Workout</p>
        <p className="text-muted mt-1 text-sm">No workout logged today.</p>
      </Card>
    </Page>
  )
}

function Macro({ label, goal }: { label: string; goal: number }) {
  return (
    <div className="bg-surface-2 rounded-xl py-2">
      <p className="text-muted">{label}</p>
      <p className="font-semibold tabular-nums">0 / {goal} g</p>
    </div>
  )
}
