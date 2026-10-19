import type { OffFood } from '@/lib/off/mapper'
import { mapFdcFood, type FdcFood } from './mapper'

// USDA FoodData Central is reached through our own /api/fdc-barcode function (it holds the API key).
// A miss resolves to null; a failed check throws, so the caller never reports "not found" for a
// product it simply couldn't check (e.g. no signal, or USDA rate-limiting).

export async function lookupFdcBarcode(canonical: string, signal?: AbortSignal): Promise<OffFood | null> {
  const res = await fetch(`/api/fdc-barcode?code=${encodeURIComponent(canonical)}`, { signal })
  if (!res.ok) throw new Error(`USDA lookup failed (${res.status})`)
  const body = (await res.json()) as { food?: FdcFood | null }
  return body.food ? mapFdcFood(body.food, canonical) : null
}
