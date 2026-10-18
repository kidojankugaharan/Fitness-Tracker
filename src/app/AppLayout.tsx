import { clsx } from 'clsx'
import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router'
import { FoodIcon, ProgressIcon, SettingsIcon, TodayIcon, WorkoutIcon } from '@/components/icons'

type Tab = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }

const tabs: Tab[] = [
  { to: '/', label: 'Today', icon: TodayIcon },
  { to: '/food', label: 'Food', icon: FoodIcon },
  { to: '/workout', label: 'Workout', icon: WorkoutIcon },
  { to: '/progress', label: 'Progress', icon: ProgressIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function AppLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="pb-safe border-border bg-surface/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                    isActive ? 'text-accent' : 'text-muted',
                  )
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
