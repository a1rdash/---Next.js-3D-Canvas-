import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Phase, TabId } from '@/lib/game/types'

/* ================================================================== */
/*  Процедурные 3D-фоны для вкладок                                     */
/*  garage — интерьер гаража (6 уровней), lot — парковка,              */
/*  auction — зал аукциона, market — рынок под открытым небом + город, */
/*  profile/about — атмосферный неоновый фон.                          */
/* ================================================================== */

export interface BackdropScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  update(t: number): void
  dispose(): void
}

const SKY: Record<Phase, { top: number; fog: number; amb: number; sun: number }> = {
  morning: { top: 0xf2b08a, fog: 0xe9c5a8, amb: 0.75, sun: 0.9 },
  day: { top: 0x7fb6ea, fog: 0xbfd8ef, amb: 1, sun: 1.2 },
  evening: { top: 0xb8508a, fog: 0x6b3a72, amb: 0.6, sun: 0.7 },
  night: { top: 0x070a1c, fog: 0x0a0c22, amb: 0.35, sun: 0.15 },
}

class Kit {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(52, 9 / 16, 0.1, 200)
  private disposables: { dispose(): void }[] = []
  private anims: ((t: number) => void)[] = []

  own<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o)
    return o
  }
  animate(fn: (t: number) => void) {
    this.anims.push(fn)
  }
  mat(color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    return this.own(new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...o }))
  }
  glow(color: number, intensity = 1.6) {
    return this.own(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity }))
  }
  box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.scene) {
    // скруглённые грани вместо «квадратиков»; тонкие панели остаются плоскими
    const minDim = Math.min(w, h, d)
    const geo = minDim > 0.1 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(0.07, minDim * 0.2)) : new THREE.BoxGeometry(w, h, d)
    const mesh = new THREE.Mesh(this.own(geo), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  cyl(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 32, parent: THREE.Object3D = this.scene) {
    const mesh = new THREE.Mesh(this.own(new THREE.CylinderGeometry(rt, rb, h, Math.max(seg, 32))), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  plane(w: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(this.own(new THREE.PlaneGeometry(w, h)), m)
    mesh.position.set(x, y, z)
    mesh.receiveShadow = true
    this.scene.add(mesh)
    return mesh
  }
  /** простая стилизованная машинка-силуэт */
  car(color: number, x: number, y: number, z: number, rotY = 0, scale = 1) {
    const g = new THREE.Group()
    const body = this.mat(color, { metalness: 0.7, roughness: 0.3 })
    const glass = this.mat(0x10141c, { metalness: 0.6, roughness: 0.1 })
    const hull = new THREE.Mesh(this.own(new RoundedBoxGeometry(1.8, 0.5, 4.2, 6, 0.22)), body)
    hull.position.set(0, 0.52, 0)
    hull.castShadow = true
    g.add(hull)
    const cab = new THREE.Mesh(this.own(new RoundedBoxGeometry(1.5, 0.5, 2.0, 6, 0.24)), glass)
    cab.position.set(0, 0.95, -0.1)
    cab.castShadow = true
    g.add(cab)
    const tire = this.mat(0x0a0a0c)
    for (const sx of [-0.9, 0.9]) for (const sz of [-1.3, 1.3]) {
      const w = this.cyl(0.36, 0.36, 0.28, tire, sx, 0.36, sz, 32, g)
      w.rotation.z = Math.PI / 2
    }
    const head = this.glow(0xfff2c0, 1.4)
    this.box(0.4, 0.12, 0.06, head, -0.6, 0.55, -2.11, g)
    this.box(0.4, 0.12, 0.06, head, 0.6, 0.55, -2.11, g)
    g.position.set(x, y, z)
    g.rotation.y = rotY
    g.scale.setScalar(scale)
    this.scene.add(g)
    return g
  }
  tex(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    draw(cv.getContext('2d')!, w, h)
    const t = this.own(new THREE.CanvasTexture(cv))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  label(text: string, color: string, w = 512, h = 128) {
    return this.tex((c, W, H) => {
      c.clearRect(0, 0, W, H)
      c.fillStyle = 'rgba(6,6,16,0.85)'
      c.fillRect(0, 0, W, H)
      c.strokeStyle = color
      c.lineWidth = 6
      c.strokeRect(6, 6, W - 12, H - 12)
      c.fillStyle = color
      c.shadowColor = color
      c.shadowBlur = 18
      c.font = `bold ${Math.floor(H * 0.5)}px system-ui, sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(text, W / 2, H / 2 + 4)
    }, w, h)
  }
  sky(phase: Phase, fogNear = 20, fogFar = 90) {
    const s = SKY[phase]
    this.scene.background = new THREE.Color(s.top)
    this.scene.fog = new THREE.Fog(s.fog, fogNear, fogFar)
    return s
  }
  finish(): BackdropScene {
    return {
      scene: this.scene,
      camera: this.camera,
      update: (t) => this.anims.forEach((a) => a(t)),
      dispose: () => {
        this.scene.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
        })
        this.disposables.forEach((d) => d.dispose())
      },
    }
  }
}

const concreteTex = (k: Kit, base = '#3a3c44', line = '#2b2d34') =>
  k.tex((c, w, h) => {
    c.fillStyle = base
    c.fillRect(0, 0, w, h)
    // мягкие пятна и разводы вместо резкого «шума»
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 30 + Math.random() * 90
      const g = c.createRadialGradient(x, y, 0, x, y, r)
      const a = Math.random() < 0.5 ? '255,255,255' : '0,0,0'
      g.addColorStop(0, `rgba(${a},${0.03 + Math.random() * 0.04})`)
      g.addColorStop(1, `rgba(${a},0)`)
      c.fillStyle = g
      c.fillRect(x - r, y - r, r * 2, r * 2)
    }
    c.strokeStyle = line
    c.globalAlpha = 0.55
    c.lineWidth = 2
    c.strokeRect(0, 0, w, h)
    c.globalAlpha = 1
  }, 512, 512)

function repeatTex(t: THREE.Texture, x: number, y: number) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(x, y)
  return t
}

/* ------------------------------------------------------------------ */
/*  ГАРАЖ — 6 уровней: с каждым уровнем просторнее и богаче            */
/* ------------------------------------------------------------------ */

export function garageScene(level: number, phase: Phase): BackdropScene {
  const k = new Kit()
  const L = Math.max(1, Math.min(6, level))
  const W = 7 + L * 1.4
  const D = 11 + L * 1.2
  const H = 3.4 + L * 0.15
  const night = phase === 'night'
  k.scene.background = new THREE.Color(0x07080f)
  k.scene.fog = new THREE.Fog(0x07080f, 12, 40)

  k.scene.add(new THREE.HemisphereLight(0x8fa2ff, 0x141018, 0.5 + L * 0.06))

  // пол: бетон → эпоксид → глянец
  const floorTex = repeatTex(concreteTex(k, L >= 5 ? '#1c1f2a' : '#3a3c44', L >= 5 ? '#2a3350' : '#2b2d34'), W / 2.2, D / 2.2)
  const floor = k.plane(W, D, k.mat(0xffffff, { map: floorTex, roughness: L >= 5 ? 0.22 : L >= 3 ? 0.5 : 0.8, metalness: L >= 5 ? 0.5 : 0.08 }), 0, 0, 0)
  floor.rotation.x = -Math.PI / 2
  const wallMat = k.mat(L >= 4 ? 0x20243a : 0x2c2a30, { roughness: 0.9 })
  k.box(W, H, 0.3, wallMat, 0, H / 2, -D / 2) // задняя стена
  k.box(0.3, H, D, wallMat, -W / 2, H / 2, 0)
  k.box(0.3, H, D, wallMat, W / 2, H / 2, 0)
  k.box(W, 0.3, D, k.mat(0x17181f), 0, H, 0) // потолок
  // ворота-ролета с ребристой текстурой + окна
  const door = k.tex((c, w, h) => {
    c.fillStyle = '#4a4e5a'
    c.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 16) {
      c.fillStyle = y % 32 ? '#555a68' : '#3b3f4a'
      c.fillRect(0, y, w, 8)
    }
  })
  k.box(W * 0.55, H * 0.78, 0.12, k.mat(0xffffff, { map: door, metalness: 0.5, roughness: 0.5 }), 0, H * 0.4, -D / 2 + 0.2)
  const winCol = night ? 0x1a2a5a : phase === 'evening' ? 0xff9a6a : 0xbfe3ff
  k.box(W * 0.55, 0.22, 0.14, k.glow(winCol, night ? 0.6 : 1.4), 0, H * 0.82, -D / 2 + 0.22)

  // света: от лампочки до светодиодной системы
  const lightCount = Math.min(4, 1 + Math.floor(L / 2))
  for (let i = 0; i < lightCount; i++) {
    const z = D / 2 - 2.5 - (i * (D - 4)) / lightCount
    const col = L >= 5 ? 0xaedcff : L >= 3 ? 0xf4f8ff : 0xffd9a0
    const p = new THREE.PointLight(col, 18 + L * 4, 14, 1.6)
    p.position.set(0, H - 0.5, z)
    k.scene.add(p)
    k.box(L >= 2 ? W * 0.5 : 0.25, 0.08, L >= 2 ? 0.14 : 0.25, k.glow(col, 2.4), 0, H - 0.1, z)
  }
  // ключевой свет со мягкими тенями над местом машины
  const keySpot = new THREE.SpotLight(0xfff4e0, 120, 18, 0.7, 0.8, 1.4)
  keySpot.position.set(2.5, H - 0.4, 3)
  keySpot.target.position.set(0, 0.5, -1)
  keySpot.castShadow = true
  keySpot.shadow.mapSize.set(1024, 1024)
  keySpot.shadow.bias = -0.0004
  keySpot.shadow.radius = 5
  k.scene.add(keySpot, keySpot.target)
  // место под машину: разметка
  k.plane(2.6, 5, k.glow(L >= 3 ? 0xffd84a : 0x555a68, L >= 3 ? 0.5 : 0.2), 0, 0.01, -1).rotation.x = -Math.PI / 2
  // базовое: бочки и покрышки
  const barrel = k.mat(0x2b4a8a, { metalness: 0.6, roughness: 0.4 })
  k.cyl(0.35, 0.35, 0.9, barrel, W / 2 - 1, 0.45, -D / 2 + 1.2)
  k.cyl(0.35, 0.35, 0.9, k.mat(0x8a2b2b, { metalness: 0.6, roughness: 0.4 }), W / 2 - 1.8, 0.45, -D / 2 + 1.0)
  for (let i = 0; i < 4; i++) k.cyl(0.4, 0.4, 0.22, k.mat(0x0b0b0d), -W / 2 + 1.1, 0.12 + i * 0.22, -D / 2 + 1.1, 16)
  k.box(2.0, 0.9, 0.8, k.mat(0x6b4a2a), -W / 2 + 2.2, 0.45, -D / 2 + 0.9) // верстак

  if (L >= 2) {
    // стеллажи с коробками
    const metal = k.mat(0x7c828f, { metalness: 0.8, roughness: 0.4 })
    for (let s = 0; s < Math.min(3, L); s++) {
      const z = -D / 2 + 3 + s * 2.4
      for (const lv of [0.4, 1.1, 1.8]) k.box(0.7, 0.05, 2.0, metal, -W / 2 + 0.55, lv, z)
      for (const px of [-1, 1]) k.box(0.05, 2.1, 0.05, metal, -W / 2 + 0.55, 1.05, z + px * 1.0)
      for (let b = 0; b < 5; b++) k.box(0.4, 0.3, 0.45, k.mat([0xc2864a, 0x4a7cc2, 0xb04a4a, 0x5ac27a, 0xe6c14a][b % 5]), -W / 2 + 0.55, 0.62 + (b % 3) * 0.7, z + (b - 2) * 0.36)
    }
  }
  if (L >= 3) {
    // инструментальные шкафы и доска с инструментами
    for (let i = 0; i < 3; i++) k.box(0.8, 1.2, 0.6, k.mat(0xb02a2a, { metalness: 0.5, roughness: 0.45 }), W / 2 - 0.6, 0.6, -D / 2 + 2.2 + i * 0.9)
    k.box(0.06, 1.1, 2.4, k.mat(0x2a2d36), W / 2 - 0.2, 1.9, -D / 2 + 3)
    for (let i = 0; i < 14; i++) k.box(0.05, 0.08 + (i % 3) * 0.06, 0.05, k.mat([0xd4d8e0, 0xe6a23a, 0x8aa0b8][i % 3], { metalness: 0.9 }), W / 2 - 0.28, 1.6 + (i % 4) * 0.25, -D / 2 + 2.2 + (i % 7) * 0.32)
  }
  if (L >= 4) {
    // подъёмник с машиной + неоновая вывеска
    const steel = k.mat(0xe0b020, { metalness: 0.6, roughness: 0.4 })
    k.box(0.22, 3.0, 0.22, steel, -1.6, 1.5, -1.4)
    k.box(0.22, 3.0, 0.22, steel, 1.6, 1.5, -1.4)
    k.box(3.4, 0.14, 0.4, steel, 0, 2.3, -1.4)
    k.car(0x2b6cff, 0, 1.25, -1.0, 0, 0.82)
    const sign = k.tex((c, w, h) => {
      c.fillStyle = 'rgba(5,5,14,0.9)'
      c.fillRect(0, 0, w, h)
      c.strokeStyle = '#22d3ee'
      c.lineWidth = 8
      c.strokeRect(8, 8, w - 16, h - 16)
      c.fillStyle = '#22d3ee'
      c.shadowColor = '#22d3ee'
      c.shadowBlur = 24
      c.font = 'bold 70px system-ui, sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('GARAGE', w / 2, h / 2)
    }, 512, 160)
    const signMesh = k.plane(3.2, 1.0, new THREE.MeshBasicMaterial({ map: sign, transparent: true }), -W / 4, H - 1.0, -D / 2 + 0.2)
    k.animate((t) => ((signMesh.material as THREE.MeshBasicMaterial).opacity = 0.85 + Math.sin(t * 3) * 0.12))
  }
  if (L >= 5) {
    // диагностическая стойка и светодиодные панели на стенах
    k.box(1.3, 1.1, 0.7, k.mat(0x1c1f2a, { metalness: 0.6 }), W / 2 - 1.4, 0.55, D / 2 - 3)
    k.box(0.9, 0.55, 0.05, k.glow(0x22d3ee, 1.2), W / 2 - 1.4, 1.35, D / 2 - 3.3)
    for (let i = 0; i < 5; i++) k.box(0.06, 1.8, 0.4, k.glow([0x22d3ee, 0xec4899][i % 2], 1.5), -W / 2 + 0.2, 1.8, -D / 2 + 1 + i * 1.5)
  }
  if (L >= 6) {
    // шоу-рум: стеклянные перегородки, подиум с вращающимся авто, неон по периметру
    const glass = k.mat(0x9fd8ff, { transparent: true, opacity: 0.18, metalness: 0.8, roughness: 0.05 })
    k.box(W * 0.9, 2.6, 0.06, glass, 0, 1.3, D / 2 - 1.5)
    const podium = k.cyl(1.9, 2.1, 0.22, k.mat(0x15172a, { metalness: 0.6, roughness: 0.3 }), 0, 0.11, D / 2 - 5.4, 32)
    const showcar = k.car(0xec4899, 0, 0.22, D / 2 - 5.4, 0, 0.78)
    const spot = new THREE.SpotLight(0xffffff, 90, 14, 0.5, 0.6, 1.2)
    spot.position.set(0, H - 0.3, D / 2 - 5.4)
    spot.target = podium
    k.scene.add(spot)
    k.animate((t) => (showcar.rotation.y = t * 0.4))
    for (const [x, c] of [[-W / 2 + 0.4, 0xec4899], [W / 2 - 0.4, 0x22d3ee]] as const) k.box(0.08, 0.08, D, k.glow(c, 2.2), x, H - 0.2, 0)
  }
  // «ожидающая» машина в боксе на нижних уровнях
  if (L < 4) k.car(L === 1 ? 0x8a2a2a : 0x3a7a5a, 0, 0, -0.8, 0.1, 0.85)

  k.camera.fov = 56
  k.camera.position.set(0, 1.7, D / 2 - 0.5)
  k.animate((t) => {
    k.camera.position.x = Math.sin(t * 0.18) * 0.9
    k.camera.position.y = 1.7 + Math.sin(t * 0.23) * 0.08
    k.camera.lookAt(0, 1.3, -D / 2 + 1)
  })
  return k.finish()
}

/* ------------------------------------------------------------------ */
/*  СТОЯНКА — парковочная зона                                          */
/* ------------------------------------------------------------------ */

/** Процедурная «фото-текстура» парковки: перспектива, размытая глубина резкости, блики, зерно. */
function parkingTexture(k: Kit, phase: Phase) {
  const night = phase === 'night'
  const evening = phase === 'evening'
  return k.tex((c, W, H) => {
    const horizon = H * 0.46
    const sky = c.createLinearGradient(0, 0, 0, horizon)
    if (night) { sky.addColorStop(0, '#05070f'); sky.addColorStop(1, '#1b2038') }
    else if (evening) { sky.addColorStop(0, '#3b3b78'); sky.addColorStop(0.6, '#c2557f'); sky.addColorStop(1, '#f6a15e') }
    else if (phase === 'morning') { sky.addColorStop(0, '#6f9fd0'); sky.addColorStop(1, '#f6d2a8') }
    else { sky.addColorStop(0, '#4d8fd8'); sky.addColorStop(1, '#cfe4f6') }
    c.fillStyle = sky
    c.fillRect(0, 0, W, horizon)
    const blur = (px: number) => { try { c.filter = px ? `blur(${px}px)` : 'none' } catch { /* без поддержки filter */ } }
    // облака
    blur(14)
    for (let i = 0; i < 9; i++) {
      c.fillStyle = night ? 'rgba(60,70,110,0.18)' : evening ? 'rgba(255,190,170,0.25)' : 'rgba(255,255,255,0.45)'
      c.beginPath()
      c.ellipse(Math.random() * W, 40 + Math.random() * horizon * 0.5, 120 + Math.random() * 220, 22 + Math.random() * 30, 0, 0, Math.PI * 2)
      c.fill()
    }
    // дальний ряд деревьев и зданий (дальняя глубина — сильнее размыта)
    blur(7)
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * W + Math.random() * 40
      const h = 40 + Math.random() * 90
      c.fillStyle = night ? '#0a1018' : evening ? '#3a2d48' : '#4a6a5a'
      c.beginPath()
      c.ellipse(x, horizon - 4, 50 + Math.random() * 40, h, 0, Math.PI, 0)
      c.fill()
    }
    c.fillStyle = night ? '#0c1020' : '#7b8497'
    for (let i = 0; i < 9; i++) c.fillRect(120 + i * 220, horizon - 70 - Math.random() * 90, 120 + Math.random() * 70, 160)
    // асфальт с градиентом
    blur(0)
    const ground = c.createLinearGradient(0, horizon, 0, H)
    ground.addColorStop(0, night ? '#14161f' : '#555a64')
    ground.addColorStop(1, night ? '#07080c' : '#23262e')
    c.fillStyle = ground
    c.fillRect(0, horizon, W, H - horizon)
    // разметка парковочных мест в перспективе
    const vx = W / 2
    blur(1.2)
    c.strokeStyle = night ? 'rgba(220,220,230,0.55)' : 'rgba(245,245,245,0.9)'
    for (let i = -14; i <= 14; i++) {
      c.lineWidth = 1 + Math.abs(i) * 0.06 + 2.6
      c.beginPath()
      c.moveTo(vx + i * 26, horizon + 2)
      c.lineTo(vx + i * 150, H)
      c.stroke()
    }
    for (let r = 1; r < 6; r++) {
      const y = horizon + (H - horizon) * Math.pow(r / 6, 1.8)
      c.lineWidth = 2 + r * 1.2
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(W, y)
      c.stroke()
    }
    // припаркованные машины: чем ближе, тем крупнее и чётче
    const cols = ['#b9202f', '#1d5fd6', '#e8eaee', '#1f2228', '#e0a21a', '#2a8f5c', '#7a4bd0', '#9aa1ad']
    for (let row = 0; row < 3; row++) {
      const depth = row / 3
      const y = horizon + 20 + (H - horizon) * Math.pow((row + 1) / 4, 1.5)
      const scale = 0.5 + row * 0.55
      blur(row === 0 ? 3.2 : row === 1 ? 1.6 : 0.8)
      for (let i = 0; i < 6 - row; i++) {
        const x = ((i + 0.5) / (6 - row)) * W
        const cw = 200 * scale
        const ch = 54 * scale
        const col = cols[(row * 3 + i * 2) % cols.length]
        const g = c.createLinearGradient(0, y - ch, 0, y)
        g.addColorStop(0, col)
        g.addColorStop(1, 'rgba(0,0,0,0.65)')
        c.fillStyle = 'rgba(0,0,0,0.35)'
        c.beginPath(); c.ellipse(x, y + 4 * scale, cw * 0.55, 8 * scale, 0, 0, Math.PI * 2); c.fill()
        c.fillStyle = g
        c.beginPath(); c.roundRect(x - cw / 2, y - ch, cw, ch * 0.72, 18 * scale); c.fill()
        c.fillStyle = night ? 'rgba(20,24,36,0.9)' : 'rgba(30,40,60,0.85)'
        c.beginPath(); c.roundRect(x - cw * 0.3, y - ch * 1.45, cw * 0.58, ch * 0.62, 16 * scale); c.fill()
        c.fillStyle = 'rgba(255,255,255,0.18)'
        c.beginPath(); c.roundRect(x - cw * 0.28, y - ch * 1.42, cw * 0.25, ch * 0.22, 8 * scale); c.fill()
        c.fillStyle = '#0b0b0e'
        c.beginPath(); c.arc(x - cw * 0.3, y - ch * 0.05, ch * 0.3, 0, Math.PI * 2); c.arc(x + cw * 0.3, y - ch * 0.05, ch * 0.3, 0, Math.PI * 2); c.fill()
        if (night || evening) {
          c.fillStyle = 'rgba(255,240,200,0.9)'
          c.beginPath(); c.ellipse(x + cw * 0.48, y - ch * 0.55, 7 * scale, 4 * scale, 0, 0, Math.PI * 2); c.fill()
        }
      }
      void depth
    }
    // фонари и боке
    blur(5)
    for (let i = 0; i < 7; i++) {
      const x = (i + 0.5) * (W / 7)
      c.fillStyle = '#2b2f3a'
      c.fillRect(x - 3, horizon - 120, 6, 130)
      if (night || evening) {
        const g = c.createRadialGradient(x, horizon - 124, 0, x, horizon - 124, 90)
        g.addColorStop(0, 'rgba(255,230,160,0.95)'); g.addColorStop(1, 'rgba(255,230,160,0)')
        c.fillStyle = g
        c.fillRect(x - 90, horizon - 214, 180, 180)
      }
    }
    // мокрый блик на асфальте
    blur(18)
    const sheen = c.createLinearGradient(0, horizon, 0, H)
    sheen.addColorStop(0, night ? 'rgba(120,150,255,0.10)' : 'rgba(255,255,255,0.10)'); sheen.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = sheen
    c.fillRect(0, horizon, W, H - horizon)
    blur(0)
    // виньетка и мелкое зерно
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)')
    c.fillStyle = vg
    c.fillRect(0, 0, W, H)
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`
      c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5)
    }
  }, 2048, 1024)
}

export function lotScene(phase: Phase): BackdropScene {
  const k = new Kit()
  k.scene.background = new THREE.Color(0x05060d)
  const mat = new THREE.MeshBasicMaterial({ map: parkingTexture(k, phase), fog: false, toneMapped: false })
  k.own(mat)
  // Если положить свою фотографию в public/backdrops/parking.jpg — она заменит процедурную текстуру
  new THREE.TextureLoader().load(
    '/backdrops/parking.jpg',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      k.own(tex)
      mat.map = tex
      mat.needsUpdate = true
    },
    undefined,
    () => {
      /* файла нет — остаётся процедурная текстура */
    },
  )
  const dist = 30
  k.camera.fov = 50
  const hh = 2 * Math.tan((k.camera.fov * Math.PI) / 360) * dist * 1.25
  const plane = new THREE.Mesh(k.own(new THREE.PlaneGeometry(hh * 2, hh)), mat)
  plane.position.set(0, 0, -dist)
  k.scene.add(plane)
  k.camera.position.set(0, 0, 0)
  k.animate((t) => {
    // лёгкий параллакс: фото «дышит»
    plane.position.x = Math.sin(t * 0.12) * 1.2
    plane.position.y = Math.sin(t * 0.09) * 0.4
    plane.rotation.z = Math.sin(t * 0.07) * 0.004
  })
  return k.finish()
}

/* ------------------------------------------------------------------ */
/*  АУКЦИОН — интерьер зала                                             */
/* ------------------------------------------------------------------ */

export function auctionScene(): BackdropScene {
  const k = new Kit()
  k.scene.background = new THREE.Color(0x0a0612)
  k.scene.fog = new THREE.Fog(0x0a0612, 10, 38)
  k.scene.add(new THREE.HemisphereLight(0xb69cff, 0x1a0c18, 0.5))

  const carpet = k.tex((c, w, h) => {
    c.fillStyle = '#4a1020'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = '#6b1a30'
    c.lineWidth = 3
    for (let i = 0; i < w; i += 32) {
      c.beginPath()
      c.moveTo(i, 0)
      c.lineTo(i + 32, h)
      c.stroke()
    }
  })
  repeatTex(carpet, 8, 10)
  const floor = k.plane(26, 34, k.mat(0xffffff, { map: carpet, roughness: 0.95 }), 0, 0, -6)
  floor.rotation.x = -Math.PI / 2
  const wall = k.mat(0x1c1426)
  k.box(26, 9, 0.4, wall, 0, 4.5, -17)
  k.box(0.4, 9, 34, wall, -13, 4.5, -6)
  k.box(0.4, 9, 34, wall, 13, 4.5, -6)
  k.box(26, 0.4, 34, k.mat(0x120b1a), 0, 9, -6)

  // сцена, кафедра и экран с «лотом»
  k.box(11, 0.6, 4.5, k.mat(0x2a1a38, { metalness: 0.4, roughness: 0.5 }), 0, 0.3, -14.4)
  k.box(1.4, 1.3, 0.9, k.mat(0x6b4a2a), -3, 1.25, -14)
  k.box(0.6, 0.12, 0.3, k.mat(0xd8b24a, { metalness: 1, roughness: 0.2 }), -3, 1.95, -14)
  const screenTex = k.label('ЛОТ №7 · ТОРГИ', '#ec4899', 768, 256)
  const screen = k.plane(8, 2.6, new THREE.MeshBasicMaterial({ map: screenTex }), 1.5, 4.6, -16.6)
  k.animate((t) => ((screen.material as THREE.MeshBasicMaterial).color.setScalar(0.85 + Math.sin(t * 2.4) * 0.15)))
  k.car(0xe6c14a, 3, 0.6, -14.2, -0.4, 1.15) // лот на подиуме

  // ряды кресел
  const seat = k.mat(0x2b2f6a, { roughness: 0.7 })
  for (let r = 0; r < 6; r++) for (let c = -5; c <= 5; c++) {
    if (c === 0) continue
    const x = c * 1.15 + (c > 0 ? -0.55 : 0.55)
    const z = -9 + r * 1.8
    k.box(0.8, 0.12, 0.8, seat, x, 0.5, z)
    k.box(0.8, 0.8, 0.12, seat, x, 0.95, z - 0.4)
  }
  // колонны, люстры и прожекторы с лучами
  for (const x of [-10, 10]) for (const z of [-12, -4, 4]) k.cyl(0.4, 0.4, 9, k.mat(0x2a2236, { metalness: 0.4 }), x, 4.5, z)
  const beamMat = k.own(new THREE.MeshBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
  const beams: THREE.Mesh[] = []
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.Mesh(k.own(new THREE.ConeGeometry(1.8, 8.5, 20, 1, true)), beamMat)
    cone.position.set(-4.5 + i * 3, 4.75, -13)
    k.scene.add(cone)
    beams.push(cone)
    k.box(0.5, 0.3, 0.5, k.glow(i % 2 ? 0x22d3ee : 0xec4899, 2), -4.5 + i * 3, 9, -13)
    const p = new THREE.PointLight(i % 2 ? 0x22d3ee : 0xec4899, 25, 14, 1.8)
    p.position.set(-4.5 + i * 3, 8, -12)
    k.scene.add(p)
  }
  k.animate((t) => beams.forEach((b, i) => (b.rotation.z = Math.sin(t * 0.7 + i) * 0.12)))
  k.box(0.1, 0.1, 22, k.glow(0xd8b24a, 1.4), -9.5, 7, -6)

  k.camera.fov = 56
  k.camera.position.set(0, 2.2, 6)
  k.animate((t) => {
    k.camera.position.x = Math.sin(t * 0.16) * 1.4
    k.camera.lookAt(0, 2.1, -14)
  })
  return k.finish()
}

/* ------------------------------------------------------------------ */
/*  РЫНОК — торговая площадка под открытым небом, город на фоне        */
/* ------------------------------------------------------------------ */

export function marketScene(phase: Phase): BackdropScene {
  const k = new Kit()
  const s = k.sky(phase, 25, 120)
  k.scene.add(new THREE.HemisphereLight(s.top, 0x2a2430, 0.5 + s.amb * 0.45))
  const sun = new THREE.DirectionalLight(0xfff0d8, s.sun)
  sun.position.set(10, 16, 8)
  k.scene.add(sun)

  const cobble = k.tex((c, w, h) => {
    c.fillStyle = phase === 'night' ? '#26242e' : '#8a8478'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = phase === 'night' ? '#1a1820' : '#6c675d'
    c.lineWidth = 2
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) c.strokeRect(x, y, 32, 32)
  })
  repeatTex(cobble, 10, 14)
  const ground = k.plane(60, 90, k.mat(0xffffff, { map: cobble, roughness: 0.95 }), 0, 0, -20)
  ground.rotation.x = -Math.PI / 2

  // торговые палатки с полосатыми тентами
  const awn = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6]
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
    const x = -9 + i * 6
    const z = -5 - row * 9
    const c = awn[(i + row * 2) % awn.length]
    k.box(3.6, 0.2, 2.8, k.mat(c), x, 3.0, z)
    k.box(3.6, 0.5, 0.08, k.mat(0xffffff), x, 2.7, z + 1.4)
    for (const sx of [-1.7, 1.7]) k.cyl(0.05, 0.05, 3, k.mat(0x6a5a44), x + sx, 1.5, z + 1.3)
    k.box(3.2, 0.9, 1.0, k.mat(0x6b4a2a), x, 0.45, z + 0.3)
    for (let b = 0; b < 4; b++) k.box(0.4, 0.3, 0.4, k.mat([0xc2864a, 0x4a7cc2, 0xb04a4a, 0xe6c14a][b]), x - 1.1 + b * 0.75, 1.05, z + 0.3)
    // гирлянда
    for (let b = 0; b < 7; b++) k.box(0.1, 0.1, 0.1, k.glow([0xffe29a, 0xec4899, 0x22d3ee][b % 3], phase === 'night' || phase === 'evening' ? 3 : 0.8), x - 1.5 + b * 0.5, 2.55 - Math.sin((b / 6) * Math.PI) * -0.08, z + 1.45)
  }
  // автомобили на витринах
  k.car(0xff6a00, -3, 0, 4, 0.3, 1)
  k.car(0x2b6cff, 3.5, 0, 3, -0.4, 1)

  // ГОРОД на заднем плане: этажи с окнами
  const windows = k.tex((c, w, h) => {
    c.fillStyle = '#12162a'
    c.fillRect(0, 0, w, h)
    for (let y = 8; y < h - 8; y += 18) for (let x = 8; x < w - 8; x += 18) {
      const on = Math.random() < (phase === 'night' ? 0.55 : phase === 'evening' ? 0.3 : 0.08)
      c.fillStyle = on ? ['#ffe29a', '#8fe3ff', '#ff9ad0'][Math.floor(Math.random() * 3)] : '#1c2240'
      c.fillRect(x, y, 9, 11)
    }
  }, 256, 512)
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 16; i++) {
      const h = 10 + ((i * 13 + layer * 7) % 26)
      const w = 4 + ((i + layer) % 3) * 1.5
      const t = windows.clone()
      t.needsUpdate = true
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(Math.max(1, w / 4), Math.max(1, h / 12))
      const m = new THREE.MeshStandardMaterial({ map: t, color: phase === 'night' ? 0xffffff : 0xb8c0d8, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: phase === 'night' ? 0.9 : phase === 'evening' ? 0.4 : 0.08 })
      k.own(m)
      k.own(t)
      k.box(w, h, w, m, -42 + i * 5.6 + layer * 1.5, h / 2, -48 - layer * 14)
    }
  }
  k.camera.fov = 54
  k.camera.position.set(0, 2.5, 11)
  k.animate((t) => {
    k.camera.position.x = Math.sin(t * 0.14) * 1.6
    k.camera.lookAt(0, 3, -25)
  })
  return k.finish()
}

