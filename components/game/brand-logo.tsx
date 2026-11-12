import { cn } from '@/lib/utils'

/**
 * Оригинальные стилизованные эмблемы марок. Форма, цвета и монограмма строятся из названия марки,
 * поэтому они узнаваемы внутри игры, но не копируют реальные логотипы.
 */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const PALETTES: [string, string][] = [
  ['#22d3ee', '#0b1b2b'], ['#ec4899', '#240b1a'], ['#facc15', '#241d05'], ['#34d399', '#06231a'],
  ['#a78bfa', '#150f2e'], ['#fb923c', '#2a1405'], ['#60a5fa', '#0a1730'], ['#f87171', '#2b0d0d'],
]

export function BrandLogo({ brand, size = 28, className }: { brand: string; size?: number; className?: string }) {
  const h = hash(brand)
  const [fg, bg] = PALETTES[h % PALETTES.length]
  const shape = (h >> 4) % 4
  const deco = (h >> 8) % 3
  const letter = (brand.replace(/[^A-Za-zА-Яа-яЁё]/g, '')[0] ?? '?').toUpperCase()
  const outline =
    shape === 0 ? 'M16 2 L29 7 V17 C29 24 23 28 16 30 C9 28 3 24 3 17 V7 Z'
    : shape === 1 ? 'M16 2 A14 14 0 1 1 15.99 2 Z'
    : shape === 2 ? 'M16 2 L30 16 L16 30 L2 16 Z'
    : 'M9 3 H23 L30 16 L23 29 H9 L2 16 Z'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={`Эмблема марки ${brand}`} className={cn('shrink-0', className)}>
      <path d={outline} fill={bg} stroke={fg} strokeWidth="1.8" strokeLinejoin="round" />
      {deco === 0 && <path d="M7 22 H25" stroke={fg} strokeWidth="1.4" opacity=".7" />}
      {deco === 1 && <path d="M8 9 L16 5 L24 9" fill="none" stroke={fg} strokeWidth="1.4" opacity=".7" />}
      {deco === 2 && <circle cx="16" cy="16" r="9.5" fill="none" stroke={fg} strokeWidth="1" opacity=".45" />}
      <text x="16" y="21" textAnchor="middle" fontSize="13" fontWeight="800" fill={fg} fontFamily="system-ui, sans-serif">{letter}</text>
    </svg>
  )
}
