'use client'

import { Hammer, Package, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { PARTS, UPGRADE_DEFS } from '@/lib/game/data'
import { partPrice } from '@/lib/game/generators'
import { formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { useI18n } from '@/lib/i18n'
import type { PartCategory, Upgrades } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { Badge, NeonButton, Panel } from '../ui'
import { BankPanel } from './bank-panel'
import { AtelierPanel } from './atelier-panel'

const CATEGORIES: { id: PartCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'engine', label: 'Мотор' },
  { id: 'tires', label: 'Шины' },
  { id: 'suspension', label: 'Подвеска' },
  { id: 'body', label: 'Кузов' },
  { id: 'electrics', label: 'Электрика' },
  { id: 'interior', label: 'Салон' },
]

export function MarketTab() {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  const [category, setCategory] = useState<PartCategory | 'all'>('all')
  const parts = PARTS.filter((p) => category === 'all' || p.category === category)
  const priceNote =
    state.partPriceMod > 1.05 ? t('market.pricesHigh') : state.partPriceMod < 0.95 ? t('market.pricesLow') : t('market.pricesOk')

  return (
    <div className="flex flex-col gap-3">
      <BankPanel />
      <AtelierPanel />
      <Panel
        title={<span className="flex items-center gap-1.5"><ShoppingCart className="size-4 text-neon" aria-hidden />{t('market.parts')}</span>}
        action={<Badge tone={state.partPriceMod > 1.05 ? 'danger' : state.partPriceMod < 0.95 ? 'success' : 'muted'}>{priceNote}</Badge>}
      >
        <p className="text-xs text-muted-foreground">
          {state.weather === 'rain' && 'Дождь: шины +25%. '}
          {state.weather === 'fog' && 'Туман: электрика +10%. '}
          {state.phase === 'night' && 'Ночной рынок: −10% на всё. '}
          Детали со склада дешевле ремонта в сервисе.
        </p>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none" role="tablist" aria-label="Категории">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                category === c.id ? 'border-neon bg-neon/15 text-neon' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {parts.map((part) => {
            const price = partPrice(part, state)
            const owned = state.inventory.find((i) => i.partId === part.id)?.qty ?? 0
            return (
              <li key={part.id} className="flex items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="truncate">{part.name}</span>
                    {part.tuning && <Badge tone="magenta">Тюнинг</Badge>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {part.description}
                    {owned > 0 && <span className="text-neon"> · на складе {owned}</span>}
                  </p>
                </div>
                <NeonButton size="sm" disabled={state.money < price} onClick={() => dispatch({ type: 'BUY_PART', partId: part.id, qty: 1 })}>
                  {formatMoney(price)}
                </NeonButton>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title={<span className="flex items-center gap-1.5"><Hammer className="size-4 text-warn" aria-hidden />{t('market.upgrades')}</span>}>
        <ul className="flex flex-col gap-2">
          {(Object.keys(UPGRADE_DEFS) as (keyof Upgrades)[]).map((key) => {
            const def = UPGRADE_DEFS[key]
            const lvl = state.upgrades[key]
            const maxed = lvl >= def.max
            const cost = def.cost(lvl)
            return (
              <li key={key} className="rounded-xl border border-border bg-secondary/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{def.label}</p>
                    <p className="text-[11px] text-muted-foreground">{def.describe(lvl)}</p>
                  </div>
                  {maxed ? (
                    <Badge tone="success">Максимум</Badge>
                  ) : (
                    <NeonButton tone="warn" size="sm" disabled={state.money < cost} onClick={() => dispatch({ type: 'BUY_UPGRADE', key })}>
                      {formatMoney(cost)}
                    </NeonButton>
                  )}
                </div>
                <div className="mt-2 flex gap-1" aria-label={`Уровень ${lvl} из ${def.max}`}>
                  {Array.from({ length: def.max }, (_, i) => (
                    <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < lvl ? 'bg-warn' : 'bg-muted')} />
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      {state.inventory.length > 0 && (
        <Panel title={<span className="flex items-center gap-1.5"><Package className="size-4 text-neon" aria-hidden />{t('market.stock')}</span>}>
          <p className="text-xs text-muted-foreground">
            {state.inventory.reduce((s, i) => s + i.qty, 0)} деталей. Устанавливай их на машины во вкладке «Стоянка».
          </p>
        </Panel>
      )}
    </div>
  )
}
