'use client'

/** Ad stub for monetization — replace with real rewarded ad SDK later. */
function handleWatchAd(onRewarded: () => void) {
  // Simulated short ad success
  onRewarded()
}


import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { ArrowLeft, Crown, FileWarning, Megaphone, Wrench, Zap } from 'lucide-react'
import { PART_ZONE, ZONE_LABELS, ZONES } from '@/lib/game/data'
import { legalizeInfo, partById, realValue, repairCost, wearInfo } from '@/lib/game/generators'
import { LIST_FEE } from '@/lib/game/reducer'
import { formatKm, formatMoney, roundTo } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { useI18n } from '@/lib/i18n'
import type { Car } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { Badge, Meter, NeonButton, Panel } from '../ui'
import { BrandLogo } from '../brand-logo'

const CarViewer = dynamic(() => import('../car3d/car-viewer'), {
  ssr: false,
  loading: () => <div className="grid aspect-[16/11] w-full place-items-center rounded-xl border border-border bg-[#07070f] text-xs text-muted-foreground">Загружаем 3D-модель…</div>,
})

export function CarWorkshop({ car, onBack }: { car: Car; onBack: () => void }) {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  const value = realValue(car, state.segmentDemand)
  const cost = car.purchasePrice + car.invested
  const [, setTick] = useState(0)
  const [counterDraft, setCounterDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const listing = state.listings[car.id]
  const offers = listing?.offers
  const saleReady = listing ? Date.now() >= listing.readyAt : false
  const saleLeftMs = listing ? Math.max(0, listing.readyAt - Date.now()) : 0
  const saleLeftSec = Math.ceil(saleLeftMs / 1000)

  const ownedParts = state.inventory.map((i) => ({ item: i, part: partById(i.partId) })).filter((p) => p.part)
  const legalizeCost = roundTo(car.baseValue * 0.08, 1000)
  const legal = legalizeInfo(state, car)
  const wear = wearInfo(car)
  const canVip = state.license >= 3 && state.vipBoostCarId === null

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />К стоянке
      </button>

      <div className="relative">
        <CarViewer car={car} night={state.phase === 'night' || state.phase === 'evening'} />
        <div className="px-1 pt-2">
          <p className="flex items-center gap-2 font-display text-xl leading-tight"><BrandLogo brand={car.brand} size={24} />{car.brand} {car.model}{(car.flightTanks ?? 0) > 0 ? ` · 🚀 баки ${car.flightTanks}/3` : car.brand === 'Тесла-Н' && car.model.includes('Роадстер') ? ' · 🚀 нужны баки' : ''}</p>
          <p className="text-xs text-muted-foreground">
            {car.year} · {formatKm(car.mileageReal)} · {car.color}
          </p>
        </div>
      </div>

      <NeonButton
        tone="neon"
        className="w-full"
        onClick={() => {
          dispatch({ type: 'START_DRIVE', carId: car.id })
          onBack()
        }}
      >
        {t('lot.testDrive')}
      </NeonButton>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border bg-card/80 p-2">
          <p className="text-muted-foreground">Вложено</p>
          <p className="font-semibold tabular-nums">{formatMoney(cost)}</p>
        </div>
        <div className="rounded-xl border border-neon/40 bg-neon/5 p-2">
          <p className="text-muted-foreground">Рынок</p>
          <p className="font-semibold text-neon tabular-nums">{formatMoney(value)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/80 p-2">
          <p className="text-muted-foreground">Тюнинг E/S/V</p>
          <p className="font-semibold tabular-nums">
            {car.tuning.engine}/{car.tuning.suspension}/{car.tuning.visual}
          </p>
        </div>
      </div>

      <Panel title={<span className="flex items-center gap-1.5"><Zap className="size-4 text-magenta" aria-hidden />Кастомизация и тюнинг</span>}>
        <div className="flex flex-col gap-2 text-xs">
          {(
            [
              ['Мотор', car.tuning.engine],
              ['Подвеска', car.tuning.suspension],
              ['Внешний вид', car.tuning.visual],
              ['Диски', car.tuning.wheels ?? 0],
              ['Коробка', car.tuning.gearbox ?? 0],
            ] as const
          ).map(([label, lvl]) => (
            <div key={label}>
              <div className="mb-0.5 flex justify-between text-muted-foreground">
                <span>{label}</span>
                <span className="tabular-nums text-foreground">{lvl}/3</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-magenta" style={{ width: `${(lvl / 3) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Ставьте детали со склада (рынок → склад → «Ставить») — поднимают тюнинг и цену на рынке.
          </p>
        </div>
      </Panel>

      <Panel title="Износ и ходовые качества">
        <Meter value={Math.round((1 - wear.wear) * 100)} label={`Состояние: ${wear.label}`} />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Макс. скорость ×{wear.speedMul.toFixed(2)} · разгон ×{wear.accelMul.toFixed(2)}
          {wear.engineDamaged ? ' · двигатель повреждён' : ''}
          {wear.suspensionDamaged ? ' · подвеска повреждена' : ''}. Ремонт мотора и подвески возвращает динамику на тест-драйве.
        </p>
      </Panel>

      {car.documentsForged && (
        <Panel className="border-destructive/50 bg-destructive/5" title={<span className="flex items-center gap-1.5"><FileWarning className="size-4 text-destructive" aria-hidden />Офис нотариуса · легализация</span>}>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Грязные документы: продажа дешевле и бьёт по репутации. Для этого транспорта нужен этап лицензии {legal.required}+, у вас
            «опыт нотариуса» {legal.experience}. {legal.allowed ? `Шанс провала ≈ ${Math.round(legal.risk * 100)}%.` : 'Вашего опыта в нотариусе не хватает, чтобы залицензировать этот транспорт.'}
          </p>
          <NeonButton tone="danger" size="sm" className="mt-2 w-full" onClick={() => dispatch({ type: 'LEGALIZE_CAR', carId: car.id })}>
            Легализовать за {formatMoney(legalizeCost)}
          </NeonButton>
        </Panel>
      )}

      <Panel title={<span className="flex items-center gap-1.5"><Wrench className="size-4 text-warn" aria-hidden />Ремонт в сервисе</span>}>
        <ul className="flex flex-col gap-2.5">
          {ZONES.filter((z) => z !== 'documents').map((zone) => {
            const defects = car.defects.filter((d) => d.zone === zone)
            const full = car.condition[zone] >= 100 && defects.length === 0
            return (
              <li key={zone} className="flex items-center gap-3">
                <div className="flex-1">
                  <Meter value={car.condition[zone]} label={ZONE_LABELS[zone]} />
                  {defects.length > 0 && <p className="mt-0.5 text-[10px] text-destructive">{defects.map((d) => d.name).join(', ')}</p>}
                </div>
                <NeonButton
                  tone="ghost"
                  size="sm"
                  disabled={full}
                  onClick={() => dispatch({ type: 'REPAIR_ZONE', carId: car.id, zone })}
                  aria-label={`Ремонт: ${ZONE_LABELS[zone]}`}
                  className="w-24 shrink-0"
                >
                  {full ? 'Идеал' : formatMoney(repairCost(car, zone))}
                </NeonButton>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title={<span className="flex items-center gap-1.5"><Zap className="size-4 text-neon" aria-hidden />Установить со склада</span>}>
        {ownedParts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Склад пуст. Купи детали на рынке — это дешевле сервиса.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ownedParts.map(({ item, part }) =>
              part ? (
                <li key={part.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {part.name} <span className="text-muted-foreground">×{item.qty}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {ZONE_LABELS[PART_ZONE[part.category]]} · {part.description}
                    </p>
                  </div>
                  <NeonButton size="sm" onClick={() => dispatch({ type: 'INSTALL_PART', carId: car.id, partId: part.id })}>
                    Ставить
                  </NeonButton>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </Panel>

      <Panel
        title={<span className="flex items-center gap-1.5"><Megaphone className="size-4 text-success" aria-hidden />Продажа</span>}
        action={
          canVip ? (
            <NeonButton
              tone="magenta"
              size="sm"
              className="max-w-[11rem] whitespace-normal text-[10px] leading-tight"
              onClick={() => handleWatchAd(() => dispatch({ type: 'VIP_BOOST', carId: car.id }))}
            >
              <Crown aria-hidden />
              Поздравить VIP (×2)
            </NeonButton>
          ) : state.vipBoostCarId === car.id ? (
            <Badge tone="magenta">VIP ×2 навара</Badge>
          ) : null
        }
      >
        {offers && listing ? (
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{t('sale.timer')}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {saleReady ? 'Готово' : `${Math.floor(saleLeftSec / 60)}:${String(saleLeftSec % 60).padStart(2, '0')}`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-neon transition-all"
                  style={{
                    width: `${Math.min(100, ((Date.now() - listing.listedAt) / Math.max(1, listing.readyAt - listing.listedAt)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Дешёвые авто уходят быстрее, премиум и спорт — дольше.
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {offers.map((o) => {
                const profit = o.amount - cost
                const walked = o.status === 'walked'
                const draft = counterDraft[o.id] ?? String(Math.round(o.amount * 1.06))
                return (
                  <li key={o.id} className={cn('rounded-lg bg-muted/50 px-2.5 py-2', walked && 'opacity-50')}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{o.name}</p>
                        <p className="text-[10px] italic text-muted-foreground">{o.mood}</p>
                        {!walked && (
                          <p className="text-[10px] text-muted-foreground">Торг: осталось попыток {o.patience ?? 0}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums">{formatMoney(o.amount)}</p>
                        <p className={cn('text-[10px] font-semibold tabular-nums', profit >= 0 ? 'text-success' : 'text-destructive')}>
                          {profit >= 0 ? '+' : ''}
                          {formatMoney(profit)}
                        </p>
                      </div>
                    </div>
                    {!walked && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <NeonButton
                          tone="success"
                          size="sm"
                          disabled={!saleReady}
                          onClick={() => dispatch({ type: 'SELL_CAR', carId: car.id, offerId: o.id })}
                        >
                          {saleReady ? 'Принять' : 'Ждём'}
                        </NeonButton>
                        <input
                          type="number"
                          className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-xs tabular-nums"
                          value={draft}
                          disabled={!saleReady}
                          onChange={(e) => setCounterDraft((d) => ({ ...d, [o.id]: e.target.value }))}
                        />
                        <NeonButton
                          tone="magenta"
                          size="sm"
                          disabled={!saleReady}
                          onClick={() =>
                            dispatch({
                              type: 'COUNTER_OFFER',
                              carId: car.id,
                              offerId: o.id,
                              amount: Number(draft) || o.amount,
                            })
                          }
                        >
                          Торг
                        </NeonButton>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Размести объявление — покупатели предложат цену. Чем лучше состояние и чище стоянка, тем выше ставки. Продажа занимает время.</p>
        )}
        <NeonButton tone="ghost" className="mt-2 w-full" onClick={() => dispatch({ type: 'LIST_CAR', carId: car.id })}>
          {offers ? 'Обновить объявление' : 'Разместить объявление'} · {formatMoney(LIST_FEE)}
        </NeonButton>
      </Panel>
    </div>
  )
}
