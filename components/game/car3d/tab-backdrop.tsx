'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Phase, TabId } from '@/lib/game/types'
import { useEnv } from '@/lib/environment'
import { useSettings, type GraphicsConfig } from '@/lib/settings'
import type { BackdropScene } from './backdrop-scenes'

/** Процедурный 3D-фон под интерфейсом: зависит от вкладки, времени суток и уровня гаража. */
export function TabBackdrop({ tab, phase, garageLevel }: { tab: TabId; phase: Phase; garageLevel: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<{ renderer: THREE.WebGLRenderer; current: BackdropScene | null; raf: number; resize: () => void } | null>(null)
  const [failed, setFailed] = useState(false)
  const [fadeKey, setFadeKey] = useState(0)
  const { season } = useEnv()
  const { config: gfx } = useSettings()
  const gfxRef = useRef<GraphicsConfig>(gfx)
  gfxRef.current = gfx

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: gfxRef.current.antialias, powerPreference: 'low-power' })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfxRef.current.dpr))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = gfxRef.current.post ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = gfxRef.current.shadows
    renderer.shadowMap.type = gfxRef.current.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap
    const st = { renderer, current: null as BackdropScene | null, raf: 0, resize: () => {} }
    stateRef.current = st

    const resize = () => {
      const w = canvas.clientWidth || 360
      const h = canvas.clientHeight || 640
      renderer.setSize(w, h, false)
      if (st.current) {
        st.current.camera.aspect = w / h
        st.current.camera.updateProjectionMatrix()
      }
    }
    st.resize = resize
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const clock = new THREE.Clock()
    let acc = 0
    const loop = () => {
      st.raf = requestAnimationFrame(loop)
      const dt = clock.getDelta()
      if (document.hidden || !st.current) return
      acc += dt
      // фон — ambient-слой: FPS ниже, чем в игре, и зависит от уровня графики
      const bgFps = gfxRef.current.fps === 0 ? 45 : Math.min(30, gfxRef.current.fps)
      if (acc < 1 / (gfxRef.current.fps === 30 ? 20 : bgFps)) return
      acc = 0
      st.current.update(reduce ? 0 : clock.elapsedTime)
      renderer.render(st.current.scene, st.current.camera)
    }
    loop()
    return () => {
      cancelAnimationFrame(st.raf)
      ro.disconnect()
      st.current?.dispose()
      renderer.dispose()
      stateRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const st = stateRef.current
      if (!st) return
      try {
        // применяем уровень графики к рендереру (DPI, тени, тональная коррекция) перед сборкой сцены
        const g = gfxRef.current
        st.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, g.dpr))
        st.renderer.shadowMap.enabled = g.shadows
        st.renderer.shadowMap.type = g.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap
        st.renderer.toneMapping = g.post ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
        st.resize()
        const { buildBackdrop } = await import('./backdrop-scenes')
        if (cancelled || !stateRef.current) return
        const next = buildBackdrop(tab, phase, garageLevel, season)
        // мягкие отражения: окружение студийного света для глянцевых материалов (гараж, машины)
        if (tab === 'home' || tab === 'garage') {
          const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js')
          const pm = new THREE.PMREMGenerator(st.renderer)
          const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
          next.scene.environment = env
          next.scene.environmentIntensity = 0.55
          pm.dispose()
        }
        const w = canvasRef.current?.clientWidth || 360
        const h = canvasRef.current?.clientHeight || 640
        next.camera.aspect = w / h
        next.camera.updateProjectionMatrix()
        const prev = st.current
        st.current = next
        prev?.dispose()
        setFadeKey((n) => n + 1)
      } catch (e) {
        console.error('backdrop failed', e)
        setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, phase, garageLevel, season, gfx.dpr, gfx.shadows, gfx.softShadows, gfx.post])

  if (failed) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <canvas key={fadeKey ? 'c' : 'c'} ref={canvasRef} className="h-full w-full animate-in fade-in duration-700" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/35 to-background/75" />
    </div>
  )
}