/* ------------------------------------------------------------------ */
/*  Атмосферный неоновый фон (профиль, «О магазине»)                    */
/* ------------------------------------------------------------------ */

export function neonScene(phase: Phase): BackdropScene {
  const k = new Kit()
  k.scene.background = new THREE.Color(phase === 'night' ? 0x070516 : 0x120a2a)
  k.scene.fog = new THREE.Fog(0x120a2a, 14, 60)
  k.scene.add(new THREE.HemisphereLight(0xa070ff, 0x10051a, 0.6))
  const grid = k.tex((c, w, h) => {
    c.fillStyle = '#0c0820'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = '#22d3ee'
    c.lineWidth = 2
    c.strokeRect(0, 0, w, h)
  })
  repeatTex(grid, 24, 40)
  const g = k.plane(80, 120, k.mat(0xffffff, { map: grid, emissive: 0x22d3ee, emissiveMap: grid, emissiveIntensity: 0.5, roughness: 0.6 }), 0, 0, -30)
  g.rotation.x = -Math.PI / 2
  const sun = new THREE.Mesh(k.own(new THREE.CircleGeometry(9, 48)), k.own(new THREE.MeshBasicMaterial({ color: 0xec4899 })))
  sun.position.set(0, 9, -60)
  k.scene.add(sun)
  const pillars: THREE.Mesh[] = []
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1
    pillars.push(k.box(0.3, 4 + (i % 4) * 2, 0.3, k.glow(i % 3 === 0 ? 0xec4899 : 0x22d3ee, 2), side * (6 + (i % 3)), 2 + (i % 4), -6 - i * 5))
  }
  k.animate((t) => pillars.forEach((p, i) => (p.scale.y = 0.85 + Math.sin(t * 1.2 + i) * 0.15)))
  k.camera.fov = 58
  k.camera.position.set(0, 2.2, 6)
  k.animate((t) => {
    k.camera.position.x = Math.sin(t * 0.2) * 1.5
    k.camera.lookAt(0, 3, -30)
  })
  return k.finish()
}

