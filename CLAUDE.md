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
- **Barcode** (later): native `BarcodeDetector`, fallback `@zxing/browser`
- **Testing**: Vitest (domain logic: PRs, 1RM, macro math, unit conversion), Playwright (E2E at mobile viewport)
- **Tooling**: ESLint + Prettier, pnpm or npm (pick one at scaffold time and stick to it)

## Open Food Facts integration

- Call OFF directly from the browser (CORS is allowed). Identify the app via the `app_name`/`app_version` query params and contact info as OFF requests.
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
- Implement as pure functions in `src/domain/prs.ts` (unit-tested). Detect a new PR when a set is completed and show a badge. A SQL view/RPC can be added later if client computation gets slow.

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

### Phase 0 — Foundation (scaffolded 2026-10-18; migration not yet applied to Supabase, not yet deployed)

- Scaffold Vite/React/TS/Tailwind, ESLint/Prettier, Vitest, Playwright.
- Supabase project, migrations for the full schema above + RLS policies, generated types.
- Auth (magic link), protected routes, profile creation on first sign-in.
- Mobile shell: bottom tabs, safe-area insets, dark mode.
- Deploy to Vercel with preview deploys.

### Phase 1 — Smallest useful version (both, thin)

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

- Custom foods, favorites, copy meal/day from a previous date, quick-add calories.
- Rest timer (auto-start on set complete, vibration/notification).
- Workout history calendar; edit past workouts; notes per set/exercise.
- Body weight logging.

### Phase 3 — Progress

- Per-exercise charts: est. 1RM, top set weight, session volume over time.
- PR list and rep-max table per exercise.
- Calorie & macro trends (7/30/90 days), body weight trend with moving average.

### Phase 4 — Speed features

- Barcode scanning (camera) → OFF product lookup.
- Routines/templates (start workout from routine).
- Recipes / saved meals.
- Offline write queue (TanStack Query persisted mutations) for logging without signal in the gym.

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
- Mutations are optimistic; show errors as non-blocking toasts with retry.
- Test at a mobile viewport (Playwright `iPhone 13` device) for every user-facing flow.
- Secrets: only the Supabase anon key goes in the client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local`, never committed).
