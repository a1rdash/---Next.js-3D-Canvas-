'use client'

import { useEffect, useRef } from 'react'
import { useSettings } from '@/lib/settings'
import type { Weather } from '@/lib/game/types'

type Drop = { x: number; y: number; len: number; speed: number; alpha: number }
type Ripple = { x: number; y: number; r: number; life: number }

/** Дождь на canvas: капли с параллаксом, всплески внизу, редкие молнии. */
function Rain({ density }: { density: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = r.width
      h = r.height
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const count = reduce ? 40 : Math.max(20, Math.round(160 * density))
    const drops: Drop[] = Array.from({ length: count }, () => {
      const depth = Math.random()
      return { x: Math.random() * 600, y: Math.random() * 900, len: 8 + depth * 22, speed: 380 + depth * 720, alpha: 0.12 + depth * 0.4 }
    })
    const ripples: Ripple[] = []
    let raf = 0
    let last = performance.now()
    let nextBolt = 6000 + Math.random() * 9000
    let bolt = 0

    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'
      const wind = 0.22
      for (const d of drops) {
        d.y += d.speed * dt
        d.x -= d.speed * dt * wind
        if (d.y > h) {
          if (Math.random() < 0.35 && ripples.length < 24) ripples.push({ x: d.x, y: h - Math.random() * 40, r: 1, life: 1 })
          d.y = -d.len
          d.x = Math.random() * (w + 200)
        }
        if (d.x < -20) d.x = w + Math.random() * 100
        ctx.strokeStyle = `rgba(190,215,255,${d.alpha})`
        ctx.lineWidth = d.len > 20 ? 1.4 : 0.9
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x + d.len * wind, d.y - d.len)
        ctx.stroke()
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.life -= dt * 2.2
        r.r += dt * 26
        if (r.life <= 0) {
          ripples.splice(i, 1)
          continue
        }
        ctx.strokeStyle = `rgba(200,225,255,${r.life * 0.35})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, Math.max(0.1, r.r), Math.max(0.035, r.r * 0.35), 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      // молния
      if (!reduce) {
        nextBolt -= dt * 1000
        if (nextBolt <= 0) {
          bolt = 1
          nextBolt = 8000 + Math.random() * 14000
        }
        if (bolt > 0) {
          bolt = Math.max(0, bolt - dt * 2.4)
          const f = bolt > 0.6 ? 1 : bolt > 0.45 ? 0.15 : bolt
          if (flashRef.current) flashRef.current.style.opacity = String(f * 0.5)
        } else if (flashRef.current && flashRef.current.style.opacity !== '0') flashRef.current.style.opacity = '0'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-b from-slate-900/25 via-transparent to-slate-900/30" aria-hidden />
      <canvas ref={ref} className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden />
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_30%_0%,rgba(220,235,255,0.95),rgba(180,200,255,0.2)_60%,transparent)] opacity-0 transition-opacity duration-75"
        aria-hidden
      />
    </>
  )
}

function Snow({ density }: { density: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    let w = 0
    let h = 0
    const resize = () => {
      w = cv.width = cv.clientWidth
      h = cv.height = cv.clientHeight
    }
    resize()
    const flakes = Array.from({ length: Math.max(15, Math.round(90 * density)) }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.2, v: 20 + Math.random() * 40, d: Math.random() * 6 }))
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000))
      last = t
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (const f of flakes) {
        f.y += (f.v * dt) / h
        f.d += dt
        if (f.y > 1) f.y = -0.02
        ctx.beginPath()
        ctx.arc(f.x * w + Math.sin(f.d) * 12, f.y * h, f.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(loop)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden />
}

export function WeatherOverlay({ weather }: { weather: Weather | 'snow' }) {
  const { config } = useSettings()
  // на низкой графике частицы (капли, снежинки) отключены; на средней — половина; на высокой — все
  if ((weather === 'snow' || weather === 'rain') && config.particles <= 0) return null
  if (weather === 'snow') return <Snow density={config.particles} />
  if (weather === 'rain') return <Rain density={config.particles} />
  if (weather === 'fog') {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-300/10 via-slate-200/10 to-slate-300/20" />
        <div className="fog-a" />
        <div className="fog-b" />
      </div>
    )
  }
  return null
}
