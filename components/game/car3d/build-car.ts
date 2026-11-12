import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { BodyType, Tuning, CarLook } from '@/lib/game/types'

/* ------------------------------------------------------------------ */
/*  Параметры кузовов (вид сбоку: +x = перед машины, y = вверх)        */
/* ------------------------------------------------------------------ */

interface BodySpec {
  L: number // длина
  W: number // ширина
  c: number // клиренс
  belt: number // линия капота/пояса
  xf0: number // начало лобового стекла (низ)
  xf1: number // верх лобового
  xr1: number // верх заднего
  xr0: number // низ заднего
  roofH: number // высота кабины над поясом
  wheelR: number
  wheelBase: number // половина колёсной базы
  boxy?: boolean
}

const SPECS: Record<BodyType, BodySpec> = {
  sedan: { L: 4.7, W: 1.85, c: 0.2, belt: 0.78, xf0: 0.75, xf1: 0.15, xr1: -0.85, xr0: -1.45, roofH: 0.52, wheelR: 0.36, wheelBase: 1.4 },
  hatch: { L: 3.95, W: 1.72, c: 0.2, belt: 0.76, xf0: 0.55, xf1: 0.0, xr1: -1.2, xr0: -1.6, roofH: 0.56, wheelR: 0.33, wheelBase: 1.2 },
  suv: { L: 4.6, W: 1.95, c: 0.3, belt: 0.95, xf0: 0.8, xf1: 0.4, xr1: -1.55, xr0: -1.85, roofH: 0.64, wheelR: 0.42, wheelBase: 1.4 },
  coupe: { L: 4.4, W: 1.9, c: 0.15, belt: 0.68, xf0: 0.5, xf1: -0.2, xr1: -0.9, xr0: -1.35, roofH: 0.42, wheelR: 0.35, wheelBase: 1.3 },
  van: { L: 4.9, W: 1.95, c: 0.25, belt: 0.88, xf0: 1.55, xf1: 1.3, xr1: -2.3, xr0: -2.4, roofH: 1.0, wheelR: 0.38, wheelBase: 1.5, boxy: true },
  roadster: { L: 4.2, W: 1.9, c: 0.14, belt: 0.62, xf0: 0.25, xf1: 0.0, xr1: -0.45, xr0: -0.7, roofH: 0.28, wheelR: 0.34, wheelBase: 1.3 },
  pickup: { L: 5.3, W: 2.0, c: 0.3, belt: 0.95, xf0: 1.25, xf1: 0.85, xr1: 0.0, xr0: -0.2, roofH: 0.62, wheelR: 0.43, wheelBase: 1.7 },
}

/* ------------------------------------------------------------------ */
/*  Цвета (названия из игры → краска)                                   */
/* ------------------------------------------------------------------ */

interface Paint {
  color: number
  metalness: number
  roughness: number
  clearcoat: number
  sheen?: number
}

export function paintFromName(name: string): Paint {
  const n = name.toLowerCase()
  if (n.includes('чёрн') || n.includes('черн')) return { color: 0x0b0b10, metalness: 0.85, roughness: 0.22, clearcoat: 1 }
  if (n.includes('белый')) return { color: 0xe9e6df, metalness: 0.35, roughness: 0.28, clearcoat: 1 }
  if (n.includes('серебр')) return { color: 0xa9adb5, metalness: 0.95, roughness: 0.25, clearcoat: 1 }
  if (n.includes('вишн')) return { color: 0x7a0a1e, metalness: 0.6, roughness: 0.24, clearcoat: 1 }
  if (n.includes('синий')) return { color: 0x0a4cff, metalness: 0.7, roughness: 0.2, clearcoat: 1 }
  if (n.includes('асфальт')) return { color: 0x3b3f48, metalness: 0.8, roughness: 0.3, clearcoat: 0.9 }
  if (n.includes('баклажан')) return { color: 0x3b0a4a, metalness: 0.7, roughness: 0.22, clearcoat: 1 }
  if (n.includes('хамелеон')) return { color: 0x0f9d58, metalness: 0.9, roughness: 0.18, clearcoat: 1 }
  if (n.includes('оранж')) return { color: 0xff6a00, metalness: 0.55, roughness: 0.24, clearcoat: 1 }
  if (n.includes('графит')) return { color: 0x2a2d33, metalness: 0.85, roughness: 0.3, clearcoat: 0.9 }
  return { color: 0x5b6577, metalness: 0.7, roughness: 0.3, clearcoat: 1 }
}

/* ------------------------------------------------------------------ */
/*  Геометрия: скруглённый многоугольник → Shape                        */
/* ------------------------------------------------------------------ */

function roundedPoly(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape()
  const n = pts.length
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(pts[n - 1], pts[0])
  s.moveTo(start[0], start[1])
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const m = mid(p, pts[(i + 1) % n])
    s.quadraticCurveTo(p[0], p[1], m[0], m[1])
  }
  s.closePath()
  return s
}

/** Выдавить профиль по ширине. Ось профиля x → вперёд (−Z мира), глубина → X мира. */
function extrudeSide(shape: THREE.Shape, width: number, bevel = 0.06): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, width - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 9,
    curveSegments: 32,
  })
  geo.translate(0, 0, -(width - bevel * 2) / 2)
  geo.rotateY(Math.PI / 2) // shape +x → world −z
  geo.computeVertexNormals()
  return geo
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * «Ваяние» кузова: призма бокового профиля становится обтекаемой —
 * сужается к носу и корме в плане, скругляет углы и даёт завал боков (кабина уже сверху).
 */
