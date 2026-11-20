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

interface Bid {
  id: number
  who: string
  amount: number
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

  const [price, setPrice] = useState(lot.startPrice)
  const [leader, setLeader] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(START_TIME)
  const [bids, setBids] = useState<Bid[]>([])
  const ended = useRef(false)
  const live = useRef({ price, leader })
  live.current = { price, leader }

  const placeBid = (who: string, amount: number) => {
    setPrice(amount)
    setLeader(who)
    setTimeLeft((t) => Math.max(t, BID_EXTEND))
    setBids((b) => [{ id: Date.now() + Math.random(), who, amount }, ...b].slice(0, 8))
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
      const { price: current, leader: currentLeader } = live.current
      const next = currentLeader ? current + step : current
      const willing = state.rivals.filter((r) => r.name !== currentLeader && ceilings[r.name] >= next)
      if (willing.length > 0) {
        const rival = pick(willing)
        if (chance(0.35 + rival.aggression * 0.45)) placeBid(rival.name, next)
      }
    }, 900)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ceilings])

  useEffect(() => {
    if (timeLeft > 0 || ended.current) return
    ended.current = true
    const winner = leader ?? state.rivals[0]?.name ?? 'Никто'
    dispatch({ type: 'AUCTION_END', lotId: lot.id, winner, price })
  }, [timeLeft, leader, price, lot.id, dispatch, state.rivals])

  const playerLeads = leader === PLAYER
  const nextBid = leader ? price + step : price

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
          <span className={cn('font-display text-lg tabular-nums', timeLeft <= 3 ? 'text-destructive' : 'text-foreground')} aria-live="polite">
            {timeLeft} с
          </span>
        </p>
        <p className="mt-2 font-display text-3xl text-magenta magenta-text tabular-nums">{formatMoney(price)}</p>
        <p className={cn('mt-1 text-xs font-semibold', playerLeads ? 'text-success' : 'text-muted-foreground')}>
          {leader ? (playerLeads ? 'Ваша ставка лидирует' : `Лидер: ${leader}`) : 'Ставок пока нет'}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-magenta transition-all duration-700" style={{ width: `${(timeLeft / START_TIME) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NeonButton
          tone="magenta"
          size="lg"
          disabled={playerLeads || timeLeft === 0 || state.money < nextBid}
          onClick={() => placeBid(PLAYER, nextBid)}
        >
          <Gavel aria-hidden />
          {formatMoney(nextBid)}
        </NeonButton>
        <NeonButton
          tone="ghost"
          size="lg"
          disabled={playerLeads || timeLeft === 0 || state.money < nextBid + step * 2}
          onClick={() => placeBid(PLAYER, nextBid + step * 2)}
        >
          +{formatMoney(step * 3)}
        </NeonButton>
      </div>
      <NeonButton tone="danger" size="sm" disabled={timeLeft === 0 || playerLeads} onClick={() => setTimeLeft(0)}>
        <Flag aria-hidden />
        Сдаться
      </NeonButton>
      <p className="text-center text-[11px] text-muted-foreground">Бюджет: {formatMoney(state.money)}</p>

      <Panel title="Лента ставок">
        {bids.length === 0 ? (
          <p className="text-xs text-muted-foreground">Тишина в зале…</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {bids.map((b, i) => (
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
