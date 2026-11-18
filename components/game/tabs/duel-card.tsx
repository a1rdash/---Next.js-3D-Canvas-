'use client'

import { Swords } from 'lucide-react'
import { useState } from 'react'
import { ZONE_LABELS, ZONES } from '@/lib/game/data'
import { formatKm, formatMoney, roundTo } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { CarArt } from '../car-art'
import { Badge, Meter, NeonButton, Panel } from '../ui'

export function DuelCard() {
  const { state, dispatch } = useGame()
  const duel = state.duel
  const [guess, setGuess] = useState(() => roundTo((duel?.car.baseValue ?? 1_000_000) * 0.5, 5000))
  if (!duel) return null
  const { car } = duel
  const max = roundTo(car.baseValue * 1.3, 5000)

  return (
    <Panel
      className="border-magenta/40"
      title={<span className="flex items-center gap-1.5"><Swords className="size-4 text-magenta" aria-hidden />Дуэль оценщиков</span>}
      action={<Badge tone="magenta">Ежедневно</Badge>}
    >
      <div className="flex gap-3">
        <CarArt bodyType={car.bodyType} brand={car.brand} model={car.model} segment={car.segment} alt={`${car.brand} ${car.model}`} />
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold">{car.brand} {car.model}</p>
          <p className="text-muted-foreground">{car.year} · {formatKm(car.mileageReal)}</p>
          <p className="mt-1 text-muted-foreground">
            Соперник: <span className="text-magenta">{duel.rival.name}</span>
          </p>
          {car.documentsForged && <p className="text-destructive">Проблемы с документами</p>}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5">
        {ZONES.map((z) => (
          <Meter key={z} value={car.condition[z]} label={ZONE_LABELS[z]} />
        ))}
      </div>

      {duel.done && duel.result ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground">Ты</p>
            <p className="font-semibold tabular-nums">{formatMoney(duel.result.player)}</p>
          </div>
          <div className="rounded-lg bg-neon/10 p-2">
            <p className="text-muted-foreground">Реально</p>
            <p className="font-semibold text-neon tabular-nums">{formatMoney(duel.result.actual)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground">Соперник</p>
            <p className="font-semibold tabular-nums">{formatMoney(duel.result.rival)}</p>
          </div>
          <p className={duel.result.won ? 'col-span-3 font-display text-success' : 'col-span-3 font-display text-destructive'}>
            {duel.result.won ? 'Победа! Ты точнее.' : 'Поражение. Завтра реванш.'}
          </p>
        </div>
      ) : (
        <>
          <label className="mt-3 block text-xs">
            <span className="flex justify-between">
              <span className="text-muted-foreground">Твоя оценка</span>
              <span className="font-semibold tabular-nums">{formatMoney(guess)}</span>
            </span>
            <input
              type="range"
              min={10_000}
              max={max}
              step={5000}
              value={Math.min(guess, max)}
              onChange={(e) => setGuess(Number(e.target.value))}
              className="mt-2 w-full accent-magenta"
            />
          </label>
          <NeonButton tone="magenta" className="mt-2 w-full" onClick={() => dispatch({ type: 'DUEL_GUESS', guess })}>
            Назвать цену
          </NeonButton>
        </>
      )}
    </Panel>
  )
}
