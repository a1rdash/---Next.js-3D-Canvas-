/**
 * Реалистичный контроллер автомобиля (TypeScript, без зависимостей от движка).
 *
 *  - Шины: упрощённая «магическая формула» Пасейки для продольного (slip ratio) и поперечного (slip angle)
 *    скольжения + ограничение «кругом трения» при комбинированном скольжении.
 *  - Подвеска: независимый рейкаст на каждое колесо, пружина + демпфер (разные для сжатия и отбоя),
 *    ограничители хода и стабилизатор поперечной устойчивости (anti-roll bar) на обеих осях.
 *  - Двигатель: кривая момента, обороты, инерция маховика, ограничитель, холостой ход, торможение двигателем.
 *  - Трансмиссия: сцепление, автоматическая или ручная коробка, передаточные числа, главная пара, дифференциал
 *    (открытый или с самоблокировкой).
 *  - Перенос веса: возникает из жёсткого тела + сил подвески в точках колёс; дополнительно есть аналитическая оценка.
 *
 * Система координат: Y — вверх, +Z — вперёд по машине, +X — вправо. Единицы СИ (м, кг, с, Н, Н·м).
 * Чтобы подключить к своему движку: задайте `raycast` (Three.js Raycaster, Unity Physics.Raycast, Godot RayCast3D)
 * и каждый кадр вызывайте `step(dt)`, затем читайте `position`, `rotation`, `wheels[i]`.
 */

/* ------------------------------------------------------------------ */
/*  Мини-математика (чтобы модуль был самодостаточным)                  */
/* ------------------------------------------------------------------ */

export interface V3 { x: number; y: number; z: number }
export interface Q4 { x: number; y: number; z: number; w: number }

const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z })
const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z)
const mul = (a: V3, s: number): V3 => v3(a.x * s, a.y * s, a.z * s)
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: V3, b: V3): V3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const len = (a: V3) => Math.hypot(a.x, a.y, a.z)
const norm = (a: V3): V3 => {
  const l = len(a)
  return l > 1e-9 ? mul(a, 1 / l) : v3(0, 0, 0)
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Поворот вектора кватернионом */
function rotate(q: Q4, v: V3): V3 {
  const t = mul(cross(v3(q.x, q.y, q.z), v), 2)
  return add(add(v, mul(t, q.w)), cross(v3(q.x, q.y, q.z), t))
}
function conj(q: Q4): Q4 {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w }
}
/** Интегрирование ориентации по угловой скорости (мировая система) */
function integrateQ(q: Q4, w: V3, dt: number): Q4 {
  const dq: Q4 = {
    w: -0.5 * (q.x * w.x + q.y * w.y + q.z * w.z),
    x: 0.5 * (q.w * w.x + w.y * q.z - w.z * q.y),
    y: 0.5 * (q.w * w.y + w.z * q.x - w.x * q.z),
    z: 0.5 * (q.w * w.z + w.x * q.y - w.y * q.x),
  }
  const r = { x: q.x + dq.x * dt, y: q.y + dq.y * dt, z: q.z + dq.z * dt, w: q.w + dq.w * dt }
  const l = Math.hypot(r.x, r.y, r.z, r.w) || 1
  return { x: r.x / l, y: r.y / l, z: r.z / l, w: r.w / l }
}

/* ------------------------------------------------------------------ */
/*  Параметры (то, что выносится в инспектор / настройки материала)     */
/* ------------------------------------------------------------------ */

/** Коэффициенты формулы Пасейки: F = D·sin(C·atan(B·x − E·(B·x − atan(B·x)))) */
export interface PacejkaCurve { B: number; C: number; E: number }

export interface SuspensionParams {
  /** Длина полностью разгруженной подвески, м (от точки крепления до центра колеса) */
  freeLength: number
  /** Полный ход сжатия до отбойника, м */
  travel: number
  /** Жёсткость пружины, Н/м (на колесо) */
  springK: number
  /** Демпфирование при сжатии (bump), Н·с/м */
  damperBump: number
  /** Демпфирование при отбое (rebound), Н·с/м (обычно ×1.3–1.8 от bump) */
  damperRebound: number
  /** Жёсткость стабилизатора поперечной устойчивости спереди/сзади, Н/м (на разность сжатий) */
  antiRollFront: number
  antiRollRear: number
}

