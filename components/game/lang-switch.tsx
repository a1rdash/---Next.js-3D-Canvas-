'use client'

import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, locales, labels, t } = useI18n()
  return (
    <div className={cn('flex items-center gap-1', compact ? '' : 'flex-col items-stretch gap-2')}>
      {!compact && <p className="text-[11px] text-muted-foreground">{t('settings.language')}</p>}
      <div className="flex gap-1">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors',
              locale === l ? 'bg-neon text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={locale === l}
          >
            {labels[l]}
          </button>
        ))}
      </div>
    </div>
  )
}
