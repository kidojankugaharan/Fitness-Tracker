-- Phase 1: global exercise library + helper functions for food logging.

-- ─────────────────────────────────────────────────────────────
-- Seed the global exercise library (user_id null = shared, read-only).
-- ─────────────────────────────────────────────────────────────

insert into public.exercises (user_id, name, category, type, equipment) values
  -- Chest
  (null, 'Barbell Bench Press',          'Chest', 'weight_reps', 'Barbell'),
  (null, 'Incline Barbell Bench Press',  'Chest', 'weight_reps', 'Barbell'),
  (null, 'Decline Barbell Bench Press',  'Chest', 'weight_reps', 'Barbell'),
  (null, 'Dumbbell Bench Press',         'Chest', 'weight_reps', 'Dumbbell'),
  (null, 'Incline Dumbbell Bench Press', 'Chest', 'weight_reps', 'Dumbbell'),
  (null, 'Dumbbell Fly',                 'Chest', 'weight_reps', 'Dumbbell'),
  (null, 'Cable Crossover',              'Chest', 'weight_reps', 'Cable'),
  (null, 'Machine Chest Press',          'Chest', 'weight_reps', 'Machine'),
  (null, 'Pec Deck',                     'Chest', 'weight_reps', 'Machine'),
  (null, 'Push-Up',                      'Chest', 'reps',        'Bodyweight'),
  (null, 'Chest Dip',                    'Chest', 'reps',        'Bodyweight'),
  -- Back
  (null, 'Deadlift',                     'Back', 'weight_reps', 'Barbell'),
  (null, 'Barbell Row',                  'Back', 'weight_reps', 'Barbell'),
  (null, 'Pendlay Row',                  'Back', 'weight_reps', 'Barbell'),
  (null, 'Dumbbell Row',                 'Back', 'weight_reps', 'Dumbbell'),
  (null, 'T-Bar Row',                    'Back', 'weight_reps', 'Barbell'),
  (null, 'Seated Cable Row',             'Back', 'weight_reps', 'Cable'),
  (null, 'Lat Pulldown',                 'Back', 'weight_reps', 'Cable'),
  (null, 'Pull-Up',                      'Back', 'reps',        'Bodyweight'),
  (null, 'Chin-Up',                      'Back', 'reps',        'Bodyweight'),
  (null, 'Weighted Pull-Up',             'Back', 'weight_reps', 'Bodyweight'),
  (null, 'Rack Pull',                    'Back', 'weight_reps', 'Barbell'),
  (null, 'Machine Row',                  'Back', 'weight_reps', 'Machine'),
  (null, 'Straight-Arm Pulldown',        'Back', 'weight_reps', 'Cable'),
  (null, 'Back Extension',               'Back', 'reps',        'Bodyweight'),
  -- Shoulders
  (null, 'Overhead Press',               'Shoulders', 'weight_reps', 'Barbell'),
  (null, 'Seated Dumbbell Shoulder Press','Shoulders', 'weight_reps', 'Dumbbell'),
  (null, 'Arnold Press',                 'Shoulders', 'weight_reps', 'Dumbbell'),
  (null, 'Machine Shoulder Press',       'Shoulders', 'weight_reps', 'Machine'),
  (null, 'Dumbbell Lateral Raise',       'Shoulders', 'weight_reps', 'Dumbbell'),
  (null, 'Cable Lateral Raise',          'Shoulders', 'weight_reps', 'Cable'),
  (null, 'Dumbbell Front Raise',         'Shoulders', 'weight_reps', 'Dumbbell'),
  (null, 'Reverse Dumbbell Fly',         'Shoulders', 'weight_reps', 'Dumbbell'),
  (null, 'Face Pull',                    'Shoulders', 'weight_reps', 'Cable'),
  (null, 'Barbell Shrug',                'Shoulders', 'weight_reps', 'Barbell'),
  (null, 'Dumbbell Shrug',               'Shoulders', 'weight_reps', 'Dumbbell'),
  (null, 'Upright Row',                  'Shoulders', 'weight_reps', 'Barbell'),
  -- Legs
  (null, 'Barbell Squat',                'Legs', 'weight_reps', 'Barbell'),
  (null, 'Front Squat',                  'Legs', 'weight_reps', 'Barbell'),
  (null, 'Romanian Deadlift',            'Legs', 'weight_reps', 'Barbell'),
  (null, 'Sumo Deadlift',                'Legs', 'weight_reps', 'Barbell'),
  (null, 'Leg Press',                    'Legs', 'weight_reps', 'Machine'),
  (null, 'Hack Squat',                   'Legs', 'weight_reps', 'Machine'),
  (null, 'Bulgarian Split Squat',        'Legs', 'weight_reps', 'Dumbbell'),
  (null, 'Walking Lunge',                'Legs', 'weight_reps', 'Dumbbell'),
  (null, 'Goblet Squat',                 'Legs', 'weight_reps', 'Dumbbell'),
  (null, 'Leg Extension',                'Legs', 'weight_reps', 'Machine'),
  (null, 'Lying Leg Curl',               'Legs', 'weight_reps', 'Machine'),
  (null, 'Seated Leg Curl',              'Legs', 'weight_reps', 'Machine'),
  (null, 'Hip Thrust',                   'Legs', 'weight_reps', 'Barbell'),
  (null, 'Standing Calf Raise',          'Legs', 'weight_reps', 'Machine'),
  (null, 'Seated Calf Raise',            'Legs', 'weight_reps', 'Machine'),
  (null, 'Hip Abduction',                'Legs', 'weight_reps', 'Machine'),
  (null, 'Hip Adduction',                'Legs', 'weight_reps', 'Machine'),
  -- Arms
  (null, 'Barbell Curl',                 'Arms', 'weight_reps', 'Barbell'),
  (null, 'EZ-Bar Curl',                  'Arms', 'weight_reps', 'Barbell'),
  (null, 'Dumbbell Curl',                'Arms', 'weight_reps', 'Dumbbell'),
  (null, 'Hammer Curl',                  'Arms', 'weight_reps', 'Dumbbell'),
  (null, 'Incline Dumbbell Curl',        'Arms', 'weight_reps', 'Dumbbell'),
  (null, 'Preacher Curl',                'Arms', 'weight_reps', 'Barbell'),
  (null, 'Cable Curl',                   'Arms', 'weight_reps', 'Cable'),
  (null, 'Close-Grip Bench Press',       'Arms', 'weight_reps', 'Barbell'),
  (null, 'Skull Crusher',                'Arms', 'weight_reps', 'Barbell'),
  (null, 'Triceps Pushdown',             'Arms', 'weight_reps', 'Cable'),
  (null, 'Overhead Triceps Extension',   'Arms', 'weight_reps', 'Cable'),
  (null, 'Triceps Dip',                  'Arms', 'reps',        'Bodyweight'),
  (null, 'Wrist Curl',                   'Arms', 'weight_reps', 'Dumbbell'),
  -- Core
  (null, 'Plank',                        'Core', 'time',        'Bodyweight'),
  (null, 'Crunch',                       'Core', 'reps',        'Bodyweight'),
  (null, 'Hanging Leg Raise',            'Core', 'reps',        'Bodyweight'),
  (null, 'Cable Crunch',                 'Core', 'weight_reps', 'Cable'),
  (null, 'Ab Wheel Rollout',             'Core', 'reps',        'Other'),
  (null, 'Russian Twist',                'Core', 'reps',        'Bodyweight'),
  (null, 'Side Plank',                   'Core', 'time',        'Bodyweight'),
  (null, 'Farmer''s Walk',               'Core', 'weight_time', 'Dumbbell'),
  -- Cardio
  (null, 'Running',                      'Cardio', 'distance', null),
  (null, 'Treadmill',                    'Cardio', 'distance', 'Machine'),
  (null, 'Cycling',                      'Cardio', 'distance', null),
  (null, 'Stationary Bike',              'Cardio', 'distance', 'Machine'),
  (null, 'Rowing Machine',               'Cardio', 'distance', 'Machine'),
  (null, 'Elliptical',                   'Cardio', 'time',     'Machine'),
  (null, 'Stair Climber',                'Cardio', 'time',     'Machine'),
  (null, 'Walking',                      'Cardio', 'distance', null),
  (null, 'Jump Rope',                    'Cardio', 'time',     'Other'),
  (null, 'Swimming',                     'Cardio', 'distance', null)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- cache_off_food: insert an Open Food Facts product into the shared cache
