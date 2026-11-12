'use client'

import { useI18n } from '@/lib/i18n'

import { useEffect, useState } from 'react'
import { DAILY_REWARDS } from '@/lib/game/data'
import { useGame } from '@/lib/game/store'
import { NeonButton, Panel } from './ui'

export function DailyRewardModal() {
  const { state, dispatch } = useGame()
  const { t, formatMoney } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const claimed = state.daily?.lastClaimDay === today
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!claimed) setOpen(true)
  }, [claimed])

  if (!open || claimed) return null

  const nextStreak = (() => {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    return state.daily?.lastClaimDay === y ? state.daily.streak + 1 : 1
  })()
  const reward = DAILY_REWARDS[Math.min(DAILY_REWARDS.length - 1, nextStreak - 1)]

  return (
    <div className="absolute inset-0 z-[55] flex items-end justify-center bg-background/70 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
      <Panel className="w-full max-w-md border-neon/40" title={t('daily.title')}>
        <p className="text-xs text-muted-foreground">{t('daily.streak', { n: nextStreak })}</p>
        <p className="mt-2 font-display text-lg text-neon">
          {formatMoney(reward.coins)} · {reward.label}
        </p>
        <div className="mt-3 flex gap-2">
          <NeonButton
            className="flex-1"
            tone="neon"
            onClick={() => {
              dispatch({ type: 'CLAIM_DAILY' })
              setOpen(false)
            }}
          >
            Забрать
          </NeonButton>
          <NeonButton className="flex-1" tone="ghost" onClick={() => setOpen(false)}>
            Позже
          </NeonButton>
        </div>
      </Panel>
    </div>
  )
}
