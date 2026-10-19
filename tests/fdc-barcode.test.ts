import { afterEach, describe, expect, it, vi } from 'vitest'
import { gtinSpellings, handleFdcBarcode } from '../api/fdc-barcode'

describe('gtinSpellings', () => {
  it('lists the 12-, 13- and 14-digit forms of a code', () => {
    expect(gtinSpellings('0049000028911')).toEqual(['049000028911', '0049000028911', '00049000028911'])
    expect(gtinSpellings('3017620422003')).toEqual(['3017620422003', '03017620422003'])
  })
})

describe('/api/fdc-barcode', () => {
  afterEach(() => vi.unstubAllGlobals())

  const fdcReturns = (foods: unknown[]) => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(
      async () => new Response(JSON.stringify({ foods })),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  const call = (code: string, key?: string) =>
    handleFdcBarcode(new Request(`https://app.test/api/fdc-barcode?code=${code}`), key)

  it('returns only an exact barcode match and keeps the key server-side', async () => {
    const fetchMock = fdcReturns([
      { fdcId: 1, description: 'Other', gtinUpc: '00049000099999', foodNutrients: [] },
      { fdcId: 2, description: 'Diet Coke', gtinUpc: '00049000028911', foodNutrients: [] },
    ])
    const res = await call('0049000028911', 'secret-key')
    expect(res.status).toBe(200)
    expect(((await res.json()) as { food: { fdcId: number } }).food.fdcId).toBe(2)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('api_key=secret-key')
    expect(res.headers.get('cache-control')).toContain('s-maxage')
  })

  it('answers null when FDC has no matching barcode', async () => {
    fdcReturns([{ fdcId: 1, description: 'Close but no', gtinUpc: '00049000028912', foodNutrients: [] }])
    expect(await (await call('0049000028911')).json()).toEqual({ food: null })
  })

  it('rejects anything that is not a barcode without calling FDC', async () => {
    const fetchMock = fdcReturns([])
    expect((await call('abc')).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
