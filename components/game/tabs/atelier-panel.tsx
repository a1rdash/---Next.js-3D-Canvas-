'use client'

import { Palette } from 'lucide-react'
import { FREE_LOOKS, LOOK_CATALOG } from '@/lib/game/data'
import type { LookKind } from '@/lib/game/content'
import { formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { Badge, NeonButton, Panel } from '../ui'

const GROUPS: { kind: LookKind; title: string }[] = [
  { kind: 'wheelDesign', title: 'Колёсные диски' },
  { kind: 'tire', title: 'Шины' },
  { kind: 'finish', title: 'Специальные покрытия' },
]

/** Ателье авторынка: покупка дисков, шин и покрытий. Применяются бесплатно во вкладке «Гараж». */
export function AtelierPanel() {
  const { state, dispatch } = useGame()
  const owned = new Set([...FREE_LOOKS, ...(state.ownedLooks ?? [])])
  return (
    <Panel
      title={<span className="flex items-center gap-1.5"><Palette className="size-4 text-magenta" aria-hidden />Ателье: кастомизация</span>}
      action={<Badge tone="magenta">диски · шины · покрытия</Badge>}
    >
      <p className="text-xs text-muted-foreground">Цвета кузова, дисков, шин и салона настраиваются в гараже. Здесь — новые варианты дисков, шин и покрытий.</p>
      {GROUPS.map((g) => (
        <div key={g.kind} className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
          <ul className="flex flex-col gap-1.5">
            {LOOK_CATALOG.filter((l) => l.kind === g.kind && l.price > 0).map((l) => {
              const has = owned.has(l.id)
              return (
                <li key={l.id} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="text-[10px] text-muted-foreground">{l.hint}</p>
                  </div>
                  {has ? (
                    <Badge tone="success">Куплено</Badge>
                  ) : (
                    <NeonButton size="sm" tone="magenta" disabled={state.money < l.price} onClick={() => dispatch({ type: 'BUY_LOOK', id: l.id })} aria-label={`Купить ${l.name}`}>
                      {formatMoney(l.price)}
                    </NeonButton>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </Panel>
  )
}
