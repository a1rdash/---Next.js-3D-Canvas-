export type Zone = 'engine' | 'body' | 'interior' | 'suspension' | 'electrics' | 'documents'

export type Segment = 'junk' | 'budget' | 'mid' | 'premium' | 'sport' | 'hyper'

export type BodyType = 'hatch' | 'sedan' | 'suv' | 'coupe' | 'van' | 'roadster' | 'pickup'

export type Phase = 'morning' | 'day' | 'evening' | 'night'

export type Weather = 'clear' | 'rain' | 'fog'

export type SellerType = 'honest' | 'cunning' | 'shady'

export type TabId = 'home' | 'garage' | 'lot' | 'auction' | 'market' | 'profile' | 'about'

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'brutal' | 'legend'

export type TxCategory =
  | 'sale'
  | 'buy'
  | 'auction'
  | 'fine'
  | 'repair'
  | 'parts'
  | 'contract'
  | 'upgrade'
  | 'protect'
  | 'exam'
  | 'list'
  | 'shady'
  | 'duel'
  | 'daily'
  | 'donate'
  | 'black'
  | 'drive'
  | 'achievement'
  | 'loan'
  | 'inspection'
  | 'paint'
  | 'other'

export interface Transaction {
  id: string
  day: number
  phase: Phase
  amount: number // +income / -expense
  category: TxCategory
  label: string
  at: number
}

export interface DailyLogin {
  streak: number
  lastClaimDay: string // YYYY-MM-DD local
}

export interface CityContract {
  id: string
  title: string
  description: string
  brandHint: string
  segment: Segment
  reward: number
  deadlineDay: number
  status: 'active' | 'done' | 'failed'
}

export interface BlackLot {
  id: string
  title: string
  /** имя/кличка продавца-перекупщика */
  seller?: string
  car: Car
  price: number
  risk: number
  status: 'open' | 'bought' | 'gone'
}


export interface Defect {
  id: string
  zone: Zone
  name: string
  severity: number
  repairCost: number
  revealed: boolean
}

/** Внешний вид: кастомная покраска, покрытия, диски, шины и цвета (виден на 3D-модели) */
export interface CarLook {
  /** цвет кузова #rrggbb (кастомная покраска) */
  paint?: string
  finish?: string
  wheelDesign?: string
  rimColor?: string
  tire?: string
  tireColor?: string
  interior?: string
}

export interface Tuning {
  engine: number
  suspension: number
  visual: number
  /** стиль дисков: 0 — штамп, 1 — литьё, 2 — спорт, 3 — кованые «неон» */
  wheels?: number
  /** коробка передач: влияет на максимальную скорость */
  gearbox?: number
}

export interface Car {
  id: string
  brand: string
  model: string
  year: number
  segment: Segment
  bodyType: BodyType
  color: string
  vin: string
  mileageShown: number
  mileageReal: number
  baseValue: number
  condition: Record<Zone, number>
  inspected: Record<Zone, boolean>
  defects: Defect[]
  documentsForged: boolean
  mileageChecked: boolean
  vinChecked: boolean
  tuning: Tuning
  /** Орбитальный родстер: воздушные баки for flight mode (0–3) */
  flightTanks?: number
  /** оплачен «Доступ на осмотр» — без него детальная оценка недоступна */
  accessGranted?: boolean
  look?: CarLook
  /** установленные электронные системы */
  features?: { cruise?: boolean; autopilot?: boolean }
  /** число тест-драйвов (каждый заезд увеличивает износ) */
  drives?: number
  purchasePrice: number
  invested: number
  acquiredDay: number
}

export interface Seller {
  id: string
  name: string
  type: SellerType
  quote: string
  car: Car
  askingPrice: number
  patience: number
  lastCounter: number | null
}

export interface BuyerOffer {
  id: string
  name: string
  amount: number
  mood: string
  /** Hidden max the buyer will pay */
  maxPay: number
  /** Negotiation rounds left before they walk */
  patience: number
  status: 'open' | 'agreed' | 'walked'
}

