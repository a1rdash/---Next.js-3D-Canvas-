'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeId = 'dark' | 'light' | 'neon'
export const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'dark', label: 'Тёмная', hint: 'Спокойный графит без лишнего свечения' },
  { id: 'light', label: 'Светлая', hint: 'Свежая и чистая, для дневного света' },
  { id: 'neon', label: 'Неон', hint: 'Фирменная: яркая подсветка и свечение' },
]

const KEY = 'avto-notarius-theme'

interface Ctx {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
  cycle: () => void
}
const ThemeContext = createContext<Ctx | null>(null)

function apply(t: ThemeId) {
  const el = document.documentElement
  el.dataset.theme = t
  el.style.colorScheme = t === 'light' ? 'light' : 'dark'
  el.classList.toggle('dark', t !== 'light')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('neon')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as ThemeId | null
      if (saved === 'dark' || saved === 'light' || saved === 'neon') {
        setThemeState(saved)
        apply(saved)
        return
      }
    } catch {
      /* private mode */
    }
    apply('neon')
  }, [])

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t)
    apply(t)
    window.dispatchEvent(new CustomEvent('avto-theme', { detail: t }))
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  const cycle = useCallback(() => {
    const order: ThemeId[] = ['neon', 'dark', 'light']
    setTheme(order[(order.indexOf(theme) + 1) % order.length])
  }, [theme, setTheme])

  return <ThemeContext.Provider value={{ theme, setTheme, cycle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
