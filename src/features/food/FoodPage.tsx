import { EmptyState, Page } from '@/components/Page'

export function FoodPage() {
  return (
    <Page title="Food">
      <EmptyState title="Food diary" body="Search Open Food Facts and log meals — coming in Phase 1." />
    </Page>
  )
}
