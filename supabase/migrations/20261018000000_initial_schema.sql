-- Initial schema: profiles, body weight, food, workouts, routines, recipes.
-- Canonical units: kg, kcal, grams, seconds, meters. Logging days are local `date`s set by the client.
-- Every table has RLS; users only ever see their own rows (plus shared, read-only library rows).

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Profiles & settings
-- ─────────────────────────────────────────────────────────────

create table public.profiles (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  display_name           text,
  units                  text not null default 'kg' check (units in ('kg', 'lb')),
  energy_unit            text not null default 'kcal' check (energy_unit in ('kcal', 'kJ')),
  goal_kcal              integer not null default 2200 check (goal_kcal between 0 and 20000),
  goal_protein_g         integer not null default 150 check (goal_protein_g >= 0),
  goal_carbs_g           integer not null default 220 check (goal_carbs_g >= 0),
  goal_fat_g             integer not null default 70 check (goal_fat_g >= 0),
  goal_fiber_g           integer check (goal_fiber_g >= 0),
  meal_names             text[] not null default '{Breakfast,Lunch,Dinner,Snacks}'
                           check (cardinality(meal_names) between 1 and 10),
  week_start             smallint not null default 1 check (week_start between 0 and 6), -- 0 = Sunday
  rest_timer_default_sec integer not null default 90 check (rest_timer_default_sec between 0 and 3600),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.body_weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  weight_kg  numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 700),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ─────────────────────────────────────────────────────────────
-- Food
-- ─────────────────────────────────────────────────────────────

-- user_id null  = shared Open Food Facts cache (readable by everyone, immutable once written).
-- user_id set   = the user's own custom food / recipe / corrected copy.
create table public.foods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade,
  source         text not null check (source in ('off', 'custom', 'recipe')),
  off_code       text,
  name           text not null check (length(name) between 1 and 200),
  brand          text,
  kcal_100g      numeric(7, 2) not null check (kcal_100g >= 0),
  protein_100g   numeric(6, 2) check (protein_100g >= 0),
  carbs_100g     numeric(6, 2) check (carbs_100g >= 0),
  fat_100g       numeric(6, 2) check (fat_100g >= 0),
  fiber_100g     numeric(6, 2) check (fiber_100g >= 0),
  sugar_100g     numeric(6, 2) check (sugar_100g >= 0),
  sat_fat_100g   numeric(6, 2) check (sat_fat_100g >= 0),
  sodium_mg_100g numeric(8, 2) check (sodium_mg_100g >= 0),
  servings       jsonb not null default '[]'::jsonb check (jsonb_typeof(servings) = 'array'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (user_id is not null or source = 'off'),
  check (source <> 'off' or off_code is not null or user_id is not null)
);

create unique index foods_shared_off_code_key on public.foods (off_code) where user_id is null;
create index foods_user_id_idx on public.foods (user_id) where user_id is not null;
create index foods_name_search_idx on public.foods using gin (to_tsvector('simple', name || ' ' || coalesce(brand, '')));

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

-- Per-user usage stats: powers recents, frequents and favorites.
create table public.user_foods (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id      uuid not null references public.foods (id) on delete cascade,
  is_favorite  boolean not null default false,
  use_count    integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  primary key (user_id, food_id)
);

create index user_foods_recent_idx on public.user_foods (user_id, last_used_at desc);

create table public.food_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  meal          text not null check (length(meal) between 1 and 50),
  food_id       uuid references public.foods (id) on delete set null,
  -- Nutrition at log time, so editing/deleting a food never rewrites history.
  food_snapshot jsonb not null,
  grams         numeric(7, 2) not null check (grams > 0),
  serving_label text,
  created_at    timestamptz not null default now()
);

create index food_entries_user_date_idx on public.food_entries (user_id, date);

create table public.recipes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(name) between 1 and 200),
  servings   numeric(6, 2) not null default 1 check (servings > 0),
  created_at timestamptz not null default now()
);

create table public.recipe_items (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id   uuid not null references public.foods (id) on delete restrict,
  position  integer not null default 0,
  grams     numeric(7, 2) not null check (grams > 0),
  primary key (recipe_id, food_id)
);

-- ─────────────────────────────────────────────────────────────
-- Workouts
-- ─────────────────────────────────────────────────────────────

-- user_id null = seeded global exercise library (read-only for users).
create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  name       text not null check (length(name) between 1 and 100),
  category   text not null check (category in ('Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Cardio', 'Other')),
  type       text not null default 'weight_reps'
               check (type in ('weight_reps', 'reps', 'time', 'distance', 'weight_time')),
  equipment  text,
  notes      text,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index exercises_global_name_key on public.exercises (lower(name)) where user_id is null;
