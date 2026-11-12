import {
  COLORS,
  DEFECT_TEMPLATES,
  FIRST_NAMES,
  MODELS,
  NICKNAMES,
  PARTS,
  RIVALS,
  SEGMENT_LABELS,
  SELLER_QUOTES,
  SEGMENT_LICENSE_REQ,
  ZONES,
  BLACK_SELLERS,
  DIFFICULTY_WEAR,
} from './data'
import { randomVin } from './exams'
import { chance, clamp, pick, rand, randInt, roundTo, shuffle, uid } from './random'
import type {
  AuctionLot,
  BlackLot,
  BuyerOffer,
  Car,
  CityContract,
  Defect,
  GameState,
  NewsItem,
  PartDef,
  Phase,
  Segment,
  Seller,
  SellerType,
  ShadyJob,
  Weather,
  Zone,
} from './types'

export const CURRENT_YEAR = 2026

export function allowedSegments(license: number): Segment[] {
  if (license >= 3) return ['junk', 'budget', 'mid', 'premium', 'sport', 'hyper']
  if (license >= 2) return ['junk', 'budget', 'mid', 'premium', 'sport']
  if (license >= 1) return ['junk', 'budget', 'mid', 'premium']
  return ['budget', 'mid']
}

const SEGMENT_WEIGHTS: Record<Segment, number> = { junk: 3, budget: 5, mid: 3, premium: 2, sport: 1, hyper: 0.4 }

function weightedSegment(segments: Segment[]): Segment {
  const total = segments.reduce((s, seg) => s + SEGMENT_WEIGHTS[seg], 0)
  let roll = Math.random() * total
  for (const seg of segments) {
    roll -= SEGMENT_WEIGHTS[seg]
    if (roll <= 0) return seg
  }
  return segments[0]
}

let activeDifficulty: string = 'normal'
/** Редьюсер задаёт текущую сложность перед каждым действием: она влияет на износ новых машин */
export function setActiveDifficulty(id: string) {
  activeDifficulty = id
}

export function generateCar(segments: Segment[], day: number, forceSegment?: Segment): Car {
  const segment = forceSegment ?? weightedSegment(segments)
  const pool = MODELS.filter((m) => m.segment === segment)
  let def = pick(pool)
  for (let i = 0; i < 6 && def.rarity !== undefined && !chance(def.rarity); i++) def = pick(pool)
  const year = randInt(segment === 'sport' ? 1995 : 2003, CURRENT_YEAR - 1)
  const age = CURRENT_YEAR - year
  const dw = DIFFICULTY_WEAR[activeDifficulty] ?? DIFFICULTY_WEAR.normal
  const mileageReal = Math.max(8_000, roundTo(age * rand(9_000, 26_000) * dw.mileage, 500))
  const condition = Object.fromEntries(
    ZONES.map((z) => [z, z === 'documents' ? randInt(70, 100) : randInt(25, 96)]),
  ) as Record<Zone, number>
  // чем выше сложность, тем более «убитые» машины появляются у ворот
  for (const z of ZONES) if (z !== 'documents') condition[z] = clamp(condition[z] - Math.round(dw.points * rand(0.6, 1.4)), 5, 100)

  const defects: Defect[] = []
  const defectCount = randInt(0, Math.min(4, 1 + Math.floor(age / 6)))
  for (let i = 0; i < defectCount; i++) {
    const zone = pick(ZONES.filter((z) => z !== 'documents'))
    const severity = rand(0.2, 1)
    condition[zone] = clamp(condition[zone] - Math.round(severity * 25), 5, 100)
    defects.push({
      id: uid(),
      zone,
      name: pick(DEFECT_TEMPLATES[zone]),
      severity,
      repairCost: roundTo(def.base * 0.04 * severity + 40, 10),
      revealed: false,
    })
  }

  return {
    id: uid(),
    brand: def.brand,
    model: def.model,
    year,
    segment,
    bodyType: def.bodyType,
    color: pick(COLORS),
    vin: randomVin(),
    mileageShown: mileageReal,
    mileageReal,
    baseValue: def.base,
    condition,
    inspected: Object.fromEntries(ZONES.map((z) => [z, false])) as Record<Zone, boolean>,
    defects,
    documentsForged: false,
    mileageChecked: false,
    vinChecked: false,
    tuning: { engine: 0, suspension: 0, visual: 0 },
    flightTanks: def.brand === 'Тесла-Н' && def.model.includes('Роадстер') ? 0 : undefined,
    purchasePrice: 0,
    invested: 0,
    acquiredDay: day,
  }
}