export interface CarListing {
  offers: BuyerOffer[]
  listedAt: number
  readyAt: number
}

export interface AuthUser {
  id: string
  name: string
  email: string
  avatar?: string
}

export type PartCategory = 'engine' | 'tires' | 'suspension' | 'body' | 'electrics' | 'interior'

export interface PartDef {
  id: string
  name: string
  category: PartCategory
  tier: number
  basePrice: number
  repairAmount: number
  tuning?: keyof Tuning
  /** открывает функцию автомобиля (круиз / автопилот) */
  feature?: 'cruise' | 'autopilot'
  description: string
}

export interface InventoryItem {
  partId: string
  qty: number
}

export interface AuctionLot {
  id: string
  title: string
  hint: string
  segment: Segment
  bank: boolean
  startPrice: number
  car: Car
  status: 'pending' | 'live' | 'won' | 'lost'
  /** когда начались торги (переживает перезагрузку страницы) */
  startedAt?: number
  finalPrice?: number
  winner?: string
}

export interface Rival {
  id: string
  name: string
  aggression: number
  budget: number
  tagline: string
}

export interface ShadyJob {
  id: string
  giver: string
  title: string
  description: string
  reward: number
  risk: number
  repLoss: number
  fine: number
}

export interface NewsItem {
  id: string
  headline: string
  segment: Segment | null
  modifier: number
}

export interface Toast {
  id: string
  message: string
  tone: 'good' | 'bad' | 'info'
}

export interface Upgrades {
  slots: number
  cleanliness: number
  tools: number
  security: number
  /** Notary office desk / archive / counsel */
  office: number
}

export interface DuelState {
  day: number
  car: Car
  rival: Rival
  done: boolean
  result?: { player: number; rival: number; actual: number; won: boolean }
}

export interface Stats {
  carsBought: number
  carsSold: number
  totalProfit: number
  bestDeal: number
  auctionsWon: number
  shadyDone: number
  duelsWon: number
  examsPassed: number
  partsInstalled: number
  repairs?: number
  drives?: number
  cleanDrives?: number
  legalized?: number
  blackBought?: number
  thievesStopped?: number
  partsBought?: number
  failedLegalize?: number
}

export interface GameState {
  money: number
  reputation: number
  xp: number
  level: number
  license: number
  day: number
  /** локальная дата последней синхронизации YYYY-MM-DD (для смены дня по реальному календарю) */
  lastSyncDate: string
  phase: Phase
  weather: Weather
  clients: Seller[]
  activeClientId: string | null
  lot: Car[]
  listings: Record<string, CarListing>
  inventory: InventoryItem[]
  auctionLots: AuctionLot[]
  rivals: Rival[]
  shadyJobs: ShadyJob[]
  news: NewsItem[]
  segmentDemand: Record<Segment, number>
  partPriceMod: number
  upgrades: Upgrades
  protectionDays: number
  blacklist: string[]
  achievements: string[]
  stats: Stats
  vipBoostCarId: string | null
  authUser: AuthUser | null
  marketSoftLeft: number
  marketNextSoftAt: number
  marketNextMajorAt: number
  lastPartsTheftAt: number
  duel: DuelState | null
  difficulty: DifficultyId
  /** пройденные режимы сложности: следующий открывается строго после предыдущего */
  completedDifficulties?: DifficultyId[]
  /** купленные в ателье (на авторынке) варианты внешнего вида */
  ownedLooks?: string[]
  loan?: { amount: number; owed: number; dueAt: number; lastPenaltyAt: number } | null
  daily: DailyLogin
  contracts: CityContract[]
  blackMarket: BlackLot[]
  pendingDriveCarId: string | null
  googleBonusClaimed: boolean
  ledger: Transaction[]
  donateHistory: Transaction[]
  log: string[]
  toasts: Toast[]
}
