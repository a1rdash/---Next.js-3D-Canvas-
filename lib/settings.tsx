'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { PaintQuality } from '@/lib/shaders/car-paint'

/* ------------------------------------------------------------------ */
/*  5. Уровни графики: Низкая / Средняя / Высокая                      */
/* ------------------------------------------------------------------ */

export type GraphicsLevel = 'low' | 'medium' | 'high'

export interface GraphicsConfig {
  label: string
  hint: string
  /** Максимальный DPI рендера (devicePixelRatio ограничивается этим значением) */
  dpr: number
  /** Нижняя граница адаптивного снижения разрешения */
  minDpr: number
  shadows: boolean
  /** Мягкие тени (PCFSoft) вместо простых */
  softShadows: boolean
  shadowMapSize: number
  /** Множитель числа частиц (дождь, снег, брызги): 0 — отключены */
  particles: number
  /** «Постобработка»: тональная коррекция ACES + свечение фонарей и фар */
  post: boolean
  antialias: boolean
  /** Шейдер автокраски: off — обычный материал, lite — лёгкий, full — полный */
  paintShader: PaintQuality
  /** Свечение (Bloom) для неоновых вывесок, фонарей и бликов */
  bloom: boolean
  /** Ограничение кадров в секунду (0 — без ограничения) */
  fps: number
}

export const GRAPHICS: Record<GraphicsLevel, GraphicsConfig> = {
  low: { label: 'Низкая', hint: 'Без теней и частиц, пониженное разрешение — для слабых телефонов', dpr: 0.8, minDpr: 0.6, shadows: false, softShadows: false, shadowMapSize: 512, particles: 0, post: false, antialias: false, paintShader: 'off', bloom: false, fps: 30 },
  medium: { label: 'Средняя', hint: 'Простые тени, базовые частицы, стандартное разрешение', dpr: 1.25, minDpr: 0.85, shadows: true, softShadows: false, shadowMapSize: 1024, particles: 0.5, post: true, antialias: true, paintShader: 'lite', bloom: false, fps: 45 },
  high: { label: 'Высокая', hint: 'Мягкие тени, все частицы, максимальное разрешение и FPS', dpr: 2, minDpr: 1, shadows: true, softShadows: true, shadowMapSize: 2048, particles: 1, post: true, antialias: true, paintShader: 'full', bloom: true, fps: 0 },
}

/* ------------------------------------------------------------------ */
/*  Хранение настроек и флагов обучения                                */
/* ------------------------------------------------------------------ */

const KEY = 'avto-notarius-settings'

interface Stored {
  graphics: GraphicsLevel
  tutorialDone: boolean
  driveHintDone: boolean
}

/** Подбор качества по устройству при первом запуске: слабым телефонам — «Низкая», мощным ПК — «Высокая» */
export function detectGraphics(): GraphicsLevel {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number }
    const cores = nav.hardwareConcurrency ?? 4
    const mem = nav.deviceMemory ?? 4
    const coarse = window.matchMedia('(pointer: coarse)').matches // телефон/планшет
    if (cores <= 4 || mem <= 3) return 'low'
    if (coarse || cores < 8 || mem < 8) return 'medium'
    return 'high'
  } catch {
    return 'medium'
  }
}

interface Ctx extends Stored {
  config: GraphicsConfig
  setGraphics: (g: GraphicsLevel) => void
  /** Показан ли сейчас обучающий гайд */
  tutorialOpen: boolean
  openTutorial: () => void
  /** Закрыть гайд (и отметить «пройдено»: и при завершении, и при пропуске) */
  closeTutorial: () => void
  markDriveHintDone: () => void
  /** Открыт тяжёлый полноэкранный режим (тест-драйв): фоновые 3D-сцены на это время не рисуются */
  heavy: boolean
  setHeavy: (v: boolean) => void
}

const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>({ graphics: 'medium', tutorialDone: true, driveHintDone: true })
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [heavy, setHeavy] = useState(false)

  // Первый запуск: гайд показывается, пока не пройден или не пропущен
  useEffect(() => {
    let next: Stored = { graphics: detectGraphics(), tutorialDone: false, driveHintDone: false }
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) next = { ...next, ...JSON.parse(raw) }
    } catch {
      /* приватный режим */
    }
    setStored(next)
    if (!next.tutorialDone) setTutorialOpen(true)
  }, [])

  const save = useCallback((s: Stored) => {
    setStored(s)
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      ...stored,
      config: GRAPHICS[stored.graphics] ?? GRAPHICS.medium,
      setGraphics: (g) => save({ ...stored, graphics: g }),
      heavy,
      setHeavy,
      tutorialOpen,
      openTutorial: () => setTutorialOpen(true),
      closeTutorial: () => {
        setTutorialOpen(false)
        if (!stored.tutorialDone) save({ ...stored, tutorialDone: true })
      },
      markDriveHintDone: () => {
        if (!stored.driveHintDone) save({ ...stored, driveHintDone: true })
      },
    }),
    [stored, tutorialOpen, heavy, save],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
