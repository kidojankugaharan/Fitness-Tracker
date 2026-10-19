-- Rows may only reference foods / exercises / routines the caller can see (shared or their own).
-- Before this, a user who knew another user's private food or exercise UUID could reference it from
-- their own rows, and ON DELETE RESTRICT could then stop the owner deleting it.

create or replace function public.can_see_food(p_food_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.foods f
    where f.id = p_food_id and (f.user_id is null or f.user_id = (select auth.uid()))
  );
$$;

create or replace function public.can_see_exercise(p_exercise_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
    where e.id = p_exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))
  );
$$;

revoke execute on function public.can_see_food(uuid) from public, anon;
revoke execute on function public.can_see_exercise(uuid) from public, anon;
grant execute on function public.can_see_food(uuid) to authenticated;
grant execute on function public.can_see_exercise(uuid) to authenticated;

-- Workout sets: own workout AND a visible exercise.
drop policy "workout_sets: insert own" on public.workout_sets;
drop policy "workout_sets: update own" on public.workout_sets;
create policy "workout_sets: insert own" on public.workout_sets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and public.can_see_exercise(exercise_id)
  );
create policy "workout_sets: update own" on public.workout_sets
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and public.can_see_exercise(exercise_id)
  );

-- Workouts: an attached routine must be the caller's.
drop policy "workouts: all own" on public.workouts;
create policy "workouts: all own" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (routine_id is null
      or exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())))
  );

-- Recipe items: own recipe AND a visible food.
drop policy "recipe_items: all via own recipe" on public.recipe_items;
create policy "recipe_items: all via own recipe" on public.recipe_items
  for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
    and public.can_see_food(food_id)
  );

-- Routine items: own routine AND a visible exercise.
drop policy "routine_items: all via own routine" on public.routine_items;
create policy "routine_items: all via own routine" on public.routine_items
  for all to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid()))
    and public.can_see_exercise(exercise_id)
  );

-- Favorites / recents: only for visible foods.
drop policy "user_foods: all own" on public.user_foods;
create policy "user_foods: all own" on public.user_foods
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_see_food(food_id));
