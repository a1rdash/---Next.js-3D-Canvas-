import { FREE_LOOKS, LOOK_CATALOG, LOOK_COLOR_COST, DIFFICULTY_GOALS, DIFFICULTY_ORDER, LOAN_TIERS, PAINT_COLORS, PAINT_COST, ACHIEVEMENTS, ACHIEVEMENT_REWARD_CAP, DAILY_REWARDS, DIFFICULTY_DEFS, DONATE_PACKS, EXAM_FEES, LICENSE_FAIL_MESSAGE, PART_ZONE, PARTS, PHASES, PHASE_LABELS, THIEF_NAMES, UPGRADE_DEFS, WEATHER_LABELS } from './data'
import {
  generateAuctionLots,
  generateBlackLot,
  generateBlackMarket,
  blackRisk,
  legalizeInfo,
  setActiveDifficulty,
  generateContracts,
  makeStarterCar,
  generateClients,
  generateDuelCar,
  generateNews,
  generateOffers,
  generateShadyJobs,
  maxSlots,
  partById,
  partPrice,
  realValue,
  repairCost,
  rivalPool,
  xpForLevel,
} from './generators'
import { chance, clamp, formatMoney, pick, rand, randInt, roundTo, uid } from './random'
import type { Car, CarLook, DifficultyId, GameState, Phase, Toast, Transaction, TxCategory, Upgrades, Weather, Zone } from './types'

export type GameAction =
  | { type: 'ADVANCE_PHASE' }
  | { type: 'SELECT_CLIENT'; id: string | null }
  | { type: 'INSPECT_ZONE'; sellerId: string; zone: Zone }
  | { type: 'CHECK_MILEAGE'; sellerId: string }
  | { type: 'CHECK_VIN'; sellerId: string }
  | { type: 'MAKE_OFFER'; sellerId: string; amount: number }
  | { type: 'ACCEPT_ASK'; sellerId: string }
  | { type: 'DISMISS_CLIENT'; sellerId: string; blacklist?: boolean }
  | { type: 'LIST_CAR'; carId: string }
  | { type: 'SELL_CAR'; carId: string; offerId: string }
  | { type: 'COUNTER_OFFER'; carId: string; offerId: string; amount: number }
  | { type: 'REPAIR_ZONE'; carId: string; zone: Zone }
  | { type: 'INSTALL_PART'; carId: string; partId: string }
  | { type: 'LEGALIZE_CAR'; carId: string }
  | { type: 'BUY_PART'; partId: string; qty: number }
  | { type: 'AUCTION_START'; lotId: string }
  | { type: 'AUCTION_END'; lotId: string; winner: string; price: number }
  | { type: 'ACCEPT_SHADY'; jobId: string }
  | { type: 'DECLINE_SHADY'; jobId: string }
  | { type: 'BUY_PROTECTION' }
  | { type: 'BUY_UPGRADE'; key: keyof Upgrades }
  | { type: 'EXAM_RESULT'; passed: boolean; stage?: number }
  | { type: 'PRACTICE_DONE'; correct: number; total: number }
  | { type: 'DUEL_GUESS'; guess: number }
  | { type: 'VIP_BOOST'; carId: string }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'UNBLACKLIST'; name: string }
  | { type: 'NEW_GAME' }
  | { type: 'GOOGLE_SIGN_IN' }
  | { type: 'GOOGLE_SIGN_OUT' }
  | { type: 'BUY_DONATE'; packId: string }
  | { type: 'MARKET_SOFT_REFRESH' }
  | { type: 'MARKET_MAJOR_REFRESH' }
  | { type: 'TICK_CLOCK' }
  | { type: 'SYNC_CLOCK'; hour: number; now: number }
  | { type: 'DRIVE_FINE'; amount: number; reason: string }
  | { type: 'REQUEST_INSPECTION'; sellerId: string }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'REPAY_LOAN' }
  | { type: 'PAINT_CAR'; carId: string; color: string }
  | { type: 'BUY_LOOK'; id: string }
  | { type: 'SET_LOOK'; carId: string; patch: Partial<CarLook> }
  | { type: 'SET_DIFFICULTY'; id: DifficultyId }
  | { type: 'CLAIM_DAILY' }
  | { type: 'BUY_BLACK'; lotId: string }
  | { type: 'START_DRIVE'; carId: string }
  | { type: 'FINISH_DRIVE'; carId: string; clean: boolean; score: number }
  | { type: 'SKIP_DRIVE' }
  | { type: 'REFRESH_CONTRACTS' }
  | { type: 'COMPLETE_CONTRACT'; contractId: string }

export const PLAYER = 'Вы'
export const PROTECTION_COST = 25_000
export const LIST_FEE = 3_500


function logTx(
  state: GameState,
  amount: number,
  category: TxCategory,
  label: string,
  opts?: { asDonate?: boolean },
): GameState {
  const entry: Transaction = {
    id: uid(),
    day: state.day,
    phase: state.phase,
    amount,
    category,
    label,
    at: Date.now(),
  }
  return {
    ...state,
    ledger: [entry, ...(state.ledger || [])].slice(0, 250),
    donateHistory: opts?.asDonate
      ? [entry, ...(state.donateHistory || [])].slice(0, 100)
      : state.donateHistory || [],
  }
}

function pushTx(
  state: GameState,
  amount: number,
  category: TxCategory,
  label: string,
  opts?: { asDonate?: boolean },
): GameState {
  const entry: Transaction = {
    id: uid(),
    day: state.day,
    phase: state.phase,
    amount,
    category,
    label,
    at: Date.now(),
  }
  const ledger = [entry, ...(state.ledger || [])].slice(0, 250)
  const donateHistory = opts?.asDonate
    ? [entry, ...(state.donateHistory || [])].slice(0, 100)
    : state.donateHistory || []
  return {
    ...state,
    money: Math.max(0, state.money + amount),
    ledger,
    donateHistory,
  }
}

function toast(state: GameState, message: string, tone: Toast['tone'] = 'info'): GameState {
  return {
    ...state,
    toasts: [...state.toasts.slice(-2), { id: uid(), message, tone }],
    log: [`Д${state.day} ${PHASE_LABELS[state.phase]}: ${message}`, ...state.log].slice(0, 40),
  }
}

function addXp(state: GameState, amount: number): GameState {
  let { xp, level } = state
  xp += Math.max(0, Math.round(amount))
  let next = state
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level)
    level += 1
    next = toast({ ...next, xp, level }, `Новый уровень перекупщика: ${level}!`, 'good')
  }
  return { ...next, xp, level }
}

function grant(state: GameState, id: string): GameState {
  if (state.achievements.includes(id)) return state
  const def = ACHIEVEMENTS.find((x) => x.id === id)
  if (!def) return state
  const reward = Math.min(ACHIEVEMENT_REWARD_CAP, def.reward)
  let next: GameState = { ...state, achievements: [...state.achievements, id], money: state.money + reward }
  next = logTx(next, reward, 'achievement', `Достижение: ${def.title}`)
  return toast(next, `Достижение «${def.title}»! Награда ${formatMoney(reward)}`, 'good')
}

