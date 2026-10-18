import { createBrowserRouter, Navigate } from 'react-router'
import { SignInPage } from '@/features/auth/SignInPage'
import { FoodPage } from '@/features/food/FoodPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TodayPage } from '@/features/today/TodayPage'
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
          { path: 'workout', element: <WorkoutPage /> },
          { path: 'progress', element: <ProgressPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
