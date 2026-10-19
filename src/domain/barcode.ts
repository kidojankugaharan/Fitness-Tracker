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

/** Every spelling of a barcode worth looking up, most canonical first. */
export function barcodeVariants(raw: string): string[] {
  const code = raw.trim()
  const out = [code]
  if (code.length === 12) out.push(`0${code}`)
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1))
  if (code.length === 14 && code.startsWith('0')) out.push(code.slice(1))
  if (code.length === 8) {
    const upcA = upcEToUpcA(code)
    if (upcA) out.push(upcA, `0${upcA}`)
  }
  return [...new Set(out)]
}