export interface WheelParams {
  /** Точка крепления подвески в локальных координатах (от центра масс) */
  attach: V3
  radius: number
  /** Момент инерции колеса со ступицей, кг·м² */
  inertia: number
  steer: boolean
  driven: boolean
}

export interface EngineParams {
  /** Кривая момента: [обороты в мин⁻¹, Н·м] */
  torqueCurve: [number, number][]
  idleRpm: number
  /** Обороты начала отсечки */
  redlineRpm: number
  /** Момент инерции маховика + двигателя, кг·м² */
  inertia: number
  /** Торможение двигателем: Н·м на 1000 об/мин при закрытом газе */
  engineBrake: number
}

export interface GearboxParams {
  ratios: number[]
  reverse: number
  finalDrive: number
  /** КПД трансмиссии */
  efficiency: number
  auto: boolean
  /** Время переключения, с */
  shiftTime: number
  /** Обороты повышения/понижения (авто) */
  upshiftRpm: number
  downshiftRpm: number
  /** Макс. момент, который передаёт сцепление, Н·м */
  clutchMaxTorque: number
}

export interface CarParams {
  mass: number
  /** Габариты для момента инерции (бокс): ширина, высота, длина */
  size: V3
  /** Высота центра масс над землёй при статике (для оценки переноса веса) */
  cgHeight: number
  wheels: [WheelParams, WheelParams, WheelParams, WheelParams] // FL, FR, RL, RR
  suspension: SuspensionParams
  /** Продольная / поперечная кривые шины и коэффициент сцепления */
  tireLong: PacejkaCurve
  tireLat: PacejkaCurve
  /** μ — коэффициент сцепления с дорогой (асфальт сухой ≈ 1.0–1.2) */
  mu: number
  /** Падение μ с ростом нагрузки (load sensitivity), 0…0.3 */
  loadSensitivity: number
  /** Сопротивление качению (Crr) */
  rollingResistance: number
  engine: EngineParams
  gearbox: GearboxParams
  /** Самоблокировка заднего/ведущего дифференциала: 0 — открытый, 1 — почти жёсткий */
  diffLock: number
  /** CdA (коэффициент лобового сопротивления × площадь), м² и коэффициент прижимной силы ClA */
  cdA: number
  clA: number
  /** Макс. тормозной момент на ось, Н·м; доля на передок */
  brakeTorque: number
  brakeBias: number
  /** Макс. угол поворота колёс (рад) на малой скорости и на высокой */
  maxSteer: number
  maxSteerHighSpeed: number
}

export interface CarInput {
  throttle: number // 0…1
  brake: number // 0…1
  steer: number // −1 (влево) … +1 (вправо)
  handbrake: boolean
}

export interface RayHit { distance: number; normal: V3 }
export type RaycastFn = (origin: V3, direction: V3, maxDistance: number) => RayHit | null

/** Плоская земля y = 0 по умолчанию */
export const flatGround: RaycastFn = (o, d, max) => {
  if (d.y >= -1e-6) return null
  const t = -o.y / d.y
  return t >= 0 && t <= max ? { distance: t, normal: v3(0, 1, 0) } : null
}

/** Пресет «седан C-класса» — отправная точка для настройки */
export function defaultSedan(): CarParams {
  const R = 0.33
  const ay = 0.2 // точка крепления выше ЦМ
  const w = (x: number, z: number, steer: boolean, driven: boolean): WheelParams => ({
    attach: v3(x, ay, z), radius: R, inertia: 1.1, steer, driven,
  })
  return {
    mass: 1450,
    size: v3(1.8, 1.4, 4.6),
    cgHeight: 0.4,
    wheels: [w(-0.8, 1.35, true, false), w(0.8, 1.35, true, false), w(-0.8, -1.35, false, true), w(0.8, -1.35, false, true)],
    suspension: { freeLength: 0.35, travel: 0.22, springK: 38_000, damperBump: 2_800, damperRebound: 4_200, antiRollFront: 18_000, antiRollRear: 12_000 },
    tireLong: { B: 12, C: 1.65, E: 0.97 },
    tireLat: { B: 9.5, C: 1.9, E: 0.97 },
    mu: 1.15,
    loadSensitivity: 0.12,
    rollingResistance: 0.012,
    engine: {
      torqueCurve: [[1000, 110], [2000, 150], [3000, 175], [4000, 190], [5000, 200], [6000, 190], [6800, 160], [7200, 100]],
      idleRpm: 900, redlineRpm: 6800, inertia: 0.25, engineBrake: 6,
    },
    gearbox: {
      ratios: [3.62, 2.19, 1.54, 1.14, 0.91, 0.74], reverse: 3.4, finalDrive: 3.9, efficiency: 0.92,
      auto: true, shiftTime: 0.22, upshiftRpm: 6300, downshiftRpm: 2300, clutchMaxTorque: 280,
    },
    diffLock: 0.25,
    cdA: 0.65, clA: 0.05,
    brakeTorque: 5200, brakeBias: 0.62,
    maxSteer: 0.55, maxSteerHighSpeed: 0.1,
  }
}

