// The made-up Supabase project E2E builds use (see playwright.config.ts). Every request to it is
// served by e2e/fake-supabase.ts, so nothing a test does can reach the real project.
export const E2E_SUPABASE_URL = 'https://e2e-fake-project.supabase.co'
export const E2E_SUPABASE_ANON_KEY = 'e2e-fake-anon-key'