function unlock(state: GameState): GameState {
  let next = state
  for (const def of ACHIEVEMENTS) {
    if (def.rule && !next.achievements.includes(def.id) && def.rule(next)) next = grant(next, def.id)
  }
  // прохождение текущей сложности открывает следующую
  const done = next.completedDifficulties ?? []
  const goal = DIFFICULTY_GOALS[next.difficulty]
  if (goal !== undefined && Number.isFinite(goal) && !done.includes(next.difficulty) && next.stats.totalProfit >= goal) {
    const idx = DIFFICULTY_ORDER.indexOf(next.difficulty as (typeof DIFFICULTY_ORDER)[number])
    const nextId = DIFFICULTY_ORDER[idx + 1]
    next = { ...next, completedDifficulties: [...done, next.difficulty] }
    next = toast(next, `Сложность пройдена! ${nextId ? `Открыт режим: ${DIFFICULTY_DEFS[nextId].label}` : ''}`, 'good')
  }
  return next
}

function rollWeather(phase: Phase): Weather {
  const fogP = phase === 'night' || phase === 'morning' ? 0.22 : 0.08
  const roll = Math.random()
  if (roll < fogP) return 'fog'
  if (roll < fogP + 0.25) return 'rain'
  return 'clear'
}

function updateSeller(state: GameState, sellerId: string, fn: (car: Car) => Car): GameState {
  return {
    ...state,
    clients: state.clients.map((c) => (c.id === sellerId ? { ...c, car: fn(c.car) } : c)),
  }
}

function updateCar(state: GameState, carId: string, fn: (car: Car) => Car): GameState {
  return { ...state, lot: state.lot.map((c) => (c.id === carId ? fn(c) : c)) }
}

function buyFromSeller(state: GameState, sellerId: string, price: number): GameState {
  const seller = state.clients.find((c) => c.id === sellerId)
  if (!seller) return state
  if (state.money < price) return toast(state, 'Не хватает денег на сделку', 'bad')
  if (state.lot.length >= maxSlots(state)) return toast(state, 'Стоянка заполнена — улучши гараж', 'bad')
  const car: Car = { ...seller.car, purchasePrice: price, acquiredDay: state.day }
  let next: GameState = {
    ...state,
    money: state.money - price,
    lot: [...state.lot, car],
    clients: state.clients.filter((c) => c.id !== sellerId),
    activeClientId: null,
    stats: { ...state.stats, carsBought: state.stats.carsBought + 1 },
    reputation: clamp(state.reputation + (seller.type === 'shady' ? -2 : 1), 0, 100),
  }
  next = logTx(next, -price, 'buy', `Покупка: ${car.brand} ${car.model}`)
  next = toast(next, `Куплено: ${car.brand} ${car.model} за ${formatMoney(price)}`, 'good')
  return unlock(addXp(next, 15))
}


/** Sale wait (~2× faster): cheap cars ~20s, premium up to ~4 min real-time. */
export function saleReadyAt(car: Car, listedAt = Date.now()): number {
  const value = car.baseValue + car.invested
  // RUB scale: budget ~25s, premium up to ~4 min
  const sec = Math.min(240, Math.max(20, Math.round(value / 40_000)))
  return listedAt + sec * 1000
}

function wrapListing(car: Car, state: GameState, listedAt = Date.now()) {
  return { offers: generateOffers(car, state), listedAt, readyAt: saleReadyAt(car, listedAt) }
}

function tryNightRaid(state: GameState): GameState {
  if (state.phase !== 'night') return state
  const thief = pick(THIEF_NAMES)
  if (state.protectionDays > 0) {
    return chance(0.15) ? toast(state, `Ночь спокойная: крыша и охрана на месте. ${thief} прошёл мимо.`, 'info') : state
  }
  const sec = state.upgrades.security
  // security 0 = высокий риск, 6 = почти нулевой
  const p = Math.max(0.02, 0.42 - sec * 0.065)
  if (!chance(p)) {
    if (sec >= 2 && chance(0.4)) {
      const stopped = { ...state, stats: { ...state.stats, thievesStopped: (state.stats.thievesStopped ?? 0) + 1 } }
      return toast(grant(stopped, 'thief-fail'), `Охрана спугнула вора: ${thief}. Он ушёл ни с чем.`, 'good')
    }
    return state
  }
  // чем сильнее охрана, тем меньше урон
  const harm = Math.max(0.35, 1 - sec * 0.1)

  const inv = state.inventory.filter((i) => i.qty > 0)
  if (inv.length && chance(0.55)) {
    const item = pick(inv)
    const nextInv = state.inventory
      .map((i) => (i.partId === item.partId ? { ...i, qty: i.qty - 1 } : i))
      .filter((i) => i.qty > 0)
    const partName = partById(item.partId)?.name ?? 'запчасть'
    return toast(
      { ...state, inventory: nextInv, lastPartsTheftAt: Date.now() },
      `Ночной налёт! ${thief} утащил «${partName}». Улучшайте охрану!`,
      'bad',
    )
  }

  if (state.lot.length) {
    const car = pick(state.lot)
    const zone = pick(['engine', 'suspension', 'body', 'electrics'] as const)
    const dmg = Math.round(randInt(12, 28) * harm)
    const next = updateCar(state, car.id, (c) => ({
      ...c,
      condition: { ...c.condition, [zone]: clamp(c.condition[zone] - dmg, 5, 100) },
    }))
    const zoneRu: Record<string, string> = { engine: 'двигатель', suspension: 'подвеску', body: 'кузов', electrics: 'электрику' }
    return toast(
      { ...next, lastPartsTheftAt: Date.now() },
      `Ночной налёт! ${thief} повредил ${zoneRu[zone]} у ${car.brand} ${car.model}. Улучшайте охрану!`,
      'bad',
    )
  }

  return toast(state, `${thief} ходил у гаража, но унести было нечего.`, 'info')
}


/** Локальная дата YYYY-MM-DD — без UTC-сдвига (в отличие от toISOString). */
export function localDayKey(now = Date.now()): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Новый игровой день: +1 к счётчику и обновление всех дневных событий. */
function beginNewDay(state: GameState): GameState {
  const day = state.day + 1
  let next: GameState = { ...state, day }
  const { news, demand } = generateNews()
  next = {
    ...next,
    news,
    segmentDemand: demand,
    partPriceMod: rand(0.85, 1.18),
    protectionDays: Math.max(0, next.protectionDays - 1),
    duel: { day, car: generateDuelCar(next), rival: pick(rivalPool), done: false },
    clients: generateClients(next),
    activeClientId: null,
    auctionLots: generateAuctionLots(next),
    blackMarket: generateBlackMarket(next),
  }
  // Car theft only on a new day, scaled by security (0..5)
  const theftTable = [0.12, 0.08, 0.05, 0.03, 0.015, 0]
  const theftChance = next.protectionDays > 0 ? 0 : theftTable[Math.min(5, next.upgrades.security)]
  if (next.lot.length > 0 && chance(theftChance)) {
    const victim = pick(next.lot)
    const { [victim.id]: _drop, ...restListings } = next.listings
    next = toast(
      { ...next, lot: next.lot.filter((c) => c.id !== victim.id), listings: restListings },
      `Ночью угнали ${victim.brand} ${victim.model}! Усиль охрану.`,
      'bad',
    )
  }
  return toast(next, `День ${next.day}. Новости рынка обновлены. Стоянка на месте.`, 'info')
}

/**
 * Переход к следующей фазе суток.
 * `allowNewDay` выключается при синхронизации по часам: там день меняется по календарной дате,
 * а не по «ночь → утро», иначе можно получить два инкремента за один день.
 */