interface ValueInput {
  baseValue: number
  invested: number
  year: number
  mileage: number
  conditions: number[]
  defectSeverity: number
  forged: boolean
  docsCondition: number
  tuning: { engine: number; suspension: number; visual: number }
  demand: number
}

function computeValue(v: ValueInput) {
  const age = CURRENT_YEAR - v.year
  const ageFactor = Math.max(0.28, Math.pow(0.94, age))
  const mileageFactor = Math.max(0.45, 1 - v.mileage / 420_000)
  const avg = v.conditions.length
    ? v.conditions.reduce((s, c) => s + c, 0) / v.conditions.length
    : 70
  const condFactor = 0.4 + 0.6 * (avg / 100)
  const defectFactor = Math.max(0.55, 1 - v.defectSeverity * 0.06)
  const docsFactor = v.forged ? 0.5 : 0.75 + 0.25 * (v.docsCondition / 100)

  // Tuning levels: strong premium on top of base (flipper margin)
  const t = v.tuning
  const tuningFlat =
    t.engine * (25_000 + v.baseValue * 0.04) +
    t.suspension * (18_000 + v.baseValue * 0.03) +
    t.visual * (14_000 + v.baseValue * 0.025)
  // Money put into repair/parts returns ~90–110% depending on demand
  const investedReturn = v.invested * (0.9 + Math.min(0.2, (v.demand - 1) * 0.15))

  const core =
    v.baseValue * ageFactor * mileageFactor * condFactor * defectFactor * docsFactor * v.demand

  const flightBonus = (v as ValueInput & { flightTanks?: number }).flightTanks
    ? (v as ValueInput & { flightTanks?: number }).flightTanks! * 8_000_000
    : 0
  return Math.max(50_000, roundTo(core + tuningFlat + investedReturn + flightBonus, 1_000))
}

const tuningSum = (car: Car) => car.tuning.engine + car.tuning.suspension + car.tuning.visual

export function realValue(car: Car, demand: Record<Segment, number>) {
  const base = computeValue({
    baseValue: car.baseValue,
    invested: car.invested,
    year: car.year,
    mileage: car.mileageReal,
    conditions: ZONES.filter((z) => z !== 'documents').map((z) => car.condition[z]),
    defectSeverity: car.defects.reduce((s, d) => s + d.severity, 0),
    forged: car.documentsForged,
    docsCondition: car.condition.documents,
    tuning: car.tuning,
    demand: demand[car.segment] ?? 1,
  })
  return base + (car.flightTanks ?? 0) * 8_000_000
}

export function estimatedValue(car: Car, demand: Record<Segment, number>) {
  return computeValue({
    baseValue: car.baseValue,
    invested: car.invested,
    year: car.year,
    mileage: car.mileageChecked ? car.mileageReal : car.mileageShown,
    conditions: ZONES.filter((z) => z !== 'documents').map((z) => (car.inspected[z] ? car.condition[z] : 75)),
    defectSeverity: car.defects.filter((d) => d.revealed).reduce((s, d) => s + d.severity, 0),
    forged: car.vinChecked ? car.documentsForged : false,
    docsCondition: car.inspected.documents ? car.condition.documents : 90,
    tuning: car.tuning,
    demand: demand[car.segment] ?? 1,
  })
}

