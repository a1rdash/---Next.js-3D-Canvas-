import Image from 'next/image'
import type { BodyType, Segment } from '@/lib/game/types'
import { cn } from '@/lib/utils'

/** Deterministic 0..1 hash from string */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function hue(s: string, salt = 0): number {
  return Math.floor(hash01(s + salt) * 360)
}

const BODY_FILE: Record<string, string> = {
  hatch: 'hatch',
  sedan: 'sedan',
  suv: 'suv',
  coupe: 'coupe',
  van: 'van',
  roadster: 'coupe',
  pickup: 'suv',
}

/** Per body-type base atmosphere */
const BODY_THEME: Record<string, { a: string; b: string; glow: string }> = {
  hatch: { a: '#0f172a', b: '#164e63', glow: 'rgba(34,211,238,0.35)' },
  sedan: { a: '#111827', b: '#1e1b4b', glow: 'rgba(167,139,250,0.35)' },
  suv: { a: '#0c1a14', b: '#14532d', glow: 'rgba(74,222,128,0.3)' },
  coupe: { a: '#1a0a14', b: '#4a044e', glow: 'rgba(244,63,94,0.35)' },
  van: { a: '#0f172a', b: '#1e293b', glow: 'rgba(148,163,184,0.3)' },
  roadster: { a: '#1c0a0a', b: '#7f1d1d', glow: 'rgba(251,146,60,0.4)' },
  pickup: { a: '#0c1220', b: '#1e3a5f', glow: 'rgba(56,189,248,0.35)' },
}

const SEGMENT_TINT: Record<Segment, string> = {
  junk: 'rgba(120,113,108,0.25)',
  budget: 'rgba(34,211,238,0.12)',
  mid: 'rgba(96,165,250,0.15)',
  premium: 'rgba(167,139,250,0.18)',
  sport: 'rgba(244,63,94,0.18)',
  hyper: 'rgba(250,204,21,0.2)',
}

export function CarArt({
  bodyType,
  alt,
  mystery = false,
  className,
  size = 'md',
  brand,
  model,
  segment,
}: {
  bodyType: BodyType
  alt: string
  mystery?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
  brand?: string
  model?: string
  segment?: Segment
}) {
  const file = BODY_FILE[bodyType] ?? 'sedan'
  const key = `${brand ?? ''}|${model ?? ''}|${bodyType}`
  const theme = BODY_THEME[bodyType] ?? BODY_THEME.sedan
  const h1 = hue(key, 1)
  const h2 = hue(key, 2)
  const h3 = hue(key, 3)
  const angle = Math.floor(hash01(key + 'a') * 160 + 20)
  const gridOp = 0.08 + hash01(key + 'g') * 0.12
  const blobX = 20 + hash01(key + 'x') * 60
  const blobY = 15 + hash01(key + 'y') * 50

  const bgStyle = mystery
    ? {
        background: `linear-gradient(${angle}deg, #0f172a 0%, #312e81 50%, #0f172a 100%)`,
      }
    : {
        background: `
          radial-gradient(ellipse at ${blobX}% ${blobY}%, hsla(${h1}, 90%, 55%, 0.35), transparent 55%),
          radial-gradient(ellipse at ${100 - blobX}% ${100 - blobY}%, hsla(${h2}, 85%, 50%, 0.25), transparent 50%),
          linear-gradient(${angle}deg, ${theme.a} 0%, hsl(${h3}, 40%, 12%) 45%, ${theme.b} 100%)
        `,
      }

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl border border-border',
        size === 'sm' && 'size-16',
        size === 'md' && 'aspect-[4/3] w-28',
        size === 'lg' && 'aspect-[16/10] w-full',
        className,
      )}
      style={bgStyle}
    >
      {/* neon grid floor */}
      {!mystery && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(hsla(${h1},80%,60%,${gridOp}) 1px, transparent 1px),
              linear-gradient(90deg, hsla(${h2},80%,60%,${gridOp}) 1px, transparent 1px)
            `,
            backgroundSize: `${12 + hash01(key) * 10}px ${12 + hash01(key) * 10}px`,
            maskImage: 'linear-gradient(to top, black 10%, transparent 75%)',
            WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 75%)',
          }}
          aria-hidden
        />
      )}

      {/* horizon glow line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[38%] h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.glow}, transparent)`,
          boxShadow: `0 0 12px ${theme.glow}`,
        }}
        aria-hidden
      />

      {/* segment tint */}
      {segment && (
        <div className="pointer-events-none absolute inset-0" style={{ background: SEGMENT_TINT[segment] }} aria-hidden />
      )}

      {/* soft vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)',
        }}
        aria-hidden
      />

      <Image
        src={mystery ? '/cars/mystery.png' : `/cars/${file}.png`}
        alt={alt}
        fill
        sizes={size === 'lg' ? '400px' : '120px'}
        className="object-cover object-center"
      />
    </div>
  )
}
