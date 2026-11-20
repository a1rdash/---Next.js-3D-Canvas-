'use client'

import { useState } from 'react'
import { FREE_LOOKS, LOOK_CATALOG, LOOK_COLOR_COST } from '@/lib/game/data'
import type { LookKind } from '@/lib/game/content'
import { formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import type { Car, CarLook } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { NeonButton, Panel } from '../ui'

const TIRE_COLORS = ['#0c0c0e', '#2a2d33', '#f2f2f2', '#d62839', '#1e6bff', '#f5c400']
const RIM_COLORS = ['#b9bdc6', '#e6ecf5', '#14161a', '#c9a24a', '#d62839', '#1e6bff', '#2b2e35']
const SEAT_COLORS = ['#7a2430', '#3a2a24', '#d9c7a3', '#14161a', '#1f4d8f', '#2f6b3a', '#e0e0e0']
const PAINT_QUICK = ['#c0182f', '#1e6bff', '#f2f4f8', '#15171c', '#ffb020', '#1fbf75', '#8a5cff', '#ff4fa3']

/** Палитра + произвольный цвет; применяется кнопкой (платно), а не при каждом движении ползунка. */
function ColorRow({ label, current, swatches, cost, onApply }: { label: string; current: string; swatches: string[]; cost: number; onApply: (hex: string) => void }) {
  const [draft, setDraft] = useState(current)
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map((c) => (
          <button key={c} type="button" aria-label={`${label}: ${c}`} onClick={() => setDraft(c)}
            className={cn('size-8 rounded-full border-2', draft.toLowerCase() === c.toLowerCase() ? 'border-neon' : 'border-border')} style={{ background: c }} />
        ))}
        <label className="grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-border text-[10px] text-muted-foreground" title="Свой цвет">
          +
          <input type="color" value={draft} onChange={(e) => setDraft(e.target.value)} className="sr-only" aria-label={`${label}: свой цвет`} />
        </label>
        <NeonButton size="sm" className="ml-auto" disabled={draft.toLowerCase() === current.toLowerCase()} onClick={() => onApply(draft)}>
          Применить · {formatMoney(cost)}
        </NeonButton>
      </div>
    </div>
  )
}

function Chips({ kind, current, onPick }: { kind: LookKind; current: string; onPick: (v: string) => void }) {
  const { state } = useGame()
  const owned = new Set([...FREE_LOOKS, ...(state.ownedLooks ?? [])])
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {LOOK_CATALOG.filter((l) => l.kind === kind).map((l) => {
        const has = owned.has(l.id)
        const on = current === l.value
        return (
          <button key={l.id} type="button" aria-pressed={on} disabled={!has} onClick={() => onPick(l.value)}
            className={cn('rounded-xl border px-2 py-1.5 text-left text-[11px] transition', on ? 'border-neon bg-neon/15 text-neon' : has ? 'border-border bg-secondary' : 'border-border/60 opacity-55')}>
            <p className="truncate font-semibold">{l.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{has ? l.hint : `🔒 в ателье · ${formatMoney(l.price)}`}</p>
          </button>
        )
      })}
    </div>
  )
}

/** Расширенная кастомизация: кастомная краска и покрытия, диски, шины и цвет шин, цвет салона. */
export function LookEditor({ car }: { car: Car }) {
  const { dispatch } = useGame()
  const look: CarLook = car.look ?? {}
  const set = (patch: Partial<CarLook>) => dispatch({ type: 'SET_LOOK', carId: car.id, patch })
  return (
    <>
      <Panel title="Кастомная покраска и покрытие">
        <ColorRow label="Цвет кузова" current={look.paint ?? '#c0182f'} swatches={PAINT_QUICK} cost={LOOK_COLOR_COST.paint} onApply={(hex) => set({ paint: hex })} />
        <p className="mb-1 mt-3 text-[11px] font-semibold text-muted-foreground">Покрытие</p>
        <Chips kind="finish" current={look.finish ?? 'gloss'} onPick={(v) => set({ finish: v })} />
        <p className="mt-2 text-[10px] text-muted-foreground">Новые покрытия, диски и шины продаются в ателье на вкладке «Рынок»; купленное применяется бесплатно.</p>
      </Panel>

      <Panel title="Колёсные диски">
        <Chips kind="wheelDesign" current={look.wheelDesign ?? ''} onPick={(v) => set({ wheelDesign: v })} />
        <div className="mt-3">
          <ColorRow label="Цвет дисков" current={look.rimColor ?? '#b9bdc6'} swatches={RIM_COLORS} cost={LOOK_COLOR_COST.rimColor} onApply={(hex) => set({ rimColor: hex })} />
        </div>
      </Panel>

      <Panel title="Шины">
        <Chips kind="tire" current={look.tire ?? 'street'} onPick={(v) => set({ tire: v })} />
        <div className="mt-3">
          <ColorRow label="Цвет шин" current={look.tireColor ?? '#0c0c0e'} swatches={TIRE_COLORS} cost={LOOK_COLOR_COST.tireColor} onApply={(hex) => set({ tireColor: hex })} />
        </div>
      </Panel>

      <Panel title="Салон">
        <ColorRow label="Цвет салона" current={look.interior ?? '#7a2430'} swatches={SEAT_COLORS} cost={LOOK_COLOR_COST.interior} onApply={(hex) => set({ interior: hex })} />
        <p className="mt-2 text-[10px] text-muted-foreground">Цвет виден через стёкла: нажмите «Салон» в ракурсах. Износ салона делает цвет тусклее.</p>
      </Panel>
    </>
  )
}