function advancePhase(state: GameState, allowNewDay = true): GameState {
  const idx = PHASES.indexOf(state.phase)
  const newDay = allowNewDay && idx === PHASES.length - 1
  const phase = PHASES[(idx + 1) % PHASES.length]
  const weather = rollWeather(phase)
  // Lot cars never change on phase switch — only time, weather and day index.
  let next: GameState = { ...state, phase, weather }

  if (newDay) {
    next = beginNewDay(next)
  } else {
    // Same day phase change: keep clients & lot. Refresh shady jobs only.
    next = {
      ...next,
      shadyJobs: generateShadyJobs(next),
    }
    if (phase === 'evening' || phase === 'night') {
      next = tryNightRaid(next)
    }
  }

  if (phase === 'night') next = toast(next, 'Ночь. Появились теневые заказы…', 'info')
  if (weather !== 'clear') next = toast(next, `Погода: ${WEATHER_LABELS[weather]}. Цены на запчасти реагируют.`, 'info')
  return unlock(next)
}

export function createInitialState(): GameState {
  const base: GameState = {
    money: 450_000,
    reputation: 50,
    xp: 0,
    level: 1,
    license: 0,
    day: 1,
    lastSyncDate: localDayKey(),
    phase: 'morning',
    weather: 'clear',
    clients: [],
    activeClientId: null,
    lot: [],
    listings: {},
    inventory: [],
    auctionLots: [],
    rivals: rivalPool,
    shadyJobs: [],
    news: [],
    segmentDemand: { junk: 1, budget: 1, mid: 1, premium: 1, sport: 1, hyper: 1 },
    partPriceMod: 1,
    upgrades: { slots: 0, cleanliness: 0, tools: 0, security: 0, office: 0 },
    protectionDays: 0,
    blacklist: [],
    achievements: [],
    stats: {
      carsBought: 0,
      carsSold: 0,
      totalProfit: 0,
      bestDeal: 0,
      auctionsWon: 0,
      shadyDone: 0,
      duelsWon: 0,
      examsPassed: 0,
      partsInstalled: 0,
    },
    vipBoostCarId: null,
    authUser: null,
    marketSoftLeft: 5,
    marketNextSoftAt: Date.now() + 3 * 60_000,
    marketNextMajorAt: Date.now() + 24 * 60 * 60_000,
    lastPartsTheftAt: 0,
    duel: null,
    difficulty: 'easy',
    completedDifficulties: [],
    ownedLooks: [],
    loan: null,
    daily: { streak: 0, lastClaimDay: '' },
    contracts: [],
    blackMarket: [],
    pendingDriveCarId: null,
    googleBonusClaimed: false,
    ledger: [],
    donateHistory: [],
    log: [],
    toasts: [],
  }
  const { news, demand } = generateNews()
  const withNews = { ...base, news, segmentDemand: demand }
  const seeded = {
    ...withNews,
    clients: generateClients(withNews),
    auctionLots: generateAuctionLots(withNews),
    duel: { day: 1, car: generateDuelCar(withNews), rival: pick(rivalPool), done: false },
  }
  const starter = makeStarterCar(1, false)
  return {
    ...seeded,
    lot: [starter],
    contracts: generateContracts(seeded),
    blackMarket: generateBlackMarket(seeded),
    log: ['День 1: на стоянке ждёт старенькая «Калинка» — начни с неё.'],
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  setActiveDifficulty(state.difficulty)
  return gameReducerInner(state, action)
}

function phaseForHour(h: number): Phase {
  return h >= 6 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'
}

function gameReducerInner(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADVANCE_PHASE':
      return advancePhase(state)

    case 'DRIVE_FINE': {
      // штраф за нарушение на тест-драйве списывается сразу (не глубже нуля)
      const amt = Math.max(0, Math.min(state.money, Math.round(action.amount)))
      let next: GameState = { ...state, money: state.money - amt, reputation: clamp(state.reputation - 4, 0, 100) }
      next = logTx(next, -amt, 'drive', `Штраф: ${action.reason}`)
      return toast(next, `Штраф ${formatMoney(amt)}: ${action.reason}`, 'bad')
    }

    case 'SYNC_CLOCK': {
      // хронология идёт по реальному времени: фаза суток = местные часы,
      // новый игровой день — по смене локальной календарной даты
      let next = state
      const target = phaseForHour(action.hour)
      const today = localDayKey(action.now)
      if (state.lastSyncDate && today > state.lastSyncDate) {
        next = beginNewDay(next)
        next = {
          ...next,
          phase: target,
          weather: rollWeather(target),
          shadyJobs: generateShadyJobs(next),
        }
        if (target === 'evening' || target === 'night') next = tryNightRaid(next)
      } else {
        for (let i = 0; i < 4 && next.phase !== target; i++) next = advancePhase(next, false)
      }
      next = { ...next, lastSyncDate: today }
      const loan = next.loan
      if (loan && action.now > loan.dueAt && action.now - loan.lastPenaltyAt >= 86_400_000) {
        const pen = Math.round(loan.owed * 0.01)
        next = {
          ...next,
          loan: { ...loan, owed: loan.owed + pen, lastPenaltyAt: action.now },
          reputation: clamp(next.reputation - 5, 0, 100),
        }
        next = toast(next, `Кредит просрочен! Пеня ${pen.toLocaleString('ru-RU')} ₽, репутация −5`, 'bad')
      }
      return unlock(next)
    }

    case 'TAKE_LOAN': {
      const tier = LOAN_TIERS.find((l) => l.amount === action.amount)
      if (!tier) return state
      if (state.loan) return toast(state, 'Сначала погасите текущий кредит', 'bad')
      if (tier.elite && state.difficulty !== 'legend') return toast(state, 'Элитные кредиты открываются на максимальной сложности «Легенда»', 'bad')
      const owed = Math.round(tier.amount * (1 + (tier.rate * tier.days) / 7))
      let next: GameState = {
        ...state,
        money: state.money + tier.amount,
        loan: { amount: tier.amount, owed, dueAt: Date.now() + tier.days * 86_400_000, lastPenaltyAt: 0 },
      }
      next = logTx(next, tier.amount, 'loan', `Кредит ${tier.amount.toLocaleString('ru-RU')} ₽`)
      return toast(next, `Кредит получен. К возврату ${owed.toLocaleString('ru-RU')} ₽ через ${tier.days} дн.`, 'info')
    }

    case 'REPAY_LOAN': {
      const loan = state.loan
      if (!loan) return state
      if (state.money < loan.owed) return toast(state, 'Не хватает денег на погашение', 'bad')
      let next: GameState = { ...state, money: state.money - loan.owed, loan: null }
      next = logTx(next, -loan.owed, 'loan', 'Погашение кредита')
      return toast(next, 'Кредит погашен', 'good')
    }

    case 'BUY_LOOK': {
      const item = LOOK_CATALOG.find((l) => l.id === action.id)
      const owned = new Set([...FREE_LOOKS, ...(state.ownedLooks ?? [])])
      if (!item || owned.has(item.id)) return state
      if (state.money < item.price) return toast(state, 'Не хватает денег', 'bad')
      let next: GameState = { ...state, money: state.money - item.price, ownedLooks: [...(state.ownedLooks ?? []), item.id] }
      next = logTx(next, -item.price, 'parts', `Ателье: ${item.name}`)
      return toast(next, `Куплено в ателье: ${item.name}. Применить можно в гараже.`, 'good')
    }

    case 'SET_LOOK': {
      const car = state.lot.find((c) => c.id === action.carId)
      if (!car) return state
      const owned = new Set([...FREE_LOOKS, ...(state.ownedLooks ?? [])])
      const hex = /^#[0-9a-fA-F]{6}$/
      const cur = car.look ?? {}
      const p = action.patch
      let cost = 0
      const next: CarLook = { ...cur }
      for (const key of ['finish', 'wheelDesign', 'tire'] as const) {
        const v = p[key]
        if (v === undefined || v === cur[key]) continue
        if (!owned.has(`${key}:${v}`)) return toast(state, 'Сначала купите это в ателье на вкладке «Рынок»', 'bad')
        next[key] = v
      }
      for (const key of ['paint', 'rimColor', 'tireColor', 'interior'] as const) {
        const v = p[key]
        if (v === undefined || v === cur[key]) continue
        if (!hex.test(v)) return state
        next[key] = v
        cost += LOOK_COLOR_COST[key]
      }
      if (state.money < cost) return toast(state, 'Не хватает денег на покраску', 'bad')
      if (JSON.stringify(next) === JSON.stringify(cur)) return state
      let out = updateCar({ ...state, money: state.money - cost }, car.id, (c) => ({ ...c, look: next, invested: c.invested + cost }))
      if (cost > 0) out = logTx(out, -cost, 'paint', `Кастом: ${car.brand} ${car.model}`)
      return out
    }

    case 'PAINT_CAR': {
      const car = state.lot.find((c) => c.id === action.carId)
      if (!car || !PAINT_COLORS.includes(action.color) || car.color === action.color) return state
      if (state.money < PAINT_COST) return toast(state, 'Не хватает денег на покраску', 'bad')
      let next = updateCar({ ...state, money: state.money - PAINT_COST }, car.id, (c) => ({ ...c, color: action.color, invested: c.invested + PAINT_COST }))
      next = logTx(next, -PAINT_COST, 'paint', `Покраска: ${car.brand} ${car.model} → ${action.color}`)
      return toast(next, `Покраска: ${action.color}`, 'good')
    }

    case 'SELECT_CLIENT':
      return { ...state, activeClientId: action.id }

    case 'REQUEST_INSPECTION': {
      const seller = state.clients.find((c) => c.id === action.sellerId)
      if (!seller || seller.car.accessGranted) return state
      const fee = Math.max(2_000, roundTo(seller.askingPrice * 0.015 * (state.license >= 2 ? 0.7 : 1), 500))
      if (state.money < fee) return toast(state, 'Не хватает денег на доступ к осмотру', 'bad')
      let next = updateSeller({ ...state, money: state.money - fee }, action.sellerId, (car) => ({ ...car, accessGranted: true }))
      next = logTx(next, -fee, 'inspection', `Доступ на осмотр: ${seller.car.brand} ${seller.car.model}`)
      return toast(next, 'Доступ на осмотр оплачен. Можно оценивать машину.', 'good')
    }

    case 'INSPECT_ZONE': {
      if (!state.clients.find((c) => c.id === action.sellerId)?.car.accessGranted) return toast(state, 'Сначала получите «Доступ на осмотр машины»', 'bad')
      const revealP = 0.5 + state.upgrades.tools * 0.17
      return updateSeller(state, action.sellerId, (car) => ({
        ...car,
        inspected: { ...car.inspected, [action.zone]: true },
        defects: car.defects.map((d) =>
          d.zone === action.zone && !d.revealed && (action.zone !== 'documents' || car.vinChecked)
            ? { ...d, revealed: chance(revealP) }
            : d,
        ),
      }))
    }

    case 'CHECK_MILEAGE':
      if (!state.clients.find((c) => c.id === action.sellerId)?.car.accessGranted) return toast(state, 'Сначала получите «Доступ на осмотр машины»', 'bad')
      if (state.upgrades.tools < 1) return toast(state, 'Нужен OBD-сканер (улучшение инструментов)', 'bad')
      return updateSeller(state, action.sellerId, (car) => ({ ...car, mileageChecked: true }))

    case 'CHECK_VIN':
      if (!state.clients.find((c) => c.id === action.sellerId)?.car.accessGranted) return toast(state, 'Сначала получите «Доступ на осмотр машины»', 'bad')
      if (state.license < 1) return toast(state, 'Проверка VIN доступна с лицензией Нотариуса I', 'bad')
      return updateSeller(state, action.sellerId, (car) => ({
        ...car,
        vinChecked: true,
        inspected: { ...car.inspected, documents: true },
        defects: car.defects.map((d) => (d.zone === 'documents' ? { ...d, revealed: true } : d)),
      }))

    case 'MAKE_OFFER': {
      const seller = state.clients.find((c) => c.id === action.sellerId)
      if (!seller) return state
      const ratio = action.amount / seller.askingPrice
      const threshold =
        { honest: 0.88, cunning: 0.8, shady: 0.7 }[seller.type] - (state.reputation - 50) / 600 + rand(-0.03, 0.03)
      if (ratio >= threshold) return buyFromSeller(state, seller.id, action.amount)
      if (ratio < 0.5) {
        return toast(
          {
            ...state,
            clients: state.clients.filter((c) => c.id !== seller.id),
            activeClientId: null,
            reputation: clamp(state.reputation - 2, 0, 100),
          },
          `${seller.name} обиделся на копеечное предложение и ушёл`,
          'bad',
        )
      }
      const patience = seller.patience - 1
      if (patience <= 0) {
        return toast(
          { ...state, clients: state.clients.filter((c) => c.id !== seller.id), activeClientId: null },
          `${seller.name} устал торговаться и уехал`,
          'bad',
        )
      }
      const counter = roundTo(seller.askingPrice - (seller.askingPrice - action.amount) * rand(0.3, 0.5), 1000)
      return {
        ...state,
        clients: state.clients.map((c) =>
          c.id === seller.id ? { ...c, patience, askingPrice: counter, lastCounter: counter } : c,
        ),
      }
    }

    case 'ACCEPT_ASK': {
      const seller = state.clients.find((c) => c.id === action.sellerId)
      return seller ? buyFromSeller(state, seller.id, seller.askingPrice) : state
    }

    case 'DISMISS_CLIENT': {
      const seller = state.clients.find((c) => c.id === action.sellerId)
      if (!seller) return state
      const next = {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.sellerId),
        activeClientId: null,
        blacklist: action.blacklist ? [...state.blacklist, seller.name] : state.blacklist,
      }
      return action.blacklist ? toast(next, `${seller.name} в чёрном списке`, 'info') : next
    }

    case 'LIST_CAR': {
      const car = state.lot.find((c) => c.id === action.carId)
      if (!car) return state
      if (state.money < LIST_FEE) return toast(state, 'Нет денег на объявление', 'bad')
      const listedAt = Date.now()
      let next: GameState = {
        ...state,
        money: state.money - LIST_FEE,
        listings: { ...state.listings, [car.id]: wrapListing(car, state, listedAt) },
      }
      next = logTx(next, -LIST_FEE, 'list', 'Размещение объявления')
      return toast(next, 'Объявление размещено. Ждите покупателей — чем дороже авто, тем дольше продажа.', 'info')
    }


    case 'COUNTER_OFFER': {
      const car = state.lot.find((c) => c.id === action.carId)
      const listing = state.listings[action.carId]
      if (!car || !listing) return state
      if (Date.now() < listing.readyAt) return toast(state, 'Таймер продажи ещё идёт', 'bad')
      const offer = listing.offers.find((o) => o.id === action.offerId)
      if (!offer || offer.status !== 'open') return toast(state, 'Этот покупатель уже ушёл', 'bad')
      const ask = Math.round(action.amount)
      if (ask <= 0) return state
      if (ask <= offer.amount) {
        // accept their price
        return gameReducer(state, { type: 'SELL_CAR', carId: action.carId, offerId: action.offerId })
      }
      const truth = realValue(car, state.segmentDemand)
      const conditionAvg =
        (car.condition.engine + car.condition.body + car.condition.interior + car.condition.suspension + car.condition.electrics) / 5
      const skill = 0.35 + state.reputation / 200 + state.level * 0.01 + state.upgrades.cleanliness * 0.02
      const stretch = (ask - offer.amount) / Math.max(1, offer.maxPay - offer.amount)
      let pAccept = skill * (conditionAvg / 100) * (1 - stretch * 0.85)
      if (ask > offer.maxPay) pAccept *= 0.15
      pAccept = clamp(pAccept, 0.05, 0.92)

      if (chance(pAccept) && ask <= offer.maxPay * 1.02) {
        const updated = {
          ...listing,
          offers: listing.offers.map((o) =>
            o.id === offer.id ? { ...o, amount: ask, status: 'agreed' as const, mood: 'Ладно, берём по вашей цене' } : o,
          ),
        }
        let next: GameState = { ...state, listings: { ...state.listings, [car.id]: updated } }
        next = toast(next, `${offer.name}: «Ок, ${formatMoney(ask)} — забираю»`, 'good')
        return gameReducer(next, { type: 'SELL_CAR', carId: action.carId, offerId: action.offerId })
      }

      // counter or walk
      const patience = offer.patience - 1
      if (patience <= 0 || chance(0.25 + stretch * 0.4)) {
        const updated = {
          ...listing,
          offers: listing.offers.map((o) =>
            o.id === offer.id ? { ...o, status: 'walked' as const, mood: 'Ушёл — слишком дорого', patience: 0 } : o,
          ),
        }
        return toast(
          { ...state, listings: { ...state.listings, [car.id]: updated } },
          `${offer.name} отказался и ушёл`,
          'bad',
        )
      }
      const mid = roundTo((offer.amount + Math.min(ask, offer.maxPay)) / 2, 25)
      const newAmount = clamp(mid, offer.amount, offer.maxPay)
      const updated = {
        ...listing,
        offers: listing.offers.map((o) =>
          o.id === offer.id
            ? {
                ...o,
                amount: newAmount,
                patience,
                mood: pick(['Могу ещё чуть поднять…', 'Это мой потолок почти', 'Давайте сойдёмся посередине']),
              }
            : o,
        ),
      }
      return toast(
        { ...state, listings: { ...state.listings, [car.id]: updated } },
        `${offer.name}: «Максимум ${formatMoney(newAmount)}» (попыток: ${patience})`,
        'info',
      )
    }

    case 'SELL_CAR': {
      const car = state.lot.find((c) => c.id === action.carId)
      const listing = state.listings[action.carId]
      const offer = listing?.offers.find((o) => o.id === action.offerId)
      if (!car || !listing || !offer) return state
      if (offer.status === 'walked') return toast(state, 'Этот покупатель уже ушёл', 'bad')
      if (Date.now() < listing.readyAt) {
        return toast(state, 'Покупатель ещё не готов — дождитесь таймера продажи', 'bad')
      }
      const baseProfit = offer.amount - car.purchasePrice - car.invested
      const vip = state.vipBoostCarId === car.id && baseProfit > 0
      const profit = vip ? baseProfit * 2 : baseProfit
      const payout = offer.amount + (vip ? baseProfit : 0)
      const { [car.id]: _removed, ...listings } = state.listings
      let next: GameState = {
        ...state,
        money: state.money + payout,
        lot: state.lot.filter((c) => c.id !== car.id),
        listings,
        vipBoostCarId: vip ? null : state.vipBoostCarId,
        reputation: clamp(state.reputation + (car.documentsForged ? -6 : profit > 0 ? 1 : 0), 0, 100),
        stats: {
          ...state.stats,
          carsSold: state.stats.carsSold + 1,
          totalProfit: state.stats.totalProfit + profit,
          bestDeal: Math.max(state.stats.bestDeal, profit),
        },
      }
      next = logTx(next, payout, 'sale', `Продажа: ${car.brand} ${car.model}`)
      next = toast(
        next,
        `Продано ${car.brand} ${car.model}. ${profit >= 0 ? 'Навар' : 'Убыток'}: ${formatMoney(profit)}${vip ? ' (VIP ×2)' : ''}`,
        profit >= 0 ? 'good' : 'bad',
      )
      if (!next.achievements.includes('sell-timer') && listing.readyAt <= Date.now()) {
        next = grant(next, 'sell-timer')
      }
      if (car.segment === 'sport' && !next.achievements.includes('sport-sale')) {
        next = grant(next, 'sport-sale')
      }
      return unlock(addXp(next, 20 + Math.max(0, profit) / 80))
    }

    case 'REPAIR_ZONE': {
      const car = state.lot.find((c) => c.id === action.carId)
      if (!car || action.zone === 'documents') return state
      const cost = repairCost(car, action.zone)
      if (state.money < cost) return toast(state, 'Не хватает денег на ремонт', 'bad')
      let next = updateCar({ ...state, money: state.money - cost }, car.id, (c) => ({
        ...c,
        condition: { ...c.condition, [action.zone]: clamp(c.condition[action.zone] + 50, 0, 100) },
        defects: c.defects.filter((d) => d.zone !== action.zone),
        invested: c.invested + cost,
      }))
      next = { ...next, stats: { ...next.stats, repairs: (next.stats.repairs ?? 0) + 1 } }
      return unlock(addXp(next, 5))
    }

    case 'INSTALL_PART': {
      const part = partById(action.partId)
      const item = state.inventory.find((i) => i.partId === action.partId)
      const car = state.lot.find((c) => c.id === action.carId)
      if (!part || !item || item.qty <= 0 || !car) return state
      if (part.id === 'air-tanks') {
        const isRoadster = car.brand === 'Тесла-Н' && car.model.includes('Роадстер')
        if (!isRoadster) return toast(state, 'Воздушные баки только для Тесла Роадстер', 'bad')
        if ((car.flightTanks ?? 0) >= 3) return toast(state, 'Баки уже на максимуме (3/3)', 'info')
      }
      if (part.feature && car.features?.[part.feature]) return toast(state, 'Эта система уже установлена', 'info')
      if (part.feature === 'autopilot' && !car.features?.cruise) return toast(state, 'Автопилоту нужен круиз-контроль', 'bad')
      if (part.tuning && (car.tuning[part.tuning] ?? 0) >= 3) return toast(state, 'Максимальный уровень тюнинга', 'bad')
      const zone = PART_ZONE[part.category]
      const inventory = state.inventory
        .map((i) => (i.partId === part.id ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0)
      let removedDefect = false
      const next = updateCar({ ...state, inventory }, car.id, (c) => ({
        ...c,
        condition: { ...c.condition, [zone]: clamp(c.condition[zone] + part.repairAmount, 0, 100) },
        defects:
          part.repairAmount >= 30
            ? c.defects.filter((d) => {
                if (!removedDefect && d.zone === zone) {
                  removedDefect = true
                  return false
                }
                return true
              })
            : c.defects,
        tuning: part.tuning ? { ...c.tuning, [part.tuning]: (c.tuning[part.tuning] ?? 0) + 1 } : c.tuning,
        features: part.feature ? { ...c.features, [part.feature]: true } : c.features,
        flightTanks:
          part.id === 'air-tanks'
            ? Math.min(3, (c.flightTanks ?? 0) + 1)
            : c.flightTanks,
        invested: c.invested + part.basePrice,
      }))
      return unlock(
        addXp(
          toast(
            { ...next, stats: { ...next.stats, partsInstalled: next.stats.partsInstalled + 1 } },
            `Установлено: ${part.name}`,
            'good',
          ),
          6,
        ),
      )
    }

    case 'LEGALIZE_CAR': {
      const car = state.lot.find((c) => c.id === action.carId)
      if (!car || !car.documentsForged) return state
      const info = legalizeInfo(state, car)
      // Недостаточно опыта/лицензии для такого транспорта — не пытаемся и не берём денег
      if (!info.allowed) return toast(state, LICENSE_FAIL_MESSAGE, 'bad')
      const cost = roundTo(car.baseValue * 0.08, 1000)
      if (state.money < cost) return toast(state, 'Не хватает денег на «решалу»', 'bad')
      const diff = DIFFICULTY_DEFS[state.difficulty] ?? DIFFICULTY_DEFS.normal
      const risk = Math.max(0.04, Math.min(0.85, info.risk * diff.riskMul))
      if (chance(risk)) {
        let failed: GameState = {
          ...state,
          money: state.money - cost,
          lot: state.lot.filter((c) => c.id !== car.id),
          reputation: clamp(state.reputation - 10, 0, 100),
          stats: { ...state.stats, failedLegalize: (state.stats.failedLegalize ?? 0) + 1 },
        }
        failed = logTx(failed, -cost, 'contract', `Провал легализации: ${car.brand} ${car.model}`)
        return toast(failed, `Провал! ${car.brand} ${car.model} изъят полицией, репутация упала`, 'bad')
      }
      let ok = updateCar(
        {
          ...state,
          money: state.money - cost,
          reputation: clamp(state.reputation - 3, 0, 100),
          stats: { ...state.stats, legalized: (state.stats.legalized ?? 0) + 1 },
        },
        car.id,
        (c) => ({
          ...c,
          documentsForged: false,
          condition: { ...c.condition, documents: 90 },
          defects: c.defects.filter((d) => d.zone !== 'documents'),
          invested: c.invested + cost,
        }),
      )
      ok = logTx(ok, -cost, 'contract', `Легализация: ${car.brand} ${car.model}`)
      return unlock(toast(ok, 'Документы «чистые». Машину можно продавать.', 'good'))
    }

    case 'BUY_PART': {
      const part = partById(action.partId)
      if (!part) return state
      const total = partPrice(part, state) * action.qty
      if (state.money < total) return toast(state, 'Не хватает денег', 'bad')
      const exists = state.inventory.some((i) => i.partId === part.id)
      let next: GameState = {
        ...state,
        money: state.money - total,
        inventory: exists
          ? state.inventory.map((i) => (i.partId === part.id ? { ...i, qty: i.qty + action.qty } : i))
          : [...state.inventory, { partId: part.id, qty: action.qty }],
      }
      next = logTx(next, -total, 'parts', `Запчасти: ${part.name} ×${action.qty}`)
      next = { ...next, stats: { ...next.stats, partsBought: (next.stats.partsBought ?? 0) + action.qty } }
      return unlock(toast(next, `Куплено: ${part.name} ×${action.qty}`, 'good'))
    }

    case 'AUCTION_START':
      return {
        ...state,
        auctionLots: state.auctionLots.map((l) =>
          l.id === action.lotId ? { ...l, status: 'live', startedAt: l.startedAt ?? Date.now() } : l,
        ),
      }

    case 'AUCTION_END': {
      const lot = state.auctionLots.find((l) => l.id === action.lotId)
      if (!lot) return state
      const noBids = action.winner === 'Никто'
      const won = action.winner === PLAYER
      const canPay = state.money >= action.price && state.lot.length < maxSlots(state)
      const status = won && canPay ? 'won' : 'lost'
      let next: GameState = {
        ...state,
        auctionLots: state.auctionLots.map((l) =>
          l.id === lot.id ? { ...l, status, finalPrice: noBids ? 0 : action.price, winner: action.winner } : l,
        ),
      }
      if (won && canPay) {
        next = {
          ...next,
          money: next.money - action.price,
          lot: [...next.lot, { ...lot.car, purchasePrice: action.price, acquiredDay: state.day }],
          stats: { ...next.stats, auctionsWon: next.stats.auctionsWon + 1, carsBought: next.stats.carsBought + 1 },
        }
        next = logTx(next, -action.price, 'auction', 'Аукцион: покупка лота')
        next = toast(next, `Лот ваш за ${formatMoney(action.price)}! Машина на стоянке.`, 'good')
        return unlock(addXp(next, 25))
      }
      if (won && !canPay) return toast(next, 'Нечем платить или нет места — лот ушёл следующему', 'bad')
      if (noBids) return toast(next, 'Лот не продан — ставок не было', 'info')
      return toast(next, `${action.winner} забрал лот за ${formatMoney(action.price)}`, 'info')
    }

    case 'ACCEPT_SHADY': {
      const job = state.shadyJobs.find((j) => j.id === action.jobId)
      if (!job) return state
      const risk = state.protectionDays > 0 ? job.risk * 0.5 : job.risk
      const remaining = state.shadyJobs.filter((j) => j.id !== job.id)
      if (chance(risk)) {
        // списываем не больше, чем есть на счету, и в историю пишем фактическую сумму
        const fine = Math.max(0, Math.min(state.money, job.fine))
        let fail: GameState = {
          ...state,
          shadyJobs: remaining,
          money: state.money - fine,
          reputation: clamp(state.reputation - job.repLoss, 0, 100),
        }
        fail = logTx(fail, -fine, 'fine', `Штраф: ${job.title}`)
        return toast(fail, `Спалились! Штраф ${formatMoney(fine)}, репутация −${job.repLoss}`, 'bad')
      }
      let next: GameState = {
        ...state,
        shadyJobs: remaining,
        money: state.money + job.reward,
        reputation: clamp(state.reputation - Math.ceil(job.repLoss / 4), 0, 100),
        stats: { ...state.stats, shadyDone: state.stats.shadyDone + 1 },
      }
      next = logTx(next, job.reward, 'shady', job.title)
      next = toast(next, `«${job.title}» — чисто. +${formatMoney(job.reward)}`, 'good')
      return unlock(addXp(next, 30))
    }

    case 'DECLINE_SHADY':
      return {
        ...state,
        shadyJobs: state.shadyJobs.filter((j) => j.id !== action.jobId),
        reputation: clamp(state.reputation + 1, 0, 100),
      }

    case 'BUY_PROTECTION':
      if (state.money < PROTECTION_COST) return toast(state, 'Крыша стоит дороже, чем у тебя есть', 'bad')
      let next: GameState = { ...state, money: state.money - PROTECTION_COST, protectionDays: state.protectionDays + 3 }
      next = logTx(next, -PROTECTION_COST, 'protect', 'Оплата «крыши» на 3 дня')
      return toast(next, 'Крыша оплачена на 3 дня: риски ниже, угонов нет', 'good')

    case 'BUY_UPGRADE': {
      const def = UPGRADE_DEFS[action.key]
      const lvl = state.upgrades[action.key]
      if (lvl >= def.max) return state
      const cost = def.cost(lvl)
      if (state.money < cost) return toast(state, 'Не хватает денег на улучшение', 'bad')
      let next: GameState = { ...state, money: state.money - cost, upgrades: { ...state.upgrades, [action.key]: lvl + 1 } }
      next = logTx(next, -cost, 'upgrade', `Улучшение: ${def.label}`)
      return toast(next, `Улучшено: ${def.label}`, 'good')
    }

    case 'EXAM_RESULT': {
      // игрок сам выбирает этап: можно сдавать выше текущего и перескакивать уровни
      const stage = action.stage ?? state.license + 1
      const fee = EXAM_FEES[stage - 1]
      if (fee === undefined || stage <= state.license) return state
      if (state.money < fee) return toast(state, 'Не хватает денег на сбор за экзамен', 'bad')
      // провал стоит только половину сбора
      const cost = action.passed ? fee : Math.round(fee / 2)
      const paid = logTx({ ...state, money: state.money - cost }, -cost, 'exam', `Экзамен на лицензию (этап ${stage})`)
      if (!action.passed) return toast(paid, 'Экзамен не сдан: списана половина сбора. Потренируйтесь и пересдайте.', 'bad')
      const next = toast(
        {
          ...paid,
          license: stage,
          reputation: clamp(state.reputation + 5, 0, 100),
          stats: { ...state.stats, examsPassed: state.stats.examsPassed + 1 },
        },
        `Лицензия получена: этап ${stage}! Новые возможности открыты.`,
        'good',
      )
      return unlock(addXp(next, 60 + stage * 10))
    }

    case 'PRACTICE_DONE':
      return addXp(toast(state, `Тренировка: ${action.correct} из ${action.total}. Опыт начислен.`, 'info'), action.correct * 4)

    case 'DUEL_GUESS': {
      if (!state.duel || state.duel.done) return state
      const actual = realValue(state.duel.car, state.segmentDemand)
      // Соперник всегда ошибается на 5–25% (переоценка или недооценка)
      const errPct = rand(0.05, 0.25)
      const errSign = chance(0.5) ? 1 : -1
      const rivalGuess = Math.max(50_000, roundTo(actual * (1 + errSign * errPct), 1_000))
      // Побеждает тот, чья оценка ближе к реальной рыночной цене
      const playerErr = Math.abs(action.guess - actual)
      const rivalErr = Math.abs(rivalGuess - actual)
      const won = playerErr < rivalErr || (playerErr === rivalErr && chance(0.5))
      const prize = 15_000 + state.level * 4_000
      let next: GameState = {
        ...state,
        duel: { ...state.duel, done: true, result: { player: action.guess, rival: rivalGuess, actual, won } },
        money: state.money + (won ? prize : 0),
        reputation: clamp(state.reputation + (won ? 2 : -1), 0, 100),
        stats: { ...state.stats, duelsWon: state.stats.duelsWon + (won ? 1 : 0) },
      }
      next = toast(next, won ? `Дуэль выиграна! Ты ближе к рынку · +${formatMoney(prize)}` : `${state.duel.rival.name} ближе к реальной цене`, won ? 'good' : 'bad')
      return unlock(addXp(next, won ? 20 : 5))
    }

    case 'VIP_BOOST':
      return toast({ ...state, vipBoostCarId: action.carId }, 'VIP-клиент поздравлен! Следующая продажа этой машины ×2 навара', 'good')

    case 'GOOGLE_SIGN_IN': {
      const user = {
        id: 'gp_' + Math.random().toString(36).slice(2, 10),
        name: 'Игрок Google',
        email: 'player@gmail.com',
        avatar: '',
      }
      let next: GameState = { ...state, authUser: user }
      if (!state.googleBonusClaimed && next.lot.length < maxSlots(next)) {
        const gift = makeStarterCar(state.day, true)
        next = {
          ...next,
          lot: [...next.lot, gift],
          googleBonusClaimed: true,
        }
        next = toast(next, 'Бонус Google Play: на стоянке подарочный хэтчбек!', 'good')
      }
      return toast(next, `Вход: ${user.name} (Google Play)`, 'good')
    }

    case 'GOOGLE_SIGN_OUT':
      return toast({ ...state, authUser: null }, 'Вы вышли из аккаунта Google', 'info')

    case 'BUY_DONATE': {
      const pack = DONATE_PACKS.find((x) => x.id === action.packId)
      if (!pack) return state
      let next = pushTx(
        state,
        pack.coins,
        'donate',
        `Google Play: ${pack.label} (${pack.rub} ₽)`,
        { asDonate: true },
      )
      if (!next.achievements.includes('shop-1')) {
        next = grant(next, 'shop-1')
      }
      return toast(next, `Google Play: +${pack.coins.toLocaleString('ru-RU')} ₽`, 'good')
    }

    case 'MARKET_SOFT_REFRESH': {
      if (state.marketSoftLeft <= 0) {
        return toast(state, 'Лимит быстрых обновлений исчерпан. Крупное — через 24 ч.', 'info')
      }
      if (Date.now() < state.marketNextSoftAt) {
        return toast(state, 'Таймер ещё тикает — подождите', 'info')
      }
      const left = state.marketSoftLeft - 1
      return toast(
        {
          ...state,
          clients: generateClients(state),
          activeClientId: null,
          marketSoftLeft: left,
          marketNextSoftAt: Date.now() + 3 * 60_000,
        },
        left > 0
          ? `Рынок машин обновлён. Осталось быстрых: ${left}`
          : 'Последнее быстрое обновление. Далее — крупное через 24 ч.',
        'good',
      )
    }

    case 'MARKET_MAJOR_REFRESH': {
      if (Date.now() < state.marketNextMajorAt) {
        return toast(state, 'Крупное обновление ещё не готово (раз в 24 ч)', 'info')
      }
      return toast(
        {
          ...state,
          clients: generateClients(state),
          activeClientId: null,
          auctionLots: generateAuctionLots(state),
          marketSoftLeft: 5,
          marketNextSoftAt: Date.now() + 3 * 60_000,
          marketNextMajorAt: Date.now() + 24 * 60 * 60_000,
        },
        'Крупное обновление рынка и аукционов!',
        'good',
      )
    }

    case 'TICK_CLOCK':
      return state

    case 'SET_DIFFICULTY': {
      const def = DIFFICULTY_DEFS[action.id]
      if (!def) return state
      const idxD = DIFFICULTY_ORDER.indexOf(action.id)
      const prevD = idxD > 0 ? DIFFICULTY_ORDER[idxD - 1] : null
      if (prevD && !(state.completedDifficulties ?? []).includes(prevD)) {
        return toast(state, `Сначала пройдите режим «${DIFFICULTY_DEFS[prevD].label}»`, 'bad')
      }
      return toast(
        {
          ...state,
          difficulty: action.id,
        },
        `Сложность: ${def.label}`,
        'info',
      )
    }

    case 'CLAIM_DAILY': {
      const today = localDayKey()
      if (state.daily.lastClaimDay === today) return toast(state, 'Награда уже получена сегодня', 'info')
      const yesterday = localDayKey(Date.now() - 86400000)
      const streak = state.daily.lastClaimDay === yesterday ? state.daily.streak + 1 : 1
      const idx = Math.min(DAILY_REWARDS.length - 1, streak - 1)
      const reward = DAILY_REWARDS[idx]
      const diff = DIFFICULTY_DEFS[state.difficulty] ?? DIFFICULTY_DEFS.normal
      const coins = Math.round(reward.coins * diff.moneyMul)
      let inv = state.inventory
      if ('parts' in reward && reward.parts) {
        inv = [...inv]
        const add = (id: string, q: number) => {
          const i = inv.findIndex((x) => x.partId === id)
          if (i >= 0) inv[i] = { ...inv[i], qty: inv[i].qty + q }
          else inv.push({ partId: id, qty: q })
        }
        add('oil-kit', 2)
        add('tires-cheap', 1)
      }
      let next: GameState = {
        ...state,
        money: state.money + coins,
        inventory: inv,
        daily: { streak, lastClaimDay: today },
      }
      next = logTx(next, coins, 'daily', `Ежедневная награда: ${reward.label}`)
      return toast(next, `День ${streak}: +${coins.toLocaleString('ru-RU')} ₽ — ${reward.label}`, 'good')
    }

    case 'BUY_BLACK': {
      const lot = state.blackMarket.find((l) => l.id === action.lotId && l.status === 'open')
      if (!lot) return state
      if (state.money < lot.price) return toast(state, 'Не хватает нота-койнов', 'bad')
      if (state.lot.length >= maxSlots(state)) return toast(state, 'Стоянка полна', 'bad')
      const diff = DIFFICULTY_DEFS[state.difficulty] ?? DIFFICULTY_DEFS.normal
      // риск пересчитывается по текущей охране гаража, лицензии и офису
      const risk = Math.min(0.85, blackRisk(state, lot.car.documentsForged) * diff.riskMul)
      const slotIdx = Math.max(0, state.blackMarket.findIndex((l) => l.id === lot.id))
      // На рынке всегда ровно 4 лота: проданный/сорвавшийся заменяется новым
      const refill = (list: typeof state.blackMarket) => list.map((l) => (l.id === lot.id ? generateBlackLot(state, slotIdx) : l))
      if (chance(risk * 0.35)) {
        // busted without getting car
        {
          const fine = Math.round(lot.price * 0.25)
          let next: GameState = {
            ...state,
            money: Math.max(0, state.money - fine),
            reputation: clamp(state.reputation - 8, 0, 100),
            blackMarket: refill(state.blackMarket),
          }
          next = logTx(next, -fine, 'fine', 'Штраф: чёрный рынок')
          return toast(next, 'Полиция накрыла сделку на чёрном рынке!', 'bad')
        }
      }
      const car = { ...lot.car, purchasePrice: lot.price, acquiredDay: state.day }
      let next: GameState = {
        ...state,
        money: state.money - lot.price,
        lot: [...state.lot, car],
        blackMarket: refill(state.blackMarket),
        pendingDriveCarId: car.id,
        stats: { ...state.stats, carsBought: state.stats.carsBought + 1, blackBought: (state.stats.blackBought ?? 0) + 1 },
      }
      next = logTx(next, -lot.price, 'black', `Чёрный рынок: ${lot.car.brand} ${lot.car.model}`)
      return unlock(toast(next, `${lot.seller ?? 'Продавец'}: «Лот ваш». Перегоните машину в гараж!`, 'good'))
    }

    case 'START_DRIVE': {
      const car = state.lot.find((c) => c.id === action.carId)
      if (!car) return state
      // зависший pending (машину угнали/продали) не должен блокировать новые заезды
      if (state.pendingDriveCarId && state.lot.some((c) => c.id === state.pendingDriveCarId)) {
        return toast(state, 'Сначала завершите текущий заезд', 'info')
      }
      return { ...state, pendingDriveCarId: car.id }
    }

    case 'FINISH_DRIVE': {
      const car = state.lot.find((c) => c.id === action.carId)
      if (!car) return { ...state, pendingDriveCarId: null }
      const bonus = action.clean ? Math.max(2_000, roundTo(3_500 + action.score * 250 + car.tuning.engine * 1_500 + car.tuning.suspension * 1_000, 100)) : Math.max(0, roundTo(action.score * 80, 100))
      const prestige = action.clean ? 2 : -1
      let next = updateCar(
        {
          ...state,
          pendingDriveCarId: null,
          money: state.money + bonus,
          reputation: clamp(state.reputation + prestige, 0, 100),
        },
        car.id,
        (c) => ({
          ...c,
          // каждый заезд изнашивает машину; аварии и нарушения — сильнее
          drives: (c.drives ?? 0) + 1,
          mileageReal: c.mileageReal + 6,
          mileageShown: c.mileageShown + 6,
          condition: {
            ...c.condition,
            engine: clamp(c.condition.engine - (action.clean ? 2 : 8), 5, 100),
            suspension: clamp(c.condition.suspension - (action.clean ? 1.5 : 10), 5, 100),
            body: clamp(c.condition.body - (action.clean ? 0.5 : 5), 5, 100),
          },
          invested: c.invested, // market value via condition
        }),
      )
      next = { ...next, stats: { ...next.stats, drives: (next.stats.drives ?? 0) + 1, cleanDrives: (next.stats.cleanDrives ?? 0) + (action.clean ? 1 : 0) } }
      if (bonus > 0) next = logTx(next, bonus, 'drive', 'Бонус за перегон')
      next = toast(
        next,
        action.clean
          ? `Чистый перегон! Престиж +${prestige}, бонус ${bonus.toLocaleString('ru-RU')} ₽`
          : 'Нарушения или аварии на заезде: износ вырос, цена ниже',
        action.clean ? 'good' : 'bad',
      )
      return unlock(next)
    }

    case 'SKIP_DRIVE':
      return { ...state, pendingDriveCarId: null }

    case 'REFRESH_CONTRACTS':
      return { ...state, contracts: generateContracts(state) }

    case 'COMPLETE_CONTRACT': {
      const c = state.contracts.find((x) => x.id === action.contractId && x.status === 'active')
      if (!c) return state
      const match = state.lot.find(
        (car) =>
          car.segment === c.segment &&
          (car.brand.includes(c.brandHint) || car.model.includes(c.brandHint) || c.brandHint.length < 3),
      )
      // soft match: any car of segment if brand not found
      const car = match || state.lot.find((x) => x.segment === c.segment)
      if (!car) return toast(state, 'Нет подходящей машины на стоянке', 'bad')
      if (state.day > c.deadlineDay) {
        return toast(
          {
            ...state,
            contracts: state.contracts.map((x) => (x.id === c.id ? { ...x, status: 'failed' as const } : x)),
          },
          'Срок контракта вышел',
          'bad',
        )
      }
      const { [car.id]: _l, ...listings } = state.listings
      let next: GameState = {
        ...state,
        money: state.money + c.reward,
        lot: state.lot.filter((x) => x.id !== car.id),
        listings,
        contracts: state.contracts.map((x) => (x.id === c.id ? { ...x, status: 'done' as const } : x)),
        upgrades: {
          ...state.upgrades,
          office: Math.min(UPGRADE_DEFS.office.max, state.upgrades.office + (c.reward > 150_000 ? 1 : 0)),
        },
        reputation: clamp(state.reputation + 4, 0, 100),
      }
      next = logTx(next, c.reward, 'contract', c.title)
      return toast(next, `Контракт выполнен! +${c.reward.toLocaleString('ru-RU')} ₽`, 'good')
    }

    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }

    case 'UNBLACKLIST':
      return { ...state, blacklist: state.blacklist.filter((n) => n !== action.name) }

    case 'NEW_GAME':
      return createInitialState()

    default:
      return state
  }
}

export const ALL_PARTS = PARTS
