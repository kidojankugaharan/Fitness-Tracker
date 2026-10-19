// Vercel serverless function: barcode lookup in USDA FoodData Central (US branded foods; many
// Canadian products carry the same UPC). Runs on the server so the API key never reaches the client.
// GET /api/fdc-barcode?code=<GTIN> → { food: FdcFood | null }
//
// Self-contained on purpose (no relative imports), so Vercel can deploy it as a single file. The
// same handler serves /api/fdc-barcode in `vite dev` / `vite preview` (see vite.config.ts).

const FDC_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search'

/** The fields of an FDC branded food the app uses (nutrient values are per 100 g or 100 ml). */
export type FdcFood = {
  fdcId: number
  description: string
  brandName?: string
  brandOwner?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients: { nutrientId: number; unitName?: string; value?: number }[]
}

/** The same GTIN written with 12, 13 and 14 digits (FDC stores whichever the brand submitted). */
export function gtinSpellings(code: string): string[] {
  const core = code.replace(/^0+/, '')
  return [12, 13, 14].filter((len) => len >= core.length).map((len) => core.padStart(len, '0'))
}

const sameGtin = (a: string, b: string) => a.replace(/^0+/, '') === b.replace(/^0+/, '')

export async function lookupFdcBarcode(code: string, apiKey: string): Promise<FdcFood | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    // Search matches whole tokens, so list every spelling; any of them may match.
    query: gtinSpellings(code).join(' '),
    dataType: 'Branded',
    pageSize: '10',
  })
  let res = await fetch(`${FDC_SEARCH}?${params}`)
  // FDC has brief hiccups (5xx, occasional 429): one quick retry before reporting a failure.
  if (res.status >= 500 || res.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    res = await fetch(`${FDC_SEARCH}?${params}`)
  }
  if (!res.ok) throw new Error(`FoodData Central responded ${res.status}`)
  const body = (await res.json()) as { foods?: (FdcFood & Record<string, unknown>)[] }
  const match = (body.foods ?? []).find((f) => f.gtinUpc && sameGtin(f.gtinUpc, code))
  if (!match) return null
  const { fdcId, description, brandName, brandOwner, gtinUpc, servingSize, servingSizeUnit } = match
  return {
    fdcId,
    description,
    brandName,
    brandOwner,
    gtinUpc,
    servingSize,
    servingSizeUnit,
    householdServingFullText: match.householdServingFullText,
    foodNutrients: (match.foodNutrients ?? []).map(({ nutrientId, unitName, value }) => ({
      nutrientId,
      unitName,
      value,
    })),
  }
}

const json = (body: unknown, status: number, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Product data rarely changes: let Vercel's edge answer repeat scans without using the key.
      'cache-control': cacheSeconds ? `public, s-maxage=${cacheSeconds}, max-age=3600` : 'no-store',
    },
  })

export async function handleFdcBarcode(request: Request, apiKey: string | undefined): Promise<Response> {
  const code = new URL(request.url).searchParams.get('code') ?? ''
  if (!/^\d{8,14}$/.test(code)) return json({ error: 'Invalid barcode' }, 400)
  try {
    // DEMO_KEY works without setup but allows only a few lookups per hour.
    const food = await lookupFdcBarcode(code, apiKey || 'DEMO_KEY')
    return json({ food }, 200, food ? 7 * 86_400 : 86_400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed'
    return json({ error: message }, 502)
  }
}

export function GET(request: Request): Promise<Response> {
  return handleFdcBarcode(request, process.env.FDC_API_KEY)
}
