export const rand = (min: number, max: number) => Math.random() * (max - min) + min

export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))

export const chance = (p: number) => Math.random() < p

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const roundTo = (v: number, step = 1000) => Math.round(v / step) * step

/** Always Russian rubles. */
export const formatMoney = (v: number) => {
  const n = Math.round(v)
  const sign = n < 0 ? '-' : ''
  return `${sign}${Math.abs(n).toLocaleString('ru-RU')} ₽`
}

export const formatKm = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} км`
