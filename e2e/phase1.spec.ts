import { expect, test } from '@playwright/test'
import { installFakeBackend, signIn } from './fake-supabase'

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('log a workout: sets are pre-filled, PRs are flagged, history is kept', async ({ page }) => {
  const db = await installFakeBackend(page)
  await page.goto('/workout')

  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByLabel('Search exercises').fill('bench')
  await page.getByRole('button', { name: /Barbell Bench Press/ }).click()

  // First set: type the numbers.
  await page.getByRole('textbox', { name: 'Weight (kg)' }).fill('100')
  await page.getByRole('textbox', { name: 'Reps' }).fill('5')
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByText('100 kg × 5')).toBeVisible()

  // Second set is pre-filled from the first; bump weight with the stepper → a PR.
  await expect(page.getByRole('textbox', { name: 'Weight (kg)' })).toHaveValue('100')
  await page.getByRole('button', { name: 'Increase Weight (kg)' }).click()
  await page.getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByText('102.5 kg × 5')).toBeVisible()
  await expect(page.getByText('PR', { exact: true })).toHaveCount(1)

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
  await expect(page.getByText('Barbell Bench Press')).toBeVisible()
  expect(db.workout_sets).toHaveLength(2)
  expect(db.workout_sets!.map((s) => s.weight_kg)).toEqual([100, 102.5])

  // Next workout shows last session and pre-fills from it.
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByRole('button', { name: /Barbell Bench Press/ }).click()
  await expect(page.getByText('Last time: 100 kg × 5, 102.5 kg × 5')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Weight (kg)' })).toHaveValue('100')

  // Exercise history page.
  await page.getByRole('link', { name: 'Barbell Bench Press' }).click()
  await expect(page.getByRole('heading', { name: 'Barbell Bench Press' })).toBeVisible()
  await expect(page.getByText('Heaviest')).toBeVisible()
  await expect(page.getByText('102.5 kg').first()).toBeVisible()
})

test('create a custom exercise from the picker', async ({ page }) => {
  const db = await installFakeBackend(page)
  await page.goto('/workout')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByLabel('Search exercises').fill('Landmine Press')
  await page.getByRole('button', { name: /Create “Landmine Press”/ }).click()
  await page.getByRole('button', { name: 'Create & add' }).click()
  await expect(page.getByRole('link', { name: 'Landmine Press' })).toBeVisible()
  expect(db.exercises!.some((e) => e.name === 'Landmine Press' && e.user_id)).toBe(true)
})

test('log food from Open Food Facts, see totals, edit and delete', async ({ page }) => {
  const db = await installFakeBackend(page)
  await page.goto('/food')

  await page.getByRole('link', { name: '+ Add food' }).first().click()
  await expect(page.getByRole('heading', { name: 'Add to Breakfast' })).toBeVisible()
  await page.getByLabel('Search foods').fill('oats')
  await page.getByRole('button', { name: /Rolled Oats/ }).click()

  // Defaults to the product's serving (40 g → 150 kcal).
  await expect(page.getByLabel('Unit')).toHaveValue('40 g')
  await page.getByRole('button', { name: 'Increase Amount' }).click() // 1.5 servings = 60 g
  await page.getByRole('button', { name: 'Add to diary' }).click()

  await expect(page).toHaveURL(/\/food$/)
  await expect(page.getByText('Rolled Oats')).toBeVisible()
  await expect(page.getByText('1.5 × 40 g · 60 g · Quaker')).toBeVisible()
  await expect(page.getByLabel('Unit').locator('option', { hasText: '(40 g)' })).toHaveCount(0)
  await expect(page.getByText('225 / 2000 eaten')).toBeVisible()
  await expect.poll(() => db.food_entries!.length).toBe(1)
  expect(db.foods).toHaveLength(1) // cached into the shared table

  // Recents now offer one-tap re-logging without hitting OFF.
  await page.getByRole('link', { name: '+ Add food' }).nth(1).click()
  await expect(page.getByRole('button', { name: /Rolled Oats/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()

  // Edit to 100 g.
  await page.getByRole('link', { name: /Rolled Oats/ }).click()
  await page.getByLabel('Unit').selectOption('__grams__')
  await page.getByRole('textbox', { name: 'Amount' }).fill('100')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('375 / 2000 eaten')).toBeVisible()

  // Delete with confirmation.
  await page.getByRole('link', { name: /Rolled Oats/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Delete entry' }).click()
  await expect(page.getByText('0 / 2000 eaten')).toBeVisible()
  await expect.poll(() => db.food_entries!.length).toBe(0)
})

test('today shows food totals and goals can be changed', async ({ page }) => {
  await installFakeBackend(page)
  await page.goto('/settings')
  await page.getByLabel('Calories (kcal)').fill('2500')
  await page.getByRole('button', { name: 'Save goals' }).click()
  await expect(page.getByText('Goals saved')).toBeVisible()

  await page.getByRole('link', { name: 'Today' }).click()
  await expect(page.getByText('0 / 2500 eaten')).toBeVisible()
  await expect(page.getByText('No workout logged today.')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})
