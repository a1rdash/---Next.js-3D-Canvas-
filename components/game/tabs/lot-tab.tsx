'use client'

import { ChevronRight, Crown, ParkingSquare } from 'lucide-react'
import { useState } from 'react'
import { SEGMENT_LABELS } from '@/lib/game/data'
import { maxSlots, realValue } from '@/lib/game/generators'
import { formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { useI18n } from '@/lib/i18n'
import type { TabId } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { CarArt } from '../car-art'
import { Badge, EmptyState, NeonButton, Panel } from '../ui'
import { CarWorkshop } from './car-workshop'

export function LotTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = state.lot.find((c) => c.id === selectedId)
  const slots = maxSlots(state)

  if (selected) return <CarWorkshop car={selected} onBack={() => setSelectedId(null)} />

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title={<span className="flex items-center gap-1.5"><ParkingSquare className="size-4 text-neon" aria-hidden />{t('lot.title')}</span>}
        action={<span className="text-[11px] text-muted-foreground tabular-nums">{t('lot.slots', { n: state.lot.length, max: slots })}</span>}
      >
        <div className="mb-3 grid grid-cols-10 gap-1" aria-hidden>
          {Array.from({ length: 30 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full',
                i < state.lot.length ? 'bg-neon neon-glow' : i < slots ? 'bg-muted' : 'border border-dashed border-border',
              )}
            />
          ))}
        </div>

        {state.lot.length === 0 ? (
          <div className="flex flex-col gap-3">
            <EmptyState icon={<ParkingSquare />} title={t('lot.emptyTitle')} text={t('lot.emptyText')} />
            <NeonButton onClick={() => onNavigate('home')}>{t('lot.toClients')}</NeonButton>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.lot.map((car) => {
              const value = realValue(car, state.segmentDemand)
              const cost = car.purchasePrice + car.invested
              const margin = value - cost
              const offers = state.listings[car.id]?.offers
              return (
                <li key={car.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(car.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/70 p-2 text-left transition-colors hover:border-neon/50"
                  >
                    <CarArt bodyType={car.bodyType} brand={car.brand} model={car.model} segment={car.segment} alt={`${car.brand} ${car.model}`} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{car.brand} {car.model}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {car.year} · {SEGMENT_LABELS[car.segment]} · {t('lot.invested')} {formatMoney(cost)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {car.documentsForged && <Badge tone="danger">{t('lot.dirtyDocs')}</Badge>}
                        {offers && <Badge tone="success">{offers.length} предлож.</Badge>}
                        {state.vipBoostCarId === car.id && (
                          <Badge tone="magenta"><Crown className="size-3" aria-hidden />VIP</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={cn('text-xs font-bold tabular-nums', margin >= 0 ? 'text-success' : 'text-destructive')}>
                        {margin >= 0 ? '+' : ''}
                        {formatMoney(margin)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{t('lot.forecast')}</span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
