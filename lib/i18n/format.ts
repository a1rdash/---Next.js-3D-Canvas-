import type { Locale } from './types'

/** Always ₽ — no conversion. */
export function formatMoneyLocale(amount: number, _locale?: Locale): string {
  const n = Math.round(amount)
  const sign = n < 0 ? '-' : ''
  return `${sign}${Math.abs(n).toLocaleString('ru-RU')} ₽`
}

/** Donate package list price in RUB. */
export function formatDonatePrice(packRub: number, _locale?: Locale): string {
  return `${packRub.toLocaleString('ru-RU')} ₽`
}
