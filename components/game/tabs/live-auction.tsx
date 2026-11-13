'use client'

import { Flag, Gavel, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { realValue } from '@/lib/game/generators'
import { chance, formatMoney, pick, rand, roundTo } from '@/lib/game/random'
import { PLAYER } from '@/lib/game/reducer'
import { useGame } from '@/lib/game/store'
import type { AuctionLot } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { CarArt } from '../car-art'
import { NeonButton, Panel } from '../ui'

const START_TIME = 12
const BID_EXTEND = 5
/** Шаг «внутренних» торгов; 900 мс — как было в исходной версии. */
const TICK_MS = 900

interface Bid {
  id: number
  who: string
  amount: number
}

interface AuctionRuntime {
  lotId: string
  step: number
  ceilings: Record<string, number>
  price: number
  leader: string | null
  /** абсолютное время окончания: таймер идёт, даже если вкладку закрыли */
  endsAt: number
  bids: Bid[]
  lastTickAt: number
  ended: boolean
}

/**
 * Состояние торгов живёт вне компонента: переключение вкладок больше не перезапускает
 * аукцион с нуля и не позволяет «переигрывать» лот бесконечно.
 */
let runtime: AuctionRuntime | null = null

function makeRuntime(lot: AuctionLot, step: number, ceilings: Record<string, number>): AuctionRuntime {
  const now = Date.now()
  // если страницу перезагрузили, таймер не начинается заново
  const startedAt = lot.startedAt ?? now
  return {
    lotId: lot.id,
    step,
    ceilings,
    price: lot.startPrice,
    leader: null,
    // при просроченном старте торги завершаются сразу, а не получают лишние секунды
    endsAt: Math.max(now, startedAt + START_TIME * 1000),
    bids: [],
    lastTickAt: now,
    ended: false,
  }
}

function ensureRuntime(lot: AuctionLot, step: number, ceilings: Record<string, number>): AuctionRuntime {
  // Завершённые торги не перезапускаем: иначе уход с вкладки «оживлял» бы лот.
  if (!runtime || runtime.lotId !== lot.id) runtime = makeRuntime(lot, step, ceilings)
  return runtime
}

function placeBid(rt: AuctionRuntime, who: string, amount: number, at: number) {
  rt.price = amount
  rt.leader = who
  rt.endsAt = Math.max(rt.endsAt, at + BID_EXTEND * 1000)
  rt.bids = [{ id: at + Math.random(), who, amount }, ...rt.bids].slice(0, 8)
}

function snapshot(rt: AuctionRuntime) {
  return {
    price: rt.price,
    leader: rt.leader,
    timeLeft: Math.max(0, Math.ceil((rt.endsAt - Date.now()) / 1000)),
    bids: rt.bids,
  }
}

export function LiveAuction({ lot }: { lot: AuctionLot }) {
  const { state, dispatch } = useGame()
  const step = roundTo(Math.max(5_000, lot.startPrice * 0.05), 1000)
  const ceilings = useMemo(() => {
    const value = realValue(lot.car, state.segmentDemand)
    return Object.fromEntries(state.rivals.map((r) => [r.name, value * r.budget * rand(0.65, 1.05)]))
    // Rival ceilings are rolled once per lot so they don't change mid-auction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ленивая инициализация: ensureRuntime не должен вызываться на каждый рендер
  const [rt] = useState<AuctionRuntime>(() => ensureRuntime(lot, step, ceilings))
  const [view, setView] = useState(() => snapshot(rt))
  const endedRef = useRef(false)

  useEffect(() => {
    const tick = () => {
      const cur = rt
      if (cur.ended) return
      const now = Date.now()
      // догоняем пропущенные тики, если игрок уходил с вкладки
      const missed = Math.min(240, Math.floor((now - cur.lastTickAt) / TICK_MS))
      for (let i = 0; i < missed; i++) {
        const at = cur.lastTickAt + TICK_MS
        // не «догоняем» уже закончившиеся торги: иначе ставки после финиша продлевали бы лот
        if (at >= cur.endsAt) break
        cur.lastTickAt = at
        const next = cur.leader ? cur.price + cur.step : cur.price
        const willing = state.rivals.filter((r) => r.name !== cur.leader && cur.ceilings[r.name] >= next)
        if (willing.length > 0) {
          const rival = pick(willing)
          if (chance(0.35 + rival.aggression * 0.45)) placeBid(cur, rival.name, next, cur.lastTickAt)
        }
      }
      if (now >= cur.endsAt) cur.ended = true
      setView(snapshot(cur))
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [rt, state.rivals])

  useEffect(() => {
    const cur = rt
    if (!cur.ended || endedRef.current) return
    endedRef.current = true
    // без ставок лот не уходит «первому попавшемуся» сопернику
    dispatch({ type: 'AUCTION_END', lotId: lot.id, winner: cur.leader ?? 'Никто', price: cur.price })
  }, [rt, view.timeLeft, view.leader, view.price, lot.id, dispatch])

  const playerLeads = view.leader === PLAYER
  const nextBid = view.leader ? view.price + step : view.price

  return (
    <div className="flex flex-col gap-3">
      <Panel className="border-magenta/50">
        <div className="flex gap-3">
          <CarArt bodyType={lot.car.bodyType} brand={lot.car.brand} model={lot.car.model} segment={lot.car.segment} alt="Неизвестный автомобиль" mystery />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{lot.title}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">{lot.hint}</p>
          </div>
        </div>
      </Panel>

      <div className="rounded-2xl border border-magenta/50 bg-gradient-to-b from-magenta/15 to-card p-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="size-4" aria-hidden />
          <span className={cn('font-display text-lg tabular-nums', view.timeLeft <= 3 ? 'text-destructive' : 'text-foreground')} aria-live="polite">
            {view.timeLeft} с
          </span>
        </p>
        <p className="mt-2 font-display text-3xl text-magenta magenta-text tabular-nums">{formatMoney(view.price)}</p>
        <p className={cn('mt-1 text-xs font-semibold', playerLeads ? 'text-success' : 'text-muted-foreground')}>
          {view.leader ? (playerLeads ? 'Ваша ставка лидирует' : `Лидер: ${view.leader}`) : 'Ставок пока нет'}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-magenta transition-all duration-700" style={{ width: `${(view.timeLeft / START_TIME) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NeonButton
          tone="magenta"
          size="lg"
          disabled={playerLeads || view.timeLeft === 0 || state.money < nextBid}
          onClick={() => {
            placeBid(rt, PLAYER, nextBid, Date.now())
            setView(snapshot(rt))
          }}
        >
          <Gavel aria-hidden />
          {formatMoney(nextBid)}
        </NeonButton>
        <NeonButton
          tone="ghost"
          size="lg"
          disabled={playerLeads || view.timeLeft === 0 || state.money < nextBid + step * 2}
          onClick={() => {
            placeBid(rt, PLAYER, nextBid + step * 2, Date.now())
            setView(snapshot(rt))
          }}
        >
          {formatMoney(nextBid + step * 2)}
        </NeonButton>
      </div>
      <NeonButton
        tone="danger"
        size="sm"
        disabled={view.timeLeft === 0 || playerLeads}
        onClick={() => {
          rt.endsAt = Date.now()
          rt.ended = true
          setView(snapshot(rt))
        }}
      >
        <Flag aria-hidden />
        Сдаться
      </NeonButton>
      <p className="text-center text-[11px] text-muted-foreground">Бюджет: {formatMoney(state.money)}</p>

      <Panel title="Лента ставок">
        {view.bids.length === 0 ? (
          <p className="text-xs text-muted-foreground">Тишина в зале…</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {view.bids.map((b, i) => (
              <li key={b.id} className={cn('flex justify-between text-xs', i === 0 ? 'font-semibold' : 'text-muted-foreground')}>
                <span className={b.who === PLAYER ? 'text-neon' : undefined}>{b.who}</span>
                <span className="tabular-nums">{formatMoney(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
