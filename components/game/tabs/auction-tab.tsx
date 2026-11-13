'use client'

import { useI18n } from '@/lib/i18n'
import { Gavel, Landmark, Trophy } from 'lucide-react'
import { SEGMENT_LABELS } from '@/lib/game/data'
import { formatMoney } from '@/lib/game/random'
import { PLAYER } from '@/lib/game/reducer'
import { useGame } from '@/lib/game/store'
import { CarArt } from '../car-art'
import { Badge, EmptyState, NeonButton, Panel } from '../ui'
import { LiveAuction } from './live-auction'

function BlackMarketPanel() {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  const open = (state.blackMarket?.filter((l) => l.status === 'open') ?? []).slice(0, 4)
  if (!open.length) return null
  return (
    <div className="mb-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm font-semibold text-destructive">{t('auction.black')}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Всегда ровно 4 лота на выбор. Элитные и «серые» машины дешевле рынка. Риск полиции падает с уровнем охраны гаража (сейчас {state.upgrades.security}/6), лицензией и офисом нотариуса.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {open.map((lot) => (
          <li key={lot.id} className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{lot.title}{lot.seller ? ` · ${lot.seller}` : ''}</p>
              <p className="text-[10px] text-muted-foreground">
                {lot.car.brand} {lot.car.model} · риск {Math.round(lot.risk * 100)}%
                {lot.car.documentsForged ? ' · грязные доки' : ''}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-destructive/20 px-2 py-1 text-[11px] font-semibold text-destructive"
              onClick={() => dispatch({ type: 'BUY_BLACK', lotId: lot.id })}
            >
              {lot.price.toLocaleString('ru-RU')} ₽
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AuctionTab() {
  const { state, dispatch } = useGame()
  const live = state.auctionLots.find((l) => l.status === 'live')

  if (live) return <LiveAuction lot={live} />

  return (
    <div className="flex flex-col gap-3">
      <BlackMarketPanel />
      <Panel title={<span className="flex items-center gap-1.5"><Gavel className="size-4 text-magenta" aria-hidden />Аукцион дня</span>}>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Машины без осмотра — только описание. Конкуренты-перекупы торгуются в реальном времени. Каждая ставка продлевает таймер.
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {state.rivals.map((r) => (
            <li key={r.id}>
              <Badge tone="muted">{r.name}</Badge>
            </li>
          ))}
        </ul>
      </Panel>

      {state.auctionLots.length === 0 ? (
        <EmptyState icon={<Gavel />} title="Лотов нет" text="Новые лоты появятся завтра утром." />
      ) : (
        <ul className="flex flex-col gap-2">
          {state.auctionLots.map((lot) => {
            const finished = lot.status === 'won' || lot.status === 'lost'
            return (
              <li key={lot.id}>
                <Panel className={lot.bank ? 'border-warn/40' : undefined}>
                  <div className="flex gap-3">
                    <CarArt bodyType={lot.car.bodyType} brand={lot.car.brand} model={lot.car.model} segment={lot.car.segment} alt="Неизвестный автомобиль" mystery />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone="neon">{SEGMENT_LABELS[lot.segment]}</Badge>
                        {lot.bank && (
                          <Badge tone="warn"><Landmark className="size-3" aria-hidden />Банк</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold">{lot.title}</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">{lot.hint}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {finished ? (
                      <p className="flex items-center gap-1.5 text-xs">
                        {lot.winner === PLAYER && lot.status === 'won' ? (
                          <>
                            <Trophy className="size-4 text-warn" aria-hidden />
                            <span className="font-semibold text-success">Ваш за {formatMoney(lot.finalPrice ?? 0)}</span>
                          </>
                        ) : lot.winner === PLAYER && lot.status === 'lost' ? (
                          <span className="text-destructive">Не оплачен — не хватило денег или места</span>
                        ) : lot.winner === 'Никто' ? (
                          <span className="text-muted-foreground">Не продан — ставок не было</span>
                        ) : (
                          <span className="text-muted-foreground">
                            Ушёл: {lot.winner} · {formatMoney(lot.finalPrice ?? 0)}
                          </span>
                        )}
                      </p>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground">
                          Старт <span className="font-semibold text-foreground tabular-nums">{formatMoney(lot.startPrice)}</span>
                        </span>
                        <NeonButton tone="magenta" size="sm" onClick={() => dispatch({ type: 'AUCTION_START', lotId: lot.id })}>
                          <Gavel aria-hidden />
                          Участвовать
                        </NeonButton>
                      </>
                    )}
                  </div>
                </Panel>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
