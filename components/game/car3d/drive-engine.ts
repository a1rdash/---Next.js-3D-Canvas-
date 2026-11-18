import * as THREE from 'three'
import type { Phase, Tuning, Weather, BodyType, CarLook } from '@/lib/game/types'
import { registerAudioContext, unregisterAudioContext } from '@/lib/audio-focus'
import type { GraphicsConfig } from '@/lib/settings'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { buildCar, paintFromName, type BuiltCar } from './build-car'

/* ================================================================== */
/*  3D-движок тест-драйва: дорога, город, трафик, погода, камера       */
/* ================================================================== */

export interface DriveOptions {
  canvas: HTMLCanvasElement
  car: { bodyType: BodyType; color: string; tuning: Tuning; look?: CarLook; condition?: Partial<Record<'engine' | 'body' | 'interior' | 'suspension' | 'electrics' | 'documents', number>> }
  /** speed/accel уже учитывают износ двигателя, подвески и повреждения конкретной машины */
  stats: { speed: number; accel?: number; handling: number; reliability: number }
  weather: Weather | 'snow'
  phase: Phase
  durationMs: number
  /** уровень графики (тени, частицы, разрешение, FPS) */
  graphics?: GraphicsConfig
  /** установленные системы: круиз-контроль и автопилот */
  features?: { cruise?: boolean; autopilot?: boolean }
  onHud: (h: { speedKmh: number; hits: number; progress: number; leftMs: number; gear: number; throttle: number; maxKmh: number; light: 'green' | 'yellow' | 'red' | null; lightLeft: number; event: string | null; siren: boolean; violations: number; cruiseOn: boolean; autoOn: boolean; blink: number; warning: string | null }) => void
  onHit: () => void
  /** Начислить штраф (вычитается из денег игрока) */
  onFine?: (amount: number, reason: string) => void
  onEnd: (elapsedMs: number, hits: number, distanceM: number, violations: number) => void
}

/** Скорость трафика — не зависит от вашей машины */
const TRAFFIC_BASE = 34
/** Запасной профиль графики (средняя), если не передан */
const DEFAULT_GFX: GraphicsConfig = { label: 'Средняя', hint: '', dpr: 1.25, minDpr: 0.85, shadows: true, softShadows: false, shadowMapSize: 1024, particles: 0.5, post: true, antialias: true, fps: 45 }
/** Светофор: зелёный 7 с, жёлтый 2 с, красный 5 с */
const LIGHT_G = 7
const LIGHT_Y = 2
const LIGHT_R = 5
const LIGHT_CYCLE = LIGHT_G + LIGHT_Y + LIGHT_R
const lightAt = (t: number): { state: 'green' | 'yellow' | 'red'; left: number } => {
  const c = ((t % LIGHT_CYCLE) + LIGHT_CYCLE) % LIGHT_CYCLE
  if (c < LIGHT_G) return { state: 'green', left: LIGHT_G - c }
  if (c < LIGHT_G + LIGHT_Y) return { state: 'yellow', left: LIGHT_G + LIGHT_Y - c }
  return { state: 'red', left: LIGHT_CYCLE - c }
}
type Ped = { m: THREE.Group; side: -1 | 1; state: 'wait' | 'cross'; cd: number; ph: number; gone?: number }
/** Сбитый пешеход в полёте/«рэгдолле» */
type Flyer = { m: THREE.Group; vx: number; vy: number; vz: number; ax: number; az: number; t: number; landed: boolean; bounced: boolean }
/** Штраф за сбитого пешехода, ₽ */
const PED_FINE = 30_000
type Junction = { root: THREE.Group; z: number; offset: number; prevLine: number; lamps: THREE.MeshStandardMaterial[]; passed: boolean; peds: Ped[] }
type Walker = { m: THREE.Group; z: number; x: number; dir: number; ph: number }
const EMG_KINDS = ['police', 'ambulance', 'fire'] as const

const LANES = 3
const LANE_W = 3.6
const ROAD_W = 13.8
const CHUNK = 60
const CHUNKS = 6
const laneX = (i: number) => (i - 1) * LANE_W

const TRAFFIC_COLORS = [0xd11a3a, 0x1d4ed8, 0xe8e8ea, 0x15803d, 0xc2410c, 0x6b21a8, 0x334155, 0xca8a04, 0x0e7490]
const TRAFFIC_BODIES: BodyType[] = ['sedan', 'suv', 'coupe', 'hatch', 'van', 'sedan', 'hatch']

type Traffic = {
  base: number
  emergency: 'police' | 'ambulance' | 'fire' | null
  isStatic: boolean
  bar: THREE.Mesh | null
  built: BuiltCar
  lane: number
  target: number
  x: number
  z: number
  speed: number
  changeCd: number
  hitT: number
  crashed: boolean
  vx: number
  spin: number
  active: boolean
  half: number
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const mix = (a: string, b: string, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()

/* ------------------------------------------------------------------ */
/*  Процедурные текстуры                                               */
/* ------------------------------------------------------------------ */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function skyTexture(phase: Phase, weather: Weather) {
  const pal: Record<Phase, string[]> = {
    morning: ['#35508f', '#e58f78', '#ffd6a1', '#6b5a63', '#1d1d26'],
    day: ['#2a76dc', '#79b8f2', '#d8ecff', '#6b7a8c', '#20242c'],
    evening: ['#1c1442', '#a83a7c', '#ff9558', '#4a2a44', '#14101c'],
    night: ['#02030a', '#080d26', '#1c2a5c', '#0a0d1c', '#05060d'],
  }
  const gray: Record<Phase, string> = { morning: '#8a8590', day: '#8d97a3', evening: '#5a4a5e', night: '#10131d' }
  const k = weather === 'clear' ? 0 : weather === 'rain' ? 0.72 : 0.88
  const cols = pal[phase].map((c) => mix(c, gray[phase], k))
  return canvasTex(1024, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512)
    gr.addColorStop(0, cols[0])
    gr.addColorStop(0.32, cols[1])
    gr.addColorStop(0.49, cols[2])
    gr.addColorStop(0.52, cols[3])
    gr.addColorStop(1, cols[4])
    g.fillStyle = gr
    g.fillRect(0, 0, 1024, 512)
    // городское зарево
    if (phase === 'night' || phase === 'evening') {
      for (let i = 0; i < 9; i++) {
        const x = rnd(0, 1024)
        const r = g.createRadialGradient(x, 252, 4, x, 252, rnd(90, 220))
        r.addColorStop(0, i % 2 ? 'rgba(236,72,153,0.38)' : 'rgba(34,211,238,0.3)')
        r.addColorStop(1, 'transparent')
        g.fillStyle = r
        g.fillRect(0, 0, 1024, 512)
      }
    }
    if (phase === 'night' && weather === 'clear') {
      g.fillStyle = '#fff'
      for (let i = 0; i < 380; i++) {
        g.globalAlpha = rnd(0.25, 0.95)
        g.fillRect(rnd(0, 1024), rnd(0, 230), rnd(0.8, 1.8), rnd(0.8, 1.8))
      }
      g.globalAlpha = 1
      const mx = 760
      const m = g.createRadialGradient(mx, 90, 2, mx, 90, 70)
      m.addColorStop(0, 'rgba(255,255,255,0.95)')
      m.addColorStop(0.12, 'rgba(230,240,255,0.9)')
      m.addColorStop(1, 'transparent')
      g.fillStyle = m
      g.fillRect(mx - 80, 10, 160, 160)
    }
    if ((phase === 'day' || phase === 'morning') && weather === 'clear') {
      const sx = phase === 'day' ? 700 : 320
      const sy = phase === 'day' ? 120 : 215
      const s = g.createRadialGradient(sx, sy, 2, sx, sy, 120)
      s.addColorStop(0, 'rgba(255,255,240,1)')
      s.addColorStop(0.1, 'rgba(255,240,200,0.9)')
      s.addColorStop(1, 'transparent')
      g.fillStyle = s
      g.fillRect(sx - 130, sy - 130, 260, 260)
    }
    // облака
    if (weather !== 'clear' || phase === 'day') {
      g.fillStyle = phase === 'night' ? 'rgba(20,24,40,0.35)' : 'rgba(255,255,255,0.18)'
      const n = weather === 'clear' ? 14 : 40
      for (let i = 0; i < n; i++) g.fillRect(rnd(0, 1024), rnd(30, 220), rnd(60, 220), rnd(6, 22))
    }
  })
}

function roadTexture() {
  return canvasTex(512, 2048, (g) => {
    g.fillStyle = '#1b1e26'
    g.fillRect(0, 0, 512, 2048)
    for (let i = 0; i < 9000; i++) {
      const v = Math.floor(rnd(20, 60))
      g.fillStyle = `rgba(${v},${v},${v + 6},${rnd(0.05, 0.22)})`
      g.fillRect(rnd(0, 512), rnd(0, 2048), rnd(1, 3), rnd(1, 3))
    }
    // следы колёс
    for (const lx of [-1, 0, 1]) {
      for (const off of [-0.9, 0.9]) {
        const x = 256 + (lx * LANE_W + off) * (512 / ROAD_W)
        const gr = g.createLinearGradient(x - 14, 0, x + 14, 0)
        gr.addColorStop(0, 'transparent')
        gr.addColorStop(0.5, 'rgba(0,0,0,0.3)')
        gr.addColorStop(1, 'transparent')
        g.fillStyle = gr
        g.fillRect(x - 14, 0, 28, 2048)
      }
    }
    // разметка
    const ux = 512 / ROAD_W
    g.fillStyle = 'rgba(235,235,235,0.9)'
    for (const sx of [-1, 1]) g.fillRect(256 + sx * 5.3 * ux - 3, 0, 6, 2048)
    g.fillStyle = 'rgba(245,225,120,0.9)'
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) g.fillRect(256 + sx * (LANE_W / 2) * ux - 2.5, (i * 2048) / 6 + 20, 5, 130)
    }
  })
}