create unique index exercises_user_name_key on public.exercises (user_id, lower(name)) where user_id is not null;

create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.routine_items (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position    integer not null default 0,
  target_sets integer not null default 3 check (target_sets between 1 and 50),
  target_reps integer check (target_reps between 1 and 1000)
);

create index routine_items_routine_idx on public.routine_items (routine_id, position);

create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  notes      text,
  routine_id uuid references public.routines (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index workouts_user_date_idx on public.workouts (user_id, date desc);

create table public.workout_sets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id     uuid not null references public.workouts (id) on delete cascade,
  exercise_id    uuid not null references public.exercises (id) on delete restrict,
  exercise_order integer not null default 0,
  set_index      integer not null default 0,
  weight_kg      numeric(6, 2) check (weight_kg >= 0),
  reps           integer check (reps between 0 and 10000),
  duration_sec   integer check (duration_sec >= 0),
  distance_m     numeric(9, 2) check (distance_m >= 0),
  rpe            numeric(3, 1) check (rpe between 1 and 10),
  is_warmup      boolean not null default false,
  notes          text,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index workout_sets_workout_idx on public.workout_sets (workout_id, exercise_order, set_index);
-- Exercise history & PR queries: all sets for one exercise for one user.
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id, completed_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.body_weights  enable row level security;
alter table public.foods         enable row level security;
alter table public.user_foods    enable row level security;
alter table public.food_entries  enable row level security;
alter table public.recipes       enable row level security;
alter table public.recipe_items  enable row level security;
alter table public.exercises     enable row level security;
alter table public.routines      enable row level security;
alter table public.routine_items enable row level security;
alter table public.workouts      enable row level security;
alter table public.workout_sets  enable row level security;

-- Profiles: read/update own (rows are created by the signup trigger).
create policy "profiles: select own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Simple owner-only tables.
create policy "body_weights: all own" on public.body_weights
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_foods: all own" on public.user_foods
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recipes: all own" on public.recipes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "routines: all own" on public.routines
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workouts: all own" on public.workouts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Foods: read shared OFF cache + own; anyone signed in may add to the shared OFF cache
-- (no update/delete on shared rows); full control over own foods.
create policy "foods: select shared or own" on public.foods
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "foods: insert shared off cache" on public.foods
  for insert to authenticated with check (user_id is null and source = 'off' and off_code is not null);
create policy "foods: insert own" on public.foods
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "foods: update own" on public.foods
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "foods: delete own" on public.foods
  for delete to authenticated using (user_id = (select auth.uid()));

-- Food entries: own rows, and the referenced food must be visible to the user.
create policy "food_entries: select own" on public.food_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "food_entries: insert own" on public.food_entries
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (food_id is null or exists (
      select 1 from public.foods f
      where f.id = food_id and (f.user_id is null or f.user_id = (select auth.uid()))))
  );
create policy "food_entries: update own" on public.food_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (food_id is null or exists (
      select 1 from public.foods f
      where f.id = food_id and (f.user_id is null or f.user_id = (select auth.uid()))))
  );
create policy "food_entries: delete own" on public.food_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Recipe items: access via the parent recipe.
create policy "recipe_items: all via own recipe" on public.recipe_items
  for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));

-- Exercises: read global library + own; write own only.
create policy "exercises: select global or own" on public.exercises
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "exercises: insert own" on public.exercises
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "exercises: update own" on public.exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exercises: delete own" on public.exercises
  for delete to authenticated using (user_id = (select auth.uid()));

-- Routine items: access via the parent routine.
create policy "routine_items: all via own routine" on public.routine_items
  for all to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())));

-- Workout sets: own rows, and the parent workout must also be the user's.
create policy "workout_sets: select own" on public.workout_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_sets: insert own" on public.workout_sets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );
create policy "workout_sets: update own" on public.workout_sets
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );
create policy "workout_sets: delete own" on public.workout_sets
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Data API grants (explicit, so access never depends on project defaults)
-- ─────────────────────────────────────────────────────────────

revoke all on all tables in schema public from anon;
grant select, update                 on public.profiles      to authenticated;
grant select, insert, update, delete on public.body_weights  to authenticated;
grant select, insert, update, delete on public.foods         to authenticated;
grant select, insert, update, delete on public.user_foods    to authenticated;
grant select, insert, update, delete on public.food_entries  to authenticated;
grant select, insert, update, delete on public.recipes       to authenticated;
grant select, insert, update, delete on public.recipe_items  to authenticated;
grant select, insert, update, delete on public.exercises     to authenticated;
grant select, insert, update, delete on public.routines      to authenticated;
grant select, insert, update, delete on public.routine_items to authenticated;
grant select, insert, update, delete on public.workouts      to authenticated;
grant select, insert, update, delete on public.workout_sets  to authenticated;
