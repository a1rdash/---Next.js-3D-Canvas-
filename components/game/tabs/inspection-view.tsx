'use client'

import { ArrowLeft, Ban, FileSearch, Gauge, Handshake, Search, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { SEGMENT_LABELS, SELLER_LABELS, ZONE_LABELS, ZONES } from '@/lib/game/data'
import { estimatedValue } from '@/lib/game/generators'
import { formatKm, formatMoney, roundTo } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import type { Seller } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { Badge, Meter, NeonButton, Panel } from '../ui'


/** Scan duration ms + unique progress style per zone */
const ZONE_SCAN: Record<
  string,
  { emoji: string; hint: string; color: string; ms: number; bar: string; anim: string; steps: string[] }
> = {
  engine: {
    emoji: '🔧',
    hint: 'Слушаем мотор, ищем подтёки, проверяем компрессию на слух.',
    color: 'from-orange-500/40 via-orange-600/10 to-transparent',
    ms: 4500,
    bar: 'bg-gradient-to-r from-orange-400 to-warn',
    anim: 'animate-[pulse_0.8s_ease-in-out_infinite]',
    steps: ['Прогрев…', 'Слушаем клапана…', 'Компрессия…', 'Подтёки масла…', 'Готово'],
  },
  suspension: {
    emoji: '⚙️',
    hint: 'Люфты, стуки, пыльники, равномерность резины.',
    color: 'from-violet-500/40 via-violet-700/10 to-transparent',
    ms: 4800,
    bar: 'bg-gradient-to-r from-violet-400 to-magenta',
    anim: 'animate-[bounce_1s_ease-in-out_infinite]',
    steps: ['Подъём…', 'Люфт ступиц…', 'Пыльники…', 'Амортизаторы…', 'Готово'],
  },
  body: {
    emoji: '🚗',
    hint: 'Толщиномер, стыки панелей, следы шпаклёвки и перекраса.',
    color: 'from-sky-500/40 via-sky-700/10 to-transparent',
    ms: 2000,
    bar: 'bg-gradient-to-r from-sky-400 to-neon',
    anim: 'animate-pulse',
    steps: ['Толщиномер…', 'Стыки…', 'Готово'],
  },
  interior: {
    emoji: '🪑',
    hint: 'Запах, износ руля, следы курения и заменённых подушек.',
    color: 'from-amber-500/40 via-amber-700/10 to-transparent',
    ms: 2000,
    bar: 'bg-gradient-to-r from-amber-400 to-warn',
    anim: 'animate-pulse',
    steps: ['Запах…', 'Износ…', 'Готово'],
  },
  electrics: {
    emoji: '⚡',
    hint: 'Ошибки OBD, проводка, свет, аккумулятор.',
    color: 'from-yellow-400/40 via-yellow-600/10 to-transparent',
    ms: 3000,
    bar: 'bg-gradient-to-r from-yellow-300 to-neon',
    anim: 'animate-[pulse_0.5s_linear_infinite]',
    steps: ['OBD…', 'Проводка…', 'АКБ…', 'Готово'],
  },
  documents: {
    emoji: '📄',
    hint: 'ПТС, печати, совпадение VIN, ограничения.',
    color: 'from-emerald-500/40 via-emerald-700/10 to-transparent',
    ms: 3000,
    bar: 'bg-gradient-to-r from-emerald-400 to-success',
    anim: '',
    steps: ['ПТС…', 'Печати…', 'VIN…', 'Готово'],
  },
}
const CarViewer = dynamic(() => import('../car3d/car-viewer'), {
  ssr: false,
  loading: () => <div className="grid aspect-[16/11] w-full place-items-center rounded-xl border border-border bg-[#07070f] text-xs text-muted-foreground">Загружаем 3D-модель…</div>,
})

export function InspectionView({ seller }: { seller: Seller }) {
  const { state, dispatch } = useGame()
  const viewerRef = useRef<HTMLDivElement>(null)
  const [scanZone, setScanZone] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStep, setScanStep] = useState(0)

  const { car } = seller
  const [offer, setOffer] = useState(() => roundTo(seller.askingPrice * 0.8, 1000))
  const estimate = estimatedValue(car, state.segmentDemand)
  const inspectedCount = ZONES.filter((z) => car.inspected[z]).length
  const min = roundTo(seller.askingPrice * 0.4, 1000)
  const max = seller.askingPrice
  const clampedOffer = Math.min(Math.max(offer, min), max)
  const mileageMismatch = car.mileageChecked && car.mileageReal !== car.mileageShown

  return (
    <div className="relative flex flex-col gap-3">
      <button
        type="button"
        onClick={() => dispatch({ type: 'SELECT_CLIENT', id: null })}
        className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />К очереди
      </button>

      <div className="relative" ref={viewerRef}>
        <CarViewer
          car={car}
          focus={scanZone as never}
          scanning={!!scanZone}
          night={state.phase === 'night' || state.phase === 'evening'}
        />
        <div className="px-1 pt-2">
          <p className="font-display text-xl leading-tight">{car.brand} {car.model}</p>
          <p className="text-xs text-muted-foreground">
            {car.year} · {car.color} · {SEGMENT_LABELS[car.segment]}
          </p>
        </div>
        {scanZone && ZONE_SCAN[scanZone] && (
          <div
            className="mt-2 rounded-xl border border-neon/50 bg-black/60 p-2.5"
            role="status"
            aria-live="polite"
            aria-label="Осмотр зоны"
          >
            <div className="flex items-center gap-2">
              <span className={cn('text-xl', ZONE_SCAN[scanZone].anim)} aria-hidden>
                {ZONE_SCAN[scanZone].emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xs text-neon">{ZONE_LABELS[scanZone as keyof typeof ZONE_LABELS]}</p>
                <p className="line-clamp-1 text-[10px] text-white/70">{ZONE_SCAN[scanZone].hint}</p>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-white">{Math.round(scanProgress * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className={cn('h-full rounded-full transition-[width] duration-75 ease-linear', ZONE_SCAN[scanZone].bar)} style={{ width: `${Math.round(scanProgress * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-white/60">{ZONE_SCAN[scanZone].steps[scanStep]}</p>
          </div>
        )}
      </div>

      <Panel>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-sm font-semibold">{seller.name}</p>
            <Badge tone={seller.type === 'honest' ? 'success' : seller.type === 'cunning' ? 'warn' : 'danger'} className="mt-1">
              {SELLER_LABELS[seller.type]}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">Терпение: {'●'.repeat(seller.patience)}</span>
        </div>
        <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs italic leading-relaxed">«{seller.quote}»</p>
      </Panel>

      {!car.accessGranted && (
        <Panel title="Доступ на осмотр машины">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Без доступа видна только заявленная цена продавца. Оплатите осмотр, чтобы сканировать зоны, проверять VIN и пробег и получить точную рыночную оценку.
          </p>
          <NeonButton className="mt-2 w-full" onClick={() => dispatch({ type: 'REQUEST_INSPECTION', sellerId: seller.id })}>
            Запросить доступ · {formatMoney(Math.max(2_000, Math.round((seller.askingPrice * 0.015 * (state.license >= 2 ? 0.7 : 1)) / 500) * 500))}
          </NeonButton>
        </Panel>
      )}

      <Panel title="Документы и пробег">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-muted-foreground">Пробег (одометр)</dt>
            <dd className={cn('font-semibold tabular-nums', mileageMismatch && 'text-destructive line-through')}>{formatKm(car.mileageShown)}</dd>
            {car.mileageChecked && (
              <dd className={cn('font-semibold tabular-nums', mileageMismatch ? 'text-destructive' : 'text-success')}>
                {mileageMismatch ? `Реально: ${formatKm(car.mileageReal)}` : 'Подтверждён'}
              </dd>
            )}
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-muted-foreground">VIN</dt>
            <dd className="break-all font-mono text-[11px]">{car.vin}</dd>
            {car.vinChecked && (
              <dd className={cn('font-semibold', car.documentsForged ? 'text-destructive' : 'text-success')}>
                {car.documentsForged ? 'Юридически грязный!' : 'Чист по базам'}
              </dd>
            )}
          </div>
        </dl>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NeonButton tone="ghost" size="sm" onClick={() => dispatch({ type: 'CHECK_MILEAGE', sellerId: seller.id })} disabled={car.mileageChecked}>
            <Gauge aria-hidden />
            {state.upgrades.tools < 1 ? 'Нужен OBD' : 'OBD-скан'}
          </NeonButton>
          <NeonButton tone="ghost" size="sm" onClick={() => dispatch({ type: 'CHECK_VIN', sellerId: seller.id })} disabled={car.vinChecked}>
            <FileSearch aria-hidden />
            {state.license < 1 ? 'Нужна лицензия' : 'Пробить VIN'}
          </NeonButton>
        </div>
      </Panel>

      <Panel title="Осмотр по зонам" action={<span className="text-[11px] text-muted-foreground">{inspectedCount}/6</span>}>
        <ul className="grid grid-cols-2 gap-2">
          {ZONES.map((zone) => {
            const done = car.inspected[zone]
            const found = car.defects.filter((d) => d.zone === zone && d.revealed)
            return (
              <li key={zone}>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => {
                    const cfg = ZONE_SCAN[zone]
                    if (!cfg) return
                    setScanZone(zone)
                    viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    setScanProgress(0)
                    setScanStep(0)
                    const started = Date.now()
                    const total = cfg.ms
                    const tick = window.setInterval(() => {
                      const p = Math.min(1, (Date.now() - started) / total)
                      setScanProgress(p)
                      setScanStep(Math.min(cfg.steps.length - 1, Math.floor(p * cfg.steps.length)))
                      if (p >= 1) {
                        window.clearInterval(tick)
                        dispatch({ type: 'INSPECT_ZONE', sellerId: seller.id, zone })
                        setScanZone(null)
                        setScanProgress(0)
                      }
                    }, 50)
                  }}
                  className={cn(
                    'flex h-full w-full flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors',
                    done ? 'border-border bg-muted/40' : 'border-neon/40 bg-neon/5 hover:bg-neon/10',
                  )}
                >
                  <span className="flex items-center justify-between text-xs font-semibold">
                    {ZONE_LABELS[zone]}
                    {!done && <Search className="size-3.5 text-neon" aria-hidden />}
                  </span>
                  {done ? (
                    <>
                      <Meter value={car.condition[zone]} />
                      {found.length > 0 ? (
                        <ul className="flex flex-col gap-0.5">
                          {found.map((d) => (
                            <li key={d.id} className="text-[10px] leading-tight text-destructive">
                              {d.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {zone === 'documents' && !car.vinChecked ? 'Без пробивки VIN не понять' : 'Явных дефектов нет'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Нажми, чтобы осмотреть</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title={<span className="flex items-center gap-1.5"><Handshake className="size-4 text-warn" aria-hidden />Торг</span>}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground">Просит</p>
            <p className="font-display text-base text-warn tabular-nums">{formatMoney(seller.askingPrice)}</p>
            {seller.lastCounter && <p className="text-[10px] text-muted-foreground">Встречное предложение</p>}
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground">Твоя оценка рынка</p>
            <p className="font-display text-base text-neon tabular-nums">{car.accessGranted ? `≈ ${formatMoney(estimate)}` : 'нужен доступ на осмотр'}</p>
            <p className="text-[10px] text-muted-foreground">{inspectedCount < 6 ? 'Осмотри всё для точности' : 'По найденному'}</p>
          </div>
        </div>

        <label className="mt-3 block text-xs">
          <span className="flex justify-between">
            <span className="text-muted-foreground">Твоё предложение</span>
            <span className="font-semibold tabular-nums">{formatMoney(clampedOffer)}</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={1000}
            value={clampedOffer}
            onChange={(e) => setOffer(Number(e.target.value))}
            className="mt-2 w-full accent-neon"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <NeonButton onClick={() => dispatch({ type: 'MAKE_OFFER', sellerId: seller.id, amount: clampedOffer })}>Предложить</NeonButton>
          <NeonButton tone="warn" onClick={() => dispatch({ type: 'ACCEPT_ASK', sellerId: seller.id })} disabled={state.money < seller.askingPrice}>
            Купить сразу
          </NeonButton>
          <NeonButton tone="ghost" size="sm" onClick={() => dispatch({ type: 'DISMISS_CLIENT', sellerId: seller.id })}>
            <X aria-hidden />
            Отказать
          </NeonButton>
          <NeonButton tone="danger" size="sm" onClick={() => dispatch({ type: 'DISMISS_CLIENT', sellerId: seller.id, blacklist: true })}>
            <Ban aria-hidden />В чёрный список
          </NeonButton>
        </div>
      </Panel>

    </div>
  )
}
