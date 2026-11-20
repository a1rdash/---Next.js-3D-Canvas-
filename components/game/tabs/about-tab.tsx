'use client'

import { CreditCard, Shield, ShoppingBag } from 'lucide-react'
import { DONATE_PACKS } from '@/lib/game/data'
import { useGame } from '@/lib/game/store'
import { useI18n } from '@/lib/i18n'
import { Badge, NeonButton, Panel } from '../ui'

const PACK_KEYS = ['shop.pack.start', 'shop.pack.flipper', 'shop.pack.tycoon'] as const

export function AboutTab() {
  const { state, dispatch } = useGame()
  const { t, formatDonate, formatMoney } = useI18n()

  return (
    <div className="flex flex-col gap-3 pb-2">
      <Panel title={t('about.title')}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('about.lore1')}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('about.lore2')}</p>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="size-4 text-magenta" aria-hidden />
            {t('shop.title')}
          </span>
        }
        action={<Badge tone="magenta">Google Play</Badge>}
      >
        <p className="mb-3 text-xs text-muted-foreground">{t('shop.hint')}</p>
        <div className="flex flex-col gap-2">
          {DONATE_PACKS.map((pack, i) => (
            <div
              key={pack.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-magenta/15 text-magenta">
                <CreditCard className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t(PACK_KEYS[i] ?? 'shop.pack.start')}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDonate(pack.rub)} → +{formatMoney(pack.coins)}
                </p>
              </div>
              <NeonButton size="sm" tone="magenta" onClick={() => dispatch({ type: 'BUY_DONATE', packId: pack.id })}>
                {t('shop.buy')}
              </NeonButton>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">{t('shop.stub')}</p>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <Shield className="size-4 text-neon" aria-hidden />
            {t('about.account')}
          </span>
        }
      >
        {state.authUser ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{state.authUser.name}</p>
            <p className="text-xs text-muted-foreground">{state.authUser.email}</p>
            <NeonButton tone="ghost" size="sm" onClick={() => dispatch({ type: 'GOOGLE_SIGN_OUT' })}>
              {t('about.signout')}
            </NeonButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <NeonButton tone="neon" onClick={() => dispatch({ type: 'GOOGLE_SIGN_IN' })}>
              {t('about.signin')}
            </NeonButton>
          </div>
        )}
      </Panel>

      <Panel title="Отказ от ответственности">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t('about.disclaimer')}</p>
      </Panel>
    </div>
  )
}
