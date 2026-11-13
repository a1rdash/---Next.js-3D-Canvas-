'use client'

import { Award, BadgeCheck, Lock, Shield, Sparkles, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ACHIEVEMENTS,
  DIFFICULTY_DEFS,
  EXAM_FEES,
  LICENSE_LEVELS,
  RANK_TITLES,
  TIER_LABELS,
} from '@/lib/game/data'
import { THEMES, useTheme } from '@/lib/theme'
import { GRAPHICS, useSettings, type GraphicsLevel } from '@/lib/settings'
import { getSynth } from '@/lib/game/audio'
import { xpForLevel } from '@/lib/game/generators'
import { formatMoney } from '@/lib/game/random'
import { PROTECTION_COST } from '@/lib/game/reducer'
import { useGame } from '@/lib/game/store'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge, NeonButton, Panel } from '../ui'
import { NotaryExam } from './notary-exam'

function rankTitle(level: number) {
  const i = Math.min(RANK_TITLES.length - 1, Math.max(0, Math.floor((level - 1) / 2)))
  return RANK_TITLES[i]
}

export function ProfileTab() {
  const { state, dispatch } = useGame()
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  const settings = useSettings()
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'in' | 'out' | 'donate'>('all')
  // значение читаем после монтирования: на сервере localStorage нет, иначе hydration mismatch
  const [musicOn, setMusicOn] = useState(true)
  useEffect(() => {
    setMusicOn(localStorage.getItem('avto-notarius-music') !== 'off')
  }, [])

  const needXp = xpForLevel(state.level)
  const xpPct = Math.min(100, Math.round((state.xp / needXp) * 100))
  const licenseInfo = LICENSE_LEVELS[Math.min(state.license, LICENSE_LEVELS.length - 1)]
  const unlocked = useMemo(() => new Set(state.achievements), [state.achievements])

  const ledgerItems = (state.ledger ?? []).filter((tx) => {
    if (ledgerFilter === 'in') return tx.amount > 0 && tx.category !== 'donate'
    if (ledgerFilter === 'out') return tx.amount < 0
    if (ledgerFilter === 'donate') return tx.category === 'donate'
    return true
  })

  return (
    <div className="flex flex-col gap-3 pb-2">
      <Panel title={t('difficulty.title')}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DIFFICULTY_DEFS) as (keyof typeof DIFFICULTY_DEFS)[]).map((id, i, all) => {
            const prev = i > 0 ? all[i - 1] : null
            const locked = !!prev && !(state.completedDifficulties ?? []).includes(prev) && state.difficulty !== id
            return (
              <button
                key={id}
                type="button"
                aria-disabled={locked}
                disabled={locked}
                onClick={() => dispatch({ type: 'SET_DIFFICULTY', id })}
                className={cn(
                  'min-h-9 rounded-full px-3 py-1 text-[11px] font-semibold',
                  state.difficulty === id ? 'bg-neon text-primary-foreground' : locked ? 'bg-muted/50 text-muted-foreground/60' : 'bg-muted text-muted-foreground',
                )}
              >
                {locked ? '🔒 ' : (state.completedDifficulties ?? []).includes(id) ? '✓ ' : ''}{t(`difficulty.${id}`)}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Режимы открываются по порядку: пройдите текущий (цель по суммарной прибыли), чтобы открыть следующий. Выше сложность — «убитее» и дороже машины у ворот.
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {t('profile.streak', { n: state.daily?.streak ?? 0 })}
        </p>
      </Panel>

      <Panel title={t('settings.title')}>
        <div className="flex flex-col gap-3">
          <p className="text-[10px] text-muted-foreground">Валюта: российские рубли (₽)</p>
          <label className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm">
            <span>
              {t('settings.music')}
              <span className="block text-[11px] text-muted-foreground">{t('settings.musicHint')}</span>
            </span>
            <input
              type="checkbox"
              className="size-5 accent-neon"
              checked={musicOn}
              onChange={(e) => {
                const on = e.target.checked
                setMusicOn(on)
                localStorage.setItem('avto-notarius-music', on ? 'on' : 'off')
                window.dispatchEvent(new CustomEvent('avto-music-toggle', { detail: on }))
                if (!on) getSynth().stop()
              }}
            />
          </label>
          <NeonButton
            tone="danger"
            className="w-full"
            onClick={() => {
              if (!window.confirm(t('settings.resetConfirm'))) return
              try {
                const keys = Object.keys(localStorage)
                for (const k of keys) {
                  if (k.startsWith('avto-notarius') || k.includes('avto-notarius')) {
                    localStorage.removeItem(k)
                  }
                }
                localStorage.removeItem('avto-notarius-save-v1')
                localStorage.removeItem('avto-notarius-locale')
                localStorage.removeItem('avto-notarius-music')
              } catch {
                /* ignore */
              }
              dispatch({ type: 'NEW_GAME' })
              window.location.reload()
            }}
          >
            {t('settings.reset')}
          </NeonButton>
        </div>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-neon" aria-hidden />
            {rankTitle(state.level)}
          </span>
        }
      >
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-2xl text-neon">{t('profile.level', { n: state.level })}</p>
            <p className="text-[11px] text-muted-foreground">
              XP {state.xp} / {needXp}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="flex items-center justify-end gap-1 font-semibold">
              <Shield className="size-3.5 text-warn" aria-hidden />
              {state.reputation}
            </p>
            <p className="text-muted-foreground">{t('profile.reputation')}</p>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-neon to-magenta" style={{ width: `${xpPct}%` }} />
        </div>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <BadgeCheck className="size-4 text-magenta" aria-hidden />
            {t('profile.license')}
          </span>
        }
      >
        <p className="text-sm font-semibold">{licenseInfo?.title ?? '—'}</p>
        <p className="text-[11px] text-muted-foreground">{licenseInfo?.perk}</p>
        <ol className="mt-2 flex flex-col gap-1" aria-label="Этапы лицензии">
          {LICENSE_LEVELS.map((lv, i) => {
            const done = state.license >= i
            const next = state.license + 1 === i
            return (
              <li key={lv.title} className={cn('flex items-center gap-2 rounded-lg px-2 py-1 text-[11px]', done ? 'bg-neon/10 text-foreground' : next ? 'border border-magenta/40 text-foreground' : 'opacity-50')}>
                <span className={cn('grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold', done ? 'bg-neon text-primary-foreground' : 'bg-muted')}>{i}</span>
                <span className="min-w-0 flex-1 truncate">{lv.title}</span>
                {i > 0 && <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney(EXAM_FEES[i - 1])}</span>}
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t('profile.licenseHint')} Чем выше этап, тем надёжнее легализация дорогих машин; для гиперкаров нужен этап 4+.
        </p>
        <NotaryExam />
      </Panel>

      <Panel title="Настройки">
        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Графика</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Уровень графики">
          {(Object.keys(GRAPHICS) as GraphicsLevel[]).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={settings.graphics === g}
              onClick={() => settings.setGraphics(g)}
              className={cn(
                'min-h-11 rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-all',
                settings.graphics === g ? 'border-neon bg-neon/15 text-neon neon-glow' : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {GRAPHICS[g].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{GRAPHICS[settings.graphics].hint}. Применяется сразу к 3D-фонам, гаражу и новому тест-драйву.</p>
        <NeonButton size="sm" tone="ghost" className="mt-3 w-full" onClick={settings.openTutorial}>Показать обучение снова</NeonButton>
      </Panel>

      <Panel title="Тема оформления">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Тема оформления">
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              role="radio"
              aria-checked={theme === th.id}
              onClick={() => setTheme(th.id)}
              className={cn(
                'rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-all',
                theme === th.id ? 'border-neon bg-neon/15 text-neon neon-glow' : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {th.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{THEMES.find((x) => x.id === theme)?.hint}</p>
      </Panel>

      <Panel title="Крыша района">
        <p className="mb-2 text-[11px] text-muted-foreground">
          Улучшения гаража и охраны — во вкладке «Рынок». Здесь можно оплатить «крышу» на 3 дня.
        </p>
        <NeonButton
          tone="warn"
          className="w-full"
          disabled={state.money < PROTECTION_COST}
          onClick={() => dispatch({ type: 'BUY_PROTECTION' })}
        >
          {t('profile.protection', { price: formatMoney(PROTECTION_COST) })}
          {state.protectionDays > 0 ? ` (${state.protectionDays}д)` : ''}
        </NeonButton>
      </Panel>

      {state.blacklist.length > 0 && (
        <Panel title={t('profile.blacklist')}>
          <ul className="flex flex-col gap-1">
            {state.blacklist.map((name) => (
              <li key={name} className="flex items-center justify-between text-xs">
                <span>{name}</span>
                <NeonButton size="sm" tone="ghost" onClick={() => dispatch({ type: 'UNBLACKLIST', name })}>
                  {t('profile.remove')}
                </NeonButton>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <Trophy className="size-4 text-warn" aria-hidden />
            {t('profile.achievements')}
          </span>
        }
        action={<Badge tone="muted">{unlocked.size}/{ACHIEVEMENTS.length}</Badge>}
      >
        <ul className="flex flex-col gap-1.5">
          {ACHIEVEMENTS.map((a) => {
            const ok = unlocked.has(a.id)
            return (
              <li key={a.id} className={cn('flex gap-2 rounded-lg px-2 py-1.5 text-xs', ok ? 'bg-neon/10' : 'opacity-60')}>
                {ok ? (
                  <Award className="mt-0.5 size-4 shrink-0 text-neon" aria-hidden />
                ) : (
                  <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground">{a.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('font-display text-[11px] tabular-nums', ok ? 'text-success' : 'text-warn')}>{ok ? '✓ ' : '+'}{formatMoney(a.reward)}</p>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{TIER_LABELS[a.tier]}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title={t('ledger.title')} action={<Badge tone="muted">{state.ledger?.length ?? 0}</Badge>}>
        <div className="mb-2 flex flex-wrap gap-1">
          {(
            [
              ['all', 'ledger.all'],
              ['in', 'ledger.in'],
              ['out', 'ledger.out'],
              ['donate', 'ledger.donate'],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLedgerFilter(id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                ledgerFilter === id ? 'bg-neon text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto scrollbar-none">
          {ledgerItems.slice(0, 80).map((tx) => {
            const tone =
              tx.category === 'donate' ? 'text-sky-400' : tx.amount >= 0 ? 'text-success' : 'text-destructive'
            return (
              <li key={tx.id} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-tight">{tx.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('profile.dayCat', { day: tx.day, cat: tx.category })}
                  </p>
                </div>
                <span className={cn('shrink-0 text-xs font-bold tabular-nums', tone)}>
                  {tx.amount >= 0 ? '+' : ''}
                  {formatMoney(tx.amount)}
                </span>
              </li>
            )
          })}
          {ledgerItems.length === 0 && (
            <li className="text-xs text-muted-foreground">{t('ledger.empty')}</li>
          )}
        </ul>
        {(state.donateHistory?.length ?? 0) > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            <p className="mb-1 text-[11px] font-semibold text-sky-400">{t('ledger.donates')}</p>
            <ul className="flex flex-col gap-1">
              {state.donateHistory.slice(0, 20).map((tx) => (
                <li key={tx.id} className="flex justify-between text-[11px]">
                  <span className="truncate text-muted-foreground">{tx.label}</span>
                  <span className="font-semibold tabular-nums text-sky-400">+{formatMoney(tx.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

    </div>
  )
}
