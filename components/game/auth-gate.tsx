'use client'

import { useGame } from '@/lib/game/store'
import { useI18n } from '@/lib/i18n'
import { NeonButton } from './ui'

export function AuthGate({ onSkip }: { onSkip: () => void }) {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  if (state.authUser) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <p className="font-display text-lg text-neon">{t('auth.title')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.hint')}</p>
        <div className="mt-4 flex flex-col gap-2">
          <NeonButton
            tone="neon"
            className="w-full"
            onClick={() => {
              dispatch({ type: 'GOOGLE_SIGN_IN' })
              onSkip()
            }}
          >
            {t('auth.google')}
          </NeonButton>
          <NeonButton tone="ghost" className="w-full" onClick={onSkip}>
            {t('auth.guest')}
          </NeonButton>
        </div>
      </div>
    </div>
  )
}
