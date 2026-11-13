'use client'

import { useI18n } from '@/lib/i18n'
import { useEffect, useState } from 'react'

import { ChevronRight, Newspaper, Skull, Swords, TrendingDown, TrendingUp, UserRound } from 'lucide-react'
import { SEGMENT_LABELS, SELLER_LABELS } from '@/lib/game/data'
import { maxSlots } from '@/lib/game/generators'
import { garageLevelOf } from '@/lib/game/data'
import { formatKm, formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import type { TabId } from '@/lib/game/types'
import { CarArt } from '../car-art'
import { Badge, EmptyState, Panel } from '../ui'
import { DuelCard } from './duel-card'
import { InspectionView } from './inspection-view'
import { ShadyPanel } from './shady-panel'

const SELLER_TONE = { honest: 'success', cunning: 'warn', shady: 'danger' } as const

export function GarageTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  const active = state.clients.find((c) => c.id === state.activeClientId)

  if (active) return <InspectionView key={active.id} seller={active} />

  return (
    <div className="flex flex-col gap-3">
      <MarketRefreshBanner />
      <div className="flex items-center justify-between rounded-2xl border border-neon/30 bg-card/70 px-3 py-2 text-xs backdrop-blur-sm">
        <span className="font-semibold text-neon">Гараж · уровень {garageLevelOf(state.upgrades)}/6</span>
        <span className="text-muted-foreground">Улучшения на вкладке «Рынок» меняют вид гаража</span>
      </div>
      {(state.contracts?.filter((c) => c.status === 'active') ?? []).length > 0 && (
        <div className="rounded-2xl border border-warn/40 bg-warn/5 p-3">
          <p className="text-sm font-semibold text-warn">{t('garage.contracts')}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {state.contracts.filter((c) => c.status === 'active').map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-card/80 px-2.5 py-2 text-xs">
                <p className="font-semibold">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">{c.description}</p>
                <p className="mt-1 text-[11px] text-neon">Награда: {c.reward.toLocaleString('ru-RU')} ₽ · до дня {c.deadlineDay}</p>
                <button
                  type="button"
                  className="mt-1.5 rounded-lg bg-warn/20 px-2 py-1 text-[11px] font-semibold text-warn"
                  onClick={() => dispatch({ type: 'COMPLETE_CONTRACT', contractId: c.id })}
                >
                  {t('garage.deliver')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Panel title={<span className="flex items-center gap-1.5"><Newspaper className="size-4 text-neon" aria-hidden />{t('garage.news')}</span>}>
        <ul className="flex flex-col gap-1.5">
          {state.news.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-xs leading-relaxed">
              {n.segment ? (
                n.modifier > 1 ? (
                  <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Рост" />
                ) : (
                  <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="Падение" />
                )
              ) : (
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neon" aria-hidden />
              )}
              <span className="flex-1">{n.headline}</span>
              {n.segment && (
                <span className={n.modifier > 1 ? 'font-semibold text-success tabular-nums' : 'font-semibold text-destructive tabular-nums'}>
                  {n.modifier > 1 ? '+' : ''}
                  {Math.round((n.modifier - 1) * 100)}%
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={<span className="flex items-center gap-1.5"><UserRound className="size-4 text-magenta" aria-hidden />Очередь у ворот</span>}
        action={<span className="text-[11px] text-muted-foreground">Стоянка {state.lot.length}/{maxSlots(state)}</span>}
      >
        {state.clients.length === 0 ? (
          <EmptyState icon={<UserRound />} title="Никого нет" text="Перейди к следующему времени суток — придут новые продавцы." />
        ) : (
          <ul className="flex flex-col gap-2">
            {state.clients.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SELECT_CLIENT', id: c.id })}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/70 p-2 text-left transition-colors hover:border-neon/50"
                >
                  <CarArt bodyType={c.car.bodyType} brand={c.car.brand} model={c.car.model} segment={c.car.segment} alt={`${c.car.brand} ${c.car.model}`} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{c.car.brand} {c.car.model}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {c.car.year} · {formatKm(c.car.mileageShown)} · {SEGMENT_LABELS[c.car.segment]}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone={SELLER_TONE[c.type]}>{SELLER_LABELS[c.type]}</Badge>
                      <span className="truncate text-[11px] text-muted-foreground">{c.name}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-neon tabular-nums">{formatMoney(c.askingPrice)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {state.shadyJobs.length > 0 && <ShadyPanel />}

      <DuelCard />

      {state.lot.length > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('lot')}
          className="flex items-center justify-between rounded-2xl border border-neon/40 bg-neon/5 p-3 text-left"
        >
          <span>
            <span className="block font-display text-sm">На стоянке: {state.lot.length} шт.</span>
            <span className="text-[11px] text-muted-foreground">Ремонтируй, тюнингуй и продавай</span>
          </span>
          <ChevronRight className="size-5 text-neon" aria-hidden />
        </button>
      )}

      {state.blacklist.length > 0 && (
        <Panel title={<span className="flex items-center gap-1.5"><Skull className="size-4 text-destructive" aria-hidden />Чёрный список</span>}>
          <ul className="flex flex-wrap gap-1.5">
            {state.blacklist.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'UNBLACKLIST', name })}
                  className="rounded-full border border-destructive/40 px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
                  aria-label={`Убрать ${name} из чёрного списка`}
                >
                  {name} ×
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[11px] text-muted-foreground">
        <Swords className="size-3.5" aria-hidden />
        Время идёт только когда ты жмёшь кнопку фазы в шапке
      </p>
    </div>
  )
}


function MarketRefreshBanner() {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const softLeft = Math.max(0, state.marketNextSoftAt - Date.now())
  const majorLeft = Math.max(0, state.marketNextMajorAt - Date.now())
  const fmt = (ms: number) => {
    const s = Math.ceil(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}ч ${m}м`
    return `${m}:${String(sec).padStart(2, '0')}`
  }
  return (
    <div className="rounded-2xl border border-neon/30 bg-neon/5 p-3">
      <p className="text-xs font-semibold text-neon">{t('garage.marketTimer')}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Быстрое обновление каждые 3 мин · осталось {state.marketSoftLeft}/5
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
          disabled={state.marketSoftLeft <= 0 || Date.now() < state.marketNextSoftAt}
          onClick={() => dispatch({ type: 'MARKET_SOFT_REFRESH' })}
        >
          Обновить · {fmt(softLeft)}
        </button>
        <button
          type="button"
          className="rounded-lg border border-magenta/40 bg-magenta/10 px-2.5 py-1.5 text-[11px] font-semibold text-magenta disabled:opacity-40"
          disabled={Date.now() < state.marketNextMajorAt}
          onClick={() => dispatch({ type: 'MARKET_MAJOR_REFRESH' })}
        >
          Крупное · {fmt(majorLeft)}
        </button>
      </div>
    </div>
  )
}
