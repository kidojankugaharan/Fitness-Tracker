import { expect, test } from '@playwright/test'
import { addDays, today } from '../src/domain/dates'
import { VIDEO_BARCODE } from '../playwright.config'
import { installFakeBackend, seedTables, signIn, USER_ID } from './fake-supabase'

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('scan a real barcode with the camera, add it, and scan the next one', async ({ page }) => {
  const db = await installFakeBackend(page)
  await page.goto('/food')
  await page.getByRole('link', { name: 'Scan' }).first().click()

  // The fake camera shows a real EAN-13 (Nutella); the scanner decodes it and looks it up.
  await expect(page.getByRole('heading', { name: 'Nutella' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Unit')).toHaveValue('15 g')
  await page.getByRole('button', { name: 'Add & scan next' }).click()

  // Straight back to the scanner for the next item.
  await expect(page.getByText('Scan barcode')).toBeVisible()
  await expect.poll(() => db.food_entries!.length).toBe(1)
  expect(db.food_entries![0]!.meal).toBe('Breakfast')
  expect(db.foods!.map((f) => f.off_code)).toEqual([VIDEO_BARCODE]) // cached for next time

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Nutella')).toBeVisible()
  await expect(page.getByText('81 / 2000 eaten')).toBeVisible() // 15 g × 539 kcal/100 g
})

test('unknown barcode: enter the label once, then the next scan finds it instantly', async ({ page }) => {
  const db = await installFakeBackend(page)
  const code = '036000291452' // valid UPC-A, not in the fake OFF database

  await page.goto('/food/scan?meal=Lunch')
  await page.getByLabel('Barcode number').fill(code)
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page.getByText('Not in Open Food Facts yet')).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Protein Bar')
  await page.getByLabel('Serving size (g)').fill('60')
  await page.getByLabel('Calories (kcal)').fill('210')
  await page.getByLabel('Protein (g)').fill('20')
  await page.getByRole('button', { name: 'Save food' }).click()

  // Saved per 100 g, with the label's serving pre-selected.
  await expect(page.getByRole('heading', { name: 'Protein Bar' })).toBeVisible()
  // Stored under the canonical GTIN-13 spelling, so UPC-A and EAN-13 scans both find it.
  expect(db.foods![0]).toMatchObject({
    off_code: `0${code}`,
    user_id: USER_ID,
    kcal_100g: 350,
    protein_100g: 33.33,
  })
  await page.getByRole('button', { name: 'Add to diary' }).click()
  await expect(page.getByText('210 / 2000 eaten')).toBeVisible()

  // Scanning it again (as the EAN-13 spelling) resolves locally, straight to the amount screen.
  await page.goto(`/food/scan?meal=Lunch`)
  await page.getByLabel('Barcode number').fill(`0${code}`)
  await page.getByRole('button', { name: 'Look up' }).click()
  await expect(page.getByRole('heading', { name: 'Protein Bar' })).toBeVisible()
})

test('quick add calories and edit them', async ({ page }) => {
  const db = await installFakeBackend(page)
  await page.goto('/food')
  await page.getByRole('link', { name: '+ Add food' }).nth(2).click() // Dinner
  await page.getByRole('button', { name: 'Quick add' }).click()
  await page.getByLabel('Description (optional)').fill('Burrito bowl')
  await page.getByLabel('Calories (kcal)').fill('850')
  await page.getByLabel('Protein (g)').fill('45')
  await page.getByRole('button', { name: 'Add to diary' }).click()

  await expect(page.getByText('Burrito bowl')).toBeVisible()
  await expect(page.getByText('Quick add · 45 g protein')).toBeVisible()
  await expect(page.getByText('850 / 2000 eaten')).toBeVisible()
  await expect.poll(() => db.food_entries!.length).toBe(1)
  expect(db.food_entries![0]).toMatchObject({ meal: 'Dinner', food_id: null })

  await page.getByRole('link', { name: /Burrito bowl/ }).click()
  await page.getByLabel('Calories (kcal)').fill('900')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('900 / 2000 eaten')).toBeVisible()
})

test('copy a meal and a whole day from yesterday', async ({ page }) => {
  const tables = seedTables()
  const yesterday = addDays(today(), -1)
  const entry = (meal: string, name: string, kcal: number) => ({
    id: crypto.randomUUID(),
    user_id: USER_ID,
    date: yesterday,
    meal,
    food_id: null,
    food_snapshot: { name, brand: null, per100: { kcal, protein: 10, carbs: 10, fat: 5 } },
    grams: 100,
    serving_label: null,
    created_at: new Date().toISOString(),
  })
  tables.food_entries = [entry('Breakfast', 'Oatmeal', 300), entry('Lunch', 'Chicken salad', 450)]
  await installFakeBackend(page, tables)
  await page.goto('/food')

  await page.getByRole('button', { name: 'Copy…' }).first().click() // Breakfast
  await page.getByRole('button', { name: 'Copy from Yesterday' }).click()
  await expect(page.getByText('Copied 1 item from Yesterday.')).toBeVisible()
  await expect(page.getByText('Oatmeal')).toBeVisible()
  await expect(page.getByText('Chicken salad')).toHaveCount(0)

  await page.getByRole('button', { name: 'Copy a whole day…' }).click()
  await page.getByRole('button', { name: 'Copy from Yesterday' }).click()
  await expect(page.getByText('Chicken salad')).toBeVisible()
  await expect(page.getByText('1050 / 2000 eaten')).toBeVisible() // 300 × 2 + 450
})

test('rest timer starts after a set, can be adjusted, and alerts when done', async ({ page }) => {
  await page.clock.install()
  await installFakeBackend(page)
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByRole('button', { name: /Barbell Squat/ }).click()
  await page.getByRole('textbox', { name: 'Weight (kg)' }).fill('140')
  await page.getByRole('textbox', { name: 'Reps' }).fill('5')
  await page.getByRole('button', { name: 'Log set' }).click()

  const timer = page.getByRole('timer', { name: 'Rest timer' })
  await expect(timer).toContainText('1:30')
  await expect(timer).toContainText('Barbell Squat')
  await page.getByRole('button', { name: '15 seconds more' }).click()
  await expect(timer).toContainText('1:45')

  // It keeps running on other tabs.
  await page.getByRole('link', { name: 'Food' }).click()
  await page.clock.runFor(106_000)
  await expect(timer).toContainText('Rest over — go!')
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(timer).toHaveCount(0)
})

test('rest timer can be turned off in Settings', async ({ page }) => {
  await installFakeBackend(page)
  await page.goto('/settings')
  await page.getByLabel('Rest timer').selectOption('0')
  await page.getByRole('link', { name: 'Workout' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByRole('button', { name: /Pull-Up/ }).click()
  await page.getByRole('textbox', { name: 'Reps' }).fill('8')
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByText('8 reps')).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
})

test('finishing a workout stops the rest timer', async ({ page }) => {
  await installFakeBackend(page)
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByRole('button', { name: /Pull-Up/ }).click()
  await page.getByRole('textbox', { name: 'Reps' }).fill('8')
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByRole('timer')).toHaveCount(0)
})