export function revealAll(car: Car): Car {
  return {
    ...car,
    inspected: Object.fromEntries(ZONES.map((z) => [z, true])) as Record<Zone, boolean>,
    defects: car.defects.map((d) => ({ ...d, revealed: true })),
    mileageChecked: true,
    vinChecked: true,
  }
}

function pickSellerType(rep: number, phase: Phase, weather: Weather): SellerType {
  const shadyP = clamp(0.08 + (100 - rep) / 350 + (phase === 'night' ? 0.25 : 0) + (weather === 'fog' ? 0.1 : 0), 0.05, 0.7)
  const honestP = clamp(0.15 + rep / 220, 0.1, 0.65)
  const roll = Math.random()
  if (roll < shadyP) return 'shady'
  if (roll < shadyP + honestP) return 'honest'
  return 'cunning'
}

export function generateSeller(state: GameState, segments: Segment[]): Seller {
  const type = pickSellerType(state.reputation, state.phase, state.weather)
  let name = ''
  for (let i = 0; i < 6; i++) {
    name = `${pick(FIRST_NAMES)} ${pick(NICKNAMES[type])}`
    if (!state.blacklist.includes(name)) break
  }
  const car = generateCar(segments, state.day)
  const truth = realValue(car, state.segmentDemand)
  let askingFactor = rand(0.92, 1.1)

  if (type === 'honest') {
    car.defects = car.defects.map((d) => ({ ...d, revealed: chance(0.7) }))
  } else if (type === 'cunning') {
    if (chance(0.65)) car.mileageShown = roundTo(car.mileageReal * rand(0.45, 0.75), 500)
    askingFactor = rand(1.08, 1.35)
  } else {
    car.documentsForged = chance(0.6)
    if (car.documentsForged) {
      car.condition.documents = randInt(10, 40)
      car.defects.push({
        id: uid(),
        zone: 'documents',
        name: pick(DEFECT_TEMPLATES.documents),
        severity: rand(0.6, 1),
        repairCost: 0,
        revealed: false,
      })
    }
    if (chance(0.4)) car.mileageShown = roundTo(car.mileageReal * rand(0.4, 0.7), 500)
    askingFactor = rand(0.5, 0.75)
  }

  // Unique market ask: model truth + jitter so the queue never looks identical
  const jitter = rand(0.88, 1.14)
  const rawAsk = truth * askingFactor * jitter * (car.documentsForged ? 1.12 : 1)
  const askingPrice = Math.max(80_000, roundTo(rawAsk + randInt(-15_000, 25_000), 1_000))

  return {
    id: uid(),
    name,
    type,
    quote: pick(SELLER_QUOTES[type]),
    car,
    askingPrice,
    patience: type === 'honest' ? 3 : type === 'cunning' ? 4 : 2,
    lastCounter: null,
  }
}

export function generateClients(state: GameState): Seller[] {
  const base = state.phase === 'night' ? 2 : 3
  const weatherMod = state.weather === 'rain' ? -1 : 0
  const repMod = state.reputation > 70 ? 1 : 0
  const count = clamp(base + weatherMod + repMod, 1, 5)
  const segments = allowedSegments(state.license)
  return Array.from({ length: count }, () => generateSeller(state, segments))
}

const BUYER_NAMES = ['Студент Кирилл', 'Семья Ивановых', 'Таксопарк «Шашка»', 'Блогер Макс', 'Дачник Петрович', 'Бизнесвумен Ирина', 'Курьер Самир', 'Коллекционер Лев', 'Стритрейсер Ник', 'Пенсионер Аркадий', 'Семья Петровых', 'Автошкола «Руль»', 'Фермер Сергей', 'Дизайнер Алина', 'Охранник Витя', 'Мама двоих', 'IT-шник Женя', 'Риелтор Оксана', 'Шеф-повар Марат', 'Инвестор Глеб', 'Таксист Рашид', 'Студентка Юля', 'Перекуп из Казани', 'Девушка на первой', 'Автоклуб «Неон»', 'Музыкант Лёша', 'Врач Елена', 'Строитель Паша', 'Байкер Дима', 'Семья из Сочи']
const BUYER_MOODS = ['Готов забрать сегодня', 'Хочет немного поторговаться', 'Влюбился с первого взгляда', 'Берёт для работы', 'Ищет именно такую', 'Сомневается, но платит']

