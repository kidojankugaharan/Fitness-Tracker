import type { Page, Route } from '@playwright/test'
import { loadEnv } from 'vite'

// A tiny in-memory stand-in for Supabase's REST API (PostgREST), just enough for the app's queries,
// so UI flows can be tested end to end without a real project or test accounts.

export const USER_ID = '11111111-1111-4111-8111-111111111111'

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

const env = loadEnv('production', process.cwd(), '')
const projectRef = new URL(env.VITE_SUPABASE_URL ?? 'https://example.supabase.co').hostname.split('.')[0]

function b64url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** Seed a signed-in session in localStorage before the app boots. */
export async function signIn(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, exp, role: 'authenticated' })}.sig`
  const session = {
    access_token: token,
    refresh_token: 'fake-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: { id: USER_ID, email: 'test@example.com', aud: 'authenticated', role: 'authenticated' },
  }
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    `sb-${projectRef}-auth-token`,
    JSON.stringify(session),
  ] as const)
}

export function seedTables(): Tables {
  const now = new Date().toISOString()
  return {
    profiles: [
      {
        user_id: USER_ID,
        display_name: null,
        units: 'kg',
        energy_unit: 'kcal',
        goal_kcal: 2000,
        goal_protein_g: 150,
        goal_carbs_g: 200,
        goal_fat_g: 70,
        goal_fiber_g: null,
        meal_names: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
        week_start: 1,
        rest_timer_default_sec: 90,
        created_at: now,
        updated_at: now,
      },
    ],
    exercises: [
      exercise('e-bench', 'Barbell Bench Press', 'Chest'),
      exercise('e-squat', 'Barbell Squat', 'Legs'),
      exercise('e-pullup', 'Pull-Up', 'Back', 'reps'),
    ],
    workouts: [],
    workout_sets: [],
    foods: [],
    user_foods: [],
    food_entries: [],
  }
}

function exercise(id: string, name: string, category: string, type = 'weight_reps'): Row {
  return {
    id,
    user_id: null,
    name,
    category,
    type,
    equipment: null,
    notes: null,
    archived: false,
    created_at: '',
  }
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(key)) continue
    if (key === 'or') {
      const terms = [...raw.slice(1, -1).matchAll(/(\w+)\.ilike\.%?([^,%]*)%?/g)]
      if (
        !terms.some(([, col, q]) =>
          String(row[col!] ?? '')
            .toLowerCase()
            .includes(q!.toLowerCase()),
        )
      )
        return false
      continue
    }
    const value = row[key]
    if (raw.startsWith('eq.')) {
      if (String(value) !== raw.slice(3)) return false
    } else if (raw === 'is.null') {
      if (value != null) return false
    } else if (raw === 'not.is.null') {
      if (value == null) return false
    }
  }
  return true
}

function sortRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows
  const specs = order.split(',').map((s) => {
    const [col, dir] = s.split('.')
    return { col: col!, desc: dir === 'desc' }
  })
  return [...rows].sort((a, b) => {
    for (const { col, desc } of specs) {
      const x = a[col] ?? ''
      const y = b[col] ?? ''
      if (x < y) return desc ? 1 : -1
      if (x > y) return desc ? -1 : 1
    }
    return 0
  })
}

/** Resolve the embedded selects the app uses. */
function embed(table: string, rows: Row[], select: string, db: Tables): Row[] {
  return rows.map((row) => {
    const out = { ...row }
    if (table === 'workouts' && select.includes('workout_sets(')) {
      out.workout_sets = db.workout_sets!.filter((s) => s.workout_id === row.id)
    }
    if (table === 'workout_sets' && select.includes('workout:workouts(')) {
      const w = db.workouts!.find((w) => w.id === row.workout_id)
      out.workout = w ? { date: w.date } : null
    }
    if (table === 'user_foods' && select.includes('food:foods(')) {
      out.food = db.foods!.find((f) => f.id === row.food_id) ?? null
    }
    return out
  })
}

function respond(route: Route, rows: Row[] | Row | null, wantsObject: boolean, status = 200) {
  const body = wantsObject ? (Array.isArray(rows) ? (rows[0] ?? null) : rows) : rows
  if (wantsObject && body == null) {
    return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'No rows found' } })
  }
  return route.fulfill({ status, json: body })
}

const OFF_HITS = [
  {
    code: '5000108000000',
    product_name: 'Rolled Oats',
    brands: ['Quaker'],
    serving_size: '40 g',
    serving_quantity: 40,
    nutriments: { 'energy-kcal_100g': 375, proteins_100g: 11, carbohydrates_100g: 60, fat_100g: 8 },
  },
]

export async function installFakeBackend(page: Page, db: Tables = seedTables()) {
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 200, json: {} }))

  await page.route('**/off-search/**', (route) => route.fulfill({ json: { hits: OFF_HITS } }))

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.split('/rest/v1/')[1]!
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const method = req.method()

    if (path.startsWith('rpc/')) {
      const args = req.postDataJSON() as Record<string, unknown>
      if (path === 'rpc/cache_off_food') {
        let food = db.foods!.find((f) => f.off_code === args.p_off_code)
        if (!food) {
          food = {
            id: crypto.randomUUID(),
            user_id: null,
            source: 'off',
            off_code: args.p_off_code,
            name: args.p_name,
            brand: args.p_brand,
            kcal_100g: args.p_kcal_100g,
            protein_100g: args.p_protein_100g,
            carbs_100g: args.p_carbs_100g,
            fat_100g: args.p_fat_100g,
            fiber_100g: null,
            sugar_100g: null,
            sat_fat_100g: null,
            sodium_mg_100g: null,
            servings: args.p_servings,
          }
          db.foods!.push(food)
        }
        return route.fulfill({ json: food.id })
      }
      if (path === 'rpc/record_food_use') {
        const existing = db.user_foods!.find((u) => u.food_id === args.p_food_id)
        const now = new Date().toISOString()
        if (existing)
          Object.assign(existing, { use_count: Number(existing.use_count) + 1, last_used_at: now })
        else
          db.user_foods!.push({
            user_id: USER_ID,
            food_id: args.p_food_id,
            use_count: 1,
            last_used_at: now,
            is_favorite: false,
          })
        return route.fulfill({ status: 204, body: '' })
      }
    }

    const table = db[path]
    if (!table) return route.fulfill({ status: 404, json: { message: `unknown table ${path}` } })
    const params = url.searchParams

    if (method === 'GET') {
      let rows = sortRows(
        table.filter((r) => matches(r, params)),
        params.get('order'),
      )
      const limit = params.get('limit')
      if (limit) rows = rows.slice(0, Number(limit))
      return respond(route, embed(path, rows, params.get('select') ?? '*', db), wantsObject)
    }
    if (method === 'POST') {
      const body = req.postDataJSON() as Row | Row[]
      const now = new Date().toISOString()
      const inserted = (Array.isArray(body) ? body : [body]).map((r) => ({
        id: crypto.randomUUID(),
        created_at: now,
        user_id: USER_ID,
        ...(path === 'workouts' ? { started_at: now, ended_at: null, notes: null, routine_id: null } : {}),
        ...(path === 'exercises' ? { equipment: null, notes: null, archived: false } : {}),
        ...r,
      }))
      table.push(...inserted)
      return respond(route, inserted, wantsObject, 201)
    }
    if (method === 'PATCH') {
      const patch = req.postDataJSON() as Row
      const rows = table.filter((r) => matches(r, params))
      for (const r of rows)
        Object.assign(r, patch, path === 'profiles' ? { updated_at: new Date().toISOString() } : {})
      return respond(route, rows, wantsObject)
    }
    if (method === 'DELETE') {
      const keep = table.filter((r) => !matches(r, params))
      // Mirror ON DELETE CASCADE for workouts → sets.
      if (path === 'workouts') {
        const removed = new Set(table.filter((r) => matches(r, params)).map((r) => r.id))
        db.workout_sets = db.workout_sets!.filter((s) => !removed.has(s.workout_id))
      }
      db[path] = keep
      table.length = 0
      table.push(...keep)
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ status: 405, json: {} })
  })

  return db
}