/* ------------------------------------------------------------------ */
/*  Состояние                                                          */
/* ------------------------------------------------------------------ */

export interface WheelState {
  grounded: boolean
  /** Сжатие подвески, м */
  compression: number
  /** Нормальная нагрузка Fz, Н */
  load: number
  /** Угловая скорость, рад/с */
  omega: number
  /** Угол вращения (для визуала) */
  spin: number
  steerAngle: number
  slipRatio: number
  slipAngle: number
  /** Продольная и поперечная силы шины, Н */
  fx: number
  fy: number
  /** Позиция центра колеса в мире (для меша) */
  center: V3
}

export class CarController {
  p: CarParams
  raycast: RaycastFn = flatGround
  input: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false }

  position: V3 = v3(0, 0.6, 0)
  rotation: Q4 = { x: 0, y: 0, z: 0, w: 1 }
  velocity: V3 = v3()
  angularVelocity: V3 = v3()

  wheels: WheelState[]
  engineOmega = 100 // рад/с
  gear = 1 // −1 = задняя, 0 = нейтраль, 1.. = передачи
  private shiftTimer = 0
  /** Пауза между автоматическими переключениями, с */
  private shiftCooldown = 0
  private steerSmooth = 0
  private inertia: V3
  private prevComp = [0, 0, 0, 0]
  /** Крутящие моменты для отладки */
  engineTorque = 0
  clutchTorque = 0

  constructor(params: CarParams = defaultSedan()) {
    this.p = params
    const m = params.mass
    const s = params.size
    // момент инерции прямоугольного бокса
    this.inertia = v3((m / 12) * (s.y * s.y + s.z * s.z), (m / 12) * (s.x * s.x + s.z * s.z), (m / 12) * (s.x * s.x + s.y * s.y))
    this.wheels = params.wheels.map((w) => ({
      grounded: false, compression: 0, load: 0, omega: 0, spin: 0, steerAngle: 0, slipRatio: 0, slipAngle: 0, fx: 0, fy: 0,
      center: v3(w.attach.x, 0, w.attach.z),
    }))
  }

  get rpm() { return (this.engineOmega * 60) / (2 * Math.PI) }
  /** Скорость вдоль кузова, м/с */
  get forwardSpeed() { return dot(this.velocity, rotate(this.rotation, v3(0, 0, 1))) }
  get speedKmh() { return Math.abs(this.forwardSpeed) * 3.6 }

  shiftUp() { if (this.gear < this.p.gearbox.ratios.length) this.startShift(this.gear + 1) }
  shiftDown() { if (this.gear > -1) this.startShift(this.gear - 1) }
  private startShift(g: number) { this.gear = g; this.shiftTimer = this.p.gearbox.shiftTime }

  /** Крутящий момент двигателя по кривой (линейная интерполяция) */
  torqueAt(rpm: number): number {
    const c = this.p.engine.torqueCurve
    if (rpm <= c[0][0]) return c[0][1]
    for (let i = 1; i < c.length; i++) {
      if (rpm <= c[i][0]) return lerp(c[i - 1][1], c[i][1], (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]))
    }
    return c[c.length - 1][1]
  }

  /** Формула Пасейки */
  private pacejka(c: PacejkaCurve, x: number): number {
    const bx = c.B * x
    return Math.sin(c.C * Math.atan(bx - c.E * (bx - Math.atan(bx))))
  }

  /**
   * Аналитическая оценка переноса веса (для HUD и настройки):
   * продольный ΔFz = m·ax·h/L, поперечный ΔFz = m·ay·h/T.
   */
  weightTransfer(ax: number, ay: number) {
    const L = Math.abs(this.p.wheels[0].attach.z - this.p.wheels[2].attach.z)
    const T = Math.abs(this.p.wheels[0].attach.x - this.p.wheels[1].attach.x)
    return { longitudinal: (this.p.mass * ax * this.p.cgHeight) / L, lateral: (this.p.mass * ay * this.p.cgHeight) / T }
  }

  /** Шаг симуляции; внутри — фиксированные подшаги для устойчивости пружин */
  step(dt: number) {
    const sub = Math.max(1, Math.min(10, Math.ceil(dt / (1 / 240))))
    const h = dt / sub
    for (let i = 0; i < sub; i++) this.substep(h)
  }

  private substep(dt: number) {
    const p = this.p
    const g = v3(0, -9.81, 0)
    const q = this.rotation
    const up = rotate(q, v3(0, 1, 0))
    const fwd = rotate(q, v3(0, 0, 1))
    const right = rotate(q, v3(1, 0, 0))
    const vFwd = dot(this.velocity, fwd)
    const speed = len(this.velocity)

    /* --- управление: угол поворота уменьшается со скоростью, сглаживается --- */
    const steerLimit = lerp(p.maxSteer, p.maxSteerHighSpeed, smoothstep(5, 45, speed))
    const steerTarget = clamp(this.input.steer, -1, 1) * steerLimit
    this.steerSmooth += (steerTarget - this.steerSmooth) * Math.min(1, dt * 9)

    /* --- ведущие колёса и их средняя скорость (нужны для синхронизации оборотов при переключении) --- */
    const driven = [0, 1, 2, 3].filter((i) => p.wheels[i].driven)
    const omegaDriven = driven.reduce((s, i) => s + this.wheels[i].omega, 0) / Math.max(1, driven.length)

    /* --- коробка: авто-логика и реверс --- */
    let throttle = clamp(this.input.throttle, 0, 1)
    let brake = clamp(this.input.brake, 0, 1)
    const gb = p.gearbox
    if (gb.auto) {
      if (this.gear === 0) this.gear = 1
      // у остановки: тормоз = задний ход, газ = вперёд
      if (Math.abs(vFwd) < 0.8) {
        if (brake > 0.1 && throttle < 0.05 && this.gear > 0) this.startShift(-1)
        if (throttle > 0.1 && this.gear < 0) this.startShift(1)
      }
      if (this.gear < 0) { const t = throttle; throttle = brake; brake = t } // в реверсе педали меняются ролями
      if (this.gear > 0 && this.shiftTimer <= 0 && this.shiftCooldown <= 0) {
        if (this.rpm > gb.upshiftRpm * (0.82 + 0.18 * throttle) && this.gear < gb.ratios.length) this.startShift(this.gear + 1)
        else if (this.rpm < gb.downshiftRpm && this.gear > 1) this.startShift(this.gear - 1)
        else if (throttle > 0.92 && this.gear > 1 && this.rpm < gb.downshiftRpm * 1.6 && vFwd > 3) this.startShift(this.gear - 1) // kickdown
      }
    }
    const wasShifting = this.shiftTimer > 0
    this.shiftTimer = Math.max(0, this.shiftTimer - dt)
    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt)
    const ratioGear = this.gear > 0 ? gb.ratios[this.gear - 1] : this.gear < 0 ? -gb.reverse : 0
    const ratio = ratioGear * gb.finalDrive
    // синхронизация: в конце переключения обороты двигателя подстраиваются под скорость колёс на новой передаче
    if (wasShifting && this.shiftTimer === 0 && ratio !== 0) {
      this.engineOmega = Math.max((p.engine.idleRpm * 2 * Math.PI) / 60, Math.abs(omegaDriven * ratio))
      this.shiftCooldown = 0.6
    }

    /* --- подвеска: рейкаст на каждое колесо --- */
    const sp = p.suspension
    const comp: number[] = [0, 0, 0, 0]
    const hits: (RayHit | null)[] = [null, null, null, null]
    const anchors: V3[] = []
    for (let i = 0; i < 4; i++) {
      const w = p.wheels[i]
      const anchor = add(this.position, rotate(q, w.attach))
      anchors.push(anchor)
      const maxLen = sp.freeLength + w.radius
      const hit = this.raycast(anchor, mul(up, -1), maxLen)
      hits[i] = hit
      if (hit) comp[i] = clamp(sp.freeLength - (hit.distance - w.radius), 0, sp.travel + 0.03)
    }

    /* --- силы и моменты (мировая система) --- */
    let F = mul(g, p.mass)
    let T = v3()
    const applyAt = (force: V3, point: V3) => {
      F = add(F, force)
      T = add(T, cross(sub(point, this.position), force))
    }

    // Стабилизатор: разность сжатий на оси передаёт силу с более сжатой стороны на менее сжатую
    const arb = [0, 0, 0, 0]
    const arbF = (cL: number, cR: number, k: number) => k * (cL - cR)
    arb[0] = arbF(comp[0], comp[1], sp.antiRollFront)
    arb[1] = -arb[0]
    arb[2] = arbF(comp[2], comp[3], sp.antiRollRear)
    arb[3] = -arb[2]

    /* --- привод: момент двигателя → сцепление → дифференциал --- */
    const engineRpm = this.rpm
    // момент двигателя: кривая × газ, отсечка у красной зоны, холостой ход, торможение двигателем
    const thrEff = this.shiftTimer > 0 ? 0 : throttle // отсечка момента на время переключения
    let tEng = this.torqueAt(engineRpm) * thrEff
    if (engineRpm > p.engine.redlineRpm) tEng *= clamp(1 - (engineRpm - p.engine.redlineRpm) / 400, 0, 1)
    tEng -= (1 - thrEff) * p.engine.engineBrake * (engineRpm / 1000)
    if (engineRpm < p.engine.idleRpm) tEng += (p.engine.idleRpm - engineRpm) * 0.18 // регулятор холостого хода
    this.engineTorque = tEng
    // сцепление: плавно включается по оборотам; во время переключения разомкнуто
    const engage = ratio === 0 || this.shiftTimer > 0 ? 0 : smoothstep(1300, 2600, engineRpm)
    const wheelSideOmega = Math.abs(omegaDriven * ratio) * Math.sign(ratio || 1)
    const slip = this.engineOmega - wheelSideOmega
    const tClutch = clamp(slip * 6, -gb.clutchMaxTorque, gb.clutchMaxTorque) * engage
    this.clutchTorque = tClutch
    // двигатель: Je·dω/dt = Tдв − Tсцепления
    this.engineOmega += ((tEng - tClutch) / p.engine.inertia) * dt
    this.engineOmega = Math.max(this.engineOmega, (p.engine.idleRpm * 0.5 * 2 * Math.PI) / 60)
    // момент на ведущие колёса
    const tDrive = tClutch * ratio * gb.efficiency
    const driveTorque = [0, 0, 0, 0]
    if (driven.length === 2) {
      // дифференциал: открытый делит поровну, самоблокировка добавляет момент к медленному колесу
      const [a, b] = driven
      const dw = this.wheels[a].omega - this.wheels[b].omega
      const lock = clamp(dw * p.diffLock * 40, -tDrive * 0.5 - 200, tDrive * 0.5 + 200)
      driveTorque[a] = tDrive * 0.5 - lock * 0.5
      driveTorque[b] = tDrive * 0.5 + lock * 0.5
    } else if (driven.length > 0) {
      for (const i of driven) driveTorque[i] = tDrive / driven.length
    }

    /* --- колёса: подвеска + шина + вращение --- */
    for (let i = 0; i < 4; i++) {
      const w = p.wheels[i]
      const ws = this.wheels[i]
      const hit = hits[i]
      ws.grounded = !!hit
      ws.steerAngle = w.steer ? this.steerSmooth : 0
      const c = comp[i]
      ws.compression = c
      // положение центра колеса (для визуала)
      ws.center = add(anchors[i], mul(up, -(sp.freeLength - c)))
      // тормозной момент: передок/зад по распределению, ручник блокирует зад
      const front = i < 2
      let brakeT = brake * p.brakeTorque * (front ? p.brakeBias : 1 - p.brakeBias) * 0.5
      if (this.input.handbrake && !front) brakeT = Math.max(brakeT, p.brakeTorque * 0.6)

      if (!hit) {
        // в воздухе: колесо просто раскручивается моментами
        ws.load = 0
        ws.fx = ws.fy = 0
        ws.omega += ((driveTorque[i] - Math.sign(ws.omega) * Math.min(Math.abs(ws.omega) * w.inertia / dt, brakeT)) / w.inertia) * dt
        this.prevComp[i] = 0
        continue
      }

      // пружина + демпфер (bump/rebound) + стабилизатор + отбойник
      const compVel = (c - this.prevComp[i]) / dt
      this.prevComp[i] = c
      let fs = sp.springK * c
      if (c > sp.travel) fs += (c - sp.travel) * sp.springK * 12 // жёсткий отбойник
      const fd = compVel > 0 ? sp.damperBump * compVel : sp.damperRebound * compVel
      const load = Math.max(0, fs + fd + arb[i])
      ws.load = load
      const n = hit.normal
      const contact = add(anchors[i], mul(up, -hit.distance))
      applyAt(mul(n, load), contact)

      // скорость контактного пятна в базисе колеса
      const r = sub(contact, this.position)
      const vc = add(this.velocity, cross(this.angularVelocity, r))
      const ca = Math.cos(ws.steerAngle)
      const sa = Math.sin(ws.steerAngle)
      let fw = norm(add(mul(fwd, ca), mul(right, sa))) // направление качения
      fw = norm(sub(fw, mul(n, dot(fw, n))))
      const sw = cross(n, fw) // боковое направление (+ вправо)
      const vLong = dot(vc, fw)
      const vLat = dot(vc, sw)

      // скольжения
      const denom = Math.max(Math.abs(vLong), 0.8)
      const kappa = clamp((ws.omega * w.radius - vLong) / denom, -1.5, 1.5)
      const alpha = Math.atan2(vLat, Math.abs(vLong) + 0.5)
      ws.slipRatio = kappa
      ws.slipAngle = alpha

      // пик сцепления с учётом чувствительности к нагрузке: μ·Fz·(1 − k·(Fz/Fz0 − 1))
      const fz0 = (p.mass * 9.81) / 4
      const muEff = p.mu * clamp(1 - p.loadSensitivity * (load / fz0 - 1), 0.6, 1.2)
      const D = muEff * load
      let fx = D * this.pacejka(p.tireLong, kappa)
      let fy = -D * this.pacejka(p.tireLat, alpha)
      // круг трения: суммарная сила не больше D
      const ratioF = Math.hypot(fx / (D + 1e-6), fy / (D + 1e-6))
      if (ratioF > 1) { fx /= ratioF; fy /= ratioF }
      // сопротивление качению
      fx -= Math.sign(vLong) * p.rollingResistance * load * smoothstep(0, 1, Math.abs(vLong))
      // на очень малой скорости поперечная сила — вязкое демпфирование (нет дрожания)
      const lowSpeed = 1 - smoothstep(0.3, 2.5, Math.abs(vLong))
      fy = lerp(fy, clamp(-vLat * load * 1.2, -D, D), lowSpeed)
      ws.fx = fx
      ws.fy = fy
      applyAt(add(mul(fw, fx), mul(sw, fy)), contact)

      // вращение колеса: Iw·dω/dt = Tпривод − Tтормоза − Fx·R
      let tNet = driveTorque[i] - fx * w.radius
      const brakeApplied = Math.min(Math.abs(ws.omega) * w.inertia / dt + Math.abs(tNet), brakeT)
      const newOmega = ws.omega + (tNet / w.inertia) * dt
      if (brakeT > 0) {
        const dec = (brakeApplied / w.inertia) * dt
        ws.omega = Math.abs(newOmega) <= dec ? 0 : newOmega - Math.sign(newOmega) * dec
      } else ws.omega = newOmega
      ws.spin += ws.omega * dt
      tNet = 0
    }

    /* --- аэродинамика --- */
    const rho = 1.225
    const drag = mul(this.velocity, -0.5 * rho * p.cdA * speed)
    F = add(F, drag)
    F = add(F, mul(up, -0.5 * rho * p.clA * speed * speed)) // прижимная сила

    /* --- интегрирование жёсткого тела --- */
    this.velocity = add(this.velocity, mul(F, dt / p.mass))
    // момент инерции в локальной системе: ω_l += (τ_l − ω_l × Iω_l)/I · dt
    const qi = conj(q)
    const wl = rotate(qi, this.angularVelocity)
    const tl = rotate(qi, T)
    const I = this.inertia
    const gyro = cross(wl, v3(I.x * wl.x, I.y * wl.y, I.z * wl.z))
    const dwl = v3((tl.x - gyro.x) / I.x, (tl.y - gyro.y) / I.y, (tl.z - gyro.z) / I.z)
    this.angularVelocity = rotate(q, add(wl, mul(dwl, dt)))
    this.angularVelocity = mul(this.angularVelocity, 1 - 0.02 * dt) // малое демпфирование для устойчивости
    this.position = add(this.position, mul(this.velocity, dt))
    this.rotation = integrateQ(q, this.angularVelocity, dt)
  }
}