export function generateOffers(car: Car, state: GameState): BuyerOffer[] {
  const truth = realValue(car, state.segmentDemand)
  const clean = 1 + state.upgrades.cleanliness * 0.03
  const rep = 0.85 + (state.reputation / 100) * 0.3
  const license = state.license >= 3 ? 1.1 : 1
  const weather = state.weather === 'rain' ? 0.93 : state.weather === 'fog' ? 0.97 : 1
  const phase = state.phase === 'evening' ? 1.05 : state.phase === 'night' ? 0.9 : 1
  const count = state.weather === 'rain' ? 2 : 3
  return shuffle(BUYER_NAMES)
    .slice(0, count)
    .map((name) => {
      const maxPay = roundTo(truth * rand(0.95, 1.18) * clean * rep * license * weather * phase, 1_000)
      const amount = roundTo(maxPay * rand(0.78, 0.92), 1_000)
      return {
        id: uid(),
        name,
        mood: pick(BUYER_MOODS),
        amount,
        maxPay,
        patience: randInt(2, 4),
        status: 'open' as const,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

const LOT_HINTS = ['Стоял в гараже 3 года', 'Конфискат с таможни', 'Изъят за долги', 'Наследство без документов на сервис', 'После лизинга', 'Утопленник? Никто не знает', 'Был в такси', 'Привезён из-за границы']

export function generateAuctionLots(state: GameState): AuctionLot[] {
  const segments = allowedSegments(state.license)
  const count = 4
  return Array.from({ length: count }, (_, i) => {
    const bank = state.license >= 2 && i === count - 1
    const car = generateCar(segments, state.day, bank ? pick(['premium', 'sport'] as Segment[]) : undefined)
    if (chance(0.15)) car.documentsForged = true
    const truth = realValue(car, state.segmentDemand)
    const decade = Math.floor(car.year / 5) * 5
    return {
      id: uid(),
      title: bank ? `Банковский лот #${randInt(100, 999)}` : `Лот #${randInt(100, 999)}`,
      hint: `${SEGMENT_LABELS[car.segment]} · ${decade}–${decade + 4} г. · ${pick(LOT_HINTS)}`,
      segment: car.segment,
      bank,
      startPrice: roundTo(truth * (bank ? 0.3 : 0.4), 1_000),
      car,
      status: 'pending' as const,
    }
  })
}

const SHADY_GIVERS = ['Кривой Саня', 'Человек в капюшоне', 'Майор в отставке', 'Тётя Люда со штрафстоянки', 'Неизвестный номер']
const SHADY_TEMPLATES = [
  { title: 'Перебивка номеров', description: 'Нужно «освежить» VIN на кузове. Быстро и тихо.', reward: [150_000, 400_000], risk: [0.25, 0.45], rep: 12, fine: 250_000 },
  { title: 'Легализация конфиската', description: 'Провести машину со штрафстоянки через «своих» в ГИБДД.', reward: [250_000, 700_000], risk: [0.3, 0.5], rep: 15, fine: 400_000 },
  { title: 'Скрутка пробега', description: 'Клиент хочет минус 150 000 км к пятнице.', reward: [60_000, 140_000], risk: [0.12, 0.25], rep: 6, fine: 90_000 },
  { title: 'Ночная перегонка', description: 'Перегнать «чистую» машину в соседний регион без вопросов.', reward: [90_000, 220_000], risk: [0.15, 0.35], rep: 8, fine: 150_000 },
  { title: 'Схема с дубликатом ПТС', description: 'Сделать дубликат, чтобы скрыть залог.', reward: [200_000, 500_000], risk: [0.3, 0.55], rep: 14, fine: 350_000 },
]

export function generateShadyJobs(state: GameState): ShadyJob[] {
  if (state.phase !== 'night' && state.weather !== 'fog') return []
  const count = state.phase === 'night' ? (state.weather === 'fog' ? 3 : 2) : 1
  const scale = 1 + state.level * 0.08
  return shuffle(SHADY_TEMPLATES)
    .slice(0, count)
    .map((t) => ({
      id: uid(),
      giver: pick(SHADY_GIVERS),
      title: t.title,
      description: t.description,
      reward: roundTo(rand(t.reward[0], t.reward[1]) * scale, 1000),
      risk: rand(t.risk[0], t.risk[1]),
      repLoss: t.rep,
      fine: roundTo(t.fine * scale, 1000),
    }))
}

const NEWS_TEMPLATES: { text: (s: string) => string; up: boolean }[] = [
  { text: (s) => `Ажиотаж! Спрос на сегмент «${s}» резко вырос`, up: true },
  { text: (s) => `Блогеры хайпуют на «${s}» — цены ползут вверх`, up: true },
  { text: (s) => `Таможня ужесточила ввоз: «${s}» в дефиците`, up: true },
  { text: (s) => `Рынок «${s}» перегрет, покупатели ушли`, up: false },
  { text: (s) => `Новый налог ударил по сегменту «${s}»`, up: false },
  { text: (s) => `Дилеры демпингуют: «${s}» дешевеет`, up: false },
]

export function generateNews(): { news: NewsItem[]; demand: Record<Segment, number> } {
  const demand: Record<Segment, number> = { junk: 1, budget: 1, mid: 1, premium: 1, sport: 1, hyper: 1 }
  const segments = shuffle(['budget', 'mid', 'premium', 'sport'] as Segment[]).slice(0, 2)
  const news: NewsItem[] = segments.map((seg) => {
    const tpl = pick(NEWS_TEMPLATES)
    const modifier = tpl.up ? rand(1.08, 1.25) : rand(0.8, 0.93)
    demand[seg] = modifier
    return { id: uid(), headline: tpl.text(SEGMENT_LABELS[seg]), segment: seg, modifier }
  })
  news.push({
    id: uid(),
    headline: pick([
      'Синоптики: неделя будет дождливой, шины в цене',
      'В городе открылся новый автосервис «Неон-Мото»',
      'Конкуренты скупают всё подряд на утренних торгах',
      'Полиция усилила рейды на серых перекупов',
      'Курс нота-койнов штормит — запчасти дорожают',
    ]),
    segment: null,
    modifier: 1,
  })
  return { news, demand }
}

export function generateDuelCar(state: GameState): Car {
  return revealAll(generateCar(allowedSegments(state.license), state.day))
}

export function partPrice(part: PartDef, state: Pick<GameState, 'partPriceMod' | 'weather' | 'phase'>) {
  let mod = state.partPriceMod
  if (state.weather === 'rain' && part.category === 'tires') mod *= 1.25
  if (state.weather === 'fog' && part.category === 'electrics') mod *= 1.1
  if (state.phase === 'night') mod *= 0.95
  // Never free — minimum ₽5
  return Math.max(500, roundTo(part.basePrice * mod, 100))
}

export function repairCost(car: Car, zone: Zone) {
  const missing = 100 - car.condition[zone]
  const defectCost = car.defects.filter((d) => d.zone === zone).reduce((s, d) => s + d.repairCost, 0)
  return Math.max(1_500, roundTo(car.baseValue * 0.004 * missing + defectCost * 0.6 + 2_500, 100))
}

/** Worn budget hatch for starting lot / Google bonus. */
export function makeStarterCar(day = 1, gift = false): Car {
  const car = generateCar(['budget'], day, 'budget')
  car.brand = gift ? 'Кира' : 'Ладога'
  car.model = gift ? 'Рио-Нова' : 'Калинка'
  car.bodyType = 'hatch'
  car.year = gift ? 2012 : 2008
  car.color = gift ? 'Белый перламутр' : 'Вишня'
  car.baseValue = gift ? 980_000 : 420_000
  car.mileageReal = gift ? 140_000 : 210_000
  car.mileageShown = car.mileageReal
  car.purchasePrice = gift ? 0 : 0
  car.invested = 0
  car.acquiredDay = day
  car.documentsForged = false
  for (const z of ZONES) {
    if (z === 'documents') car.condition[z] = gift ? 85 : 70
    else car.condition[z] = gift ? randInt(45, 75) : randInt(28, 55)
    car.inspected[z] = false
  }
  return car
}

export const partById = (id: string) => PARTS.find((p) => p.id === id)

export const rivalPool = RIVALS

export const xpForLevel = (level: number) => Math.round(120 * Math.pow(level, 1.45))

export const maxSlots = (state: GameState) => state.upgrades.slots + 2


/**
 * Износ: насколько машина «убита». 0 — как новая, 1 — развалюха.
 * Двигатель и подвеска влияют сильнее всего, плюс пробег и невыявленные/неустранённые дефекты.
 */
export function wearInfo(car: Car) {
  const eng = clamp(car.condition.engine / 100, 0, 1)
  const sus = clamp(car.condition.suspension / 100, 0, 1)
  const ele = clamp(car.condition.electrics / 100, 0, 1)
  const defectLoad = car.defects
    .filter((d) => d.zone === 'engine' || d.zone === 'suspension')
    .reduce((sum, d) => sum + d.severity, 0)
  const mileage = clamp(car.mileageReal / 450_000, 0, 1)
  // 0 (идеал) … 1 (убита)
  const wear = clamp(
    (1 - eng) * 0.42 + (1 - sus) * 0.28 + (1 - ele) * 0.08 + mileage * 0.14 + clamp(defectLoad * 0.03, 0, 0.2),
    0,
    1,
  )
  // «нелинейный» штраф: небольшой износ почти не ощущается, сильный — режет скорость и разгон
  const speedMul = clamp(1 - Math.pow(wear, 1.25) * 0.62, 0.35, 1)
  const accelMul = clamp(1 - Math.pow(wear, 1.1) * 0.75, 0.22, 1)
  const label =
    wear < 0.15 ? 'Как новая' : wear < 0.35 ? 'Лёгкий износ' : wear < 0.55 ? 'Заметный износ' : wear < 0.75 ? 'Сильный износ' : 'Убитая'
  const engineDamaged = eng < 0.45 || car.defects.some((d) => d.zone === 'engine' && d.severity >= 3)
  const suspensionDamaged = sus < 0.45 || car.defects.some((d) => d.zone === 'suspension' && d.severity >= 3)
  return { wear, speedMul, accelMul, label, engineDamaged, suspensionDamaged }
}

/** Arcade drive stats from brand segment + wear (engine/suspension/electrics). */
export function driveStats(car: Car) {
  const eng = car.condition.engine / 100
  const sus = car.condition.suspension / 100
  const ele = car.condition.electrics / 100
  const segmentBoost: Record<string, number> = {
    junk: 0.65, budget: 0.85, mid: 1, premium: 1.12, sport: 1.28, hyper: 1.45,
  }
  const boost = segmentBoost[car.segment] ?? 1
  const tanks = car.flightTanks ?? 0
  const flight = tanks > 0 ? 1 + tanks * 0.12 : 1
  // максимальная скорость растёт с двигателем, коробкой и подвеской; общий износ её снижает (см. wearInfo)
  const tune = 1 + car.tuning.engine * 0.12 + (car.tuning.gearbox ?? 0) * 0.1 + car.tuning.suspension * 0.04
  const w = wearInfo(car)
  // потенциал машины без износа (сегмент + тюнинг), затем износ режет и максимальную скорость, и разгон
  const potential = boost * tune * flight * 0.85
  const speed = clamp(potential * w.speedMul + eng * 0.08, 0.3, 2.3)
  const accel = clamp((0.6 + boost * 0.4 * tune) * w.accelMul, 0.15, 1.7)
  const handling = clamp((sus * 0.6 + boost * 0.25 * (tanks > 0 ? 1.05 : 1)) * (w.suspensionDamaged ? 0.8 : 1), 0.3, 1.45)
  const reliability = clamp((eng + ele) / 2, 0.35, 1.2)
  const appeal = clamp((eng + sus + ele) / 3 * (1 + car.tuning.visual * 0.05), 0.5, 1.4)
  return { speed, accel, handling, reliability, appeal, wear: w.wear, wearLabel: w.label, engineDamaged: w.engineDamaged, suspensionDamaged: w.suspensionDamaged }
}

/** Лицензирование (легализация документов): нужный уровень, «опыт» игрока и шанс провала. */
export function legalizeInfo(state: GameState, car: Car) {
  const required = SEGMENT_LICENSE_REQ[car.segment] ?? 0
  // «Опыт нотариуса»: лицензия + бонус от офиса (штатный юрист и выше даёт +1 этап)
  const experience = state.license + ((state.upgrades.office ?? 0) >= 3 ? 1 : 0)
  const allowed = experience >= required
  let risk = state.protectionDays > 0 ? 0.15 : 0.35
  risk += required * 0.04 // чем дороже и престижнее машина, тем сложнее
  risk -= (experience - required) * 0.08 // запас лицензии резко повышает шанс успеха
  risk -= state.upgrades.tools * 0.02
  risk -= (state.upgrades.office ?? 0) * 0.03
  risk = clamp(risk, 0.04, 0.8)
  return { required, experience, allowed, risk }
}

/** Риск чёрного рынка зависит от охраны вашего гаража: чем она сильнее, тем меньше «чужих глаз» у сделки. */
export function blackRisk(state: GameState, forged: boolean) {
  return clamp(
    0.34 + (forged ? 0.15 : 0) + (6 - state.upgrades.security) * 0.015 - state.license * 0.035 - (state.upgrades.office ?? 0) * 0.03,
    0.15,
    0.7,
  )
}

export function generateBlackLot(state: GameState, i: number): BlackLot {
  const segs = allowedSegments(state.license)
  const elite = i % 4 === 3
  const car = generateCar(segs, state.day, elite ? pick(['premium', 'sport'] as Segment[]) : undefined)
  car.documentsForged = chance(0.55)
  const truth = realValue(car, state.segmentDemand)
  const seller = pick(BLACK_SELLERS)
  return {
    id: uid(),
    title: elite ? 'Элитный «серый» лот' : pick(['Контрабандный лот', 'Конфискат', 'Лот без истории', 'Ночная поставка']),
    seller,
    car,
    price: roundTo(truth * rand(0.35, 0.55), 1_000),
    risk: blackRisk(state, car.documentsForged),
    status: 'open' as const,
  }
}

/** На чёрном рынке всегда ровно 4 машины на выбор. */
export const BLACK_MARKET_SIZE = 4

export function generateBlackMarket(state: GameState): BlackLot[] {
  return Array.from({ length: BLACK_MARKET_SIZE }, (_, i) => generateBlackLot(state, i))
}

export function generateContracts(state: GameState): CityContract[] {
  const brands = ['Волга', 'Жигули', 'Москвич', 'ГАЗ', 'УАЗ']
  return [0, 1].map((i) => {
    const brand = brands[(state.day + i) % brands.length]
    const seg: Segment = i === 0 ? 'mid' : pick(['premium', 'sport'] as Segment[])
    return {
      id: uid(),
      title: i === 0 ? `Контракт: найти «${brand}»` : 'Заказ авторитета',
      description: `Доставьте ${brand} сегмента ${seg} на стоянку до дня ${state.day + 3 + i}.`,
      brandHint: brand,
      segment: seg,
      reward: roundTo((80_000 + state.level * 25_000) * (i + 1), 1_000),
      deadlineDay: state.day + 3 + i,
      status: 'active' as const,
    }
  })
}