function sculpt(geo: THREE.BufferGeometry, o: { L: number; W: number; y0: number; h: number; tumble: number; taper?: boolean }) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    const y = pos.getY(i)
    let z = pos.getZ(i)
    const k = Math.min(1, Math.max(0, (y - o.y0) / o.h))
    x *= 1 - o.tumble * k
    if (o.taper) {
      const sgn = z < 0 ? -1 : 1
      const sT = smooth(0.7, 1.02, Math.abs(z) / (o.L / 2))
      x *= 1 - 0.3 * (z < 0 ? 1.15 : 0.85) * sT * sT
      const u = Math.min(1, Math.abs(x) / (o.W / 2))
      z -= sgn * 0.34 * Math.pow(u, 2.4) * sT
    }
    pos.setXYZ(i, x, y, z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/* ------------------------------------------------------------------ */
/*  Публичный API                                                       */
/* ------------------------------------------------------------------ */

export interface CarOptions {
  bodyType: BodyType
  colorName: string
  tuning: Tuning
  /** упрощённая модель для трафика */
  lowDetail?: boolean
  /** переопределить цвет (трафик) */
  paintOverride?: number
  /** состояние зон 0–100: износ и ремонт видны на модели */
  condition?: Partial<Record<'engine' | 'body' | 'interior' | 'suspension' | 'electrics' | 'documents', number>>
  /** кастомный внешний вид: цвет, покрытие, диски, шины, салон */
  look?: CarLook
}

export interface BuiltCar {
  root: THREE.Group
  /** кузов+колёса, поднимается/опускается подвеской */
  body: THREE.Group
  frontWheels: THREE.Group[]
  allWheels: THREE.Group[]
  headlights: THREE.Mesh[]
  taillights: THREE.Mesh[]
  glow: { head: THREE.SpotLight[]; under: THREE.PointLight | null }
  spec: BodySpec
  bodyMaterial: THREE.MeshPhysicalMaterial
  setTuning(t: Tuning, animate?: boolean): void
  /** Показать износ/ремонт: ржавчина и вмятины, тусклая краска, дым из-под капота, потрёпанный салон, битая фара, просевшая подвеска */
  setCondition(c: NonNullable<CarOptions['condition']>): void
  /** перекрасить кузов (спецтранспорт, трафик) */
  setBodyColor(hex: number): void
  /** кастом: краска и покрытие, диски, шины, цвет шин и салона */
  setLook(look: CarLook): void
  setLights(on: boolean, brake?: boolean, headIntensity?: number): void
  tick(dt: number, speedMs?: number): void
  dispose(): void
}

const matCache = new Map<string, THREE.Material>()
function std(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key)
  if (!m) {
    m = make()
    matCache.set(key, m)
  }
  return m
}

