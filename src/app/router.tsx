import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './AppLayout'
import { FullScreenSpinner, RequireAuth } from './RequireAuth'

// Screens are code-split: the first load only carries the app shell. Shortly after start-up every
// screen is fetched in the background (preloadScreens), so opening one later works offline too —
// e.g. going to Add food at the gym with no signal.
const screens = {
  signIn: () => import('@/features/auth/SignInPage').then((m) => m.SignInPage),
  today: () => import('@/features/today/TodayPage').then((m) => m.TodayPage),
  food: () => import('@/features/food/FoodPage').then((m) => m.FoodPage),
  addFood: () => import('@/features/food/AddFoodPage').then((m) => m.AddFoodPage),
  editEntry: () => import('@/features/food/EditEntryPage').then((m) => m.EditEntryPage),
  scan: () => import('@/features/food/ScanPage').then((m) => m.ScanPage),
  barcode: () => import('@/features/food/BarcodeResultPage').then((m) => m.BarcodeResultPage),
  workout: () => import('@/features/workouts/WorkoutPage').then((m) => m.WorkoutPage),
  exerciseHistory: () => import('@/features/workouts/ExerciseHistoryPage').then((m) => m.ExerciseHistoryPage),
  progress: () => import('@/features/progress/ProgressPage').then((m) => m.ProgressPage),
  settings: () => import('@/features/settings/SettingsPage').then((m) => m.SettingsPage),
} satisfies Record<string, () => Promise<ComponentType>>

const screen = (load: () => Promise<ComponentType>) => async () => ({ Component: await load() })

/** Fetch every screen's code once the app is idle (module imports are cached after that). */
export function preloadScreens() {
  const run = () => Object.values(screens).forEach((load) => void load().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1500)
}

export const router = createBrowserRouter([
  { path: '/sign-in', lazy: screen(screens.signIn) },
  {
    element: <RequireAuth />,
    HydrateFallback: FullScreenSpinner,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, lazy: screen(screens.today) },
          { path: 'food', lazy: screen(screens.food) },
          { path: 'food/add', lazy: screen(screens.addFood) },
          { path: 'food/entry/:entryId', lazy: screen(screens.editEntry) },
          { path: 'food/scan', lazy: screen(screens.scan) },
          { path: 'food/barcode/:code', lazy: screen(screens.barcode) },
          { path: 'workout', lazy: screen(screens.workout) },
          { path: 'workout/exercise/:exerciseId', lazy: screen(screens.exerciseHistory) },
          { path: 'progress', lazy: screen(screens.progress) },
          { path: 'settings', lazy: screen(screens.settings) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
