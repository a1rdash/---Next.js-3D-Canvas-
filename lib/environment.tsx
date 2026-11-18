'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Phase, Weather } from '@/lib/game/types'

export type EnvWeather = Weather | 'snow'
export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
export type WeatherMode = 'auto' | EnvWeather
export type TimeMode = 'real' | Phase
export type SeasonMode = 'auto' | Season

export const WEATHER_OPTIONS: { id: WeatherMode; label: string }[] = [
  { id: 'auto', label: 'Авто' }, { id: 'clear', label: 'Ясно' }, { id: 'rain', label: 'Дождь' },
  { id: 'snow', label: 'Снег' }, { id: 'fog', label: 'Туман' },
]
export const TIME_OPTIONS: { id: TimeMode; label: string }[] = [
  { id: 'real', label: 'Реальное' }, { id: 'morning', label: 'Утро' }, { id: 'day', label: 'День' },
  { id: 'evening', label: 'Вечер' }, { id: 'night', label: 'Ночь' },
]
export const SEASON_OPTIONS: { id: SeasonMode; label: string }[] = [
  { id: 'auto', label: 'Авто' }, { id: 'winter', label: 'Зима' }, { id: 'spring', label: 'Весна' },
  { id: 'summer', label: 'Лето' }, { id: 'autumn', label: 'Осень' },
]

export function seasonForDate(d: Date): Season {
  const m = d.getMonth()
  return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'
}

const KEY = 'avto-notarius-env'

interface Ctx {
  weatherMode: WeatherMode
  timeMode: TimeMode
  seasonMode: SeasonMode
  setWeatherMode: (m: WeatherMode) => void
  setTimeMode: (m: TimeMode) => void
  setSeasonMode: (m: SeasonMode) => void
  /** Итоговые значения с учётом ручного выбора */
  phaseOf: (real: Phase) => Phase
  weatherOf: (real: Weather) => EnvWeather
  season: Season
}

const EnvContext = createContext<Ctx | null>(null)

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [weatherMode, setW] = useState<WeatherMode>('auto')
  const [timeMode, setT] = useState<TimeMode>('real')
  const [seasonMode, setS] = useState<SeasonMode>('auto')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p.w) setW(p.w)
        if (p.t) setT(p.t)
        if (p.s) setS(p.s)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const save = useCallback((w: WeatherMode, t: TimeMode, s: SeasonMode) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ w, t, s }))
    } catch {
      /* ignore */
    }
  }, [])

  const value: Ctx = {
    weatherMode,
    timeMode,
    seasonMode,
    setWeatherMode: (m) => { setW(m); save(m, timeMode, seasonMode) },
    setTimeMode: (m) => { setT(m); save(weatherMode, m, seasonMode) },
    setSeasonMode: (m) => { setS(m); save(weatherMode, timeMode, m) },
    phaseOf: (real) => (timeMode === 'real' ? real : timeMode),
    weatherOf: (real) => (weatherMode === 'auto' ? real : weatherMode),
    season: seasonMode === 'auto' ? seasonForDate(new Date()) : seasonMode,
  }
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>
}

export function useEnv() {
  const ctx = useContext(EnvContext)
  if (!ctx) throw new Error('useEnv must be used inside EnvironmentProvider')
  return ctx
}
