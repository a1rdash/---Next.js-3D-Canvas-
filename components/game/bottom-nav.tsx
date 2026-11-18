'use client'

import { Gavel, House, Info, ParkingSquare, ShoppingCart, User, Wrench } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { TabId } from '@/lib/game/types'
import { cn } from '@/lib/utils'

const TAB_IDS: { id: TabId; key: string; label?: string; icon: typeof House }[] = [
  { id: 'home', key: 'nav.garage', label: 'Главная', icon: House },
  { id: 'garage', key: 'nav.garage', label: 'Гараж', icon: Wrench },
  { id: 'lot', key: 'nav.lot', icon: ParkingSquare },
  { id: 'auction', key: 'nav.auction', icon: Gavel },
  { id: 'market', key: 'nav.market', icon: ShoppingCart },
  { id: 'profile', key: 'nav.profile', icon: User },
  { id: 'about', key: 'nav.shop', icon: Info },
]

export function BottomNav({
  active,
  onChange,
  lotCount,
  clientCount,
}: {
  active: TabId
  onChange: (tab: TabId) => void
  lotCount: number
  clientCount: number
}) {
  const { t } = useI18n()
  const badges: Partial<Record<TabId, number>> = { home: clientCount, lot: lotCount }
  return (
    <nav
      aria-label="Main"
      className="relative z-20 border-t border-border bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur"
    >
      <ul className="grid grid-cols-7">
        {TAB_IDS.map(({ id, key, label: fixed, icon: Icon }) => {
          const isActive = id === active
          const badge = badges[id]
          const label = fixed ?? t(key)
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[9.5px] font-semibold transition-colors',
                  isActive ? 'text-neon' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                <span className="truncate max-w-full">{label}</span>
                {!!badge && badge > 0 && (
                  <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-magenta px-1 text-[9px] text-accent-foreground">
                    {badge}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
