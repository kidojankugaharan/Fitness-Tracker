// Retail barcodes (EAN-8, EAN-13, UPC-A, UPC-E). Open Food Facts keys products by the digits printed
// under the barcode, but the same product can appear as 12-digit UPC-A or 13-digit EAN-13 (leading 0).

const DIGITS = /^\d+$/

/** GS1 check digit: weights 3,1,3,1… from the right (excluding the check digit itself). */
function checkDigitValid(code: string): boolean {
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** Expand a UPC-E (8 digits, number system 0/1) to its UPC-A form. */
export function upcEToUpcA(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const d = (i: number) => code.charAt(i)
  const last = d(6)
  let body: string
  if (last === '0' || last === '1' || last === '2') body = `${d(1)}${d(2)}${last}0000${d(3)}${d(4)}${d(5)}`
  else if (last === '3') body = `${d(1)}${d(2)}${d(3)}00000${d(4)}${d(5)}`
  else if (last === '4') body = `${d(1)}${d(2)}${d(3)}${d(4)}00000${d(5)}`
  else body = `${d(1)}${d(2)}${d(3)}${d(4)}${d(5)}0000${last}`
  const upcA = `${d(0)}${body}${d(7)}`
  return checkDigitValid(upcA) ? upcA : null
}

export function isValidBarcode(raw: string): boolean {
  const code = raw.trim()
  if (!DIGITS.test(code)) return false
  if (code.length === 8) return checkDigitValid(code) || upcEToUpcA(code) !== null
  if (code.length === 12 || code.length === 13 || code.length === 14) return checkDigitValid(code)
  return false
}

/** Compress a UPC-A to UPC-E when the code allows it (verified by expanding it back). */
export function upcAToUpcE(upcA: string): string | null {
  if (!/^[01]\d{11}$/.test(upcA)) return null
  const ns = upcA.charAt(0)
  const m = upcA.slice(1, 6)
  const p = upcA.slice(6, 11)
  const check = upcA.charAt(11)
  const candidates = [
    m.slice(0, 2) + p.slice(2) + m.charAt(2),
    m.slice(0, 3) + p.slice(3) + '3',
    m.slice(0, 4) + p.charAt(4) + '4',
    m + p.charAt(4),
  ]
  for (const body of candidates) {
    const upcE = `${ns}${body}${check}`
    if (upcEToUpcA(upcE) === upcA) return upcE
  }
  return null
}

/**
 * One spelling per product: GTIN-13 for UPC-A / UPC-E / GTIN-14-with-leading-0, EAN-13 as is.
 * An 8-digit code that is valid both as EAN-8 and as UPC-E is ambiguous and kept unchanged.
 */
export function canonicalBarcode(raw: string): string {
  const code = raw.trim()
  if (code.length === 12) return `0${code}`
  if (code.length === 14 && code.startsWith('0')) return code.slice(1)
  if (code.length === 8 && !checkDigitValid(code)) {
    const upcA = upcEToUpcA(code)
    if (upcA) return `0${upcA}`
  }
  return code
}

/** Every spelling of the same product worth looking up, canonical form first. */
export function barcodeVariants(raw: string): string[] {
  const code = raw.trim()
  const canonical = canonicalBarcode(code)
  const out = [canonical, code]
  const upcA =
    canonical.length === 13 && canonical.startsWith('0')
      ? canonical.slice(1)
      : code.length === 8
        ? upcEToUpcA(code)
        : null
  if (upcA) {
    out.push(upcA, `0${upcA}`)
    const upcE = upcAToUpcE(upcA)
    if (upcE) out.push(upcE)
  }
  return [...new Set(out)]
}
