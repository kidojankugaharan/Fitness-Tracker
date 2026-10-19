import { clsx } from 'clsx'
import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router'
import { FoodIcon, ProgressIcon, SettingsIcon, TodayIcon, WorkoutIcon } from '@/components/icons'
import { RestTimerBar } from '@/components/RestTimerBar'
import { SyncStatus } from '@/components/SyncStatus'
import { useRestTimer } from '@/lib/restTimer'

type Tab = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }

const tabs: Tab[] = [
  { to: '/', label: 'Today', icon: TodayIcon },
  { to: '/food', label: 'Food', icon: FoodIcon },
  { to: '/workout', label: 'Workout', icon: WorkoutIcon },
  { to: '/progress', label: 'Progress', icon: ProgressIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function AppLayout() {
  const resting = useRestTimer() !== null
  return (
    <div className="flex min-h-full flex-col">
      <SyncStatus />
      {/* Extra bottom space while the rest timer bar sits above the tabs. */}
      <main className={clsx('flex-1', resting ? 'pb-36' : 'pb-20')}>
        <Outlet />
      </main>
      <RestTimerBar />
      <nav
        aria-label="Main"
        className="pb-safe border-border bg-bg/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-md"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'font-display relative flex h-16 flex-col items-center justify-center gap-1 text-[0.75rem] font-bold tracking-wider uppercase transition-colors',
                    isActive ? 'text-accent-bright' : 'text-muted active:text-text',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active tab: a blue bar along the top edge. */}
                    <span
                      aria-hidden="true"
                      className={clsx(
                        'bg-accent absolute top-0 h-[3px] w-10 rounded-b-full transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <Icon className="size-6" />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
