import { mapOffProduct, OFF_FIELDS, type OffFood, type OffProduct } from './mapper'

// Open Food Facts search (search-a-licious) sends no CORS headers, so the browser calls it through a
// same-origin proxy: Vite's dev/preview proxy locally, a Vercel rewrite in production (see vercel.json).
// Search is rate-limited (~10 req/min), so callers must debounce and prefer the user's own foods first.
const SEARCH_BASE = '/off-search'

export const OFF_MIN_QUERY_LENGTH = 3

export async function searchOff(query: string, signal?: AbortSignal): Promise<OffFood[]> {
  const params = new URLSearchParams({ q: query, page_size: '25', fields: OFF_FIELDS })
  const res = await fetch(`${SEARCH_BASE}/search?${params}`, { signal })
  if (res.status === 429) throw new Error('Open Food Facts is rate-limiting searches. Try again in a minute.')
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`)
  const body = (await res.json()) as { hits?: OffProduct[] }
  return (body.hits ?? []).map(mapOffProduct).filter((f): f is OffFood => f !== null)
}
