/**
 * Parse a non-negative number typed by the user (accepts "," as the decimal separator).
 * Returns null for a blank field and NaN for anything invalid, so callers can tell
 * "not entered" apart from "entered wrong".
 */
export function parseNonNegative(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (!/^\d*[.,]?\d*$/.test(trimmed) || trimmed === '.' || trimmed === ',') return NaN
  return Number(trimmed.replace(',', '.'))
}

export const isInvalid = (value: number | null): boolean => value !== null && Number.isNaN(value)
