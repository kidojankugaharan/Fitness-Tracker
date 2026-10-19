import { describe, expect, it } from 'vitest'
import { barcodeVariants, isValidBarcode, upcEToUpcA } from './barcode'

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
  it('expands to UPC-A', () => {
    expect(upcEToUpcA('04252614')).toBe('042100005264')
    expect(isValidBarcode('04252614')).toBe(true)
  })
})

describe('barcodeVariants', () => {
  it('pairs UPC-A with its EAN-13 form and vice versa', () => {
    expect(barcodeVariants('036000291452')).toEqual(['036000291452', '0036000291452'])
    expect(barcodeVariants('0036000291452')).toEqual(['0036000291452', '036000291452'])
    expect(barcodeVariants('3017624010701')).toEqual(['3017624010701'])
  })

  it('includes expanded forms of UPC-E', () => {
    expect(barcodeVariants('04252614')).toEqual(['04252614', '042100005264', '0042100005264'])
  })
})
