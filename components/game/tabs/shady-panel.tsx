'use client'

import { MoonStar, ShieldCheck } from 'lucide-react'
import { formatMoney } from '@/lib/game/random'
import { PROTECTION_COST } from '@/lib/game/reducer'
import { useGame } from '@/lib/game/store'
import { Badge, NeonButton, Panel } from '../ui'

export function ShadyPanel() {
  const { state, dispatch } = useGame()
  return (
    <Panel
      className="border-destructive/40 bg-destructive/5"
      title={<span className="flex items-center gap-1.5"><MoonStar className="size-4 text-destructive" aria-hidden />Теневые заказы</span>}
      action={
        state.protectionDays > 0 ? (
          <Badge tone="success"><ShieldCheck className="size-3" aria-hidden />Крыша {state.protectionDays} дн.</Badge>
        ) : (
          <NeonButton tone="ghost" size="sm" onClick={() => dispatch({ type: 'BUY_PROTECTION' })}>
            Крыша {formatMoney(PROTECTION_COST)}
          </NeonButton>
        )
      }
    >
      <ul className="flex flex-col gap-2">
        {state.shadyJobs.map((job) => {
          const risk = Math.round((state.protectionDays > 0 ? job.risk * 0.5 : job.risk) * 100)
          return (
            <li key={job.id} className="rounded-xl border border-border bg-background/60 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{job.title}</p>
                  <p className="text-[11px] text-muted-foreground">от: {job.giver}</p>
                </div>
                <span className="font-display text-sm text-success tabular-nums">+{formatMoney(job.reward)}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{job.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="danger">Риск {risk}%</Badge>
                <Badge tone="warn">Штраф {formatMoney(job.fine)}</Badge>
                <Badge tone="muted">Репутация −{job.repLoss}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NeonButton tone="danger" size="sm" onClick={() => dispatch({ type: 'ACCEPT_SHADY', jobId: job.id })}>
                  Взяться
                </NeonButton>
                <NeonButton tone="ghost" size="sm" onClick={() => dispatch({ type: 'DECLINE_SHADY', jobId: job.id })}>
                  Отказаться (+1 реп.)
                </NeonButton>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
