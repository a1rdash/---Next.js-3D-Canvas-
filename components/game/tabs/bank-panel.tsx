'use client'

import { Landmark, Lock } from 'lucide-react'
import { LOAN_TIERS } from '@/lib/game/data'
import { formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { cn } from '@/lib/utils'
import { Badge, NeonButton, Panel } from '../ui'

/** Банк: базовые займы 100 / 300 / 500 тыс. ₽; на максимальной сложности «Легенда» — 1 / 1,5 / 2 млн ₽. */
export function BankPanel() {
  const { state, dispatch } = useGame()
  const loan = state.loan
  const eliteOpen = state.difficulty === 'legend'
  const leftMs = loan ? loan.dueAt - Date.now() : 0
  const leftDays = Math.max(0, Math.ceil(leftMs / 86_400_000))
  return (
    <Panel
      title={<span className="flex items-center gap-1.5"><Landmark className="size-4 text-neon" aria-hidden />Банк</span>}
      action={<Badge tone={eliteOpen ? 'magenta' : 'muted'}>{eliteOpen ? 'Элитные кредиты открыты' : 'Элитные — на «Легенде»'}</Badge>}
    >
      {loan ? (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs">
          <p className="font-semibold">Активный кредит {formatMoney(loan.amount)}</p>
          <p className="mt-1 text-muted-foreground">К возврату {formatMoney(loan.owed)} · {leftMs > 0 ? `осталось ${leftDays} дн.` : 'просрочен: растёт пеня 1% в день'}</p>
          <NeonButton className="mt-2 w-full" tone="success" disabled={state.money < loan.owed} onClick={() => dispatch({ type: 'REPAY_LOAN' })}>
            Погасить {formatMoney(loan.owed)}
          </NeonButton>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {LOAN_TIERS.map((t) => {
            const locked = t.elite && !eliteOpen
            const owed = Math.round(t.amount * (1 + (t.rate * t.days) / 7))
            return (
              <li key={t.amount} className={cn('flex items-center gap-2 rounded-xl border p-2 text-xs', locked ? 'border-border opacity-60' : 'border-neon/30 bg-neon/5')}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">{formatMoney(t.amount)}{t.elite ? ' · элитный' : ''}</p>
                  <p className="text-[11px] text-muted-foreground">{(t.rate * 100).toFixed(1).replace('.0', '')}% за 7 дней · {t.days} дн. · вернуть {formatMoney(owed)}</p>
                </div>
                <NeonButton size="sm" disabled={locked} onClick={() => dispatch({ type: 'TAKE_LOAN', amount: t.amount })} aria-label={`Взять кредит ${t.amount}`}>
                  {locked ? <Lock className="size-3.5" aria-hidden /> : 'Взять'}
                </NeonButton>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">Один активный кредит. Срок идёт по реальному времени; просрочка снижает репутацию.</p>
    </Panel>
  )
}
