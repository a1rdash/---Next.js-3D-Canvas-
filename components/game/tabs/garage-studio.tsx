'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { PAINT_COLORS, PAINT_COST, ZONE_LABELS, ZONES } from '@/lib/game/data'
import { partById, repairCost, wearInfo } from '@/lib/game/generators'
import { formatKm, formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import type { TabId } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { BrandLogo } from '../brand-logo'
import { Meter, NeonButton, Panel } from '../ui'
import { LookEditor } from './look-editor'

const CarViewer = dynamic(() => import('../car3d/car-viewer'), {
  ssr: false,
  loading: () => <div className="grid aspect-[16/11] w-full place-items-center rounded-xl border border-border bg-[#07070f] text-xs text-muted-foreground">Загружаем 3D-модель…</div>,
})

/** Цвета-образцы для палитры «КРАСКА» (названия понимает 3D-модель) */
const SWATCH: Record<string, string> = {
  'Чёрный': '#0b0b10', 'Белый': '#e9e6df', 'Серебристый': '#a9adb5', 'Вишнёвый': '#7a0a1e', 'Синий': '#0a4cff',
  'Асфальт': '#3b3f48', 'Баклажан': '#3b0a4a', 'Хамелеон': '#0f9d58', 'Оранжевый': '#ff6a00', 'Графит': '#2a2d33',
}

/** Отдельная вкладка «Гараж»: тюнинг, покраска и осмотр последней купленной машины на платформе. */
export function GarageStudio({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { state, dispatch } = useGame()
  // последняя купленная машина = последняя в списке стоянки (новые покупки добавляются в конец)
  const car = state.lot[state.lot.length - 1]
  const wear = useMemo(() => (car ? wearInfo(car) : null), [car])
  const stock = state.inventory.filter((i) => i.qty > 0)

  if (!car || !wear) {
    return (
      <Panel title="Гараж">
        <p className="text-sm text-muted-foreground">Здесь появится последняя купленная машина. Купите первую на вкладке «Главная».</p>
        <NeonButton className="mt-3 w-full" onClick={() => onNavigate('home')}>На главную</NeonButton>
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <CarViewer car={car} night={state.phase === 'night' || state.phase === 'evening'} />

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 backdrop-blur-sm">
        <BrandLogo brand={car.brand} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight">{car.brand} {car.model}</p>
          <p className="text-xs text-muted-foreground">{car.year} · {formatKm(car.mileageReal)} · {car.color}</p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <p>Износ</p>
          <p className="font-semibold text-foreground">{wear.label}</p>
        </div>
      </div>

      <Panel title={<span className="tracking-[0.14em] text-magenta">КРАСКА</span>} action={<span className="text-[11px] text-muted-foreground">Глянец · {formatMoney(PAINT_COST)}</span>}>
        <div role="radiogroup" aria-label="Цвет кузова" className="grid grid-cols-5 gap-2">
          {PAINT_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={car.color === c} aria-label={c}
              onClick={() => dispatch({ type: 'PAINT_CAR', carId: car.id, color: c })}
              className={cn('mx-auto size-10 rounded-full border-[3px] transition-transform active:scale-95', car.color === c ? 'border-neon neon-glow' : 'border-border')}
              style={{ background: SWATCH[c] }} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Цвет сразу виден на 3D-модели. Повторная покраска в тот же цвет бесплатна: деньги не списываются.</p>
      </Panel>

      <LookEditor car={car} />

      <Panel title="Состояние и ремонт">
        <div className="flex flex-col gap-2">
          {ZONES.filter((z) => z !== 'documents').map((z) => {
            const cost = repairCost(car, z)
            return (
              <div key={z} className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><Meter value={Math.round(car.condition[z])} label={ZONE_LABELS[z]} /></div>
                <NeonButton size="sm" tone="ghost" disabled={car.condition[z] >= 98} onClick={() => dispatch({ type: 'REPAIR_ZONE', carId: car.id, zone: z })}>
                  {car.condition[z] >= 98 ? 'ОК' : formatMoney(cost)}
                </NeonButton>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Тюнинг: двигатель {car.tuning.engine}/3 · подвеска {car.tuning.suspension}/3 · обвес {car.tuning.visual}/3 · диски {(car.tuning.wheels ?? 0)}/3 · коробка {(car.tuning.gearbox ?? 0)}/3
          {car.features?.cruise ? ' · круиз' : ''}{car.features?.autopilot ? ' · автопилот' : ''}
        </p>
      </Panel>

      <Panel title="Установить со склада">
        {stock.length === 0 ? (
          <p className="text-xs text-muted-foreground">Склад пуст. Детали продаются на вкладке «Рынок».</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stock.map((i) => {
              const part = partById(i.partId)
              if (!part) return null
              return (
                <li key={i.partId} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{part.name} <span className="text-muted-foreground">×{i.qty}</span></span>
                  <NeonButton size="sm" onClick={() => dispatch({ type: 'INSTALL_PART', carId: car.id, partId: i.partId })}>Поставить</NeonButton>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <NeonButton size="lg" className="w-full" onClick={() => dispatch({ type: 'START_DRIVE', carId: car.id })}>Тест-драйв (5 минут)</NeonButton>
    </div>
  )
}