function glowTexture(color = '255,255,255') {
  return canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, `rgba(${color},1)`)
    r.addColorStop(0.25, `rgba(${color},0.45)`)
    r.addColorStop(1, `rgba(${color},0)`)
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
  })
}

function facadeTextures(lit: number) {
  const cols = 8
  const rows = 16
  const cells: { lit: boolean; c: string }[] = []
  for (let i = 0; i < cols * rows; i++) {
    const r = Math.random()
    cells.push({ lit: Math.random() < lit, c: r < 0.6 ? '#ffd98a' : r < 0.85 ? '#9fe8ff' : '#ffffff' })
  }
  const draw = (emissive: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = emissive ? '#000' : '#232838'
    g.fillRect(0, 0, 128, 256)
    cells.forEach((cell, i) => {
      const x = (i % cols) * 16 + 3
      const y = Math.floor(i / cols) * 16 + 3
      if (emissive) {
        if (cell.lit) {
          g.fillStyle = cell.c
          g.fillRect(x, y, 10, 10)
        }
      } else {
        g.fillStyle = cell.lit ? '#7a8aa3' : '#3a4558'
        g.fillRect(x, y, 10, 10)
      }
    })
  }
  return { map: canvasTex(128, 256, draw(false)), emissive: canvasTex(128, 256, draw(true)) }
}

/* ================================================================== */

export class DriveEngine {
  private o: DriveOptions
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(64, 1, 0.1, 600)
  private raf = 0
  private disposed = false
  private ro: ResizeObserver

  private chunks: THREE.Group[] = []
  private bldMats: THREE.MeshStandardMaterial[] = []
  private lampGlows: THREE.Sprite[] = []
  private lampPools: THREE.Mesh[] = []
  private roadMat!: THREE.MeshStandardMaterial
  private disposables: { dispose(): void }[] = []

  private player: BuiltCar
  private traffic: Traffic[] = []
  private pool: Traffic[] = []
  private sun: THREE.DirectionalLight
  private hemi: THREE.HemisphereLight
  private fogColor!: THREE.Color
  private cones: THREE.Mesh[] = []

  private rain: THREE.LineSegments | null = null
  private rainData: Float32Array | null = null
  private spray: THREE.Points | null = null
  private sprayData: { pos: Float32Array; vel: Float32Array; life: Float32Array } | null = null

  private elapsed = 0
  private introT = 0
  private target = 1
  private px = 0
  private pvx = 0
  private speed = 0
  private penalty = 1
  private hits = 0
  private shake = 0
  private lightning = 0
  private nextBolt = rnd(5, 10)
  private spawnCd = 1
  private hudCd = 0
  private ended = false
  private lampsOn: boolean
  private wet: boolean
  private frameAvg = 16
  private pr: number
  private audio: { ctx: AudioContext; osc1: OscillatorNode; osc2: OscillatorNode; osc3: OscillatorNode; gain: GainNode; filt: BiquadFilterNode } | null = null
  /** «газ»: 0…1 от максимальной скорости именно этой машины */
  private braking = false
  private distance = 0
  private muted = false
  /* ---- светофоры, пешеходы, события, динамическая среда ---- */
  private tClock = 0
  private junctions: Junction[] = []
  private walkers: Walker[] = []
  private violations = 0
  private pedAssets: { skin: THREE.Material; pants: THREE.Material; body: THREE.BufferGeometry; head: THREE.BufferGeometry; limb: THREE.BufferGeometry; arm: THREE.BufferGeometry; cols: number[] } | null = null
  private eventText: string | null = null
  private eventLeft = 0
  private eventCd = 35
  private emgCd = 45
  private slowT = 0
  private curWeather: Weather | 'snow'
  private nextWeatherAt = 70
  private snow: THREE.Points | null = null
  private snowData: Float32Array | null = null
  private fogBase = 0.0055
  private hemiBase = 0.9
  private sunBase = 2
  private dark = 0
  private darkDir = 1
  private cruiseOn = false
  private gfx: GraphicsConfig = DEFAULT_GFX
  private frameAcc = 0
  /* управление: удержание кнопок независимо друг от друга (мультитач / несколько клавиш) */
  private gasHeld = false
  private brakeHeld = false
  private steerDir: -1 | 0 | 1 = 0
  private gasLevel = 0
  private cruiseSet = 0
  private snapT = 0
  private blink = 0
  private flyers: Flyer[] = []
  private warning: string | null = null
  private warnLeft = 0
  private pedHits = 0
  private blinkT = 0
  private darkTarget: number | null = null
  private autoOn = false
  private autoCd = 0
  private autoCap = Infinity
  private siren: { osc: OscillatorNode; gain: GainNode } | null = null
  private sirenLevel = 0
  private headI = 220
  private touchX: number | null = null

