import { expect, test, type Page } from '@playwright/test'
import { installFakeBackend, seedTables, signIn, TEST_EMAIL, TEST_PASSWORD, USER_ID } from './fake-supabase'

// Regression tests for the issues found in the Codex review (ids refer to that review).

const isGet = (method: string, url: string, table: string) =>
  method === 'GET' && new URL(url).pathname.endsWith(`/rest/v1/${table}`)

async function startWorkoutWithSet(page: Page) {
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByRole('button', { name: /Barbell Bench Press/ }).click()
  await page.getByRole('textbox', { name: 'Weight (kg)' }).fill('100')
  await page.getByRole('textbox', { name: 'Reps' }).fill('5')
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByText('100 kg × 5', { exact: true })).toBeVisible()
}

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  /** Make the next reloads' workout_sets reads hang until release() is called. */
  async function stallSetReads(page: Page) {
    let release!: () => void
    const stalled = new Promise<void>((r) => (release = r))
    await page.route('**/rest/v1/workout_sets**', async (route) => {
      if (isGet(route.request().method(), route.request().url(), 'workout_sets')) await stalled
      await route.fallback()
    })
    return () => release()
  }

  test('D1: on a cold start, Finish waits for the sets to load', async ({ page }) => {
    const db = await installFakeBackend(page)
    await startWorkoutWithSet(page)
    await expect.poll(() => db.workout_sets!.length).toBe(1)

    await page.evaluate(() => localStorage.removeItem('fitness-tracker-cache')) // nothing saved on the phone
    const release = await stallSetReads(page)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeDisabled()
    release()
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeEnabled()
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
    expect(db.workout_sets).toHaveLength(1)
    expect(db.workouts![0]!.ended_at).not.toBeNull()
  })

  test('D1: an out-of-date saved copy showing no sets never deletes the workout', async ({ page }) => {
    const db = await installFakeBackend(page)
    await page.goto('/workout')
    await page.getByRole('button', { name: 'Start workout' }).click()
    await expect(page.getByText('Add your first exercise')).toBeVisible()
    await page.waitForTimeout(800) // the phone now has a saved copy with no sets

    // Meanwhile a set reaches the server (e.g. logged on another device).
    db.workout_sets!.push({
      id: crypto.randomUUID(),
      user_id: USER_ID,
      workout_id: db.workouts![0]!.id,
      exercise_id: 'e-bench',
      exercise_order: 0,
      set_index: 0,
      weight_kg: 100,
      reps: 5,
      duration_sec: null,
      distance_m: null,
      rpe: null,
      is_warmup: false,
      notes: null,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    await stallSetReads(page) // never released: the server's answer doesn't arrive
    await page.reload()
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect.poll(() => db.workouts![0]?.ended_at ?? null).not.toBeNull()
    expect(db.workouts).toHaveLength(1)
    expect(db.workout_sets).toHaveLength(1)
  })

  test('D2: a food logged offline survives a reload and syncs when back online', async ({
    page,
    context,
  }) => {
    const db = await installFakeBackend(page)
    await page.goto('/food')
    await expect(page.getByText('0 / 2000 eaten')).toBeVisible()
    // Let the background preload of all screens finish (a 1.5 s timer where requestIdleCallback is
    // missing, as in Safari).
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    await context.setOffline(true)
    await page.getByRole('link', { name: '+ Add food' }).first().click()
    await page.getByRole('button', { name: 'Quick add' }).click()
    await page.getByLabel('Calories (kcal)').fill('300')
    await page.getByRole('button', { name: 'Add to diary' }).click()
    await expect(page.getByText('300 / 2000 eaten')).toBeVisible()
    await expect(page.getByText(/1 change saved on this phone/)).toBeVisible()
    expect(db.food_entries).toHaveLength(0)

    // Close and reopen the app before signal returns: the queued write is restored and replayed.
    await page.waitForTimeout(800) // let the persister flush
    await context.setOffline(false)
    await page.reload()
    await expect.poll(() => db.food_entries!.length).toBe(1)
    await expect(page.getByText('300 / 2000 eaten')).toBeVisible()
    await expect(page.getByText(/saved on this phone/)).toHaveCount(0)
  })

  test('D3: deleting a set that is still saving leaves no orphan on the server', async ({ page }) => {
    const db = await installFakeBackend(page)
    await page.goto('/workout')
    await page.getByRole('button', { name: 'Start workout' }).click()
    await page.getByRole('button', { name: '+ Add exercise' }).click()
    await page.getByRole('button', { name: /Barbell Bench Press/ }).click()

    await page.route('**/rest/v1/workout_sets**', async (route) => {
      if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1000))
      await route.fallback()
    })
    await page.getByRole('textbox', { name: 'Weight (kg)' }).fill('100')
    await page.getByRole('textbox', { name: 'Reps' }).fill('5')
    await page.getByRole('button', { name: 'Log set' }).click()
    await page.getByRole('button', { name: 'Delete set 1' }).click() // while the insert is in flight
    await expect(page.getByText('100 kg × 5', { exact: true })).toHaveCount(0)
    await page.waitForTimeout(1800)
    expect(db.workout_sets).toHaveLength(0)
    await expect(page.getByText('100 kg × 5', { exact: true })).toHaveCount(0)
  })

  test('D5: a deleted set can be restored with Undo', async ({ page }) => {
    const db = await installFakeBackend(page)
    await startWorkoutWithSet(page)
    await page.getByRole('button', { name: 'Delete set 1' }).click()
    await expect(page.getByText('100 kg × 5', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('100 kg × 5', { exact: true })).toBeVisible()
    await expect.poll(() => db.workout_sets!.length).toBe(1)
  })

  test('B6: an invalid weight blocks logging instead of becoming 0 kg', async ({ page }) => {
    await installFakeBackend(page)
    await page.goto('/workout')
    await page.getByRole('button', { name: 'Start workout' }).click()
    await page.getByRole('button', { name: '+ Add exercise' }).click()
    await page.getByRole('button', { name: /Barbell Bench Press/ }).click()
    await page.getByRole('textbox', { name: 'Reps' }).fill('5')
    await expect(page.getByRole('button', { name: 'Log set' })).toBeDisabled() // no weight yet
    await page.getByRole('textbox', { name: 'Weight (kg)' }).fill('-5')
    await expect(page.getByRole('textbox', { name: 'Weight (kg)' })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('button', { name: 'Log set' })).toBeDisabled()
    await page.getByRole('textbox', { name: 'Weight (kg)' }).fill('0')
    await expect(page.getByRole('button', { name: 'Log set' })).toBeEnabled() // empty bar is fine
  })

  test('barcode lookup error still allows entering the food manually', async ({ page }) => {
    await installFakeBackend(page)
    await page.route('https://world.openfoodfacts.org/api/v2/product/**', (route) =>
      route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'down' }),
    )
    await page.goto('/food/barcode/036000291452?meal=Lunch')
    await expect(page.getByText(/Open Food Facts lookup failed/)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Enter it manually' }).click()
    await expect(page.getByRole('button', { name: 'Save food' })).toBeVisible()
  })

  test('U1: a failed diary load says so instead of showing an empty day', async ({ page }) => {
    await installFakeBackend(page)
    let fail = true
    await page.route('**/rest/v1/food_entries**', async (route) => {
      if (fail && isGet(route.request().method(), route.request().url(), 'food_entries')) {
        return route.fulfill({ status: 500, json: { message: 'boom' } })
      }
      await route.fallback()
    })
    await page.goto('/food')
    await expect(page.getByText("Couldn't load this day's food")).toBeVisible({ timeout: 15_000 })
    fail = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText("Couldn't load this day's food")).toHaveCount(0)
  })

  test('B11: an invalid date in the URL falls back to today instead of crashing', async ({ page }) => {
    await installFakeBackend(page)
    await page.goto('/food?date=2026-02-30')
    await expect(page.getByRole('heading', { name: 'Food' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
  })

  test('B8: totals are marked incomplete when a food has no protein data', async ({ page }) => {
    const tables = seedTables()
    tables.food_entries = [
      {
        id: crypto.randomUUID(),
        user_id: USER_ID,
        date: new Date().toLocaleDateString('en-CA'),
        meal: 'Lunch',
        food_id: null,
        food_snapshot: { kind: 'quick', name: 'Takeaway', brand: null, per100: { kcal: 700, protein: null } },
        grams: 100,
        serving_label: null,
        created_at: new Date().toISOString(),
      },
    ]
    await installFakeBackend(page, tables)
    await page.goto('/food')
    await expect(page.getByText('Some foods have no data for this')).toBeVisible()
  })

  test('U4: changing a unit keeps unsaved goal edits', async ({ page }) => {
    await installFakeBackend(page)
    await page.goto('/settings')
    await page.getByLabel('Protein (g)').fill('180')
    await page.getByText('lb', { exact: true }).click()
    await expect(page.getByLabel('Protein (g)')).toHaveValue('180')
  })
})

test('B10: signing in returns to the exact page, including date and meal', async ({ page }) => {
  await installFakeBackend(page)
  await page.goto('/food/add?date=2026-10-18&meal=Dinner')
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/food\/add\?date=2026-10-18&meal=Dinner$/)
  await expect(page.getByRole('heading', { name: 'Add to Dinner' })).toBeVisible()
})
