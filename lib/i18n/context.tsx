'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { translate } from './dictionaries'
import { formatDonatePrice, formatMoneyLocale } from './format'
import { LOCALES, LOCALE_LABELS, type Locale } from './types'

interface I18nValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  formatMoney: (amount: number) => string
  formatDonate: (rub: number) => string
  locales: typeof LOCALES
  labels: typeof LOCALE_LABELS
}

const I18nContext = createContext<I18nValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale: Locale = 'ru'
  const setLocale = useCallback((_l: Locale) => {
    /* RU only */
  }, [])

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      formatMoney: (amount) => formatMoneyLocale(amount, locale),
      formatDonate: (rub) => formatDonatePrice(rub, locale),
      locales: LOCALES,
      labels: LOCALE_LABELS,
    }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within LocaleProvider')
  return ctx
}
