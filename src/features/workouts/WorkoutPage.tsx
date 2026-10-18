import { EmptyState, Page } from '@/components/Page'

export function WorkoutPage() {
  return (
    <Page title="Workout">
      <EmptyState
        title="Workout log"
        body="Log sets, reps and weight with PR tracking — coming in Phase 1."
      />
    </Page>
  )
}
