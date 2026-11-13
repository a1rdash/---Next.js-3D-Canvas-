'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bot, Gauge, Moon, Sun, Sunset, X } from 'lucide-react'
import { driveStats } from '@/lib/game/generators'
import { useGame } from '@/lib/game/store'
import { useSettings } from '@/lib/settings'
import type { Car } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { NeonButton } from './ui'

export type EnvPreset = { time: 'morning' | 'day' | 'evening' | 'night'; weather: 'clear' | 'rain' | 'snow' }

/** Пресеты окружения: все сочетания времени суток и погоды */
export const ENV_PRESETS: EnvPreset[] = (['morning', 'day', 'evening', 'night'] as const).flatMap((time) =>
  (['clear', 'rain', 'snow'] as const).map((weather) => ({ time, weather })),
)

export function pickEnvPreset(): EnvPreset {
  return ENV_PRESETS[Math.floor(Math.random() * ENV_PRESETS.length)]
}

/** Ровно 5 минут заезда */
const DURATION_MS = 5 * 60 * 1000

const WEATHER_LABEL = { clear: 'Ясно', rain: 'Дождь', fog: 'Туман', snow: 'Снег' } as const
const PHASE_LABEL = { morning: 'Утро', day: 'День', evening: 'Вечер', night: 'Ночь' } as const
const WEATHER_ICON = { clear: '☀️', rain: '🌧️', fog: '🌫️', snow: '❄️' } as const

export function TestDriveOverlay() {
  const { state, dispatch } = useGame()
  const car = state.lot.find((c) => c.id === state.pendingDriveCarId)
  if (!car || !state.pendingDriveCarId) return null
  return (
    <TestDriveGame
      key={car.id}
      car={car}
      onDone={(clean, score) => dispatch({ type: 'FINISH_DRIVE', carId: car.id, clean, score })}
      onSkip={() => dispatch({ type: 'SKIP_DRIVE' })}
    />
  )
}