export type SeasonId = 'winter' | 'spring' | 'summer' | 'autumn'

/** Сезон меняет цвет неба/тумана уличных сцен (зима — холодный белёсый, осень — тёплый) и вид площадок */
function tintSeason(b: BackdropScene, season: SeasonId, outdoor: boolean) {
  if (!outdoor) return b
  const tint = season === 'winter' ? 0xdfe9f5 : season === 'autumn' ? 0xd9a15a : season === 'spring' ? 0xa8d8a0 : 0
  if (!tint) return b
  const amount = season === 'winter' ? 0.45 : 0.22
  if (b.scene.background instanceof THREE.Color) b.scene.background.lerp(new THREE.Color(tint), amount)
  if (b.scene.fog) b.scene.fog.color.lerp(new THREE.Color(tint), amount)
  if (season === 'winter') {
    b.scene.traverse((o) => {
      const m = o as THREE.Mesh
      const mat = m.material as THREE.MeshStandardMaterial | undefined
      // «снег» на крупных горизонтальных плоскостях (земля площадок)
      if (m.isMesh && mat && 'color' in mat && m.geometry.type === 'PlaneGeometry') mat.color.lerp(new THREE.Color(0xf2f6fb), 0.35)
    })
  }
  return b
}

export function buildBackdrop(tab: TabId, phase: Phase, garageLevel: number, season: SeasonId = 'summer'): BackdropScene {
  switch (tab) {
    case 'home':
    case 'garage':
      return garageScene(garageLevel, phase)
    case 'lot':
      return tintSeason(lotScene(phase), season, true)
    case 'auction':
      return auctionScene()
    case 'market':
      return tintSeason(marketScene(phase), season, true)
    default:
      return neonScene(phase)
  }
}
