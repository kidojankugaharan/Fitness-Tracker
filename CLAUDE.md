# Fitness Tracker

A mobile-friendly web app combining **food & macro logging** (MyFitnessPal-style) and **workout logging** (FitNotes-style: sets, reps, weight, history, progress charts, PRs) — with a cleaner, faster UX than either.

## Product principles

- **Speed over features.** Logging a set or a food should take 1–3 taps. Pre-fill from history, use steppers, avoid modals where possible.
- **Mobile-first.** Design for a 375px viewport, one-handed use, large tap targets (≥44px), bottom tab navigation.
- **Instant feel.** Optimistic UI updates for every write; never block the UI on the network.
- **Never lose data.** Logged food entries snapshot their nutrition; edits to a food never rewrite history.

## Agreed decisions

| Decision      | Choice                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------ |
| Data storage  | **Cloud from day one** — Supabase (Postgres + Auth), per-user rows with Row Level Security |
| Phase 1 scope | **Both food and workouts, thin** versions of each                                          |
| Default units | **kg** (lb switchable in settings; always store kg)                                        |
| Hosting       | **Vercel** (static SPA, HTTPS for PWA install + camera)                                    |
| Food database | **Open Food Facts**                                                                        |

## Tech stack

- **Vite + React + TypeScript** (strict mode)
- **Tailwind CSS** + Radix primitives for accessible headless components
- **Supabase**: Auth (email magic link + optional Google), Postgres, RLS, generated TS types (`supabase gen types`)
- **TanStack Query**: all server state, optimistic mutations, caching; persisted query cache for fast reloads
- **React Router** for routing
- **Recharts** for charts
- **vite-plugin-pwa** for installability and asset caching
- **Barcode**: native `BarcodeDetector` (Chrome on Android), else the `barcode-detector` ponyfill (ZXing WebAssembly) loaded lazily; its `.wasm` is bundled (not CDN), excluded from precache and cached on first use (`src/lib/barcode/detector.ts`). Camera needs HTTPS (or localhost).
- **Testing**: Vitest (domain logic: PRs, 1RM, macro math, unit conversion), Playwright (E2E at mobile viewport)
- **Tooling**: ESLint + Prettier, pnpm or npm (pick one at scaffold time and stick to it)

## Open Food Facts integration