function TestDriveGame({
  car,
  onDone,
  onSkip,
}: {
  car: Car
  onDone: (clean: boolean, score: number) => void
  onSkip: () => void
}) {
  const { state, dispatch } = useGame()
  const settings = useSettings()
  // При каждом запуске тест-драйва случайно выбираем комбинацию времени суток и погоды
  const [preset] = useState(() => pickEnvPreset())
  const startWeather = preset.weather
  const startPhase = preset.time
  const [tod, setTod] = useState<'day' | 'evening' | 'night'>(startPhase === 'night' ? 'night' : startPhase === 'evening' ? 'evening' : 'day')
  const [size, setSize] = useState({ w: 0, h: 0 })
  const stats = driveStats(car)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<{ setGas(on: boolean): void; setBrake(on: boolean): void; setSteer(d: -1 | 0 | 1): void; setTimeOfDay(p: 'day' | 'evening' | 'night'): void; toggleCruise(): void; toggleAutopilot(): void; moveLane(d: -1 | 1): void; setMuted(m: boolean): void; dispose(): void } | null>(null)
  const swipes = useRef(new Map<number, number>())
  const [showHint, setShowHint] = useState(!settings.driveHintDone)
  const finishedRef = useRef(false)
  const finishTimer = useRef<number | null>(null)
  const [hud, setHud] = useState({ speedKmh: 0, hits: 0, progress: 0, leftMs: DURATION_MS, gear: 1, throttle: 0, maxKmh: 0, light: null as 'green' | 'yellow' | 'red' | null, lightLeft: 0, event: null as string | null, siren: false, violations: 0, cruiseOn: false, autoOn: false, blink: 0, warning: null as string | null })
  const [flash, setFlash] = useState(0)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)

  // колбэки через ref, чтобы не пересоздавать 3D-сцену
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const quit = useCallback(() => {
    finishedRef.current = true
    onSkip()
  }, [onSkip])

  useEffect(() => {
    let cancelled = false
    let engine: { dispose(): void } | null = null
    ;(async () => {
      try {
        const { DriveEngine } = await import('./car3d/drive-engine')
        if (cancelled || !canvasRef.current) return
        const e = new DriveEngine({
          canvas: canvasRef.current,
          // именно выбранная машина: её кузов, цвет, тюнинг, повреждения и износ
          car: { bodyType: car.bodyType, color: car.color, tuning: car.tuning, condition: car.condition, look: car.look },
          stats,
          weather: startWeather,
          phase: startPhase,
          features: car.features,
          graphics: settings.config,
          durationMs: DURATION_MS,
          onHud: (h) => setHud(h),
          onHit: () => setFlash((n) => n + 1),
          onFine: (amount, reason) => dispatch({ type: 'DRIVE_FINE', amount, reason }),
          onEnd: (_elapsed, hits, distanceM, violations) => {
            if (finishedRef.current) return
            finishedRef.current = true
            // очки за пройденную дистанцию: стоять на месте не выгодно, а изношенная машина проезжает меньше
            const distScore = Math.min(100, Math.round(distanceM / 75))
            const score = Math.max(0, Math.round((distScore - hits * 8 - violations * 6) * stats.handling * (1 + car.tuning.engine * 0.06)))
            const clean = hits === 0 && violations === 0 && distanceM >= 1200
            // даём насладиться финишем секунду
            finishTimer.current = window.setTimeout(() => {
              finishTimer.current = null
              doneRef.current(clean, score)
            }, 900)
          },
        })
        engine = e
        engineRef.current = e
        setReady(true)
      } catch (err) {
        console.error('3D test drive failed', err)
        setError(true)
      }
    })()
    return () => {
      cancelled = true
      engine?.dispose()
      engineRef.current = null
    }
    // сцена создаётся один раз на заезд
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // отложенный финиш не должен срабатывать после закрытия заезда
  useEffect(
    () => () => {
      if (finishTimer.current !== null) window.clearTimeout(finishTimer.current)
      finishTimer.current = null
    },
    [],
  )

  // Интерфейс тест-драйва строго горизонтальный: при вертикальном экране поворачиваем его на 90°
  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    so?.lock?.('landscape').catch(() => {})
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      screen.orientation?.unlock?.()
    }
  }, [])

  /* --- управление с клавиатуры: каждая клавиша учитывается независимо, поэтому газ и поворот работают одновременно --- */
  useEffect(() => {
    const held = new Set<string>()
    const apply = () => {
      const e = engineRef.current
      if (!e) return
      const has = (...ks: string[]) => ks.some((k) => held.has(k))
      e.setGas(has('arrowup', 'w'))
      e.setBrake(has('arrowdown', 's', ' '))
      const l = has('arrowleft', 'a')
      const r = has('arrowright', 'd')
      e.setSteer(l === r ? 0 : l ? -1 : 1) // обе нажаты — едем прямо
      if (has('arrowup', 'w')) dismissHint()
    }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (e.key === 'Escape') return quit()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault()
        held.add(k)
        apply()
      }
    }
    const up = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase())
      apply()
    }
    // при потере фокуса отпускаем все кнопки, чтобы газ не «залипал»
    const release = () => {
      held.clear()
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quit])

  // подсказка для новичков скрывается сама через несколько секунд
  const dismissHint = useCallback(() => {
    setShowHint((v) => {
      if (v) settings.markDriveHintDone()
      return false
    })
  }, [settings])
  useEffect(() => {
    if (!showHint) return
    const t = window.setTimeout(dismissHint, 14000)
    return () => window.clearTimeout(t)
  }, [showHint, dismissHint])

  const mm = Math.floor(hud.leftMs / 60000)
  const ss = Math.floor((hud.leftMs % 60000) / 1000)
  const portrait = size.h > size.w
  // в портретной ориентации раскладка поворачивается: ширина = высота экрана
  const frame: React.CSSProperties = portrait
    ? { position: 'fixed', top: 0, left: 0, width: size.h, height: size.w, transformOrigin: 'top left', transform: `translateX(${size.w}px) rotate(90deg)` }
    : { position: 'fixed', inset: 0 }
  // Безопасные зоны (статус-бар, вырез): при повороте на 90° стороны экрана меняются местами
  const insets = (portrait
    ? { '--sa-t': 'env(safe-area-inset-right)', '--sa-r': 'env(safe-area-inset-bottom)', '--sa-b': 'env(safe-area-inset-left)', '--sa-l': 'env(safe-area-inset-top)' }
    : { '--sa-t': 'env(safe-area-inset-top)', '--sa-r': 'env(safe-area-inset-right)', '--sa-b': 'env(safe-area-inset-bottom)', '--sa-l': 'env(safe-area-inset-left)' }) as React.CSSProperties
  const px = (e: { clientX: number; clientY: number }) => (portrait ? e.clientY : e.clientX)
  // мягкие округлые полупрозрачные кнопки
  const soft = 'grid place-items-center rounded-full border border-white/25 bg-white/15 text-white/90 opacity-60 shadow-lg backdrop-blur-md transition select-none'
  const todBtn = (id: 'day' | 'evening' | 'night', Icon: typeof Sun, label: string) => (
    <button key={id} type="button" aria-label={label} aria-pressed={tod === id}
      onClick={() => { setTod(id); engineRef.current?.setTimeOfDay(id) }}
      className={cn('grid size-9 place-items-center rounded-full text-white/90 transition', tod === id ? 'bg-white/35' : 'opacity-60')}>
      <Icon className="size-4" />
    </button>
  )

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <div style={{ ...frame, ...insets }} className="touch-none select-none overflow-hidden bg-[#05060d]"
        // свайп по холсту (не по кнопкам): отслеживаем каждый палец по pointerId, чтобы касания кнопок не мешали
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-control]')) return
          swipes.current.set(e.pointerId, px(e))
        }}
        onPointerUp={(e) => {
          const x0 = swipes.current.get(e.pointerId)
          if (x0 == null) return
          swipes.current.delete(e.pointerId)
          const dx = px(e) - x0
          if (Math.abs(dx) > 40) engineRef.current?.moveLane(dx > 0 ? 1 : -1)
        }}
        onPointerCancel={(e) => swipes.current.delete(e.pointerId)}>
        {!error && <canvas ref={canvasRef} className="block h-full w-full" aria-label="3D тест-драйв" />}
        {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-xs text-white/70">Не удалось запустить 3D (WebGL недоступен). Закройте окно и попробуйте другой браузер.</div>}
        {!ready && !error && <div className="absolute inset-0 grid place-items-center text-xs text-white/70">Загрузка трассы…</div>}
        {flash > 0 && (
          <div key={flash} className="pointer-events-none absolute inset-0 animate-[hit-flash_0.6s_ease-out_forwards]" aria-hidden
            style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(244,63,94,0.55) 100%)' }} />
        )}

        {/* верх: выход · время суток · поворотники · статистика (компактно, ниже строки состояния) */}
        <div data-control className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 pb-1 pl-[max(0.6rem,var(--sa-l))] pr-[max(0.6rem,var(--sa-r))] pt-[max(0.35rem,var(--sa-t))]">
          <button type="button" onClick={quit} aria-label="Выход из тест-драйва" className={cn(soft, 'size-10')}><X className="size-5" /></button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full border border-white/20 bg-black/25 p-0.5 backdrop-blur-md" role="group" aria-label="Время суток">
              {todBtn('day', Sun, 'День')}
              {todBtn('evening', Sunset, 'Вечер')}
              {todBtn('night', Moon, 'Ночь')}
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 backdrop-blur-md" aria-label="Поворотники">
              <ArrowLeft className={cn('size-5 transition', hud.blink === -1 ? 'text-amber-400 drop-shadow-[0_0_6px_#fbbf24]' : 'text-white/25')} />
              <ArrowRight className={cn('size-5 transition', hud.blink === 1 ? 'text-amber-400 drop-shadow-[0_0_6px_#fbbf24]' : 'text-white/25')} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-black/25 px-3 py-1 text-right backdrop-blur-md">
            <p className="font-display text-base leading-none tabular-nums text-white">{mm}:{String(ss).padStart(2, '0')}</p>
            <p className={cn('text-[10px] tabular-nums', hud.hits + hud.violations > 0 ? 'text-rose-300' : 'text-emerald-300')}>нарушения {hud.hits + hud.violations}</p>
          </div>
        </div>

        {hud.warning && (
          <div role="alert" className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border border-rose-300/40 bg-rose-600/80 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
            style={{ top: 'calc(max(0.35rem, var(--sa-t)) + 3.4rem)' }}>
            ⚠ {hud.warning}
          </div>
        )}

        {/* спидометр (внутри рабочей зоны, выше нижней безопасной границы) */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-2xl border border-white/15 bg-black/25 px-5 py-1 text-center backdrop-blur-md"
          style={{ bottom: 'max(0.5rem, var(--sa-b))' }}>
          <p className="font-display text-3xl leading-none tabular-nums text-white">{hud.speedKmh}</p>
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">км/ч</p>
        </div>

        {/* подсказка новичкам: показывается только в первом заезде */}
        {showHint && (
          <>
            <div className="pointer-events-none absolute max-w-[40%] rounded-xl bg-black/65 px-3 py-2 text-[11px] leading-snug text-white" style={{ left: 'max(0.6rem, var(--sa-l))', bottom: 'calc(max(0.5rem, var(--sa-b)) + 4.6rem)' }}>
              <b className="text-cyan-300">Повороты:</b> держите ◀ ▶. Можно вместе с газом: нажимайте двумя пальцами.
            </div>
            <div className="pointer-events-none absolute max-w-[40%] rounded-xl bg-black/65 px-3 py-2 text-[11px] leading-snug text-white" style={{ right: 'max(0.6rem, var(--sa-r))', bottom: 'calc(max(0.5rem, var(--sa-b)) + 5.4rem)' }}>
              <b className="text-emerald-300">ГАЗ:</b> удерживайте, чтобы разгоняться. Отпустили: машина катится и замедляется. <b className="text-rose-300">СТОП</b> — тормоз.
            </div>
          </>
        )}

        {/* управление: слева — повороты, справа — тормоз/газ. Каждая кнопка независима (мультитач), удержание = действие */}
        <div className="absolute flex items-end gap-3" style={{ left: 'max(0.6rem, var(--sa-l))', bottom: 'max(0.5rem, var(--sa-b))' }}>
          <HoldButton label="Влево (поворотник)" className={cn(soft, 'size-14')} onHold={(on) => engineRef.current?.setSteer(on ? -1 : 0)}><ArrowLeft className="size-6" /></HoldButton>
          <HoldButton label="Вправо (поворотник)" className={cn(soft, 'size-14')} onHold={(on) => engineRef.current?.setSteer(on ? 1 : 0)}><ArrowRight className="size-6" /></HoldButton>
        </div>
        <div className="absolute flex items-end gap-3" style={{ right: 'max(0.6rem, var(--sa-r))', bottom: 'max(0.5rem, var(--sa-b))' }}>
          {(car.features?.cruise || car.features?.autopilot) && (
            <div data-control className="mb-1 flex flex-col gap-2">
              {car.features?.cruise && (
                <button type="button" aria-label="Круиз-контроль" aria-pressed={hud.cruiseOn} onClick={() => engineRef.current?.toggleCruise()} className={cn(soft, 'size-10', hud.cruiseOn && '!bg-cyan-400/40 !opacity-90')}><Gauge className="size-5" /></button>
              )}
              {car.features?.autopilot && (
                <button type="button" aria-label="Автопилот" aria-pressed={hud.autoOn} onClick={() => engineRef.current?.toggleAutopilot()} className={cn(soft, 'size-10', hud.autoOn && '!bg-fuchsia-400/40 !opacity-90')}><Bot className="size-5" /></button>
              )}
            </div>
          )}
          <HoldButton label="Тормоз (держать)" className={cn(soft, 'size-14 !bg-rose-500/30 text-[11px] font-bold')} onHold={(on) => engineRef.current?.setBrake(on)}>СТОП</HoldButton>
          <HoldButton label="Газ (держать)" className={cn(soft, 'size-[4.5rem] !bg-emerald-400/30 text-sm font-bold')} onHold={(on) => { engineRef.current?.setGas(on); if (on) dismissHint() }}>ГАЗ</HoldButton>
        </div>
      </div>
    </div>
  )
}

/**
 * Кнопка «пока держу»: pointer capture привязывает касание к кнопке, поэтому несколько кнопок работают
 * одновременно (мультитач) и касание одной не перехватывает события другой. Сброс при отпускании/отмене/потере захвата.
 */
function HoldButton({ onHold, label, className, children }: { onHold: (on: boolean) => void; label: string; className?: string; children: React.ReactNode }) {
  const [pressed, setPressed] = useState(false)
  const active = useRef(false)
  const set = (on: boolean) => {
    if (active.current === on) return
    active.current = on
    setPressed(on)
    onHold(on)
  }
  return (
    <button
      type="button"
      data-control
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
      className={cn(className, pressed && '!opacity-100 scale-95 !bg-white/40')}
    >
      {children}
    </button>
  )
}
