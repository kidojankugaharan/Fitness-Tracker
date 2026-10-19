import { mapOffProduct, OFF_FIELDS, type OffFood, type OffProduct } from './mapper'

// Open Food Facts search (search-a-licious) sends no CORS headers, so the browser calls it through a
// same-origin proxy: Vite's dev/preview proxy locally, a Vercel rewrite in production (see vercel.json).
// Search is rate-limited (~10 req/min), so callers must debounce and prefer the user's own foods first.
const SEARCH_BASE = '/off-search'

// The product API allows CORS (`*`) and ~100 req/min, so barcode lookups go direct.
const PRODUCT_BASE = 'https://world.openfoodfacts.org/api/v2/product'

export const OFF_MIN_QUERY_LENGTH = 3

export async function searchOff(query: string, signal?: AbortSignal): Promise<OffFood[]> {
  const params = new URLSearchParams({ q: query, page_size: '25', fields: OFF_FIELDS })
  const res = await fetch(`${SEARCH_BASE}/search?${params}`, { signal })
  if (res.status === 429) throw new Error('Open Food Facts is rate-limiting searches. Try again in a minute.')
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`)
  const body = (await res.json()) as { hits?: OffProduct[] }
  return (body.hits ?? []).map(mapOffProduct).filter((f): f is OffFood => f !== null)
}

export type OffLookup =
  | { status: 'found'; food: OffFood }
  /** OFF knows the product but lacks usable nutrition data; name/brand can pre-fill a custom food. */
  | { status: 'incomplete'; name: string | null; brand: string | null }
  | { status: 'not_found' }

export async function lookupOffBarcode(code: string, signal?: AbortSignal): Promise<OffLookup> {
  const params = new URLSearchParams({ fields: OFF_FIELDS })
  const res = await fetch(`${PRODUCT_BASE}/${encodeURIComponent(code)}?${params}`, { signal })
  if (res.status === 404) return { status: 'not_found' }
  if (res.status === 429) throw new Error('Open Food Facts is busy. Try again in a moment.')
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`)
  const body = (await res.json()) as { status?: number; product?: OffProduct }
  if (body.status !== 1 || !body.product) return { status: 'not_found' }

  // Key the food by the scanned code so the next scan of it hits our cache.
  const food = mapOffProduct({ ...body.product, code })
  if (food) return { status: 'found', food }
  const name = (body.product.product_name || body.product.product_name_en || '').trim() || null
  const brands = body.product.brands
  const brand = (Array.isArray(brands) ? brands[0] : brands?.split(',')[0])?.trim() || null
  return { status: 'incomplete', name, brand }
}
