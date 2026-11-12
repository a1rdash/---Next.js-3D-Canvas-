import { useState } from 'react'
import { CloudFog, CloudRain, CloudSnow, Leaf, Moon, Music, Palette, Shield, Snowflake, Star, Sun, Sunrise, Sunset, Wallet, X } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { SEASON_OPTIONS, TIME_OPTIONS, WEATHER_OPTIONS, useEnv } from '@/lib/environment'
import { PHASE_LABELS, WEATHER_LABELS } from '@/lib/game/data'
import { xpForLevel } from '@/lib/game/generators'
import { formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { cn } from '@/lib/utils'

const PHASE_ICONS = { morning: Sunrise, day: Sun, evening: Sunset, night: Moon }
const SEASON_LABEL = { winter: 'Зима', spring: 'Весна', summer: 'Лето', autumn: 'Осень' } as const

type EnvTab = 'weather' | 'time' | 'season'

/** Меню «Погода / Время суток / Сезоны» вместо кнопки «День». Хронология игры идёт по реальному времени. */
function EnvMenu({ onClose }: { onClose: () => void }) {
  const env = useEnv()
  const [tab, setTab] = useState<EnvTab>('weather')
  const tabs: { id: EnvTab; label: string }[] = [
    { id: 'weather', label: 'Погода' }, { id: 'time', label: 'Время суток' }, { id: 'season', label: 'Сезоны' },
  ]
  const opts = tab === 'weather' ? WEATHER_OPTIONS : tab === 'time' ? TIME_OPTIONS : SEASON_OPTIONS
  const current = tab === 'weather' ? env.weatherMode : tab === 'time' ? env.timeMode : env.seasonMode
  const choose = (id: string) => {
    if (tab === 'weather') env.setWeatherMode(id as never)
    else if (tab === 'time') env.setTimeMode(id as never)
    else env.setSeasonMode(id as never)
  }
  return (
    <div role="dialog" aria-label="Погода, время суток и сезоны" className="absolute right-3 top-full z-30 mt-1 w-[min(22rem,calc(100%-1.5rem))] rounded-2xl border border-neon/40 bg-card/95 p-3 shadow-xl backdrop-blur neon-glow">
      <div className="flex items-center justify-between">
        <div role="tablist" className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn('min-h-9 rounded-lg px-2.5 text-[11px] font-semibold', tab === t.id ? 'bg-neon text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть меню" className="grid size-9 place-items-center rounded-full text-muted-foreground"><X className="size-4" /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <button key={o.id} type="button" onClick={() => choose(o.id)} aria-pressed={current === o.id}
            className={cn('min-h-9 rounded-full border px-3 text-xs font-semibold', current === o.id ? 'border-neon bg-neon/15 text-neon' : 'border-border bg-secondary text-muted-foreground')}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Игровое время идёт в реальном времени: утро 6–11, день 11–17, вечер 17–22, ночь 22–6. Ручной выбор меняет вид гаража и тест-драйв, но не ход экономики.
      </p>
    </div>
  )
}

export function Hud({ onOpenMusic }: { onOpenMusic: () => void }) {
  const { state } = useGame()
  const env = useEnv()
  const { theme, cycle } = useTheme()
  const [open, setOpen] = useState(false)
  const phase = env.phaseOf(state.phase)
  const weather = env.weatherOf(state.weather)
  const PhaseIcon = PHASE_ICONS[phase]
  const WeatherIcon = weather === 'rain' ? CloudRain : weather === 'fog' ? CloudFog : weather === 'snow' ? CloudSnow : null
  const xpNeed = xpForLevel(state.level)
  const weatherLabel = weather === 'snow' ? 'Снег' : WEATHER_LABELS[weather]

  return (
    <header className="relative z-20 border-b border-border bg-card/85 px-3 pb-2 pt-1.5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Wallet className="size-4 text-neon" aria-hidden />
          <span className="font-display text-lg leading-none text-neon neon-text tabular-nums" aria-label="Деньги">{formatMoney(state.money)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold tabular-nums" aria-label="Репутация">
            <Shield className={cn('size-3.5', state.reputation >= 60 ? 'text-success' : state.reputation >= 30 ? 'text-warn' : 'text-destructive')} aria-hidden />
            {state.reputation}
          </span>
          <button type="button" onClick={cycle} className="flex size-8 items-center justify-center rounded-full bg-neon/15 text-neon neon-glow"
            aria-label={`Сменить тему (сейчас: ${theme === 'neon' ? 'неон' : theme === 'dark' ? 'тёмная' : 'светлая'})`}>
            <Palette className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={onOpenMusic} className="flex size-8 items-center justify-center rounded-full bg-magenta/15 text-magenta magenta-glow" aria-label="Открыть музыкальный плеер">
            <Music className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <PhaseIcon className="size-3.5 text-warn" aria-hidden />
            День {state.day} · {PHASE_LABELS[phase]}
          </span>
          {WeatherIcon && (
            <span className="flex items-center gap-1"><WeatherIcon className="size-3.5 text-neon" aria-hidden />{weatherLabel}</span>
          )}
          <span className="ml-auto flex items-center gap-1" title={`${state.xp} / ${xpNeed} XP`}>
            <Star className="size-3.5 text-warn" aria-hidden />
            <span className="font-semibold text-foreground">Ур. {state.level}</span>
          </span>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog"
          className="flex h-8 items-center gap-1 rounded-lg border border-neon/50 bg-neon/10 px-2 text-[11px] font-semibold text-neon hover:bg-neon/20">
          {env.season === 'winter' ? <Snowflake className="size-3.5" aria-hidden /> : <Leaf className="size-3.5" aria-hidden />}
          Среда
        </button>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-neon to-magenta transition-all" style={{ width: `${(state.xp / xpNeed) * 100}%` }} />
      </div>
      <span className="sr-only">Сезон: {SEASON_LABEL[env.season]}</span>
      {open && <EnvMenu onClose={() => setOpen(false)} />}
    </header>
  )
}