- **Search** uses search-a-licious (`search.openfoodfacts.org/search`), which sends **no CORS headers**, so the browser calls the same-origin path `/off-search/*`: proxied by Vite (`server.proxy`/`preview.proxy` in vite.config.ts) locally and by a rewrite in vercel.json in production. The legacy `/cgi/search.pl` endpoint returned 503 when checked (2026-10-18).
- **Product lookup** (`world.openfoodfacts.org/api/v2/product/{code}`) allows CORS (`*`) and is called directly for barcode lookups (`lookupOffBarcode`). Unknown codes return HTTP 200 with `status: 0` (404 also handled). OFF itself matches UPC-A to the EAN-13 form, but it can hold the same product as separate entries under other spellings (e.g. UPC-E `04963406`), so `lookupOffBarcodeVariants` tries each spelling.
- Names: `product_name_en` is preferred (Canadian products are bilingual; the main name is often French). Some OFF entries have French text even in the English field; the user fixes those once via "Edit it" on the result page, which saves a user-owned copy for that barcode (pre-filled with the product's values) that wins on every later scan.
- The mapper falls back to "as prepared" values (name suffixed "(prepared)") and to per-serving values scaled to 100 g when a product has no per-100 g nutrition.

## USDA FoodData Central (second barcode source)

- OFF is thin for North America (the user is in Canada), so barcodes OFF doesn't know are looked up in USDA FoodData Central branded foods (US products; many Canadian products share the UPC).
- Called only via our Vercel function `api/fdc-barcode.ts` (`GET /api/fdc-barcode?code=<GTIN>` → `{ food }`), which holds `FDC_API_KEY` (server env, no `VITE_` prefix; unset = `DEMO_KEY`, ~10/hour). One search lists the 12/13/14-digit spellings; only an exact GTIN match is returned. Responses are edge-cached (`s-maxage`). `vite dev`/`preview` serve the same handler via a plugin in vite.config.ts; e2e tests fake it (`FDC_FOODS` in `e2e/fake-supabase.ts`).
- The function file must stay self-contained (no relative imports) so Vercel deploys it as one file.
- Mapped client-side (`src/lib/fdc/mapper.ts`, nutrient ids 1008/2047/2048 energy, 1003 protein, 1004 fat, 1005 carbs, 1079 fiber, 2000 sugars, 1258 sat fat, 1093 sodium mg; values per 100 g or ml) into the OffFood shape and cached with `cache_off_food` like an OFF product (stored `source` is `'off'`, meaning "external database"). A failed FDC check (network, 5xx/429 after one server-side retry) is reported as a lookup error with "Enter it manually", never as "not found".
- The scanner accepts a code only after two frames agree within 1.5 s (`src/domain/scanConfirm.ts`), so a one-frame misread (e.g. part of an EAN-13 read as an EAN-8) can't open the wrong product.
- search-a-licious returns `brands` as an array; the v2 product API returns a comma-separated string. The mapper (`src/lib/off/mapper.ts`) handles both.
- **Rate limits**: search ≈ 10 req/min, product (barcode) lookup ≈ 100 req/min. Therefore:
  - Search the user's own foods (recent, frequent, favorites, custom) **first**, locally/from Supabase, with zero OFF calls.
  - Only hit OFF search on debounced input (≥ 500ms, ≥ 3 chars) or explicit submit; cache results in TanStack Query.
  - Barcode lookup is the preferred fast path.
- When a user picks an OFF product, **upsert it into the `foods` table** (keyed by `off_code`) normalized to per-100g values, so it is never fetched again.
- Treat OFF data as untrusted/incomplete: missing nutrients → `null`, not 0; let users correct values (creates a user-owned copy).
- Put all OFF code in one module (`src/lib/off/`) with a typed mapper from OFF product JSON → `Food`.

## Data model (Postgres / Supabase)

All user tables have `user_id uuid references auth.users` with RLS `user_id = auth.uid()`. Timestamps are `timestamptz`; **logging days are local-date strings `date` (YYYY-MM-DD)** computed on the client so late-night entries land on the right day. Weights stored in **kg**, energy in **kcal**.

### Settings & body

```
profiles        user_id PK, display_name, units ('kg'|'lb'), energy_unit ('kcal'|'kJ'),
                goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g, goal_fiber_g?,
                meal_names text[] default {Breakfast,Lunch,Dinner,Snacks},
                week_start smallint, rest_timer_default_sec int
body_weights    id, user_id, date, weight_kg, unique(user_id, date)
```

### Food

```
foods           id, user_id (null = shared OFF cache), source ('off'|'custom'|'recipe'),
                off_code?, name, brand?,
                kcal_100g, protein_100g, carbs_100g, fat_100g,
                fiber_100g?, sugar_100g?, sat_fat_100g?, sodium_mg_100g?,
                servings jsonb  -- [{label: "1 slice", grams: 30}]
                created_at, updated_at
user_foods      user_id, food_id, is_favorite, use_count, last_used_at   -- powers recents/frequent
food_entries    id, user_id, date, meal (text, one of profile.meal_names),
                food_id, food_snapshot jsonb (name, brand, per-100g nutrients at log time),
                grams numeric, serving_label?, created_at
recipes         id, user_id, name, servings numeric           -- Phase 4
recipe_items    recipe_id, food_id, grams                      -- Phase 4
```

Entry nutrition = `snapshot.per100 * grams / 100`. Daily totals are computed client-side (or via a SQL view if needed).

### Workouts

```
exercises       id, user_id (null = seeded global library), name, category
                (Chest|Back|Shoulders|Legs|Arms|Core|Cardio|Other),
                type ('weight_reps'|'reps'|'time'|'distance'|'weight_time'),
                equipment?, notes?, archived bool
workouts        id, user_id, date, started_at, ended_at?, notes?, routine_id?
workout_sets    id, user_id, workout_id, exercise_id, exercise_order int, set_index int,
                weight_kg?, reps?, duration_sec?, distance_m?, rpe?, is_warmup bool,
                completed_at
routines        id, user_id, name                               -- Phase 4
routine_items   routine_id, exercise_id, position, target_sets, target_reps?
```

### PRs (derived)

Computed from `workout_sets` (non-warmup), never hand-entered:

- Heaviest weight, best estimated 1RM (**Epley**: `w * (1 + reps/30)`, reps ≤ 12), max reps at a given weight (rep-max table), best single-set volume, best session volume.
- Implement as pure functions in `src/domain/prs.ts` (unit-tested). Detect a new PR when a set is completed and show a badge. Rules: warm-ups never count; the very first set of an exercise is not a PR (nothing to beat); ties are not PRs; rep PRs only for sets without weight. A SQL view/RPC can be added later if client computation gets slow.

## Commands

```
npm run dev          # dev server (http://localhost:5173)
npm run lint         # ESLint
npm run typecheck    # tsc -b
npm test             # Vitest unit tests (src/**/*.test.ts)
npm run test:e2e     # Playwright, mobile viewport (builds + previews on :4173)
npm run build        # typecheck + production build (PWA service worker included)
npm run db:types     # regenerate src/lib/supabase/database.types.ts (needs `npx supabase login`)
npm run generate-pwa-assets   # regenerate PWA icons from public/favicon.svg
```

- Env: `.env.local` holds `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (publishable key only; gitignored). `.env.example` is the template.
- Supabase project ref: `ojdzgdhvyquhiouwenjo`. Apply migrations with the SQL editor or `npx supabase link --project-ref ojdzgdhvyquhiouwenjo && npx supabase db push`.
- Supabase Auth → URL Configuration must list `http://localhost:5173` and the Vercel URLs as redirect URLs for magic links.
- `database.types.ts` is currently hand-written to mirror the migration; keep it in sync (or regenerate) on every schema change.
- Auth hooks live in `src/app/useAuth.ts`; the provider in `src/app/auth.tsx` (split for React fast refresh).

## App structure

```
src/
  app/            routes, layout, bottom tabs (Today · Food · Workout · Progress · Settings)
  features/
    food/         diary, search, food detail, custom food form
    workouts/     active workout, set logger, exercise picker, history
    progress/     charts, PR lists
    settings/
  domain/         pure TS logic: prs.ts, macros.ts, units.ts, dates.ts  (no React, no Supabase)
  lib/
    supabase/     client, generated types, query hooks
    off/          Open Food Facts client + mapper
  components/     shared UI primitives
supabase/
  migrations/     SQL migrations (schema + RLS + seed exercise library)
```

## Phased build plan

### Phase 0 — Foundation (done 2026-10-18; migrations not yet applied to Supabase, not yet deployed)

- Scaffold Vite/React/TS/Tailwind, ESLint/Prettier, Vitest, Playwright.
- Supabase project, migrations for the full schema above + RLS policies, generated types.
- Auth (magic link), protected routes, profile creation on first sign-in.
- Mobile shell: bottom tabs, safe-area insets, dark mode.
- Deploy to Vercel with preview deploys.

### Phase 1 — Smallest useful version (both, thin) (built 2026-10-18; verified with Playwright against a fake backend in `e2e/fake-supabase.ts`, not yet against live Supabase)

**Workouts**

- Seeded exercise library (~80 common exercises) + create custom exercise.
- Start workout → add exercise → log sets (weight/reps steppers, pre-filled from last session's values for that exercise) → finish.
- Exercise history list (past sessions for that exercise).
- PR detection with a badge on the set.

**Food**

- Daily diary grouped by meal, date switcher.
- Search: user's recent/favorite foods first, then Open Food Facts.
- Add entry by grams or serving; edit/delete entries.
- Daily totals vs goals (kcal + protein/carbs/fat) on the Today screen.
- Set calorie/macro goals in settings.

**Today screen**: calories remaining, macro bars, today's workout summary.

### Phase 2 — Depth

Done 2026-10-19 (verified with Playwright against the fake backend):

- **Barcode scanning** (moved up from Phase 4: it is the user's main way to log food). `/food/scan` → `/food/barcode/:code`. Lookup order: user's own foods with that barcode → shared barcode cache → OFF product API → USDA FoodData Central (`/api/fdc-barcode`); a remembered miss is always re-checked on open. Tries UPC-A/EAN-13/UPC-E variants (`src/domain/barcode.ts`). Not found / no nutrition → custom food form pre-filled with the barcode, so the next scan resolves locally. "Add & scan next" returns to the scanner, which ignores the just-scanned code until it leaves the frame (prevents double logs).
- **Custom foods** (enter label per serving or per 100 g; stored per 100 g), **quick-add calories** (snapshot `kind: 'quick'`, stored as 100 g of per-100g = typed values, `food_id` null), **copy a meal or whole day** from any date.
- **Rest timer**: starts on every logged set (length in Settings, 0 = off), persisted end time, bar above the tabs on every screen, vibrate + beep when done (only while the app is open), stops when a workout is finished/discarded.

Remaining Phase 2 items (not started):

- Favorites; workout history calendar; edit past workouts **and edit sets during a workout**; notes per set/exercise; body weight logging; owned-food manager (edit/delete custom foods, "correct nutrition" flow).
- Import from the user's previous workout app's backup file (user request; format TBD — ask for a sample file). Lossless JSON export first.

### Codex review fixes (2026-10-19)

A full Codex review (bugs, security, data integrity, UX, features, code quality) was done; every bug/security/integrity/UX/quality finding was fixed and regression-tested in `e2e/review-fixes.spec.ts` and `supabase/tests/policies.test.ts`. Missing features it listed are the "Remaining" items above. Still open:

- Migration `20261019000000_tighten_reference_policies.sql` is applied to the live project (2026-10-19).
- The shared OFF cache accepts inserts from any signed-in account (by design), so "Allow new users to sign up" is **disabled** in Supabase Auth (2026-10-19). Re-enabling sign-ups needs a moderation story for the cache first.
- A failed write keeps its payload for the toast's **Retry**, but doesn't restore the typed draft into the form.

### Phase 3 — Progress

- Per-exercise charts: est. 1RM, top set weight, session volume over time.
- PR list and rep-max table per exercise.
- Calorie & macro trends (7/30/90 days), body weight trend with moving average.

### Phase 4 — Speed features

- Routines/templates (start workout from routine).
- Recipes / saved meals.
- ~~Offline write queue~~ — done early (see Conventions → writes).

### Phase 5 — Data portability & polish

- Export all data as JSON/CSV; import from FitNotes CSV export and MyFitnessPal export.
- Supersets, plate calculator, warm-up calculator.
- Accessibility and performance pass (Lighthouse ≥ 90 on mobile).

## Conventions

- Keep business logic in `src/domain/` as pure, tested functions; components stay thin.
- All Supabase access goes through typed query hooks in `src/lib/supabase/`; no raw queries in components.
- Every schema change is a new SQL migration in `supabase/migrations/`; never edit applied migrations. Every new table gets an RLS policy in the same migration.
- Store canonical units (kg, kcal, grams, seconds, meters); convert only at the display layer via `src/domain/units.ts`.
- Use local `YYYY-MM-DD` dates for logging days (helpers in `src/domain/dates.ts`); never derive a log day from a UTC timestamp.
- **Writes** (see `src/lib/supabase/writes.ts`):
  - Optimistic, with rollback in the hook; every failure shows a toast with **Retry** (global `MutationCache.onError`).
  - Inserts carry a client-generated UUID; a 23505 duplicate on retry means the earlier attempt committed (`throwUnlessDuplicate`). Never insert without a client id.
  - Writes to the same thing share a mutation `scope` (diary entries; each workout's sets + finish; profile) so they run in order.
  - After settling, refetch with `reconcileWhenIdle` (only when no other write in the group is pending). Cancel affected queries before optimistic updates.
  - Diary writes, set logs/deletes and finishing a workout are registered with `setMutationDefaults` (`registerFoodMutations` / `registerWorkoutMutations`, called in `main.tsx` before restore) so offline writes persist to localStorage and replay after reload. Their variables must carry everything the write needs (incl. `user_id`) — no closures over component state.
  - Every **pending** replayable write is persisted (not only paused ones: `shouldPersistMutation`) and resumed after restore (`resumeRestoredWrites`); the online state starts from `navigator.onLine`. Writes that never reached the server (`isTransportError`) retry until they get through — they must never be dropped for lack of signal.
  - Writes whose rows are built inside `mutationFn` (e.g. copy) derive ids with `stableUuid(nonce, …)`, the nonce made once per tap, so the toast's Retry can't duplicate.
  - `reconcileWhenIdle` keeps the keys of writes that settled while others were pending and refetches them all when the group drains.
  - Finishing a workout only sets `ended_at` and never deletes (lists hide finished workouts with no sets); only an explicit Discard deletes, queued in the workout's scope.
- Query cache is persisted (`PersistQueryClientProvider`); bump `CACHE_BUSTER` in `src/lib/queryClient.ts` when cached data shapes change. Every query key holding private rows includes the user id; the cache is cleared whenever the signed-in user changes.
- Never treat "not loaded" as "empty": show `LoadError` with retry for failed loads; never delete based on what the client believes is on the server (optimistic updates also count as "fetched").
- Validate URL params (`dateFromParam`); use `useToday()` (rolls over at midnight / on resume) instead of `today()` in components.
- Parse user-typed numbers with `parseNonNegative` (blank → null, invalid → NaN); never coerce invalid input to 0.
- Barcodes: store `canonicalBarcode()` (GTIN-13), look up with `barcodeVariants()`.
- Screens are lazy routes in `src/app/router.tsx` and preloaded after start-up (`preloadScreens`) so they open offline.
- Test at a mobile viewport for every user-facing flow: Playwright runs **mobile Chrome (Pixel 7) and mobile Safari/WebKit (iPhone 13)**. Database rules are tested in `supabase/tests/policies.test.ts` (all migrations run in PGlite) — add a case for every new policy.
- E2E builds use a fake Supabase URL (`e2e/env.ts`, set in `playwright.config.ts`) and block service workers, so tests can never reach the real project; `reuseExistingServer` is off for that reason.
- Secrets: only the Supabase anon key goes in the client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local`, never committed).
- E2E tests run against an in-memory fake Supabase (`e2e/fake-supabase.ts`); extend it when the app uses new tables, filters or auth endpoints. The Chrome fake camera plays a generated video of a real EAN-13 barcode (`e2e/barcode-video.ts`, written by `e2e/global-setup.ts`), so scanning is tested with the real decoder.