-- (or find the existing row) and return its id. Runs with the caller's rights,
-- so the "foods: insert shared off cache" RLS policy still applies.
-- ─────────────────────────────────────────────────────────────

create or replace function public.cache_off_food(
  p_off_code       text,
  p_name           text,
  p_brand          text,
  p_kcal_100g      numeric,
  p_protein_100g   numeric,
  p_carbs_100g     numeric,
  p_fat_100g       numeric,
  p_fiber_100g     numeric,
  p_sugar_100g     numeric,
  p_sat_fat_100g   numeric,
  p_sodium_mg_100g numeric,
  p_servings       jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.foods (
    user_id, source, off_code, name, brand, kcal_100g, protein_100g, carbs_100g, fat_100g,
    fiber_100g, sugar_100g, sat_fat_100g, sodium_mg_100g, servings
  ) values (
    null, 'off', p_off_code, p_name, p_brand, p_kcal_100g, p_protein_100g, p_carbs_100g, p_fat_100g,
    p_fiber_100g, p_sugar_100g, p_sat_fat_100g, p_sodium_mg_100g, coalesce(p_servings, '[]'::jsonb)
  )
  on conflict (off_code) where user_id is null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.foods where off_code = p_off_code and user_id is null;
  end if;
  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- record_food_use: bump use_count / last_used_at for the caller (powers recents).
-- ─────────────────────────────────────────────────────────────

create or replace function public.record_food_use(p_food_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.user_foods (user_id, food_id, use_count, last_used_at)
  values ((select auth.uid()), p_food_id, 1, now())
  on conflict (user_id, food_id)
  do update set use_count = public.user_foods.use_count + 1, last_used_at = now();
$$;

revoke execute on function public.cache_off_food(text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) from public, anon;
revoke execute on function public.record_food_use(uuid) from public, anon;
grant execute on function public.cache_off_food(text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) to authenticated;
grant execute on function public.record_food_use(uuid) to authenticated;

-- Internal trigger functions should never be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