export function buildCar(opts: CarOptions): BuiltCar {
  const spec = SPECS[opts.bodyType] ?? SPECS.sedan
  const paint = paintFromName(opts.colorName)
  const low = !!opts.lowDetail
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(o: T): T => {
    disposables.push(o)
    return o
  }

  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const bodyMat = track(
    new THREE.MeshPhysicalMaterial({
      color: opts.paintOverride ?? paint.color,
      metalness: paint.metalness,
      roughness: paint.roughness,
      clearcoat: paint.clearcoat,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.1,
    }),
  )
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0a1018,
      metalness: 0.2,
      roughness: 0.04,
      transmission: 0,
      transparent: true,
      opacity: low ? 0.92 : 0.34,
      depthWrite: low,
      envMapIntensity: 1.6,
      clearcoat: 1,
    }),
  )
  const blackMat = std('black', () => new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.7, metalness: 0.3 }))
  const trimMat = std('trim', () => new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.45, metalness: 0.6 }))

  const { L, W, c, belt } = spec

  /* ---- нижний кузов ---- */
  const lower = roundedPoly([
    [L / 2 - 0.05, c + 0.1],
    [L / 2 + 0.01, belt - 0.26],
    [L / 2 - 0.4, belt - 0.04],
    [spec.xf0 + 0.15, belt + 0.02],
    [spec.xr0 - 0.1, belt + 0.02],
    [-L / 2 + 0.35, belt + (opts.bodyType === 'sedan' ? 0.02 : 0)],
    [-L / 2 - 0.01, belt - 0.12],
    [-L / 2 + 0.02, c + 0.14],
    [-L / 2 + 0.5, c],
    [L / 2 - 0.5, c],
  ])
  const lowerMesh = new THREE.Mesh(track(sculpt(extrudeSide(lower, W, 0.09), { L, W, y0: c, h: belt - c, tumble: 0.05, taper: true })), bodyMat)
  lowerMesh.castShadow = true
  body.add(lowerMesh)

  /* ---- кабина ---- */
  const cabW = W * (spec.boxy ? 0.97 : 0.86)
  const cabin = roundedPoly([
    [spec.xf0 + 0.05, belt - 0.02],
    [spec.xf1, belt + spec.roofH],
    [spec.xr1, belt + spec.roofH],
    [spec.xr0 - 0.05, belt - 0.02],
  ])
  // Трафик (low) остаётся сплошным; у основной модели кабина «пустая»: каркас + видимый салон
  const seatDefaultColor = new THREE.Color(0x3a2a24)
  const seatBestColor = new THREE.Color(0x7a2430)
  const seatMat = track(new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.7, metalness: 0.05, emissive: 0x120c0a, emissiveIntensity: 0.6 }))
  const dashMat = track(new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.2, emissive: 0x0a0b0e, emissiveIntensity: 0.6 }))
  const floorMat = track(new THREE.MeshStandardMaterial({ color: 0x1b1a1d, roughness: 0.95, metalness: 0, emissive: 0x08080a, emissiveIntensity: 0.6 }))
  const interiorTear: THREE.Mesh[] = []
  if (low) {
    const cabinMesh = new THREE.Mesh(track(sculpt(extrudeSide(cabin, cabW, 0.07), { L, W, y0: belt, h: spec.roofH, tumble: spec.boxy ? 0.05 : 0.16 })), bodyMat)
    cabinMesh.castShadow = true
    body.add(cabinMesh)
  } else {
    const roofY = belt + spec.roofH
    const roofLen = Math.abs(spec.xf1 - spec.xr1)
    const roofSlab = new THREE.Mesh(track(new RoundedBoxGeometry(cabW * (spec.boxy ? 0.93 : 0.82), 0.08, roofLen + 0.1, 4, 0.035)), bodyMat)
    roofSlab.position.set(0, roofY - 0.035, -((spec.xf1 + spec.xr1) / 2))
    roofSlab.castShadow = true
    body.add(roofSlab)
    const bar = (x0: number, y0: number, x1: number, y1: number, sx: number, thick = 0.06) => {
      const tf = (y: number) => 1 - (spec.boxy ? 0.05 : 0.16) * Math.min(1, Math.max(0, (y - belt) / spec.roofH))
      const a = new THREE.Vector3(sx * (cabW / 2 - 0.02) * tf(y0), y0, -x0)
      const b = new THREE.Vector3(sx * (cabW / 2 - 0.02) * tf(y1), y1, -x1)
      const len = a.distanceTo(b)
      const m = new THREE.Mesh(track(new RoundedBoxGeometry(thick, thick, len, 2, thick * 0.4)), bodyMat)
      m.position.copy(a).add(b).multiplyScalar(0.5)
      m.lookAt(b)
      body.add(m)
    }
    for (const sx of [-1, 1]) {
      bar(spec.xf0, belt + 0.02, spec.xf1, roofY - 0.03, sx, 0.07) // A-стойка
      bar(spec.xr0, belt + 0.02, spec.xr1, roofY - 0.03, sx, 0.09) // C-стойка
      if (roofLen > 1.1) bar((spec.xf1 + spec.xr1) / 2 + 0.1, belt + 0.02, (spec.xf1 + spec.xr1) / 2 + 0.1, roofY - 0.04, sx, 0.06) // B-стойка
    }
    // пол и порожки салона
    const floorLen = Math.abs(spec.xf0 - spec.xr0) - 0.15
    const floor = new THREE.Mesh(track(new THREE.BoxGeometry(cabW * 0.9, 0.04, floorLen)), floorMat)
    floor.position.set(0, belt + 0.035, -((spec.xf0 + spec.xr0) / 2))
    body.add(floor)
    // торпедо + приборная панель
    const dashX = spec.xf0 - 0.32
    const dash = new THREE.Mesh(track(new THREE.BoxGeometry(cabW * 0.9, 0.17, 0.34)), dashMat)
    dash.position.set(0, belt + 0.12, -dashX)
    body.add(dash)
    const cluster = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.22, 0.07, 0.03)),
      track(new THREE.MeshStandardMaterial({ color: 0x0b1620, emissive: 0x22d3ee, emissiveIntensity: 0.55, roughness: 0.3 })),
    )
    cluster.position.set(-cabW * 0.2, belt + Math.min(0.23, spec.roofH - 0.16), -(dashX - 0.15))
    cluster.rotation.x = -0.35
    body.add(cluster)
    const screen = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.2, 0.12, 0.02)),
      track(new THREE.MeshStandardMaterial({ color: 0x0b0b12, emissive: 0xec4899, emissiveIntensity: 0.4, roughness: 0.3 })),
    )
    screen.position.set(cabW * 0.05, belt + Math.min(0.25, spec.roofH - 0.14), -(dashX - 0.14))
    screen.rotation.x = -0.25
    body.add(screen)
    // Высота салона ограничена крышей: всё, что внутри, должно помещаться под ней (с зазором под потолок)
    const headroom = spec.roofH - 0.18
    const wheelY = Math.min(0.3, Math.max(0.1, spec.roofH - 0.24))
    // руль
    const wheel = new THREE.Mesh(track(new THREE.TorusGeometry(0.14, 0.02, 10, 24)), trimMat)
    wheel.position.set(-cabW * 0.22, belt + wheelY, -(dashX - 0.34))
    wheel.rotation.x = -1.1
    body.add(wheel)
    const column = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8)), trimMat)
    column.position.set(-cabW * 0.22, belt + wheelY - 0.08, -(dashX - 0.24))
    column.rotation.x = -1.1
    body.add(column)
    // сиденья
    const frontX = spec.xf1 - 0.25
    const mkSeat = (xp: number, sx: number) => {
      const g = new THREE.Group()
      const base = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.1, 0.46)), seatMat)
      const back = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.5, 0.1)), seatMat)
      back.position.set(0, 0.28, 0.2)
      back.rotation.x = 0.16
      const head = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.14, 0.08)), seatMat)
      head.position.set(0, 0.58, 0.24)
      g.add(base, back, head)
      // сиденье целиком (с подголовником) сжимается по высоте так, чтобы быть строго под крышей
      g.scale.set(1, Math.min(1, Math.max(0.15, headroom / 0.65)), 1)
      g.position.set(sx * cabW * 0.22, belt + 0.06, -xp)
      body.add(g)
      // «дыры» на сиденьях для потрёпанного салона
      const tear = new THREE.Mesh(track(new THREE.CircleGeometry(0.07, 10)), track(new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 1 })))
      tear.rotation.x = -Math.PI / 2
      tear.position.set(0.05, 0.056, -0.02)
      tear.visible = false
      g.add(tear)
      interiorTear.push(tear)
    }
    mkSeat(frontX, -1)
    mkSeat(frontX, 1)
    if (frontX - (spec.xr1 + 0.25) > 0.5) {
      const rearX = spec.xr1 + 0.25
      const bench = new THREE.Group()
      const bb = new THREE.Mesh(track(new THREE.BoxGeometry(cabW * 0.78, 0.1, 0.42)), seatMat)
      const bk = new THREE.Mesh(track(new THREE.BoxGeometry(cabW * 0.78, 0.42, 0.09)), seatMat)
      bk.position.set(0, 0.24, 0.2)
      bk.rotation.x = 0.2
      bench.add(bb, bk)
      bench.scale.set(1, Math.min(1, Math.max(0.15, headroom / 0.5)), 1)
      bench.position.set(0, belt + 0.06, -rearX)
      body.add(bench)
    }
  }

  /* ---- стёкла ---- */
  const glassShape = roundedPoly([
    [spec.xf0 - 0.08, belt + 0.03],
    [spec.xf1 + 0.02, belt + spec.roofH - 0.07],
    [spec.xr1 - 0.02, belt + spec.roofH - 0.07],
    [spec.xr0 + 0.1, belt + 0.03],
  ])
  const side = new THREE.Mesh(track(sculpt(extrudeSide(glassShape, cabW + 0.025, 0.005), { L, W, y0: belt, h: spec.roofH, tumble: spec.boxy ? 0.05 : 0.16 })), glassMat)
  body.add(side)

  const quad = (zb: number, yb: number, zt: number, yt: number, hw: number, nz: number) => {
    // четырёхугольник между нижней (zb,yb) и верхней (zt,yt) кромкой, смещён по нормали на nz
    const g = new THREE.BufferGeometry()
    const v = new Float32Array([-hw, yb, zb + nz, hw, yb, zb + nz, hw, yt, zt + nz, -hw, yt, zt + nz])
    g.setAttribute('position', new THREE.BufferAttribute(v, 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.computeVertexNormals()
    return g
  }
  const glassDouble = track(glassMat.clone())
  glassDouble.side = THREE.DoubleSide
  const wind = new THREE.Mesh(
    track(quad(-(spec.xf0 - 0.04), belt + 0.04, -(spec.xf1 + 0.03), belt + spec.roofH - 0.06, cabW * 0.45, -0.012)),
    glassDouble,
  )
  body.add(wind)
  const rear = new THREE.Mesh(
    track(quad(-(spec.xr0 + 0.04), belt + 0.04, -(spec.xr1 - 0.03), belt + spec.roofH - 0.06, cabW * 0.44, 0.012)),
    glassDouble,
  )
  body.add(rear)

  /* ---- арки, пороги, решётка ---- */
  const arches: THREE.Mesh[] = []
  const archGeo = track(new THREE.CircleGeometry(spec.wheelR + 0.07, 28))
  const archMat = std('arch', () => new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.DoubleSide }))
  for (const sx of [-1, 1]) {
    for (const ax of [spec.wheelBase, -spec.wheelBase]) {
      const m = new THREE.Mesh(archGeo, archMat)
      m.position.set(sx * (W / 2 + 0.002), spec.wheelR, -ax)
      m.rotation.y = sx * Math.PI / 2
      body.add(m)
      arches.push(m)
    }
  }
  // плавные арки: полукруглая «губа» над каждым колесом
  const lipGeo = track(new THREE.TorusGeometry(spec.wheelR + 0.075, 0.038, 12, 48, Math.PI))
  for (const sx of [-1, 1]) {
    for (const ax of [spec.wheelBase, -spec.wheelBase]) {
      const lip = new THREE.Mesh(lipGeo, bodyMat)
      lip.position.set(sx * (W / 2 + 0.006), spec.wheelR, -ax)
      lip.rotation.y = Math.PI / 2
      body.add(lip)
    }
  }
  // бамперы: скруглённые губы спереди и сзади
  const bumpGeo = track(new RoundedBoxGeometry(W * 0.86, 0.2, 0.26, 5, 0.09))
  const bumpF = new THREE.Mesh(bumpGeo, bodyMat)
  bumpF.position.set(0, c + 0.17, -(L / 2 - 0.1))
  body.add(bumpF)
  const bumpR = new THREE.Mesh(bumpGeo, bodyMat)
  bumpR.position.set(0, c + 0.2, L / 2 - 0.1)
  body.add(bumpR)
  const grille = new THREE.Mesh(track(new RoundedBoxGeometry(W * 0.5, 0.16, 0.07, 3, 0.04)), trimMat)
  grille.position.set(0, belt - 0.3, -(L / 2 + 0.01))
  body.add(grille)
  const plateF = new THREE.Mesh(track(new RoundedBoxGeometry(0.5, 0.12, 0.03, 2, 0.012)), std('plate', () => new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6 })))
  plateF.position.set(0, c + 0.28, -(L / 2 + 0.03))
  body.add(plateF)
  const plateR = plateF.clone()
  plateR.position.set(0, c + 0.42, L / 2 + 0.03)
  body.add(plateR)

  /* ---- фары ---- */
  const headlights: THREE.Mesh[] = []
  const taillights: THREE.Mesh[] = []
  const headMat = track(new THREE.MeshStandardMaterial({ color: 0xfff6d6, emissive: 0xfff1b8, emissiveIntensity: 0.5, roughness: 0.2 }))
  const tailMat = track(new THREE.MeshStandardMaterial({ color: 0x8a0010, emissive: 0xff1030, emissiveIntensity: 0.6, roughness: 0.3 }))
  const headMat2 = track(headMat.clone())
  let headBroken = false
  const hGeo = track(new RoundedBoxGeometry(0.46, 0.1, 0.08, 4, 0.045))
  const tGeo = track(new RoundedBoxGeometry(0.5, 0.1, 0.07, 4, 0.04))
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(hGeo, sx === 1 ? headMat2 : headMat)
    h.position.set(sx * (W / 2 - 0.4), belt - 0.22, -(L / 2 - 0.02))
    body.add(h)
    headlights.push(h)
    const t = new THREE.Mesh(tGeo, tailMat)
    t.position.set(sx * (W / 2 - 0.42), belt - 0.18, L / 2 - 0.02)
    body.add(t)
    taillights.push(t)
  }

  /* ---- колёса ---- */
  const frontWheels: THREE.Group[] = []
  const allWheels: THREE.Group[] = []
  const wheelSpinners: THREE.Group[] = []
  const rimMat = track(new THREE.MeshStandardMaterial({ color: 0xb9bdc6, metalness: 1, roughness: 0.18 }))
  const tireGeo = track(new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.26, low ? 16 : 64))
  tireGeo.rotateZ(Math.PI / 2)
  // у каждой машины своя резина, чтобы цвет шин не «протекал» на другие модели
  const tireMat = (low ? std('tire', () => new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.92, metalness: 0 })) : track(new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9, metalness: 0 }))) as THREE.MeshStandardMaterial
  const tireMeshes: THREE.Mesh[] = []
  const rimMeshes: THREE.Mesh[] = []
  const spokeMeshes: THREE.Mesh[] = []
  const rimGeo = track(new THREE.CylinderGeometry(spec.wheelR * 0.66, spec.wheelR * 0.66, 0.27, low ? 12 : 48))
  rimGeo.rotateZ(Math.PI / 2)
  const discGeo = track(new THREE.CylinderGeometry(spec.wheelR * 0.5, spec.wheelR * 0.5, 0.2, 20))
  discGeo.rotateZ(Math.PI / 2)
  const spokeGeo = track(new THREE.CapsuleGeometry(0.024, spec.wheelR * 1.0, 4, 10))
  const spokeGroups: THREE.Group[] = []
  const extraSpokes: THREE.Mesh[] = []
  const neonRings: THREE.Mesh[] = []

  const caliperMat = track(new THREE.MeshStandardMaterial({ color: 0xff2a2a, roughness: 0.4, metalness: 0.3 }))

  for (const sx of [-1, 1]) {
    for (const ax of [spec.wheelBase, -spec.wheelBase]) {
      const steer = new THREE.Group()
      steer.position.set(sx * (W / 2 - 0.12), spec.wheelR, -ax)
      const spin = new THREE.Group()
      const tireMesh = new THREE.Mesh(tireGeo, tireMat)
      spin.add(tireMesh)
      tireMeshes.push(tireMesh)
      if (!low) {
        const rim = new THREE.Mesh(rimGeo, rimMat)
        spin.add(rim)
        rimMeshes.push(rim)
        const spokes = new THREE.Group()
        spokes.position.x = sx * 0.14
        for (let i = 0; i < 5; i++) {
          const sp = new THREE.Mesh(spokeGeo, rimMat)
          sp.rotation.x = (i / 5) * Math.PI
          sp.position.x = 0
          spokes.add(sp)
          spokeMeshes.push(sp)
        }
        // дополнительные спицы для спортивных/кованых дисков
        for (let i = 0; i < 5; i++) {
          const sp = new THREE.Mesh(spokeGeo, rimMat)
          sp.rotation.x = ((i + 0.5) / 5) * Math.PI
          sp.visible = false
          spokes.add(sp)
          extraSpokes.push(sp)
          spokeMeshes.push(sp)
        }
        const ring = new THREE.Mesh(
          track(new THREE.TorusGeometry(spec.wheelR * 0.66, 0.014, 8, 40)),
          track(new THREE.MeshBasicMaterial({ color: 0x22d3ee })),
        )
        ring.rotation.y = Math.PI / 2
        ring.position.x = sx * 0.14
        ring.visible = false
        spin.add(ring)
        neonRings.push(ring)
        // спицы вращаются вокруг оси X
        spin.add(spokes)
        spokeGroups.push(spokes)
        const disc = new THREE.Mesh(discGeo, std('disc', () => new THREE.MeshStandardMaterial({ color: 0x555a63, metalness: 0.9, roughness: 0.4 })))
        spin.add(disc)
      } else {
        spin.add(new THREE.Mesh(rimGeo, rimMat))
      }
      steer.add(spin)
      if (!low) {
        const caliper = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, spec.wheelR * 0.5, spec.wheelR * 0.4)), caliperMat)
        caliper.position.set(-sx * 0.06, spec.wheelR * 0.1, 0)
        steer.add(caliper)
      }
      body.add(steer)
      spin.userData.sx = sx
      allWheels.push(spin)
      wheelSpinners.push(spin)
      if (ax > 0) frontWheels.push(steer)
    }
  }

  /* ---- динамические тюнинг-детали ---- */
  let underLightRef: THREE.PointLight | null = null
  const parts: { obj: THREE.Object3D; need: number; key: 'visual' | 'engine'; v: number; flash: number }[] = []
  const addPart = (obj: THREE.Object3D, need: number, key: 'visual' | 'engine') => {
    obj.visible = false
    obj.scale.setScalar(0.001)
    body.add(obj)
    parts.push({ obj, need, key, v: 0, flash: 0 })
  }

  if (!low) {
    // спойлер: 1 = утиный хвост, 2+ = большое крыло
    const spoiler = new THREE.Group()
    const wing = new THREE.Mesh(track(new THREE.BoxGeometry(W * 0.86, 0.04, 0.34)), blackMat)
    wing.position.set(0, 0, 0)
    const stand = track(new THREE.BoxGeometry(0.05, 0.28, 0.1))
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(stand, blackMat)
      s.position.set(sx * W * 0.3, -0.14, 0.02)
      spoiler.add(s)
    }
    const endL = track(new THREE.BoxGeometry(0.04, 0.14, 0.36))
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(endL, bodyMat)
      e.position.set(sx * W * 0.43, 0.04, 0)
      spoiler.add(e)
    }
    spoiler.add(wing)
    spoiler.position.set(0, belt + 0.28, L / 2 - 0.45)
    addPart(spoiler, 1, 'visual')

    // обвес: пороги, сплиттер, диффузор
    const kit = new THREE.Group()
    for (const sx of [-1, 1]) {
      const skirt = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.14, (spec.wheelBase * 2) - spec.wheelR * 0.6)), blackMat)
      skirt.position.set(sx * (W / 2 + 0.02), c + 0.09, 0)
      kit.add(skirt)
    }
    const splitter = new THREE.Mesh(track(new THREE.BoxGeometry(W * 0.96, 0.05, 0.3)), blackMat)
    splitter.position.set(0, c + 0.04, -(L / 2 + 0.1))
    kit.add(splitter)
    const diff = new THREE.Mesh(track(new THREE.BoxGeometry(W * 0.7, 0.14, 0.2)), blackMat)
    diff.position.set(0, c + 0.12, L / 2 + 0.05)
    kit.add(diff)
    addPart(kit, 2, 'visual')

    // гоночные полосы + капот-скуп (3)
    const stripe = new THREE.Group()
    const stripeMat = track(new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.35, metalness: 0.1 }))
    const hood = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.012, (L / 2 - spec.xf0) * 0.92)), stripeMat)
    hood.position.set(0, belt + 0.035, -(spec.xf0 + (L / 2 - spec.xf0) / 2) + 0.02)
    stripe.add(hood)
    const roof = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.012, Math.abs(spec.xf1 - spec.xr1) * 0.9)), stripeMat)
    roof.position.set(0, belt + spec.roofH + 0.06, -((spec.xf1 + spec.xr1) / 2))
    stripe.add(roof)
    const scoop = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.06, 0.4)), blackMat)
    scoop.position.set(0, belt + 0.06, -(spec.xf0 + 0.55))
    stripe.add(scoop)
    addPart(stripe, 3, 'visual')

    // подсветка днища (3)
    const neonColor = 0x22d3ee
    const glowPlane = new THREE.Mesh(
      track(new THREE.PlaneGeometry(W + 0.5, L + 0.5)),
      track(new THREE.MeshBasicMaterial({ color: neonColor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })),
    )
    glowPlane.rotation.x = -Math.PI / 2
    glowPlane.position.set(0, 0.03, 0)
    root.add(glowPlane)
    glowPlane.visible = false
    parts.push({ obj: glowPlane, need: 3, key: 'visual', v: 0, flash: 0 })
    const underLight = new THREE.PointLight(neonColor, 0, 6, 2)
    underLight.position.set(0, 0.15, 0)
    root.add(underLight)

    // выхлоп (двигатель)
    const exMat = track(new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 1, roughness: 0.2 }))
    const exhaust1 = new THREE.Group()
    const e1 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 18)), exMat)
    e1.rotation.x = Math.PI / 2
    e1.position.set(W * 0.3, c + 0.1, L / 2 + 0.02)
    exhaust1.add(e1)
    addPart(exhaust1, 1, 'engine')
    const exhaust2 = new THREE.Group()
    const e2 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 18)), exMat)
    e2.rotation.x = Math.PI / 2
    e2.position.set(-W * 0.3, c + 0.1, L / 2 + 0.02)
    exhaust2.add(e2)
    addPart(exhaust2, 2, 'engine')
    const flame = new THREE.Group()
    const fl = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.05, 0.36, 12)),
      track(new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })),
    )
    fl.rotation.x = Math.PI / 2
    fl.position.set(W * 0.3, c + 0.1, L / 2 + 0.28)
    const fl2 = fl.clone()
    fl2.position.x = -W * 0.3
    flame.add(fl, fl2)
    addPart(flame, 3, 'engine')

    underLightRef = underLight
  }

  /* ---- фары-источники света (для ночи/дождя) ---- */
  const headSpots: THREE.SpotLight[] = []
  if (!low) {
    for (const sx of [-1, 1]) {
      const s = new THREE.SpotLight(0xfff1c8, 0, 40, 0.5, 0.6, 1.4)
      s.position.set(sx * (W / 2 - 0.34), belt - 0.22, -(L / 2))
      const tgt = new THREE.Object3D()
      tgt.position.set(sx * 0.4, 0.3, -(L / 2 + 14))
      body.add(tgt)
      s.target = tgt
      body.add(s)
      headSpots.push(s)
    }
  }

  /* ---- подвеска / посадка ---- */
  let currentRide = 0
  let targetRide = 0
  let bob = 0
  let spinAngle = 0
  let lightsOn = false
  let braking = false
  const underGlowLight = underLightRef
  let tuningSuspension = 0
  let sag = 0
  let wearCamber = 0

  /* ---- стили дисков ---- */
  const WHEEL_STYLES = [
    { color: 0x6b6f78, rough: 0.55, metal: 0.8 }, // штамп
    { color: 0xb9bdc6, rough: 0.18, metal: 1 }, // литьё
    { color: 0x2b2e35, rough: 0.25, metal: 1 }, // спорт, графит
    { color: 0xe6ecf5, rough: 0.1, metal: 1 }, // кованые + неон
  ]
  let look: CarLook = {}
  let lastCond: NonNullable<CarOptions['condition']> = {}
  const applyWheels = (lvl: number) => {
    if (look.wheelDesign) return // выбранный дизайн дисков важнее уровня тюнинга
    const st = WHEEL_STYLES[Math.max(0, Math.min(3, lvl))]
    rimMat.color.setHex(st.color)
    rimMat.roughness = st.rough
    rimMat.metalness = st.metal
    for (const sp of extraSpokes) sp.visible = lvl >= 2
    for (const r of neonRings) r.visible = lvl >= 3
  }

  /* ---- кастом: покрытия, диски, шины, цвета ---- */
  const DESIGNS: Record<string, { extra: number; th: number; color: number; rough: number; metal: number; neon?: boolean; deep?: boolean }> = {
    steel: { extra: 0, th: 1.7, color: 0x6b6f78, rough: 0.55, metal: 0.8 },
    alloy: { extra: 0, th: 1.1, color: 0xb9bdc6, rough: 0.18, metal: 1 },
    mesh: { extra: 5, th: 0.55, color: 0xd0d4dc, rough: 0.2, metal: 1 },
    turbine: { extra: 2, th: 0.95, color: 0x2b2e35, rough: 0.25, metal: 1 },
    deepdish: { extra: 0, th: 1.5, color: 0xc9a24a, rough: 0.25, metal: 1, deep: true },
    split: { extra: 5, th: 0.85, color: 0x14161a, rough: 0.3, metal: 0.9 },
    forged: { extra: 1, th: 0.7, color: 0xe6ecf5, rough: 0.08, metal: 1 },
    neon: { extra: 5, th: 0.7, color: 0xe6ecf5, rough: 0.1, metal: 1, neon: true },
  }
  const TIRES: Record<string, { w: number; r: number }> = {
    street: { w: 1, r: 1 }, sport: { w: 1.16, r: 0.985 }, offroad: { w: 1.06, r: 1.09 }, slick: { w: 1.36, r: 1 },
  }
  const FINISHES: Record<string, { rough: number; clear: number; metal: number; env: number; irid: number }> = {
    gloss: { rough: paint.roughness, clear: paint.clearcoat, metal: 0.55, env: 1.2, irid: 0 },
    matte: { rough: 0.9, clear: 0, metal: 0.15, env: 0.6, irid: 0 },
    metallic: { rough: 0.32, clear: 1, metal: 0.9, env: 1.6, irid: 0 },
    pearl: { rough: 0.22, clear: 1, metal: 0.55, env: 1.5, irid: 0.9 },
    chrome: { rough: 0.05, clear: 0, metal: 1, env: 2.8, irid: 0 },
  }
  const applyLook = (l: CarLook) => {
    look = l
    if (low) return
    // краска
    paintBase.color.set(l.paint ?? (opts.paintOverride ?? paint.color))
    const f = FINISHES[l.finish ?? 'gloss'] ?? FINISHES.gloss
    paintBase.rough = f.rough
    paintBase.clear = f.clear
    bodyMat.metalness = f.metal
    bodyMat.envMapIntensity = f.env
    bodyMat.iridescence = f.irid
    bodyMat.iridescenceIOR = 1.6
    bodyMat.color.copy(paintBase.color)
    // диски
    const d = DESIGNS[l.wheelDesign ?? ''] ?? null
    if (d) {
      rimMat.color.set(l.rimColor ?? d.color)
      rimMat.roughness = d.rough
      rimMat.metalness = d.metal
      extraSpokes.forEach((sp, i) => (sp.visible = i % 5 < d.extra))
      for (const sp of spokeMeshes) sp.scale.set(d.th, 1, d.th)
      for (const r of neonRings) r.visible = !!d.neon
      for (const r of rimMeshes) r.scale.x = d.deep ? 1.5 : 1
    } else if (l.rimColor) {
      rimMat.color.set(l.rimColor)
    }
    // шины
    const t = TIRES[l.tire ?? 'street'] ?? TIRES.street
    for (const m of tireMeshes) m.scale.set(t.w, t.r, t.r)
    tireMat.color.set(l.tireColor ?? '#0c0c0e')
    tireMat.roughness = l.tireColor ? 0.7 : 0.9
    // салон
    if (l.interior) {
      seatBestColor.set(l.interior)
      seatDefaultColor.set(l.interior).multiplyScalar(0.75)
    } else {
      seatBestColor.setHex(0x7a2430)
      seatDefaultColor.setHex(0x3a2a24)
    }
  }

  /* ---- износ и ремонт ---- */
  const patchMat = track(new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }))
  const scratchMat = track(new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.9, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }))
  const patchGeo = track(new THREE.CircleGeometry(0.11, 10))
  const patches: THREE.Mesh[] = []
  if (!low) {
    const spots: [number, number, number, number][] = [
      // x, y, z, нормаль-ось (1 = бок +X, -1 = бок −X, 2 = капот, 3 = багажник, 4 = крыша)
      [1, belt - 0.2, 0.2, 1], [-1, belt - 0.3, -0.5, -1], [1, c + 0.28, -0.9, 1], [-1, belt - 0.15, 0.9, -1],
      [0, belt + 0.04, -(L / 2 - 0.5), 2], [0.3, belt + 0.04, -(L / 2 - 0.9), 2],
      [0, belt + 0.04, L / 2 - 0.45, 3], [0, belt + spec.roofH + 0.005, -((spec.xf1 + spec.xr1) / 2), 4],
    ]
    spots.forEach(([x, y, z, k], i) => {
      const m = new THREE.Mesh(patchGeo, i % 2 ? scratchMat : patchMat)
      m.scale.setScalar(0.7 + (i % 3) * 0.35)
      if (k === 1 || k === -1) {
        m.position.set(k * (W / 2 + 0.012), y, z)
        m.rotation.y = k * Math.PI / 2
      } else {
        m.position.set(x, y, z)
        m.rotation.x = -Math.PI / 2
      }
      m.visible = false
      body.add(m)
      patches.push(m)
    })
  }
  // дым из-под капота при убитом моторе
  const smokePuffs: { m: THREE.Mesh; t: number }[] = []
  let smokeOn = false
  if (!low) {
    const smokeGeo = track(new THREE.SphereGeometry(0.14, 8, 8))
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(smokeGeo, track(new THREE.MeshBasicMaterial({ color: 0x8a8a90, transparent: true, opacity: 0, depthWrite: false })))
      m.visible = false
      body.add(m)
      smokePuffs.push({ m, t: i / 6 })
    }
  }
  const paintBase = { rough: paint.roughness, clear: paint.clearcoat, color: new THREE.Color(opts.paintOverride ?? paint.color) }
  const rustTint = new THREE.Color(0x5a3a28)

  const api: BuiltCar = {
    root,
    body,
    frontWheels,
    allWheels,
    headlights,
    taillights,
    glow: { head: headSpots, under: underGlowLight },
    spec,
    bodyMaterial: bodyMat,

    setTuning(t, animate = true) {
      tuningSuspension = t.suspension
      targetRide = -0.035 * t.suspension - sag
      applyWheels(t.wheels ?? 0)
      if (!animate) currentRide = targetRide
      for (const p of parts) {
        const level = p.key === 'visual' ? t.visual : t.engine
        const should = level >= p.need
        if (should && !p.obj.visible) {
          p.obj.visible = true
          p.v = animate ? 0 : 1
          p.flash = animate ? 1 : 0
          if (!animate) p.obj.scale.setScalar(1)
        } else if (!should && p.obj.visible) {
          p.obj.visible = false
          p.obj.scale.setScalar(0.001)
        }
      }
      if (underGlowLight) underGlowLight.intensity = t.visual >= 3 ? 6 : 0
      // чуть шире колея при подвеске
      const camber = 0.02 * t.suspension
      for (const w of allWheels) w.rotation.z = (camber + wearCamber) * (w.userData.sx ?? 1)
    },

    setBodyColor(hex) {
      paintBase.color.setHex(hex)
      bodyMat.color.setHex(hex)
    },

    setLook(l) {
      applyLook(l)
      this.setCondition(lastCond)
    },

    setCondition(cond) {
      lastCond = cond
      const body100 = cond.body ?? 100
      const eng = cond.engine ?? 100
      const intr = cond.interior ?? 100
      const sus = cond.suspension ?? 100
      const ele = cond.electrics ?? 100
      // краска: чем хуже кузов, тем тусклее, с ржавым оттенком
      const wornBody = Math.max(0, Math.min(1, (100 - body100) / 100))
      bodyMat.roughness = Math.min(1, paintBase.rough + wornBody * 0.4)
      bodyMat.clearcoat = paintBase.clear * (1 - wornBody * 0.85)
      bodyMat.color.copy(paintBase.color).lerp(rustTint, wornBody * 0.35)
      const n = body100 >= 85 ? 0 : Math.min(patches.length, Math.round(((85 - body100) / 85) * patches.length) + 1)
      patches.forEach((p, i) => {
        p.visible = i < n
        if (i < n) p.material = body100 < 45 && i % 2 === 0 ? patchMat : scratchMat
      })
      // салон: свежая кожа ↔ потёртая ткань
      const worn = Math.max(0, Math.min(1, (100 - intr) / 100))
      seatMat.color.copy(seatDefaultColor).lerp(new THREE.Color(0x6a6a63), worn * 0.7)
      seatMat.roughness = 0.7 + worn * 0.3
      dashMat.color.setHex(0x15161a).lerp(new THREE.Color(0x3b3a38), worn * 0.7)
      floorMat.color.setHex(0x1b1a1d).lerp(new THREE.Color(0x4a3f33), worn * 0.8)
      interiorTear.forEach((t, i) => (t.visible = intr < 45 && i < 2))
      if (intr >= 85) {
        // «кожа»: тёплый коричневый → насыщенный красный/бордо
        seatMat.color.copy(seatBestColor)
        seatMat.roughness = 0.45
      }
      // электрика: разбитая правая фара
      headBroken = ele < 40
      headMat2.color.setHex(headBroken ? 0x2a2a2a : 0xfff6d6)
      headMat2.emissiveIntensity = headBroken ? 0 : headMat.emissiveIntensity
      // подвеска: просадка и развал
      const susWear = Math.max(0, Math.min(1, (100 - sus) / 100))
      sag = susWear * 0.07
      wearCamber = susWear * 0.07
      targetRide = -0.035 * tuningSuspension - sag
      currentRide = targetRide
      for (const w of allWheels) w.rotation.z = (0.02 * tuningSuspension + wearCamber) * (w.userData.sx ?? 1)
      // мотор: дым
      smokeOn = eng < 35 && !low
      if (!smokeOn) for (const p of smokePuffs) p.m.visible = false
    },

    setLights(on, brake = false, headIntensity = 40) {
      lightsOn = on
      braking = brake
      headMat.emissiveIntensity = on ? 3 : 0.5
      headMat2.emissiveIntensity = headBroken ? 0 : on ? 3 : 0.5
      tailMat.emissiveIntensity = brake ? 4 : on ? 1.6 : 0.6
      headSpots.forEach((s, i) => (s.intensity = on && !(headBroken && i === 1) ? headIntensity : 0))
    },

    tick(dt, speedMs = 0) {
      currentRide += (targetRide - currentRide) * Math.min(1, dt * 5)
      bob += dt * (1.2 + speedMs * 0.15)
      const bounce = speedMs > 0.5 ? Math.sin(bob * 6) * 0.004 * Math.min(1, speedMs / 15) : 0
      body.position.y = currentRide + bounce
      spinAngle += (speedMs / spec.wheelR) * dt
      for (const w of wheelSpinners) w.rotation.x = -spinAngle
      for (const p of parts) {
        if (!p.obj.visible) continue
        if (p.v < 1) {
          p.v = Math.min(1, p.v + dt * 2.2)
          // «выскакивает» с лёгким перелётом
          const t = p.v
          const e = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)
          p.obj.scale.setScalar(Math.max(0.001, e))
        }
        if (p.flash > 0) {
          p.flash = Math.max(0, p.flash - dt * 1.5)
        }
      }
      if (smokeOn) {
        for (const p of smokePuffs) {
          p.t = (p.t + dt * 0.55) % 1
          p.m.visible = true
          p.m.position.set((Math.sin(p.t * 9 + p.m.id) * 0.12), belt + 0.1 + p.t * 0.85, -(L / 2 - 0.55) - p.t * 0.15)
          p.m.scale.setScalar(0.5 + p.t * 1.9)
          ;(p.m.material as THREE.MeshBasicMaterial).opacity = (1 - p.t) * 0.38
        }
      }
      // пламя выхлопа мерцает
      const fl = parts[parts.length - 1]
      if (fl && fl.key === 'engine' && fl.obj.visible) fl.obj.scale.z = 0.8 + Math.random() * 0.6
      if (underGlowLight && underGlowLight.intensity > 0) underGlowLight.intensity = 5 + Math.sin(bob * 3) * 1.2
      void lightsOn
      void braking
    },

    dispose() {
      for (const d of disposables) d.dispose()
    },
  }

  api.setTuning(opts.tuning, false)
  api.setLook(opts.look ?? {})
  api.setCondition(opts.condition ?? {})
  void spokeGroups
  return api
}

