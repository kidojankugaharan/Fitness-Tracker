import { describe, expect, it } from 'vitest'
import { barcodeVariants, canonicalBarcode, isValidBarcode, upcAToUpcE, upcEToUpcA } from './barcode'

describe('isValidBarcode', () => {
  it('accepts real EAN-13, UPC-A and EAN-8 codes', () => {
    expect(isValidBarcode('3017624010701')).toBe(true) // Nutella EAN-13
    expect(isValidBarcode('036000291452')).toBe(true) // UPC-A
    expect(isValidBarcode('96385074')).toBe(true) // EAN-8
  })

  it('rejects bad check digits, letters and odd lengths', () => {
    expect(isValidBarcode('3017624010702')).toBe(false)
    expect(isValidBarcode('30176240107a1')).toBe(false)
    expect(isValidBarcode('12345')).toBe(false)
    expect(isValidBarcode('')).toBe(false)
  })
})

describe('UPC-E', () => {
  it('expands to UPC-A and compresses back', () => {
    expect(upcEToUpcA('04252614')).toBe('042100005264')
    expect(upcAToUpcE('042100005264')).toBe('04252614')
    expect(isValidBarcode('04252614')).toBe(true)
  })

  it('round-trips every compression rule', () => {
    for (const upcE of ['01234505', '01234531', '01234542', '01234558', '01234565']) {
      const upcA = upcEToUpcA(upcE)
      if (upcA) expect(upcAToUpcE(upcA)).toBe(upcE)
    }
  })

  it('returns null for codes that cannot be compressed', () => {
    expect(upcAToUpcE('036000291452')).toBeNull()
  })
})

describe('canonicalBarcode', () => {
  it('maps every spelling of a product to one GTIN-13', () => {
    expect(canonicalBarcode('036000291452')).toBe('0036000291452')
    expect(canonicalBarcode('0036000291452')).toBe('0036000291452')
    expect(canonicalBarcode('00036000291452')).toBe('0036000291452')
    expect(canonicalBarcode('04252614')).toBe('0042100005264')
    expect(canonicalBarcode('3017624010701')).toBe('3017624010701')
    expect(canonicalBarcode('96385074')).toBe('96385074') // EAN-8 stays
  })
})

describe('barcodeVariants', () => {
  it('finds a UPC-E-stored food from its UPC-A scan and vice versa', () => {
    expect(barcodeVariants('042100005264')).toContain('04252614')
    expect(barcodeVariants('04252614')).toContain('042100005264')
    expect(barcodeVariants('0042100005264')).toContain('04252614')
  })

  it('pairs UPC-A with EAN-13, canonical first', () => {
    expect(barcodeVariants('036000291452')).toEqual(['0036000291452', '036000291452'])
    expect(barcodeVariants('3017624010701')).toEqual(['3017624010701'])
  })
})
