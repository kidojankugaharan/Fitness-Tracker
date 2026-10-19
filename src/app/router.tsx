import { createBrowserRouter, Navigate } from 'react-router'
import { SignInPage } from '@/features/auth/SignInPage'
import { AddFoodPage } from '@/features/food/AddFoodPage'
import { BarcodeResultPage } from '@/features/food/BarcodeResultPage'
import { ScanPage } from '@/features/food/ScanPage'
import { EditEntryPage } from '@/features/food/EditEntryPage'
import { FoodPage } from '@/features/food/FoodPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TodayPage } from '@/features/today/TodayPage'
import { ExerciseHistoryPage } from '@/features/workouts/ExerciseHistoryPage'
import { WorkoutPage } from '@/features/workouts/WorkoutPage'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: 'food', element: <FoodPage /> },
          { path: 'food/add', element: <AddFoodPage /> },
          { path: 'food/entry/:entryId', element: <EditEntryPage /> },
          { path: 'food/scan', element: <ScanPage /> },
          { path: 'food/barcode/:code', element: <BarcodeResultPage /> },
          { path: 'workout', element: <WorkoutPage /> },
          { path: 'workout/exercise/:exerciseId', element: <ExerciseHistoryPage /> },
          { path: 'progress', element: <ProgressPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
