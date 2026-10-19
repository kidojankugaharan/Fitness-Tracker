// Canonical storage units are kg and kcal. Convert only at the display/input boundary.

export type WeightUnit = 'kg' | 'lb'
export type EnergyUnit = 'kcal' | 'kJ'

export const KG_PER_LB = 0.45359237
export const KJ_PER_KCAL = 4.184

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function kcalToDisplay(kcal: number, unit: EnergyUnit): number {
  return unit === 'kcal' ? kcal : kcal * KJ_PER_KCAL
}

/** Round to at most `decimals` places and drop trailing zeros (82.50 → "82.5", 100.00 → "100"). */
export function formatNumber(value: number, decimals = 1): string {
  const factor = 10 ** decimals
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${formatNumber(kgToDisplay(kg, unit), unit === 'kg' ? 2 : 1)} ${unit}`
}

export function formatEnergy(kcal: number, unit: EnergyUnit): string {
  return `${Math.round(kcalToDisplay(kcal, unit))} ${unit}`
}

/** Label for an energy input in the user's unit. */
export const energyLabel = (unit: EnergyUnit) => (unit === 'kcal' ? 'Calories (kcal)' : 'Energy (kJ)')

/** Convert energy typed in the user's unit to kcal for storage. */
export const energyToKcal = (value: number, unit: EnergyUnit) =>
  unit === 'kcal' ? value : value / KJ_PER_KCAL
