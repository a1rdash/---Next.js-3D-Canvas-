'use client'

import { useSettings } from '@/lib/settings'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Car, Zone } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { CarArt } from '../car-art'
import { buildCar, zoneCamera, type BuiltCar } from './build-car'

const VIEWS: { id: string; label: string }[] = [
  { id: 'front', label: 'Перед' },
  { id: 'side', label: 'Бок' },
  { id: 'rear', label: 'Зад' },
  { id: 'wheel', label: 'Колесо' },
  { id: 'interior', label: 'Салон' },
  { id: 'engine', label: 'Мотор' },
]

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export interface CarViewerProps {
  car: Car
  className?: string
  /** Зона осмотра: камера плавно подлетает к ней */
  focus?: Zone | null
  /** Идёт сканирование: по кузову бегает луч */
  scanning?: boolean
  /** Кнопки ракурсов */
  showControls?: boolean
  /** Ночной свет (включает фары) */
  night?: boolean
}

export default function CarViewer({ car, className, focus = null, scanning = false, showControls = true, night = false }: CarViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{
    fly: (view: string) => void
    setScan: (v: boolean) => void
    setNight: (v: boolean) => void
    setCar: (c: Car) => void
    setTuning: (c: Car) => void
    setCondition: (c: Car) => void
    setLook: (c: Car) => void
  } | null>(null)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState('')
  const carRef = useRef(car)
  carRef.current = car

  /* ---------- сцена ---------- */
  const gfx = useSettings().config
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: gfx.antialias, alpha: false, powerPreference: gfx.fps === 0 ? 'high-performance' : 'default' })
    } catch {
      setFailed(true)
      return
    }
    // DPI и тени зависят от уровня графики
    renderer.setPixelRatio(Math.max(gfx.minDpr, Math.min(window.devicePixelRatio || 1, gfx.dpr)))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = gfx.post ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = gfx.shadows
    renderer.shadowMap.type = gfx.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    // фон: тёмный градиент студии
    const bg = document.createElement('canvas')
    bg.width = 8
    bg.height = 256
    const bctx = bg.getContext('2d')!
    const grd = bctx.createLinearGradient(0, 0, 0, 256)
    grd.addColorStop(0, '#26335c')
    grd.addColorStop(0.55, '#1a2748')
    grd.addColorStop(1, '#0e1526')
    bctx.fillStyle = grd
    bctx.fillRect(0, 0, 8, 256)
    const bgTex = new THREE.CanvasTexture(bg)
    bgTex.colorSpace = THREE.SRGBColorSpace
    scene.background = bgTex
    scene.fog = new THREE.Fog(0x141d38, 18, 46)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex
    scene.environmentIntensity = 0.9

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(6.5, 2.4, -6.2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 1.0
    controls.maxDistance = 11
    controls.maxPolarAngle = Math.PI / 2 - 0.04
    controls.minPolarAngle = 0.25
    controls.target.set(0, 0.7, 0)
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.9

    /* свет */
    const key = new THREE.SpotLight(0xffffff, 120, 30, 0.6, 0.7, 1.4)
    key.position.set(5, 9, -3)
    key.castShadow = gfx.shadows
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0004
    key.shadow.radius = 6
    scene.add(key, key.target)
    const rimL = new THREE.PointLight(0xec4899, 40, 14, 2)
    rimL.position.set(-5, 2.2, 4)
    const rimR = new THREE.PointLight(0x22d3ee, 40, 14, 2)
    rimR.position.set(5, 2.2, 5)
    scene.add(rimL, rimR)
    scene.add(new THREE.HemisphereLight(0xb4c4ff, 0x1c2240, 0.7))
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.9)
    fill.position.set(-6, 5, -5)
    scene.add(fill)

    /* пол-подиум */
    const floorTex = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 512
      const g = c.getContext('2d')!
      const r = g.createRadialGradient(256, 256, 10, 256, 256, 256)
      r.addColorStop(0, '#1d1d34')
      r.addColorStop(0.6, '#0f0f1e')
      r.addColorStop(1, '#07070f')
      g.fillStyle = r
      g.fillRect(0, 0, 512, 512)
      g.strokeStyle = 'rgba(34,211,238,0.18)'
      g.lineWidth = 1
      for (let i = 1; i < 8; i++) {
        g.beginPath()
        g.arc(256, 256, i * 32, 0, Math.PI * 2)
        g.stroke()
      }
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      return t
    })()
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.22, metalness: 0.6, envMapIntensity: 0.9 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 3.66, 96),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.005
    scene.add(ring)

    /* студия: изогнутая циклорама, потолочные софтбоксы и неоновые линии, чтобы машина стояла в пространстве, а не в пустоте */
    const wallTex = (() => {
      const c = document.createElement('canvas')
      c.width = 1024
      c.height = 256
      const g = c.getContext('2d')!
      const v = g.createLinearGradient(0, 0, 0, 256)
      v.addColorStop(0, '#2b3a66')
      v.addColorStop(0.5, '#1f2c52')
      v.addColorStop(1, '#10182e')
      g.fillStyle = v
      g.fillRect(0, 0, 1024, 256)
      // вертикальные световые панели по стене
      for (let i = 0; i < 16; i++) {
        const x = i * 64 + 6
        const p = g.createLinearGradient(x, 0, x + 52, 0)
        p.addColorStop(0, 'rgba(255,255,255,0)')
        p.addColorStop(0.5, 'rgba(180,205,255,0.16)')
        p.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = p
        g.fillRect(x, 20, 52, 200)
      }
      g.fillStyle = 'rgba(34,211,238,0.55)'
      g.fillRect(0, 232, 1024, 3)
      g.fillStyle = 'rgba(236,72,153,0.45)'
      g.fillRect(0, 40, 1024, 2)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = THREE.RepeatWrapping
      t.repeat.set(2, 1)
      return t
    })()
    const cyclo = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 15, 9, 96, 1, true),
      new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, fog: false }),
    )
    cyclo.position.y = 4.4
    scene.add(cyclo)
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.MeshBasicMaterial({ color: 0x0f1528, side: THREE.DoubleSide, fog: false }))
    ceil.rotation.x = Math.PI / 2
    ceil.position.y = 8.9
    scene.add(ceil)
    const panelMat = new THREE.MeshBasicMaterial({ color: 0xeaf2ff })
    for (const [x, z] of [[0, 0], [5, -4], [-5, 4], [4, 5], [-4, -5]] as const) {
      const sb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.4), panelMat)
      sb.position.set(x, 8.7, z)
      scene.add(sb)
    }

    /* сканер-луч */
    const scanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), scanMat)
    scanPlane.position.y = 0.85
    scene.add(scanPlane)
    let scanning = false

    /* машина */
    let built: BuiltCar | null = null
    let carKey = ''
    let slide = 1 // 1 → машина «заезжает», 0 → на месте
    let nightOn = false
    const setCarModel = (c: Car) => {
      const k = `${c.id}|${c.bodyType}|${c.color}`
      if (k === carKey && built) return
      carKey = k
      if (built) {
        scene.remove(built.root)
        built.dispose()
      }
      built = buildCar({ bodyType: c.bodyType, colorName: c.color, tuning: c.tuning, condition: c.condition, look: c.look })
      built.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true
      })
      built.setLights(nightOn)
      scene.add(built.root)
      slide = 1
      view = null
      const sp = built.spec
      controls.target.set(0, sp.belt * 0.7, 0)
    }

    /* перелёт камеры */
    let view: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number; dur: number } | null = null
    let idle = 0
    const fly = (name: string) => {
      if (!built) return
      const z = zoneCamera(built.spec, name)
      view = { from: camera.position.clone(), to: z.pos, tFrom: controls.target.clone(), tTo: z.look, t: 0, dur: 1.25 }
      controls.autoRotate = false
      idle = -2
      setActive(name)
    }

    apiRef.current = {
      fly,
      setScan: (v) => {
        scanning = v
      },
      setNight: (v) => {
        nightOn = v
        built?.setLights(v)
        key.intensity = v ? 40 : 120
        renderer.toneMappingExposure = v ? 0.85 : 1.05
      },
      setCar: setCarModel,
      setTuning: (c) => built?.setTuning(c.tuning, true),
      setCondition: (c) => built?.setCondition(c.condition),
      setLook: (c) => built?.setLook(c.look ?? {}),
    }
    setCarModel(carRef.current)

    /* размер */
    const resize = () => {
      const w = mount.clientWidth || 300
      const h = mount.clientHeight || 220
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      // на узком экране отодвигаем камеру
      camera.fov = w / h < 1.2 ? 46 : 38
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    const onDown = () => {
      controls.autoRotate = false
      view = null
      idle = 0
    }
    renderer.domElement.addEventListener('pointerdown', onDown)

    /* цикл */
    const clock = new THREE.Clock()
    let raf = 0
    let visible = true
    const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true))
    io.observe(mount)
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible) {
        clock.getDelta()
        return
      }
      const dt = Math.min(clock.getDelta(), 0.05)
      if (built) {
        built.tick(dt, 0)
        if (slide > 0) {
          slide = Math.max(0, slide - dt * 1.1)
          const e = ease(1 - slide)
          built.root.position.x = (1 - e) * 7
          built.root.rotation.y = (1 - e) * 0.5
          for (const w of built.allWheels) w.rotation.x -= (1 - e) * dt * 22
        }
      }
      if (view) {
        view.t += dt / view.dur
        const e = ease(Math.min(1, view.t))
        camera.position.lerpVectors(view.from, view.to, e)
        controls.target.lerpVectors(view.tFrom, view.tTo, e)
        if (view.t >= 1) view = null
      } else if (!controls.autoRotate) {
        idle += dt
        if (idle > 6) controls.autoRotate = true
      }
      if (scanning) {
        const t = (clock.elapsedTime * 0.9) % 2
        const x = (t < 1 ? t : 2 - t) * 5 - 2.5
        scanPlane.position.z = x
        scanMat.opacity = 0.28
      } else scanMat.opacity = Math.max(0, scanMat.opacity - dt)
      ring.rotation.z += dt * 0.15
      controls.update()
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      controls.dispose()
      built?.dispose()
      floor.geometry.dispose()
      ;(floor.material as THREE.Material).dispose()
      floorTex.dispose()
      bgTex.dispose()
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      apiRef.current = null
    }
  }, [])

  /* ---------- реакции на изменения ---------- */
  const prevTuning = useRef(car.tuning)
  useEffect(() => {
    apiRef.current?.setCar(car)
  }, [car.id, car.bodyType, car.color]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = prevTuning.current
    const t = car.tuning
    if (p.engine === t.engine && p.suspension === t.suspension && p.visual === t.visual && (p.wheels ?? 0) === (t.wheels ?? 0)) return
    apiRef.current?.setTuning(car)
    if ((t.wheels ?? 0) > (p.wheels ?? 0)) apiRef.current?.fly('wheel')
    // красивый ракурс на изменённую часть
    if ((t.wheels ?? 0) > (p.wheels ?? 0)) { /* уже летим к колесу */ }
    else if (t.visual > p.visual) apiRef.current?.fly('rear')
    else if (t.engine > p.engine) apiRef.current?.fly('rear')
    else if (t.suspension > p.suspension) apiRef.current?.fly('wheel')
    prevTuning.current = t
  }, [car.tuning.engine, car.tuning.suspension, car.tuning.visual, car.tuning.wheels]) // eslint-disable-line react-hooks/exhaustive-deps

  // кастом (краска, покрытие, диски, шины, салон) сразу виден на модели
  const lookKey = JSON.stringify(car.look ?? {})
  useEffect(() => {
    apiRef.current?.setLook(car)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey])

  // ремонт и износ сразу видны на модели (ржавчина, дым, салон, фара, подвеска)
  const prevCond = useRef(car.condition)
  useEffect(() => {
    const p = prevCond.current
    const c = car.condition
    apiRef.current?.setCondition(car)
    if (c.body > p.body + 5) apiRef.current?.fly('side')
    else if (c.interior > p.interior + 5) apiRef.current?.fly('interior')
    else if (c.engine > p.engine + 5) apiRef.current?.fly('engine')
    else if (c.suspension > p.suspension + 5) apiRef.current?.fly('wheel')
    else if (c.electrics > p.electrics + 5) apiRef.current?.fly('front')
    prevCond.current = c
  }, [car.condition.engine, car.condition.body, car.condition.interior, car.condition.suspension, car.condition.electrics]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focus) apiRef.current?.fly(focus)
  }, [focus])
  useEffect(() => apiRef.current?.setScan(scanning), [scanning])
  useEffect(() => apiRef.current?.setNight(night), [night])

  if (failed) {
    return <CarArt bodyType={car.bodyType} brand={car.brand} model={car.model} segment={car.segment} alt={`${car.brand} ${car.model}`} size="lg" />
  }

  return (
    <div className={cn('flex w-full flex-col overflow-hidden rounded-xl border border-border bg-[#0e1526]', className)}>
      {showControls && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-black/30 p-2 scrollbar-none">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => apiRef.current?.fly(v.id)}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors',
                active === v.id ? 'border-neon bg-neon/25 text-neon' : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-[16/11] w-full">
        <div ref={mountRef} className="absolute inset-0" />
      </div>
      <p className="shrink-0 border-t border-white/10 bg-black/30 px-2 py-1 text-right text-[9px] text-white/45">тяни — крутить · щипок — приблизить</p>
    </div>
  )
}
