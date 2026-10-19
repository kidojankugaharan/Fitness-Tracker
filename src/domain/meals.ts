/**
 * Best-guess meal for "now" when the user didn't pick one (e.g. scanning from the Today screen).
 * With the usual four meals: breakfast before 10:30, lunch before 15:00, dinner before 21:00,
 * snacks otherwise. Any other meal setup falls back to the first meal.
 */
export function suggestMeal(mealNames: string[], now: Date = new Date()): string {
  if (mealNames.length !== 4) return mealNames[0] ?? 'Snacks'
  const minutes = now.getHours() * 60 + now.getMinutes()
  const index = minutes < 10 * 60 + 30 ? 0 : minutes < 15 * 60 ? 1 : minutes < 21 * 60 ? 2 : 3
  return mealNames[index]!
}
