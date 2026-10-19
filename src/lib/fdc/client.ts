import type { OffFood } from '@/lib/off/mapper'
import { mapFdcFood, type FdcFood } from './mapper'

// USDA FoodData Central is reached through our own /api/fdc-barcode function (it holds the API key).
// It's a second source for barcodes Open Food Facts doesn't know, so a failure here is never fatal:
// the caller just falls back to "not found" and the user can enter the label.

export async function lookupFdcBarcode(canonical: string, signal?: AbortSignal): Promise<OffFood | null> {
  try {
    const res = await fetch(`/api/fdc-barcode?code=${encodeURIComponent(canonical)}`, { signal })
    if (!res.ok) return null
    const body = (await res.json()) as { food?: FdcFood | null }
    return body.food ? mapFdcFood(body.food, canonical) : null
  } catch (error) {
    if (signal?.aborted) throw error
    return null
  }
}
