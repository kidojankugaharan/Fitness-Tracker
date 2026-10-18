import { expect, test } from '@playwright/test'
import {
  installFakeBackend,
  seedTables,
  signIn,
  TEST_EMAIL,
  TEST_PASSWORD,
  type AuthLog,
} from './fake-supabase'

const newLog = (): AuthLog => ({ otpRequests: 0, passwordUpdates: [] })

test('password sign-in sends no email', async ({ page }) => {
  const log = newLog()
  await installFakeBackend(page, seedTables(), log)
  await page.goto('/sign-in')

  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect')

  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('0 / 2000 eaten')).toBeVisible()
  expect(log.otpRequests).toBe(0)
})

test('email code fallback is throttled and explains the rate limit', async ({ page }) => {
  const log = newLog()
  await installFakeBackend(page, seedTables(), log)
  await page.goto('/sign-in')

  await page.getByRole('button', { name: /Sign in with an email code/ }).click()
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click()
  await expect(page.getByLabel('Sign-in code')).toBeVisible()

  // Going back immediately: the send button stays locked, even after a reload.
  await page.getByRole('button', { name: 'Use a different email' }).click()
  await expect(page.getByRole('button', { name: /Email sent — wait \d+s/ })).toBeDisabled()
  await page.reload()
  await page.getByRole('button', { name: /Sign in with an email code/ }).click()
  await expect(page.getByRole('button', { name: /Email sent — wait \d+s/ })).toBeDisabled()
  expect(log.otpRequests).toBe(1)

  // When Supabase itself refuses, the message is clear and points to passwords.
  await page.evaluate(() => localStorage.removeItem('auth:last-email-sent-at'))
  await page.reload()
  await page.getByRole('button', { name: /Sign in with an email code/ }).click()
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click()
  await expect(page.getByRole('alert')).toContainText('Too many sign-in emails')
  await expect(page.getByRole('button', { name: /Email sent — wait \d+s/ })).toBeDisabled()
})

test('a signed-in user can set a password in Settings', async ({ page }) => {
  const log = newLog()
  await signIn(page)
  await installFakeBackend(page, seedTables(), log)
  await page.goto('/settings')

  await page.getByLabel('New password').fill('short')
  await expect(page.getByText('At least 8 characters.')).toBeVisible()
  await page.getByLabel('New password').fill(TEST_PASSWORD)
  await page.getByLabel('Confirm password').fill('different')
  await expect(page.getByText("Passwords don't match.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save password' })).toBeDisabled()

  await page.getByLabel('Confirm password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText(/Password saved/)).toBeVisible()
  expect(log.passwordUpdates).toEqual([TEST_PASSWORD])
})