/** Положение камеры для зон осмотра (в системе координат машины, перед = −Z). */
export function zoneCamera(spec: { L: number; W: number; belt: number; wheelR: number; wheelBase: number }, zone: string) {
  const { L, W, belt, wheelR, wheelBase } = spec
  switch (zone) {
    case 'engine':
      return { pos: new THREE.Vector3(W * 0.55, belt + 1.3, -(L / 2 + 1.6)), look: new THREE.Vector3(0, belt, -(L / 2 - 0.9)) }
    case 'body':
      return { pos: new THREE.Vector3(L * 0.75, belt + 0.9, -L * 0.7), look: new THREE.Vector3(0, belt * 0.7, 0) }
    case 'interior':
      return { pos: new THREE.Vector3(W / 2 + 1.1, belt + 0.55, -0.1), look: new THREE.Vector3(0, belt + 0.3, -0.1) }
    case 'suspension':
      return { pos: new THREE.Vector3(W / 2 + 1.2, wheelR + 0.25, -(wheelBase + 1.2)), look: new THREE.Vector3(W / 2 - 0.1, wheelR, -wheelBase) }
    case 'electrics':
      return { pos: new THREE.Vector3(-W * 0.6, belt - 0.05, -(L / 2 + 1.7)), look: new THREE.Vector3(0, belt - 0.2, -(L / 2)) }
    case 'documents':
      return { pos: new THREE.Vector3(W * 0.3, belt + 0.4, L / 2 + 1.7), look: new THREE.Vector3(0, belt - 0.1, L / 2) }
    case 'front':
      return { pos: new THREE.Vector3(0, belt + 0.35, -(L / 2 + 3.4)), look: new THREE.Vector3(0, belt * 0.7, 0) }
    case 'rear':
      return { pos: new THREE.Vector3(0, belt + 0.45, L / 2 + 3.6), look: new THREE.Vector3(0, belt * 0.7, 0) }
    case 'side':
      return { pos: new THREE.Vector3(L * 1.1, belt * 0.8, 0), look: new THREE.Vector3(0, belt * 0.65, 0) }
    case 'wheel':
      return { pos: new THREE.Vector3(W / 2 + 1.3, wheelR + 0.3, wheelBase + 1.0), look: new THREE.Vector3(W / 2 - 0.1, wheelR, wheelBase) }
    default:
      return { pos: new THREE.Vector3(L * 0.8, belt + 1.0, -L * 0.8), look: new THREE.Vector3(0, belt * 0.7, 0) }
  }
}