  constructor(o: DriveOptions) {
    this.o = o
    this.gfx = o.graphics ?? DEFAULT_GFX
    const { weather, phase } = o
    this.curWeather = weather
    this.dark = { morning: 0.2, day: 0, evening: 0.55, night: 1 }[phase]
    this.darkDir = phase === 'night' ? -1 : 1
    this.cruiseOn = false
    this.lampsOn = phase === 'night' || phase === 'evening' || weather !== 'clear'
    this.wet = weather === 'rain'

    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: this.gfx.antialias, powerPreference: this.gfx.fps === 0 ? 'high-performance' : 'default' })
    // DPI рендера зависит от уровня графики (низкая — ниже родного разрешения)
    this.pr = Math.max(this.gfx.minDpr, Math.min(window.devicePixelRatio || 1, this.gfx.dpr))
    this.renderer.setPixelRatio(this.pr)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // «постобработка»: тональная коррекция только на средней/высокой графике
    this.renderer.toneMapping = this.gfx.post ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    this.renderer.toneMappingExposure = phase === 'night' ? 0.95 : phase === 'day' ? 1.05 : 1
    // тени: выкл. на низкой, простые на средней, мягкие на высокой
    this.renderer.shadowMap.enabled = this.gfx.shadows
    this.renderer.shadowMap.type = this.gfx.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap

    /* небо + окружение (отражения на краске и мокром асфальте) */
    const sky = skyTexture(phase, weather === 'snow' ? 'fog' : weather)
    sky.mapping = THREE.EquirectangularReflectionMapping
    this.disposables.push(sky)
    this.scene.background = sky
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const env = pmrem.fromEquirectangular(sky).texture
    this.scene.environment = env
    this.scene.environmentIntensity = phase === 'night' ? 0.7 : 1
    this.disposables.push(env, pmrem)

    const horizon = mix(
      { morning: '#f1b48a', day: '#cfe5f8', evening: '#c9588a', night: '#0c1230' }[phase],
      { morning: '#8a8590', day: '#8d97a3', evening: '#5a4a5e', night: '#10131d' }[phase],
      weather === 'clear' ? 0 : weather === 'rain' ? 0.7 : 0.9,
    )
    const density = weather === 'fog' ? 0.026 : weather === 'rain' ? 0.011 : phase === 'night' ? 0.0075 : 0.0055
    this.scene.fog = new THREE.FogExp2(horizon, weather === 'snow' ? Math.max(density, 0.012) : density)
    this.fogBase = weather === 'clear' ? density : phase === 'night' ? 0.0075 : 0.0055
    this.fogColor = new THREE.Color(horizon)

    /* свет */
    const sunI = { morning: 2.2, day: 3.4, evening: 1.6, night: 0.55 }[phase] * (weather === 'clear' ? 1 : weather === 'rain' ? 0.45 : 0.35)
    const sunC = { morning: 0xffc79a, day: 0xfff4e0, evening: 0xff9a6a, night: 0x8fa8ff }[phase]
    this.sunBase = sunI
    this.sun = new THREE.DirectionalLight(sunC, sunI)
    this.sun.position.set(-8, 14, 8)
    this.sun.castShadow = this.gfx.shadows
    this.sun.shadow.mapSize.set(this.gfx.shadowMapSize, this.gfx.shadowMapSize)
    const sc = this.sun.shadow.camera
    sc.left = -12
    sc.right = 12
    sc.top = 14
    sc.bottom = -14
    sc.near = 1
    sc.far = 50
    sc.updateProjectionMatrix()
    this.sun.shadow.bias = -0.0005
    this.scene.add(this.sun, this.sun.target)
    this.hemi = new THREE.HemisphereLight(
      { morning: 0xffd9b8, day: 0xbfe0ff, evening: 0xd48ab0, night: 0x3a4a8a }[phase],
      0x1a1a22,
      { morning: 0.7, day: 0.9, evening: 0.5, night: 0.35 }[phase],
    )
    this.hemiBase = this.hemi.intensity
    this.scene.add(this.hemi)

    /* дорога и окружение */
    this.buildWorld()

    /* машина игрока */
    this.player = buildCar({ bodyType: o.car.bodyType, colorName: o.car.color, tuning: o.car.tuning, condition: o.car.condition, look: o.car.look })
    this.player.root.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = this.gfx.shadows
    })
    this.player.setLights(this.lampsOn)
    this.headI = weather === 'fog' ? 90 : 220
    this.scene.add(this.player.root)
    if (this.lampsOn) this.addHeadCones()

    /* погода */
    // частицы (дождь, снег, брызги) — на низкой графике отключены
    if (this.gfx.particles > 0) {
      if (weather === 'rain') this.buildRain()
      if (weather === 'snow') this.buildSnow()
      if (weather === 'rain' || weather === 'fog' || weather === 'snow') this.buildSpray()
    }
    this.buildWalkers()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(o.canvas.parentElement ?? o.canvas)
    this.resize()
    this.initAudio()
    this.camera.position.set(5, 2.0, -7)
    this.raf = requestAnimationFrame(this.loop)
  }

  /* ---------------------------------------------------------------- */
  /*  Мир                                                              */
  /* ---------------------------------------------------------------- */

  private buildWorld() {
    const { phase, weather } = this.o
    const road = roadTexture()
    road.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.disposables.push(road)
    this.roadMat = new THREE.MeshStandardMaterial({
      map: road,
      roughness: this.wet ? 0.22 : 0.88,
      metalness: this.wet ? 0.35 : 0.05,
      envMapIntensity: this.wet ? 1.6 : 0.35,
    })
    const groundMat = new THREE.MeshStandardMaterial({ color: phase === 'night' ? 0x0a0c12 : 0x2a2e36, roughness: 0.95 })
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ae, metalness: 0.85, roughness: 0.35 })
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.6, roughness: 0.5 })
    const lampHeadMat = new THREE.MeshBasicMaterial({ color: this.lampsOn ? 0xfff0c0 : 0x8a8f99 })
    this.disposables.push(this.roadMat, groundMat, railMat, poleMat, lampHeadMat)

    const lit = { morning: 0.15, day: 0.1, evening: 0.45, night: 0.62 }[phase]
    for (let v = 0; v < 3; v++) {
      const f = facadeTextures(lit)
      const m = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: f.map,
        emissive: 0xffffff,
        emissiveMap: f.emissive,
        emissiveIntensity: { morning: 0.15, day: 0.05, evening: 0.7, night: 1.5 }[phase],
        roughness: 0.55,
        metalness: 0.3,
      })
      this.bldMats.push(m)
      this.disposables.push(f.map, f.emissive, m)
    }

    const planeRoad = new THREE.PlaneGeometry(ROAD_W, CHUNK)
    planeRoad.rotateX(-Math.PI / 2)
    const planeGround = new THREE.PlaneGeometry(60, CHUNK)
    planeGround.rotateX(-Math.PI / 2)
    const railGeo = new THREE.BoxGeometry(0.12, 0.45, CHUNK)
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 8.2, 8)
    const armGeo = new THREE.BoxGeometry(2.2, 0.1, 0.12)
    const headGeo = new THREE.BoxGeometry(0.7, 0.1, 0.3)
    const glowTex = glowTexture('255,226,160')
    const poolTex = glowTexture('255,226,160')
    this.disposables.push(planeRoad, planeGround, railGeo, poleGeo, armGeo, headGeo, glowTex, poolTex)

    for (let i = 0; i < CHUNKS; i++) {
      const g = new THREE.Group()
      g.position.z = CHUNK / 2 - i * CHUNK
      const r = new THREE.Mesh(planeRoad, this.roadMat)
      r.receiveShadow = true
      g.add(r)
      for (const sx of [-1, 1]) {
        const gr = new THREE.Mesh(planeGround, groundMat)
        gr.position.set(sx * (ROAD_W / 2 + 30), -0.02, 0)
        g.add(gr)
        const rail = new THREE.Mesh(railGeo, railMat)
        rail.position.set(sx * 7.3, 0.4, 0)
        g.add(rail)
        // фонари
        for (let k = 0; k < 3; k++) {
          const z = -CHUNK / 2 + 10 + k * 20
          const pole = new THREE.Mesh(poleGeo, poleMat)
          pole.position.set(sx * 7.7, 4.1, z)
          g.add(pole)
          const arm = new THREE.Mesh(armGeo, poleMat)
          arm.position.set(sx * 6.6, 8.1, z)
          g.add(arm)
          const head = new THREE.Mesh(headGeo, lampHeadMat)
          head.position.set(sx * 5.6, 8.0, z)
          g.add(head)
          if (this.lampsOn && this.gfx.post) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe3a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: weather === 'fog' ? 1 : 0.85 }))
            sp.scale.setScalar(weather === 'fog' ? 9 : 5)
            sp.position.set(sx * 5.6, 7.9, z)
            g.add(sp)
            this.lampGlows.push(sp)
            const pool = new THREE.Mesh(
              new THREE.PlaneGeometry(14, 14),
              new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffd88a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: this.wet ? 0.55 : 0.3, fog: false }),
            )
            pool.rotation.x = -Math.PI / 2
            pool.position.set(sx * 3.2, 0.03, z)
            g.add(pool)
            this.lampPools.push(pool)
          }
        }
      }
      // здания размещаются отдельно (пересоздаются при переносе)
      const city = new THREE.Group()
      city.name = 'city'
      g.add(city)
      this.fillCity(city)
      this.scene.add(g)
      this.chunks.push(g)
    }
  }

  private fillCity(city: THREE.Group) {
    for (const c of [...city.children]) {
      city.remove(c)
      const m = c as THREE.Mesh
      m.geometry?.dispose()
      if (m.material instanceof THREE.MeshBasicMaterial) m.material.dispose()
    }
    const neon = [0xec4899, 0x22d3ee, 0xfacc15, 0x8b5cf6]
    for (const sx of [-1, 1]) {
      let z = -CHUNK / 2 + rnd(2, 6)
      while (z < CHUNK / 2 - 4) {
        const w = rnd(7, 13)
        const d = rnd(8, 15)
        const h = rnd(10, 48)
        const x = sx * (ROAD_W / 2 + rnd(5, 14) + w / 2)
        const geo = new RoundedBoxGeometry(w, h, d, 3, Math.min(0.9, w * 0.07))
        // масштаб UV под размер здания, чтобы окна не растягивались
        const uv = geo.attributes.uv as THREE.BufferAttribute
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 12, (uv.getY(i) * h) / 24)
        const m = new THREE.Mesh(geo, this.bldMats[Math.floor(Math.random() * this.bldMats.length)])
        m.position.set(x, h / 2, z + d / 2)
        city.add(m)
        if (Math.random() < 0.45) {
          const c = neon[Math.floor(Math.random() * neon.length)]
          const sign = new THREE.Mesh(
            new RoundedBoxGeometry(0.4, rnd(2, 6), rnd(2, 5), 2, 0.12),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(this.o.phase === 'day' ? 0.5 : 1.6) }),
          )
          sign.position.set(x - sx * (w / 2 + 0.2), rnd(4, Math.min(h - 3, 16)), z + d / 2)
          city.add(sign)
        }
        z += d + rnd(1, 5)
      }
    }
  }

  private addHeadCones() {
    const geo = new THREE.ConeGeometry(2.2, 16, 20, 1, true)
    geo.rotateX(-Math.PI / 2) // вершина к машине, основание вперёд (−Z)
    geo.translate(0, 0, -8)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff1c8,
      transparent: true,
      opacity: this.o.weather === 'clear' ? 0.05 : 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
    this.disposables.push(geo, mat)
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(geo, mat)
      c.position.set(sx * 0.7, 0.8, -(this.player.spec.L / 2))
      this.player.root.add(c)
      this.cones.push(c)
    }
  }

  private buildRain() {
    const N = Math.max(80, Math.round(1800 * this.gfx.particles))
    const data = new Float32Array(N * 6)
    for (let i = 0; i < N; i++) {
      const x = rnd(-16, 16)
      const y = rnd(0, 16)
      const z = rnd(-50, 10)
      data.set([x, y, z, x, y, z], i * 6)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data, 3))
    const mat = new THREE.LineBasicMaterial({ color: 0xaec6e6, transparent: true, opacity: 0.38, depthWrite: false, fog: false })
    this.rain = new THREE.LineSegments(geo, mat)
    this.rain.frustumCulled = false
    this.rainData = data
    this.scene.add(this.rain)
    this.disposables.push(geo, mat)
  }

  private buildSpray() {
    const N = Math.max(12, Math.round(90 * this.gfx.particles))
    const pos = new Float32Array(N * 3)
    const vel = new Float32Array(N * 3)
    const life = new Float32Array(N).fill(0)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const tex = glowTexture('220,230,245')
    const mat = new THREE.PointsMaterial({ map: tex, size: 0.9, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true })
    this.spray = new THREE.Points(geo, mat)
    this.spray.frustumCulled = false
    this.sprayData = { pos, vel, life }
    this.scene.add(this.spray)
    this.disposables.push(geo, tex, mat)
  }

  /* ---------------------------------------------------------------- */
  /*  Трафик                                                           */
  /* ---------------------------------------------------------------- */

  private buildSnow() {
    const N = Math.max(60, Math.round(900 * this.gfx.particles))
    const data = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) data.set([rnd(-14, 14), rnd(0, 14), rnd(-50, 10)], i * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data, 3))
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false, fog: false })
    this.snow = new THREE.Points(geo, mat)
    this.snow.frustumCulled = false
    this.snowData = data
    this.scene.add(this.snow)
    this.disposables.push(geo, mat)
  }

  /** Фигура пешехода: плавные капсулы, голова, руки и ноги (для шагающей анимации) */
  private makePed(i: number): THREE.Group {
    const A = this.pedAssets!
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: A.cols[i % A.cols.length], roughness: 0.75 })
    this.disposables.push(mat)
    const b = new THREE.Mesh(A.body, mat)
    b.position.y = 1.18
    const h = new THREE.Mesh(A.head, A.skin)
    h.position.y = 1.78
    const legs: THREE.Mesh[] = []
    for (const sx of [-0.09, 0.09]) {
      const leg = new THREE.Mesh(A.limb, A.pants)
      leg.position.set(sx, 0.9, 0)
      g.add(leg)
      legs.push(leg)
    }
    const arms: THREE.Mesh[] = []
    for (const sx of [-0.26, 0.26]) {
      const arm = new THREE.Mesh(A.arm, mat)
      arm.position.set(sx, 1.42, 0)
      g.add(arm)
      arms.push(arm)
    }
    g.add(b, h)
    g.userData.legs = legs
    g.userData.arms = arms
    return g
  }

  /** Пешеходы на тротуарах */
  private buildWalkers() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0b89a, roughness: 0.7 })
    const body = new THREE.CapsuleGeometry(0.2, 0.55, 8, 20)
    const head = new THREE.SphereGeometry(0.15, 24, 18)
    const limb = new THREE.CapsuleGeometry(0.075, 0.5, 6, 12)
    limb.translate(0, -0.3, 0)
    const arm = new THREE.CapsuleGeometry(0.06, 0.42, 6, 12)
    arm.translate(0, -0.24, 0)
    const pants = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.85 })
    this.disposables.push(skin, body, head, limb, arm, pants)
    this.pedAssets = { skin, pants, body, head, limb, arm, cols: [0x2563eb, 0xdc2626, 0x16a34a, 0xf59e0b, 0x7c3aed, 0x0891b2] }
    for (let i = 0; i < 16; i++) {
      const g = this.makePed(i)
      const side = i % 2 ? 1 : -1
      const w: Walker = { m: g, z: rnd(-140, 10), x: side * (ROAD_W / 2 + rnd(2.2, 4.6)), dir: Math.random() < 0.5 ? -1 : 1, ph: rnd(0, 6) }
      g.position.set(w.x, 0, w.z)
      this.scene.add(g)
      this.walkers.push(w)
    }
  }

  /** Перекрёсток со светофорами (цикл 7 / 2 / 5 с) */
  private makeJunction(index: number): Junction {
    const root = new THREE.Group()
    const road = new THREE.Mesh(new THREE.BoxGeometry(90, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.9 }))
    road.position.y = 0.012
    root.add(road)
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 })
    for (let i = -6; i <= 6; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 3), stripeMat)
      st.position.set(i * 1.0, 0.02, -7.5)
      root.add(st)
    }
    const line = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.035, 0.35), stripeMat)
    line.position.set(0, 0.021, -9.4)
    root.add(line)
    const lamps: THREE.MeshStandardMaterial[] = []
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.5 })
    for (const sx of [-1, 1]) {
      const px = sx * (ROAD_W / 2 + 1.4)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 20), poleMat)
      pole.position.set(px, 2.2, -9.8)
      const head = new THREE.Mesh(new RoundedBoxGeometry(0.46, 1.28, 0.42, 3, 0.1), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.3 }))
      head.position.set(px, 4.5, -9.8)
      root.add(pole, head)
      const cols = [0xff2b2b, 0xffc21a, 0x2bff6a]
      for (let k = 0; k < 3; k++) {
        const m = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: cols[k], emissiveIntensity: 0.05 })
        lamps.push(m)
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), m)
        l.position.set(px, 4.95 - k * 0.42, -9.58)
        root.add(l)
      }
    }
    // пешеходы у зебры: ждут на тротуарах и переходят строго на красный для машин
    const peds: Ped[] = []
    for (let k = 0; k < 4; k++) {
      const side = (k % 2 ? 1 : -1) as -1 | 1
      const m = this.makePed(k + index * 4 + 2)
      m.position.set(side * (ROAD_W / 2 + 1.7), 0, -7.5 + (k > 1 ? 0.9 : -0.9))
      m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
      root.add(m)
      peds.push({ m, side, state: 'wait', cd: 0.5 + k * 1.1, ph: 0 })
    }
    root.visible = false
    this.scene.add(root)
    return { root, z: -9999, offset: index * 5, prevLine: -9999, lamps, passed: false, peds }
  }

  private lightOf(j: Junction) {
    return lightAt(this.tClock + j.offset)
  }

  private placeJunction(j: Junction, z: number) {
    j.z = z
    j.passed = false
    j.prevLine = z - 8
    for (const p of j.peds) {
      p.state = 'wait'
      p.cd = 0.5 + Math.random() * 3
      p.m.position.x = p.side * (ROAD_W / 2 + 1.7)
    }
    j.root.visible = true
    j.root.position.z = z
  }

  private spawnSpecial(kind: 'police' | 'ambulance' | 'fire') {
    const t = this.pool.pop() ?? this.makeTraffic()
    const color = kind === 'police' ? 0xf4f4f6 : kind === 'ambulance' ? 0xffffff : 0xc81e1e
    t.built.setBodyColor(color)
    if (!t.bar) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.34), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff1a1a, emissiveIntensity: 2 }))
      bar.position.set(0, 1.72, 0)
      t.built.root.add(bar)
      t.bar = bar
    }
    t.bar.visible = true
    t.emergency = kind
    t.isStatic = false
    // самая дальняя от игрока полоса: спецтранспорт обгоняет, не создавая лобовой столкновение
    let lane = 0
    let best = -1
    for (let l = 0; l < LANES; l++) {
      const d = Math.abs(laneX(l) - this.px)
      if (d > best) { best = d; lane = l }
    }
    t.lane = t.target = lane
    t.x = laneX(lane)
    t.z = 70
    t.speed = Math.max(this.speed + 13, 30)
    t.base = t.speed
    t.hitT = 0
    t.crashed = false
    t.vx = 0
    t.spin = 0
    t.active = true
    t.changeCd = 99
    t.built.root.visible = true
    t.built.root.rotation.set(0, 0, 0)
    t.built.root.scale.set(1, 1, 1)
    this.traffic.push(t)
  }

  private spawnStatic(lane: number, z: number) {
    const t = this.pool.pop() ?? this.makeTraffic()
    t.emergency = null
    if (t.bar) t.bar.visible = false
    t.built.setBodyColor(0xe8590c)
    t.isStatic = true
    t.lane = t.target = lane
    t.x = laneX(lane)
    t.z = z
    t.speed = 0
    t.base = 0
    t.hitT = 0
    t.crashed = false
    t.vx = 0
    t.spin = 0
    t.active = true
    t.changeCd = 999
    t.built.root.visible = true
    t.built.root.rotation.set(0, 0, 0)
    t.built.setLights(true, true)
    this.traffic.push(t)
  }

  private startEvent() {
    const roll = Math.random()
    const lane = Math.floor(Math.random() * LANES)
    if (roll < 0.4) {
      this.spawnStatic(lane, -210)
      this.eventText = 'Впереди сломавшаяся машина'
    } else if (roll < 0.75) {
      this.spawnStatic(lane, -200)
      this.spawnStatic(lane, -216)
      this.eventText = 'Дорожные работы: полоса закрыта'
    } else {
      this.slowT = 12
      this.eventText = 'Затор: поток замедлился'
    }
    this.eventLeft = 7
  }

  private makeTraffic(): Traffic {
    const bodyType = TRAFFIC_BODIES[Math.floor(Math.random() * TRAFFIC_BODIES.length)]
    const built = buildCar({
      bodyType,
      colorName: '',
      tuning: { engine: 0, suspension: 0, visual: 0 },
      lowDetail: true,
      paintOverride: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
    })
    built.root.rotation.y = 0
    built.root.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = this.gfx.shadows
    })
    built.setLights(this.lampsOn)
    built.root.visible = false
    this.scene.add(built.root)
    return { base: 0, emergency: null, isStatic: false, bar: null, built, lane: 1, target: 1, x: 0, z: 0, speed: 0, changeCd: 0, hitT: 0, crashed: false, vx: 0, spin: 0, active: false, half: built.spec.L / 2 }
  }

  private spawn(phase: number, base: number) {
    const lane = Math.floor(Math.random() * LANES)
    const z0 = -230
    const near = this.traffic.filter((t) => !t.crashed && Math.abs(t.z - z0) < 38)
    if (near.some((t) => Math.abs(t.lane - lane) < 0.6)) return
    const otherLanes = new Set(near.map((t) => Math.round(t.lane)))
    otherLanes.add(lane)
    if (otherLanes.size >= LANES) return // всегда оставляем свободный ряд
    const t = this.pool.pop() ?? this.makeTraffic()
    t.lane = t.target = lane
    t.x = laneX(lane)
    t.z = z0 - rnd(0, 20)
    t.speed = base * (0.34 + Math.random() * 0.3 + phase * 0.08)
    t.base = t.speed
    t.emergency = null
    t.isStatic = false
    t.built.setBodyColor(TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)])
    if (t.bar) t.bar.visible = false
    t.changeCd = rnd(3, 8)
    t.hitT = 0
    t.crashed = false
    t.vx = 0
    t.spin = 0
    t.active = true
    t.built.root.visible = true
    t.built.root.rotation.set(0, 0, 0)
    t.built.root.position.set(t.x, 0, t.z)
    this.traffic.push(t)
  }

  /* ---------------------------------------------------------------- */
  /*  Управление                                                       */
  /* ---------------------------------------------------------------- */

  /** Быстрая смена полосы (свайп / автопилот): плавный доворот к центру полосы */
  moveLane(dir: -1 | 1) {
    this.signal(dir)
    if (this.ended) return
    this.target = Math.max(0, Math.min(LANES - 1, this.target + dir))
    this.snapT = 0.9
  }

  /** ГАЗ: удерживается кнопкой/клавишей. Отпустили — машина катится и замедляется (трение/сопротивление) */
  setGas(on: boolean) {
    this.gasHeld = on
    // круиз запоминает скорость в момент отпускания газа
    if (!on && this.cruiseOn) this.cruiseSet = this.speed
  }

  /** ТОРМОЗ: удерживается; отключает круиз и автопилот */
  setBrake(on: boolean) {
    this.brakeHeld = on
    if (on) {
      this.cruiseOn = false
      this.autoOn = false
    }
  }

  /** РУЛЬ: -1 влево, 1 вправо, 0 — прямо. Работает одновременно с газом и тормозом */
  setSteer(dir: -1 | 0 | 1) {
    if (dir === this.steerDir) return
    this.steerDir = dir
    if (dir !== 0) {
      this.signal(dir)
      this.autoOn = false // ручной поворот отключает автопилот
    }
  }

  /** Поворотник: мигает 2.5 с */
  signal(dir: -1 | 1) {
    this.blink = dir
    this.blinkT = 2.5
  }

  /** Переключатель времени суток */
  setTimeOfDay(p: 'day' | 'evening' | 'night') {
    this.darkTarget = p === 'day' ? 0 : p === 'evening' ? 0.55 : 1
  }

  toggleCruise() {
    if (!this.o.features?.cruise) return
    this.cruiseOn = !this.cruiseOn
    if (this.cruiseOn) this.cruiseSet = this.speed
  }

  toggleAutopilot() {
    if (this.o.features?.autopilot) this.autoOn = !this.autoOn
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.audio) this.audio.gain.gain.setTargetAtTime(m ? 0 : 0.042, this.audio.ctx.currentTime, 0.05)
  }

  /** Свайп по холсту */
  pointerDown(x: number) {
    this.touchX = x
  }
  pointerUp(x: number) {
    if (this.touchX == null) return
    const dx = x - this.touchX
    this.touchX = null
    if (Math.abs(dx) > 28) this.moveLane(dx > 0 ? 1 : -1)
  }

  /* ---------------------------------------------------------------- */
  /*  Звук двигателя (WebAudio)                                         */
  /* ---------------------------------------------------------------- */

  private initAudio() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()
      // Мягкий «бархатный» мотор: треугольник + синусы (без резкой пилы/квадрата), глубокий ФНЧ и плавная огибающая
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const osc3 = ctx.createOscillator()
      osc1.type = 'triangle'
      osc2.type = 'sine'
      osc3.type = 'sine'
      const filt = ctx.createBiquadFilter()
      filt.type = 'lowpass'
      filt.frequency.value = 220
      filt.Q.value = 0.3
      const gain = ctx.createGain()
      gain.gain.value = 0.0001
      gain.gain.setTargetAtTime(this.muted ? 0 : 0.042, ctx.currentTime, 0.4)
      const g1 = ctx.createGain()
      const g2 = ctx.createGain()
      const g3 = ctx.createGain()
      g1.gain.value = 0.55
      g2.gain.value = 0.9
      g3.gain.value = 0.35
      osc1.connect(g1).connect(filt)
      osc2.connect(g2).connect(filt)
      osc3.connect(g3).connect(filt)
      filt.connect(gain)
      gain.connect(ctx.destination)
      osc1.start()
      osc2.start()
      osc3.start()
      registerAudioContext(ctx) // автопауза при сворачивании / потере фокуса
      this.audio = { ctx, osc1, osc2, osc3, gain, filt }
      // сирена спецтранспорта: мягкий «вой» синусом
      const so = ctx.createOscillator()
      so.type = 'sine'
      const sg = ctx.createGain()
      sg.gain.value = 0
      so.connect(sg).connect(ctx.destination)
      so.start()
      this.siren = { osc: so, gain: sg }
    } catch {
      this.audio = null
    }
  }

  private thump() {
    const a = this.audio
    if (!a || this.muted) return
    const o = a.ctx.createOscillator()
    const g = a.ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, a.ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(35, a.ctx.currentTime + 0.35)
    g.gain.setValueAtTime(0.16, a.ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + 0.4)
    o.connect(g)
    g.connect(a.ctx.destination)
    o.start()
    o.stop(a.ctx.currentTime + 0.45)
  }

  /* ---------------------------------------------------------------- */
  /*  Основной цикл                                                    */
  /* ---------------------------------------------------------------- */

  private clock = new THREE.Clock()

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    // ограничение FPS по уровню графики: копим время и пропускаем лишние кадры
    this.frameAcc += this.clock.getDelta()
    if (this.gfx.fps > 0 && this.frameAcc < 1 / this.gfx.fps - 0.002) return
    const raw = this.frameAcc
    this.frameAcc = 0
    const dt = Math.min(raw, 0.05)
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    // адаптивное разрешение
    this.frameAvg += (raw * 1000 - this.frameAvg) * 0.03
    const budgetMs = this.gfx.fps > 0 ? 1000 / this.gfx.fps + 8 : 26
    if (this.frameAvg > budgetMs && this.pr > this.gfx.minDpr) {
      this.pr = Math.max(this.gfx.minDpr, this.pr - 0.2)
      this.renderer.setPixelRatio(this.pr)
      this.resize()
      this.frameAvg = 16
    }
  }

  private update(dt: number) {
    const o = this.o
    const { stats, phase } = o
    const weather = this.curWeather
    if (!this.ended) this.elapsed += dt * 1000
    const prog = Math.min(1, this.elapsed / o.durationMs)

    /* скорость: максимум и разгон берутся из износа ИМЕННО этой машины */
    this.tClock += dt
    this.updateEnvironment(dt)
    const cw = this.curWeather
    const wmul = cw === 'rain' ? 0.94 : cw === 'fog' ? 0.9 : cw === 'snow' ? 0.88 : 1
    // максимальная скорость целиком зависит от машины: тюнинг (двигатель, коробка, подвеска) и износ уже учтены в stats.speed
    const maxV = (12 + stats.speed * 26) * wmul // м/с
    const base = maxV
    this.introT = Math.min(1, this.introT + dt / 2.6)
    this.penalty += (1 - this.penalty) * Math.min(1, dt * 0.7)
    if (this.autoOn) this.autopilotStep(dt, maxV)

    /* --- динамический разгон ---
       Газ зажат: ускорение растёт плавно и затухает по мере приближения к maxV (a ~ 1 - (v/maxV)^2.4).
       Газ отпущен: выбег — скорость снижается трением качения и сопротивлением воздуха. */
    this.gasLevel += ((this.gasHeld && !this.ended ? 1 : 0) - this.gasLevel) * Math.min(1, dt * 4.5) // сглаженная педаль
    const accelMax = 2.4 + (stats.accel ?? 1) * 4.6 // м/с²: изношенный мотор разгоняется вяло
    const drag = 0.45 + 0.0016 * this.speed * this.speed // трение + аэродинамика
    let a: number
    if (this.autoOn && !this.ended) {
      const tgt = Math.min(maxV * 0.85, this.autoCap)
      a = Math.max(-7, Math.min(accelMax * 0.8, (tgt - this.speed) * 1.2))
    } else if (this.cruiseOn && this.cruiseSet > 0 && this.gasLevel < 0.05 && !this.ended) {
      a = Math.max(-3, Math.min(accelMax * 0.6, (this.cruiseSet - this.speed) * 0.9))
    } else {
      const r = Math.min(1, this.speed / maxV)
      a = this.gasLevel * accelMax * (1 - Math.pow(r, 2.4)) - drag * (1 - this.gasLevel * 0.85)
    }
    if (this.ended) a = -2.5 - drag
    if (this.brakeHeld && this.speed > 0.2) a -= 11
    const cap = maxV * this.penalty // после ударов скорость временно ограничена
    if (this.speed > cap) a -= (this.speed - cap) * 3
    this.braking = this.brakeHeld || a < -3
    this.speed = Math.max(0, Math.min(maxV, this.speed + a * dt))
    this.distance += this.speed * dt
    const v = this.speed

    /* боковое движение игрока: удержание кнопки поворачивает плавно и не зависит от газа */
    this.snapT = Math.max(0, this.snapT - dt)
    const kS = 5 + stats.handling * 3.5 + (weather === 'rain' ? -1.2 : 0)
    if (this.autoOn || (this.steerDir === 0 && this.snapT > 0)) {
      // автопилот / быстрая смена полосы: пружина к центру полосы
      const accL = (laneX(this.target) - this.px) * kS * kS * 0.18 - this.pvx * kS * 0.9
      this.pvx += accL * dt
    } else if (this.steerDir !== 0 && !this.ended) {
      const grip = weather === 'rain' ? 0.85 : weather === 'snow' ? 0.75 : 1
      const speedFactor = Math.min(1, 0.15 + v / 5) // на месте почти не «ездим боком»
      const vTarget = this.steerDir * (3 + Math.min(v, 40) * 0.14) * (0.65 + stats.handling * 0.35) * grip * speedFactor
      this.pvx += (vTarget - this.pvx) * Math.min(1, dt * 6)
    } else {
      this.pvx += (0 - this.pvx) * Math.min(1, dt * 5) // отпустили руль: едем прямо
    }
    this.px += this.pvx * dt
    const roadLimit = laneX(LANES - 1) + 1.1
    if (Math.abs(this.px) > roadLimit) {
      this.px = Math.sign(this.px) * roadLimit
      this.pvx = 0
    }
    if (!this.autoOn && this.steerDir !== 0) {
      // ближайшая полоса нужна ИИ трафика и автопилоту
      let best = 0
      for (let l = 1; l < LANES; l++) if (Math.abs(laneX(l) - this.px) < Math.abs(laneX(best) - this.px)) best = l
      this.target = best
    }

    /* чанки */
    for (const g of this.chunks) {
      g.position.z += v * dt
      if (g.position.z - CHUNK / 2 > 24) {
        g.position.z -= CHUNK * CHUNKS
        this.fillCity(g.getObjectByName('city') as THREE.Group)
      }
    }

    /* трафик */
    if (!this.ended) {
      this.spawnCd -= dt
      const maxCars = 6 + Math.floor(prog * 8)
      if (this.spawnCd <= 0 && this.traffic.length < maxCars && this.introT > 0.5) {
        this.spawn(prog, TRAFFIC_BASE)
        this.spawnCd = Math.max(0.35, (1.5 - prog * 0.7 + Math.random() * 1.0) * (0.85 + stats.reliability * 0.3))
      }
    }
    /* перекрёстки со светофорами */
    this.updateJunctions(dt, v)
    this.checkPedHits()
    this.updateFlyers(dt, v)
    /* пешеходы */
    for (const w of this.walkers) {
      w.z += (v + w.dir * 1.3) * dt
      w.ph += dt * 6
      if (w.z > 24) { w.z = rnd(-170, -110); w.dir = Math.random() < 0.5 ? -1 : 1 }
      w.m.position.set(w.x, Math.abs(Math.sin(w.ph)) * 0.04, w.z)
      const sw = Math.sin(w.ph) * 0.6
      const lg = w.m.userData.legs as THREE.Mesh[]
      const ar = w.m.userData.arms as THREE.Mesh[]
      lg[0].rotation.x = sw
      lg[1].rotation.x = -sw
      ar[0].rotation.x = -sw * 0.8
      ar[1].rotation.x = sw * 0.8
      w.m.rotation.y = w.dir > 0 ? 0 : Math.PI
    }
    /* спецтранспорт и дорожные события */
    if (!this.ended && this.introT > 0.9) {
      this.emgCd -= dt
      if (this.emgCd <= 0) {
        this.spawnSpecial(EMG_KINDS[Math.floor(Math.random() * EMG_KINDS.length)])
        this.emgCd = rnd(55, 85)
      }
      this.eventCd -= dt
      if (this.eventCd <= 0) {
        this.startEvent()
        this.eventCd = rnd(40, 70)
      }
    }
    if (this.eventLeft > 0) {
      this.eventLeft -= dt
      if (this.eventLeft <= 0) this.eventText = null
    }
    if (this.slowT > 0) this.slowT -= dt
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i]
      this.trafficBrain(t, dt)
      t.z += (v - t.speed) * dt
      if (t.crashed) {
        t.hitT -= dt
        t.x += t.vx * dt
        t.built.root.rotation.y += t.spin * dt
        t.built.root.rotation.z += t.spin * 0.3 * dt
        t.vx *= 0.97
        t.speed *= 0.97
        if (t.hitT <= 0) {
          this.recycle(i)
          continue
        }
      } else {
        t.changeCd -= dt
        if (t.changeCd <= 0) {
          if (Math.random() < 0.4) {
            const dir = Math.random() < 0.5 ? -1 : 1
            const next = Math.max(0, Math.min(LANES - 1, Math.round(t.target) + dir))
            const clear = !this.traffic.some((x) => x !== t && Math.abs(x.lane - next) < 0.6 && Math.abs(x.z - t.z) < 14)
            if (clear && Math.abs(this.px - laneX(next)) + Math.abs(t.z) > 6) t.target = next
          }
          t.changeCd = rnd(4, 9)
        }
        const prevLane = t.lane
        t.lane += (t.target - t.lane) * Math.min(1, dt * 1.6)
        t.x = laneX(t.lane)
        t.built.root.rotation.y = -(t.lane - prevLane) * 6
      }
      t.built.root.position.set(t.x, 0, t.z)
      if (t.emergency && t.bar) {
        const on = Math.floor(this.tClock * 5) % 2 === 0
        ;(t.bar.material as THREE.MeshStandardMaterial).emissive.setHex(on ? 0xff1a1a : 0x1a4bff)
        t.lane = t.target = (() => { let l = 0, b = -1; for (let k = 0; k < LANES; k++) { const d = Math.abs(laneX(k) - this.px); if (d > b) { b = d; l = k } } return l })()
      }
      if (!t.isStatic) t.built.setLights(this.lampsOn, v - t.speed > 18 && t.z > -60)
      t.built.tick(dt, t.speed)

      /* столкновение */
      if (!this.ended && !t.crashed && Math.abs(t.z) < t.half + this.player.spec.L / 2 - 0.5 && Math.abs(t.x - this.px) < 1.8) {
        this.hits += 1
        this.shake = 1
        this.penalty = 0.5
        t.crashed = true
        t.hitT = 1.6
        t.vx = (t.x >= this.px ? 1 : -1) * rnd(6, 10)
        t.spin = rnd(-3, 3)
        this.pvx += (this.px >= t.x ? 1 : -1) * 4
        o.onHit()
        this.thump()
      }
      if (t.z > 120 || t.z < -320) this.recycle(i)
    }

    /* игрок */
    const roll = THREE.MathUtils.clamp(-this.pvx * 0.012, -0.08, 0.08)
    const yaw = THREE.MathUtils.clamp(-this.pvx * 0.035, -0.22, 0.22)
    this.player.root.position.x = this.px
    this.player.root.rotation.y = yaw
    this.player.body.rotation.z += (roll - this.player.body.rotation.z) * Math.min(1, dt * 6)
    // клевок при торможении/разгоне
    const pitch = (this.penalty < 0.95 ? 0.03 : 0) - (this.introT < 1 ? 0.012 : 0)
    this.player.body.rotation.x += (pitch - this.player.body.rotation.x) * Math.min(1, dt * 4)
    for (const f of this.player.frontWheels) f.rotation.y = -THREE.MathUtils.clamp(this.pvx * 0.07, -0.4, 0.4)
    this.player.tick(dt, v)
    this.player.setLights(this.lampsOn, this.penalty < 0.8 || this.braking, this.headI)

    /* солнце/тень следует за игроком */
    this.sun.position.set(this.px - 8, 14, 8)
    this.sun.target.position.set(this.px, 0, -2)

    /* камера: вступительный пролёт → погоня */
    this.updateCamera(dt, v)

    /* погода */
    this.updateWeather(dt, v)

    /* звук */
    if (this.audio && !this.muted) {
      const kmh = v * 3.6
      const gearLen = 42
      const gear = Math.min(5, Math.floor(kmh / gearLen))
      const inGear = (kmh - gear * gearLen) / gearLen
      const rpm = 0.2 + inGear * 0.55 * (gear >= 5 ? 0.6 : 1) // умеренные обороты: без «визга»
      const f = 30 + rpm * 62 * (1 + o.car.tuning.engine * 0.03)
      const t = this.audio.ctx.currentTime
      this.audio.osc1.frequency.setTargetAtTime(f, t, 0.12)
      this.audio.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.12)
      this.audio.osc3.frequency.setTargetAtTime(f * 1.006, t, 0.12)
      this.audio.filt.frequency.setTargetAtTime(170 + rpm * 330, t, 0.15)
      const load = this.braking ? 0.55 : 0.7 + this.gasLevel * 0.45
      this.audio.gain.gain.setTargetAtTime(0.03 * load + 0.012, t, 0.2)
    }

    /* сирена: громче при приближении спецтранспорта */
    let near = 0
    for (const t of this.traffic) if (t.emergency) near = Math.max(near, 1 - Math.min(1, Math.abs(t.z) / 150))
    this.sirenLevel += (near - this.sirenLevel) * Math.min(1, dt * 3)
    if (this.siren && this.audio) {
      const ct = this.audio.ctx.currentTime
      this.siren.osc.frequency.setTargetAtTime(760 + Math.sin(this.tClock * 5.5) * 190, ct, 0.05)
      this.siren.gain.gain.setTargetAtTime(this.muted ? 0 : this.sirenLevel * 0.035, ct, 0.1)
    }

    /* HUD */
    this.hudCd -= dt
    if (this.hudCd <= 0) {
      this.hudCd = 0.1
      o.onHud({
        speedKmh: Math.round(v * 3.6),
        hits: this.hits,
        progress: prog * 100,
        leftMs: Math.max(0, o.durationMs - this.elapsed),
        gear: Math.min(6, Math.floor((v * 3.6) / 42) + 1),
        throttle: this.gasLevel,
        maxKmh: Math.round(maxV * 3.6),
        ...this.lightHud(),
        event: this.eventText,
        siren: this.sirenLevel > 0.05,
        violations: this.violations,
        cruiseOn: this.cruiseOn,
        autoOn: this.autoOn,
        blink: this.blinkT > 0 && Math.floor(this.tClock * 3) % 2 === 0 ? this.blink : 0,
        warning: this.warnLeft > 0 ? this.warning : null,
      })
    }

    if (!this.ended && this.elapsed >= o.durationMs) {
      this.ended = true
      o.onEnd(Math.min(o.durationMs, this.elapsed), this.hits, this.distance, this.violations)
    }
    void phase
  }

  /** Погода и время суток меняются по ходу заезда */
  private updateEnvironment(dt: number) {
    if (this.tClock >= this.nextWeatherAt) {
      const opts: (Weather | 'snow')[] = ['clear', 'rain', 'snow', 'fog']
      const next = opts[Math.floor(Math.random() * opts.length)]
      this.curWeather = next
      this.nextWeatherAt = this.tClock + rnd(60, 95)
      if (this.gfx.particles > 0) {
        if (next === 'rain' && !this.rain) this.buildRain()
        if (next === 'snow' && !this.snow) this.buildSnow()
        if ((next === 'rain' || next === 'fog' || next === 'snow') && !this.spray) this.buildSpray()
      }
      this.wet = next === 'rain'
    }
    const w = this.curWeather
    if (this.rain) this.rain.visible = w === 'rain'
    if (this.snow) this.snow.visible = w === 'snow'
    const fogT = w === 'fog' ? 0.026 : w === 'rain' ? 0.011 : w === 'snow' ? 0.014 : this.fogBase
    const fog = this.scene.fog as THREE.FogExp2
    fog.density += (fogT - fog.density) * Math.min(1, dt * 0.6)
    // время суток дрейфует: день → вечер → ночь (или ночь → рассвет)
    if (this.darkTarget !== null) this.dark += (this.darkTarget - this.dark) * Math.min(1, dt * 1.4)
    else this.dark = Math.min(1, Math.max(0, this.dark + this.darkDir * dt * 0.0016))
    if (this.blinkT > 0) {
      this.blinkT -= dt
      if (this.blinkT <= 0) this.blink = 0
    }
    const k = 1 - 0.78 * this.dark
    this.scene.backgroundIntensity = 1 - 0.8 * this.dark
    this.scene.environmentIntensity = 1 - 0.35 * this.dark
    this.sun.intensity = this.sunBase * k * (w === 'clear' ? 1 : 0.5)
    if (this.lightning <= 0) this.hemi.intensity = this.hemiBase * (1 - 0.5 * this.dark)
    fog.color.copy(this.fogColor).multiplyScalar(1 - 0.85 * this.dark)
    const lamps = this.dark > 0.45 || w !== 'clear'
    if (lamps !== this.lampsOn) {
      this.lampsOn = lamps
      if (lamps && this.cones.length === 0) this.addHeadCones()
      for (const c of this.cones) c.visible = lamps
    }
    // снег
    if (this.snow && this.snowData && w === 'snow') {
      const d = this.snowData
      const cx = this.camera.position.x
      for (let i = 0; i < d.length; i += 3) {
        d[i + 1] -= 2.2 * dt
        d[i + 2] += this.speed * dt * 0.9
        d[i] += Math.sin(this.tClock + i) * 0.4 * dt
        if (d[i + 1] < 0 || d[i + 2] > 12) {
          d[i] = cx + rnd(-14, 14)
          d[i + 1] = rnd(8, 14)
          d[i + 2] = rnd(-55, 4)
        }
      }
      ;(this.snow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
  }

  /** Наезд на пешехода: импульс, отлёт с кувырками, штраф и предупреждение */
  private hitPed(m: THREE.Group, respawn: () => void) {
    const v = this.speed
    this.scene.attach(m) // сохраняем мировую позицию, дальше живёт в системе игрока
    const side = m.position.x >= this.px ? 1 : -1
    const k = 1 + v / 20
    this.flyers.push({
      m,
      vx: side * (2.5 + v * 0.28) + rnd(-0.6, 0.6),
      vy: 3 + v * 0.17,
      vz: -(v * 0.85), // уносит вперёд по ходу машины (скорость относительно земли)
      ax: rnd(-7, 7) * k,
      az: rnd(-6, 6) * k,
      t: 0,
      landed: false,
      bounced: false,
    })
    respawn()
    this.pedHits += 1
    this.violations += 1
    this.shake = Math.max(this.shake, 0.7)
    this.penalty = Math.min(this.penalty, 0.55)
    this.warning = `Сбит пешеход! Штраф ${PED_FINE.toLocaleString('ru-RU')} ₽`
    this.warnLeft = 4.5
    this.o.onFine?.(PED_FINE, 'Сбит пешеход')
    this.thump()
  }

  /** Триггер-зона перед бампером: пешеходы, попавшие в габарит машины */
  private checkPedHits() {
    if (this.ended || this.speed < 0.8) return
    const sp = this.player.spec
    const hw = sp.W / 2 + 0.3
    const front = -(sp.L / 2) - 0.3
    const back = sp.L * 0.2
    for (const j of this.junctions) {
      if (!j.root.visible) continue
      for (const p of j.peds) {
        if (p.gone && p.gone > 0) continue
        const wz = j.z + p.m.position.z
        if (Math.abs(p.m.position.x - this.px) < hw && wz > front && wz < back) {
          this.hitPed(p.m, () => {
            const nm = this.makePed(Math.floor(Math.random() * 6))
            nm.position.set(p.side * (ROAD_W / 2 + 1.7), 0, -7.5)
            nm.visible = false
            j.root.add(nm)
            p.m = nm
            p.state = 'wait'
            p.gone = 9
          })
        }
      }
    }
    for (const w of this.walkers) {
      if (Math.abs(w.x - this.px) < hw && w.z > front && w.z < back) {
        this.hitPed(w.m, () => {
          const nm = this.makePed(Math.floor(Math.random() * 6))
          this.scene.add(nm)
          w.m = nm
          w.z = rnd(-170, -110)
          nm.position.set(w.x, 0, w.z)
        })
      }
    }
  }

  private updateFlyers(dt: number, v: number) {
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i]
      f.t += dt
      f.vy -= 9.8 * dt
      f.m.position.x += f.vx * dt
      f.m.position.y += f.vy * dt
      f.m.position.z += (v + f.vz) * dt
      const leg = f.m.userData.legs as THREE.Mesh[]
      const arm = f.m.userData.arms as THREE.Mesh[]
      if (!f.landed) {
        f.m.rotation.x += f.ax * dt
        f.m.rotation.z += f.az * dt
        const fl = Math.sin(f.t * 16)
        leg[0].rotation.x = fl * 1.1
        leg[1].rotation.x = -fl * 1.1
        arm[0].rotation.z = 1.2 + fl * 0.4
        arm[1].rotation.z = -1.2 - fl * 0.4
      }
      if (f.m.position.y <= 0) {
        f.m.position.y = 0
        if (!f.bounced && f.vy < -2) {
          f.vy = -f.vy * 0.28
          f.bounced = true
          f.ax *= 0.4
          f.az *= 0.4
          f.vx *= 0.7
        } else {
          f.landed = true
          f.vy = 0
        }
      }
      if (f.landed) {
        const damp = Math.exp(-4.5 * dt)
        f.vx *= damp
        f.vz *= damp
        // ложится на землю
        f.m.rotation.x += (-Math.PI / 2 - f.m.rotation.x) * Math.min(1, dt * 5)
        f.m.rotation.z += (0 - f.m.rotation.z) * Math.min(1, dt * 5)
        f.m.position.y += (0.12 - f.m.position.y) * Math.min(1, dt * 6)
      }
      if (f.t > 5 || f.m.position.z > 60) {
        this.scene.remove(f.m)
        this.flyers.splice(i, 1)
      }
    }
    if (this.warnLeft > 0) this.warnLeft -= dt
  }

  private updateJunctions(dt: number, v: number) {
    void dt
    if (this.junctions.length === 0) for (let i = 0; i < 3; i++) this.junctions.push(this.makeJunction(i))
    // самый дальний перекрёсток впереди
    let far = Infinity
    for (const j of this.junctions) if (j.root.visible) far = Math.min(far, j.z)
    for (const j of this.junctions) {
      if (!j.root.visible) continue
      j.z += v * dt
      j.root.position.z = j.z
      // нарушение: пересечение стоп-линии на красный
      const lz = j.z - 8
      if (!this.ended && j.prevLine < 0 && lz >= 0 && !j.passed) {
        j.passed = true
        if (this.lightOf(j).state === 'red') {
          this.violations += 1
          this.eventText = 'Проезд на красный! Нарушение'
          this.eventLeft = 4
        } else if (j.peds.some((p) => p.state === 'cross' && Math.abs(p.m.position.x) < ROAD_W / 2 + 0.6)) {
          this.violations += 1
          this.eventText = 'Не уступили пешеходу'
          this.eventLeft = 4
        }
      }
      j.prevLine = lz
      const light = this.lightOf(j)
      const st = light.state
      // Пешеходы: начинают переход СТРОГО на красный для машин; на зелёный не выходят, а вышедшие ускоряются и завершают переход
      for (const p of j.peds) {
        if (p.gone && p.gone > 0) {
          p.gone -= dt
          if (p.gone <= 0) p.m.visible = true
          continue
        }
        const leg = p.m.userData.legs as THREE.Mesh[]
        const arm = p.m.userData.arms as THREE.Mesh[]
        if (p.state === 'wait') {
          p.cd -= dt
          leg[0].rotation.x = leg[1].rotation.x = arm[0].rotation.x = arm[1].rotation.x = 0
          if (st === 'red' && light.left >= 3 && p.cd <= 0) p.state = 'cross'
        } else {
          const target = -p.side * (ROAD_W / 2 + 1.7)
          const dir = Math.sign(target - p.m.position.x)
          const sp = st === 'red' ? 1.55 : 2.8
          p.m.position.x += dir * sp * dt
          p.m.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
          p.ph += dt * sp * 4.2
          const sw = Math.sin(p.ph) * 0.6
          leg[0].rotation.x = sw
          leg[1].rotation.x = -sw
          arm[0].rotation.x = -sw * 0.8
          arm[1].rotation.x = sw * 0.8
          if ((dir > 0 && p.m.position.x >= target) || (dir < 0 && p.m.position.x <= target)) {
            p.m.position.x = target
            p.state = 'wait'
            p.side = (-p.side) as -1 | 1
            p.cd = 2.5 + Math.random() * 3
            p.m.rotation.y = p.side > 0 ? -Math.PI / 2 : Math.PI / 2
          }
        }
      }
      j.lamps.forEach((m, idx) => {
        const kind = idx % 3 // 0 красный, 1 жёлтый, 2 зелёный
        const on = (kind === 0 && st === 'red') || (kind === 1 && st === 'yellow') || (kind === 2 && st === 'green')
        m.emissiveIntensity = on ? 3 : 0.04
      })
      if (j.z > 40) j.root.visible = false
    }
    if (far === Infinity || far > -170) {
      const free = this.junctions.find((j) => !j.root.visible)
      if (free && this.introT > 0.4) {
        free.offset = (free.offset + 7) % LIGHT_CYCLE
        this.placeJunction(free, far === Infinity ? -140 : far - rnd(170, 230))
      }
    }
  }

  /** Ближайший впереди светофор для HUD */
  private lightHud() {
    let best: Junction | null = null
    for (const j of this.junctions) if (j.root.visible && j.z - 8 < 4 && (!best || j.z > best.z)) best = j
    if (!best) return { light: null, lightLeft: 0 }
    const l = this.lightOf(best)
    return { light: l.state, lightLeft: Math.ceil(l.left) }
  }

  /** Поведение машин: красный — полная остановка до зелёного, дистанция до впереди идущего */
  private trafficBrain(t: Traffic, dt: number) {
    if (t.crashed || t.emergency) return
    if (t.isStatic) { t.speed = 0; return }
    let tv = t.base * (this.slowT > 0 ? 0.45 : 1)
    for (const j of this.junctions) {
      if (!j.root.visible) continue
      const d = t.z - (j.z - 8)
      if (d > -1 && d < 45) {
        const st = this.lightOf(j).state
        const pedOn = j.peds.some((p) => p.state === 'cross' && Math.abs(p.m.position.x) < ROAD_W / 2 + 1)
        if (st === 'red' || pedOn || (st === 'yellow' && d > 10)) tv = Math.min(tv, t.base * Math.min(1, Math.max(0, (d - 3) / 32)))
      }
    }
    for (const o of this.traffic) {
      if (o === t || o.crashed || Math.abs(o.x - t.x) > 1.7) continue
      const gap = t.z - o.z - t.half - o.half
      if (gap > 0 && gap < 16) tv = Math.min(tv, gap < 3.5 ? 0 : Math.max(0, o.speed * 0.95 * (gap / 16)))
    }
    t.speed += (tv - t.speed) * Math.min(1, dt * (tv < t.speed ? 2.6 : 0.9))
    if (t.speed < 0.05) t.speed = 0
  }

  /** Автопилот: держит полосу, объезжает помехи, тормозит на красный и перед впереди идущими */
  private autopilotStep(dt: number, maxV: number) {
    this.autoCap = maxV
    // светофор
    for (const j of this.junctions) {
      if (!j.root.visible) continue
      const d = -(j.z - 8)
      if (d > 0 && d < 55) {
        const st = this.lightOf(j).state
        const pedOn = j.peds.some((p) => p.state === 'cross' && Math.abs(p.m.position.x) < ROAD_W / 2 + 1)
        if (st === 'red' || pedOn || (st === 'yellow' && d > 14)) this.autoCap = Math.min(this.autoCap, maxV * Math.min(1, Math.max(0, (d - 4) / 36)))
      }
    }
    // впереди идущие
    let lead: Traffic | null = null
    for (const t of this.traffic) {
      if (t.crashed || t.z > 0 || Math.abs(t.x - this.px) > 1.9) continue
      if (!lead || t.z > lead.z) lead = t
    }
    if (lead) {
      const gap = -lead.z - lead.half - this.player.spec.L / 2
      if (gap < 30) this.autoCap = Math.min(this.autoCap, Math.max(0, lead.speed * (gap / 30)))
      this.autoCd -= dt
      if (gap < 22 && this.autoCd <= 0) {
        // искать свободную соседнюю полосу
        for (const dir of [-1, 1] as const) {
          const l = Math.max(0, Math.min(LANES - 1, this.target + dir))
          if (l === this.target) continue
          const blocked = this.traffic.some((t) => !t.crashed && Math.abs(t.x - laneX(l)) < 1.9 && t.z > -40 && t.z < 12)
          if (!blocked) { this.target = l; this.autoCd = 2.5; break }
        }
      }
    }
  }

  private recycle(i: number) {
    const t = this.traffic[i]
    t.active = false
    t.built.root.visible = false
    this.traffic.splice(i, 1)
    this.pool.push(t)
  }

  private updateCamera(dt: number, v: number) {
    const cam = this.camera
    const sp = Math.min(1, v / 40)
    const L = this.player.spec.L
    const chaseR = L / 2 + 4.6 + sp * 0.8
    const chaseH = 2.25 + L * 0.04
    const lookZ = -9 - sp * 6
    if (this.introT < 1) {
      // кинематографичный пролёт: от переда-сбоку к виду за машиной
      const t = this.introT
      const e = t * t * (3 - 2 * t)
      const ang = (1 - e) * 2.6
      const r = 8 + (chaseR - 8) * e
      const h = 1.5 + (chaseH - 1.5) * e
      cam.position.set(this.px + Math.sin(ang) * r, h, Math.cos(ang) * r)
      cam.lookAt(this.px * (1 - e) + this.px * 0.9 * e, 0.8 + 0.2 * e, lookZ * e)
    } else {
      cam.position.x += (this.px * 0.7 - cam.position.x) * Math.min(1, dt * 4)
      cam.position.y += (chaseH - cam.position.y) * Math.min(1, dt * 4)
      cam.position.z += (chaseR - cam.position.z) * Math.min(1, dt * 4)
      cam.lookAt(this.px * 0.9, 1.0, lookZ)
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2)
      cam.position.x += rnd(-1, 1) * this.shake * 0.25
      cam.position.y += rnd(-1, 1) * this.shake * 0.18
    }
    cam.position.y += Math.sin(this.elapsed * 0.045) * 0.004 * sp
    cam.rotation.z += -this.pvx * 0.004
    const fov = 58 + sp * 18 + (this.introT < 1 ? (1 - this.introT) * -10 : 0)
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 3)
      cam.updateProjectionMatrix()
    }
  }

  private updateWeather(dt: number, v: number) {
    const weather = this.curWeather
    if (this.rain && this.rainData && weather === 'rain') {
      const d = this.rainData
      const cx = this.camera.position.x
      const fall = 34
      for (let i = 0; i < d.length; i += 6) {
        d[i + 1] -= fall * dt
        d[i + 2] += v * dt * 0.9
        d[i + 4] = d[i + 1] + 1.1
        d[i + 5] = d[i + 2] - v * 0.012 // наклон капель по движению
        d[i + 3] = d[i]
        if (d[i + 1] < 0 || d[i + 2] > 12) {
          d[i] = cx + rnd(-16, 16)
          d[i + 1] = rnd(12, 17)
          d[i + 2] = rnd(-55, 8)
          d[i + 3] = d[i]
        }
        d[i + 4] = d[i + 1] + 1.1
      }
      ;(this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      // молния
      this.nextBolt -= dt
      if (this.nextBolt <= 0) {
        this.lightning = 1
        this.nextBolt = rnd(7, 16)
      }
      if (this.lightning > 0) {
        this.lightning = Math.max(0, this.lightning - dt * 2.6)
        const flick = this.lightning > 0.55 ? 1 : this.lightning > 0.4 ? 0.2 : this.lightning
        this.hemi.intensity = 0.4 + flick * 6
        this.renderer.toneMappingExposure = 0.95 + flick * 0.6
      } else {
        this.hemi.intensity += (0.45 - this.hemi.intensity) * Math.min(1, dt * 4)
      }
    }
    if (this.spray && this.sprayData) {
      const s = this.sprayData
      const rearZ = this.player.spec.L / 2 - 0.2
      for (let i = 0; i < s.life.length; i++) {
        if (s.life[i] <= 0) {
          if (v > 8 && Math.random() < dt * 14) {
            const side = Math.random() < 0.5 ? -1 : 1
            s.pos[i * 3] = this.px + side * 0.85
            s.pos[i * 3 + 1] = 0.12
            s.pos[i * 3 + 2] = rearZ
            s.vel[i * 3] = side * rnd(0.2, 1.4)
            s.vel[i * 3 + 1] = rnd(0.6, 2)
            s.vel[i * 3 + 2] = rnd(2, 6) + v * 0.35
            s.life[i] = rnd(0.5, 1.1)
          } else {
            s.pos[i * 3 + 1] = -5
          }
        } else {
          s.life[i] -= dt
          s.pos[i * 3] += s.vel[i * 3] * dt
          s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt
          s.pos[i * 3 + 2] += (s.vel[i * 3 + 2] - v) * dt
          s.vel[i * 3 + 1] -= 3 * dt
        }
      }
      ;(this.spray.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // лужи: блики на асфальте дрожат
    if (this.curWeather === 'rain') this.roadMat.roughness = 0.2 + Math.sin(this.elapsed * 0.0015) * 0.03
  }

  /* ---------------------------------------------------------------- */

  private resize() {
    const el = this.o.canvas.parentElement ?? this.o.canvas
    const w = Math.max(160, el.clientWidth)
    const h = Math.max(160, el.clientHeight)
    this.renderer.setSize(w, h, false)
    this.o.canvas.style.width = '100%'
    this.o.canvas.style.height = '100%'
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    try {
      this.audio?.osc1.stop()
      this.audio?.osc2.stop()
      this.audio?.osc3.stop()
      this.siren?.osc.stop()
      if (this.audio) unregisterAudioContext(this.audio.ctx)
      void this.audio?.ctx.close()
    } catch {
      /* ignore */
    }
    this.player.dispose()
    for (const t of [...this.traffic, ...this.pool]) t.built.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh || (o as THREE.Points).isPoints || (o as THREE.LineSegments).isLine) {
        m.geometry?.dispose()
      }
    })
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
  }
}

export { paintFromName }
