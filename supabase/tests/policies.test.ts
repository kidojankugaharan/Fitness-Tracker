import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

// Runs every migration in an in-memory Postgres (PGlite) with minimal stand-ins for what Supabase
// provides (auth schema, auth.uid(), anon/authenticated roles), then checks the access rules.

const MIGRATIONS = join(__dirname, '..', 'migrations')
const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

let db: PGlite

async function as<T = Record<string, unknown>>(uid: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false)`)
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec('reset role')
  }
}

async function rejected(uid: string, sql: string): Promise<boolean> {
  try {
    await as(uid, sql)
    return false
  } catch {
    return true
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`)
}, 60_000)

describe('migrations', () => {
  it('seed the exercise library and create a profile per signup', async () => {
    expect(
      (await as<{ n: number }>(A, 'select count(*)::int n from public.exercises'))[0]!.n,
    ).toBeGreaterThan(80)
    expect(await as(A, 'select user_id from public.profiles')).toHaveLength(1)
  })
})

describe('row level security', () => {
  it('keeps workouts and sets private', async () => {
    const [w] = await as<{ id: string }>(
      A,
      `insert into public.workouts (date) values ('2026-10-19') returning id`,
    )
    const [ex] = await as<{ id: string }>(A, `select id from public.exercises where user_id is null limit 1`)
    await as(
      A,
      `insert into public.workout_sets (workout_id, exercise_id, reps) values ('${w!.id}', '${ex!.id}', 5)`,
    )
    expect(await as(B, 'select * from public.workouts')).toHaveLength(0)
    expect(await as(B, 'select * from public.workout_sets')).toHaveLength(0)
    expect(
      await rejected(
        B,
        `insert into public.workout_sets (workout_id, exercise_id) values ('${w!.id}', '${ex!.id}')`,
      ),
    ).toBe(true)
    expect(
      await rejected(B, `insert into public.workouts (user_id, date) values ('${A}', '2026-10-19')`),
    ).toBe(true)
  })

  it("blocks referencing another user's private exercise or food", async () => {
    const [privEx] = await as<{ id: string }>(
      A,
      `insert into public.exercises (user_id, name, category) values ('${A}', 'Secret Lift', 'Other') returning id`,
    )
    const [privFood] = await as<{ id: string }>(
      A,
      `insert into public.foods (user_id, source, name, kcal_100g) values ('${A}', 'custom', 'Secret Bar', 400) returning id`,
    )
    const [wB] = await as<{ id: string }>(
      B,
      `insert into public.workouts (date) values ('2026-10-19') returning id`,
    )
    expect(
      await rejected(
        B,
        `insert into public.workout_sets (workout_id, exercise_id) values ('${wB!.id}', '${privEx!.id}')`,
      ),
    ).toBe(true)
    expect(await rejected(B, `insert into public.user_foods (food_id) values ('${privFood!.id}')`)).toBe(true)
    const [recipe] = await as<{ id: string }>(
      B,
      `insert into public.recipes (name) values ('R') returning id`,
    )
    expect(
      await rejected(
        B,
        `insert into public.recipe_items (recipe_id, food_id, grams) values ('${recipe!.id}', '${privFood!.id}', 10)`,
      ),
    ).toBe(true)
    const [routineA] = await as<{ id: string }>(
      A,
      `insert into public.routines (name) values ('A day') returning id`,
    )
    expect(
      await rejected(
        B,
        `insert into public.workouts (date, routine_id) values ('2026-10-19', '${routineA!.id}')`,
      ),
    ).toBe(true)
    // The owner can still use and delete their own exercise.
    const [wA] = await as<{ id: string }>(
      A,
      `insert into public.workouts (date) values ('2026-10-19') returning id`,
    )
    await as(
      A,
      `insert into public.workout_sets (workout_id, exercise_id, reps) values ('${wA!.id}', '${privEx!.id}', 3)`,
    )
  })

  it('protects the shared exercise library and OFF cache from edits', async () => {
    expect(await rejected(B, `insert into public.exercises (name, category) values ('Hack', 'Chest')`)).toBe(
      true,
    )
    await as(
      A,
      `select public.cache_off_food('5000000000001','Oats',null,389,17,66,7,null,null,null,null,'[]')`,
    )
    await as(B, `update public.foods set kcal_100g = 1 where off_code = '5000000000001'`)
    const [food] = await as<{ kcal_100g: string }>(
      B,
      `select kcal_100g from public.foods where off_code = '5000000000001'`,
    )
    expect(Number(food!.kcal_100g)).toBe(389)
  })

  it('makes cache_off_food idempotent and record_food_use count uses', async () => {
    const call = `select public.cache_off_food('5000000000002','Rice',null,360,7,80,1,null,null,null,null,'[]') id`
    const [first] = await as<{ id: string }>(A, call)
    const [second] = await as<{ id: string }>(B, call)
    expect(second!.id).toBe(first!.id)
    await as(A, `select public.record_food_use('${first!.id}')`)
    await as(A, `select public.record_food_use('${first!.id}')`)
    const [uses] = await as<{ use_count: number }>(
      A,
      `select use_count from public.user_foods where food_id = '${first!.id}'`,
    )
    expect(uses!.use_count).toBe(2)
  })

  it('gives signed-out (anon) callers nothing', async () => {
    await db.exec('set role anon')
    try {
      await expect(db.query('select * from public.profiles')).rejects.toThrow()
      await expect(db.query(`select public.record_food_use('${A}')`)).rejects.toThrow()
    } finally {
      await db.exec('reset role')
    }
  })
})
