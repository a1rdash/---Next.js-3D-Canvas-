import type { BodyType, GameState, PartDef, Segment } from './types'

/* ------------------------------------------------------------------ */
/*  Запчасти: расширенный ассортимент магазина                         */
/* ------------------------------------------------------------------ */

const P = (
  id: string,
  name: string,
  category: PartDef['category'],
  tier: number,
  basePrice: number,
  repairAmount: number,
  description: string,
  tuning?: PartDef['tuning'],
): PartDef => ({ id, name, category, tier, basePrice, repairAmount, description, ...(tuning ? { tuning } : {}) })

export interface NewModelDef {
  brand: string
  model: string
  segment: Segment
  bodyType: BodyType
  base: number
  /** шанс появиться, если выпала эта модель (редкость) */
  rarity?: number
}

const M = (brand: string, model: string, segment: Segment, bodyType: BodyType, base: number, rarity?: number): NewModelDef => ({ brand, model, segment, bodyType, base, rarity })

/** +50 новых моделей. Cybertruck v1 — самая дорогая машина игры (100 000 000 ₽). */
export const NEW_MODELS: NewModelDef[] = [
  M('Ладога', 'Двенашка-Ретро', 'junk', 'sedan', 38_000), M('Москвич-Н', '2141 «Святогор»', 'junk', 'hatch', 62_000),
  M('Волга-Н', '31 «Дежурная»', 'junk', 'sedan', 88_000), M('УАЗ-Патриот', 'Буханка-Старая', 'junk', 'van', 110_000),
  M('Кира', 'Спектра-Н', 'budget', 'sedan', 640_000), M('Кира', 'Сид-Лайт', 'budget', 'hatch', 910_000), M('Хёнда', 'Акцент-Х', 'budget', 'sedan', 780_000),
  M('Хёнда', 'Гетц-Сити', 'budget', 'hatch', 560_000), M('Рено-Дач', 'Сандеро-Степ', 'budget', 'hatch', 1_020_000), M('Черри-Амлет', 'Тигго-4', 'budget', 'suv', 1_540_000),
  M('Джили-Коул', 'Эмгранд-С', 'budget', 'sedan', 1_190_000), M('Ладога', 'Ларгус-Фургон', 'budget', 'van', 1_080_000), M('УАЗ-Патриот', 'Хантер-Р', 'budget', 'suv', 1_110_000), M('Ладога', 'Нива-Тундра', 'budget', 'pickup', 1_240_000),
  M('Тойота-Н', 'Королла-Н', 'mid', 'sedan', 2_050_000), M('Тойота-Н', 'Рав-Сити', 'mid', 'suv', 3_150_000), M('Мазда-Н', 'Тройка-Спорт', 'mid', 'hatch', 2_250_000),
  M('Мазда-Н', 'СХ-Север', 'mid', 'suv', 2_980_000), M('Фольксваген-Н', 'Поло-Макс', 'mid', 'sedan', 1_980_000), M('Фольксваген-Н', 'Тигуан-Н', 'mid', 'suv', 3_050_000),
  M('Шкода-Н', 'Октавия-Н', 'mid', 'sedan', 2_480_000), M('Форд-Н', 'Фокус-Н', 'mid', 'hatch', 1_880_000), M('Форд-Н', 'Рейнджер-Н', 'mid', 'pickup', 3_400_000),
  M('Ниссан-Н', 'Кашкай-Н', 'mid', 'suv', 2_780_000), M('Субару-Н', 'Форестер-Н', 'mid', 'suv', 3_250_000), M('Пежо-Н', 'Партнёр-Ван', 'mid', 'van', 2_140_000),
  M('БМВ-Н', 'Тройка-Н', 'premium', 'sedan', 4_800_000), M('БМВ-Н', 'Х3-Н', 'premium', 'suv', 6_200_000), M('Мерседес-Н', 'С-Класс-Н', 'premium', 'sedan', 7_400_000),
  M('Мерседес-Н', 'ГЛЕ-Н', 'premium', 'suv', 8_100_000), M('Ауди-Н', 'А6-Н', 'premium', 'sedan', 5_900_000), M('Ауди-Н', 'Ку5-Н', 'premium', 'suv', 6_500_000),
  M('Вольво-Н', 'ХС90-Н', 'premium', 'suv', 7_200_000), M('Лексус-Н', 'РХ-Н', 'premium', 'suv', 7_800_000), M('Порше-Н', 'Макан-Н', 'premium', 'suv', 8_900_000), M('Лэнд-Н', 'Дефендер-Н', 'premium', 'suv', 9_300_000),
  M('Ниссан-Н', 'ГТР-Н', 'sport', 'coupe', 14_500_000), M('Шевроле-Н', 'Корвет-Н', 'sport', 'coupe', 12_800_000), M('Форд-Н', 'Мустанг-Н', 'sport', 'coupe', 7_900_000),
  M('Порше-Н', '911-Н', 'sport', 'coupe', 16_500_000), M('Ауди-Н', 'Р8-Н', 'sport', 'coupe', 19_800_000), M('БМВ-Н', 'М4-Н', 'sport', 'coupe', 11_200_000),
  M('Мазда-Н', 'МХ-5-Н', 'sport', 'roadster', 5_800_000), M('Додж-Н', 'Челленджер-Н', 'sport', 'coupe', 8_600_000),
  M('Паганы-Н', 'Зонда-Н', 'hyper', 'coupe', 52_000_000), M('Коенигсегг-Н', 'Джеско-Н', 'hyper', 'coupe', 66_000_000), M('Макларен-Н', 'П1-Н', 'hyper', 'coupe', 58_000_000),
  M('Ламбо-Н', 'Ревуэльто-Н', 'hyper', 'coupe', 44_000_000), M('Роллс-Н', 'Катлинан-Н', 'hyper', 'suv', 36_000_000),
  M('Нео-Трак', 'Cybertruck v1', 'hyper', 'pickup', 100_000_000, 0.18),
]

/* ------------------------------------------------------------------ */
/*  Ателье: диски, шины и покрытия (продаются на авторынке)            */
/* ------------------------------------------------------------------ */

export type LookKind = 'wheelDesign' | 'tire' | 'finish'
export interface LookItem { id: string; kind: LookKind; value: string; name: string; price: number; hint: string }

export const LOOK_CATALOG: LookItem[] = [
  { id: 'wheelDesign:steel', kind: 'wheelDesign', value: 'steel', name: 'Штампованные', price: 0, hint: 'Базовые, 5 спиц' },
  { id: 'wheelDesign:alloy', kind: 'wheelDesign', value: 'alloy', name: 'Литые «Классика»', price: 24_000, hint: '5 спиц, серебро' },
  { id: 'wheelDesign:mesh', kind: 'wheelDesign', value: 'mesh', name: 'Сетка «Решётка»', price: 38_000, hint: '10 тонких спиц' },
  { id: 'wheelDesign:turbine', kind: 'wheelDesign', value: 'turbine', name: 'Турбина', price: 52_000, hint: '7 спиц, графит' },
  { id: 'wheelDesign:deepdish', kind: 'wheelDesign', value: 'deepdish', name: 'Глубокие «Дип-диш»', price: 64_000, hint: 'Широкие, золото' },
  { id: 'wheelDesign:split', kind: 'wheelDesign', value: 'split', name: 'Сплит «Двойные»', price: 78_000, hint: '10 спиц, чёрные' },
  { id: 'wheelDesign:forged', kind: 'wheelDesign', value: 'forged', name: 'Кованые «Лёгкие»', price: 120_000, hint: 'Хром, тонкие' },
  { id: 'wheelDesign:neon', kind: 'wheelDesign', value: 'neon', name: 'Неон «Кольцо»', price: 180_000, hint: 'С неоновым ободом' },
  { id: 'tire:street', kind: 'tire', value: 'street', name: 'Дорожные', price: 0, hint: 'Стандартные' },
  { id: 'tire:sport', kind: 'tire', value: 'sport', name: 'Спорт-профиль', price: 32_000, hint: 'Шире, ниже профиль' },
  { id: 'tire:offroad', kind: 'tire', value: 'offroad', name: 'Внедорожные', price: 36_000, hint: 'Высокий профиль' },
  { id: 'tire:slick', kind: 'tire', value: 'slick', name: 'Слики', price: 58_000, hint: 'Максимально широкие' },
  { id: 'finish:gloss', kind: 'finish', value: 'gloss', name: 'Глянец', price: 0, hint: 'Базовое покрытие' },
  { id: 'finish:matte', kind: 'finish', value: 'matte', name: 'Матовая плёнка', price: 28_000, hint: 'Без блеска' },
  { id: 'finish:metallic', kind: 'finish', value: 'metallic', name: 'Металлик', price: 36_000, hint: 'Глубокий блеск' },
  { id: 'finish:pearl', kind: 'finish', value: 'pearl', name: 'Жемчуг', price: 64_000, hint: 'Переливы цвета' },
  { id: 'finish:chrome', kind: 'finish', value: 'chrome', name: 'Хром', price: 140_000, hint: 'Зеркальное покрытие' },
]

export const FREE_LOOKS = LOOK_CATALOG.filter((l) => l.price === 0).map((l) => l.id)
/** Стоимость кастомных цветов (применяются в гараже) */
export const LOOK_COLOR_COST = { paint: 12_000, rimColor: 6_000, tireColor: 6_000, interior: 9_000 } as const

export const EXTRA_PARTS: PartDef[] = [
  P('gearbox-sport', 'Спортивная коробка (короткие передачи)', 'engine', 2, 48_000, 10, 'Тюнинг коробки +1: выше максимальная скорость', 'gearbox'),
  P('gearbox-close', 'Коробка с близкими ступенями', 'engine', 3, 95_000, 10, 'Тюнинг коробки +1: выше максимальная скорость', 'gearbox'),
  P('gearbox-dct', 'Робот-коробка с двумя сцеплениями', 'engine', 4, 210_000, 15, 'Тюнинг коробки +1: заметно выше максимальная скорость', 'gearbox'),
  { id: 'cruise-control', name: 'Круиз-контроль', category: 'electrics', tier: 3, basePrice: 85_000, repairAmount: 0, description: 'Держит заданную скорость на тест-драйве (до 120 км/ч)', feature: 'cruise' },
  { id: 'autopilot', name: 'Автопилот «Нео-Пилот»', category: 'electrics', tier: 4, basePrice: 450_000, repairAmount: 0, description: 'Держит полосу, объезжает помехи и останавливается на красный. Нужен круиз-контроль', feature: 'autopilot' },
  // двигатель
  P('spark-plugs', 'Свечи зажигания (комплект)', 'engine', 1, 3_200, 8, 'Мотор +8%'),
  P('air-filter', 'Воздушный фильтр нулевого сопротивления', 'engine', 1, 2_800, 6, 'Мотор +6%'),
  P('cooling', 'Радиатор и помпа', 'engine', 2, 14_000, 20, 'Мотор +20%'),
  P('fuel-pump', 'Топливный насос', 'engine', 2, 9_500, 18, 'Мотор +18%'),
  P('head-gasket', 'Прокладка ГБЦ + шлифовка', 'engine', 2, 16_500, 28, 'Мотор +28%'),
  P('injectors', 'Форсунки', 'engine', 2, 24_000, 30, 'Мотор +30%'),
  P('clutch', 'Комплект сцепления', 'engine', 2, 22_000, 22, 'Мотор +22%'),
  P('gearbox-rebuild', 'Капремонт коробки передач', 'engine', 3, 58_000, 50, 'Мотор +50%'),
  P('ecu-chip', 'Чип-тюнинг «Стейдж 1»', 'engine', 3, 62_000, 5, 'Тюнинг двигателя +1 уровень', 'engine'),
  P('supercharger', 'Компрессор «Вихрь»', 'engine', 4, 260_000, 0, 'Тюнинг двигателя +1 уровень', 'engine'),
  P('nitro-kit', 'Закись азота «Нео-Бустер»', 'engine', 4, 340_000, 0, 'Тюнинг двигателя +1 уровень', 'engine'),
  P('engine-swap-v8', 'Свап V8 «Громовержец»', 'engine', 4, 480_000, 100, 'Мотор до 100% + доработки'),
  // шины и диски
  P('tires-winter', 'Зимние шипованные шины', 'tires', 1, 18_000, 25, 'Подвеска +25%'),
  P('tires-all', 'Всесезонные шины', 'tires', 1, 22_000, 30, 'Подвеска +30%'),
  P('tires-sport', 'Спортивные шины «Гонщик»', 'tires', 2, 48_000, 45, 'Подвеска +45%'),
  P('tires-slick', 'Трековые слики', 'tires', 3, 78_000, 50, 'Подвеска +50%'),
  P('wheels-alloy', 'Литые диски R17', 'tires', 2, 28_000, 0, 'Новые диски на модели: стиль «литьё»', 'wheels'),
  P('wheels-sport', 'Спортивные диски «Турбина»', 'tires', 3, 95_000, 0, 'Новые диски: стиль «спорт»', 'wheels'),
  P('wheels-forged', 'Кованые диски «Неон»', 'tires', 4, 220_000, 0, 'Кованые диски с неоновым ободом', 'wheels'),
  // подвеска
  P('bushings', 'Сайлентблоки (комплект)', 'suspension', 1, 9_000, 20, 'Подвеска +20%'),
  P('stabilizers', 'Стойки стабилизатора', 'suspension', 1, 17_000, 25, 'Подвеска +25%'),
  P('struts', 'Стойки амортизаторов', 'suspension', 2, 21_000, 35, 'Подвеска +35%'),
  P('control-arms', 'Рычаги подвески', 'suspension', 2, 26_000, 40, 'Подвеска +40%'),
  P('sport-springs', 'Спортивные пружины', 'suspension', 3, 38_000, 15, 'Тюнинг подвески +1, подвеска +15%', 'suspension'),
  P('air-ride', 'Пневмоподвеска «Парение»', 'suspension', 4, 210_000, 30, 'Тюнинг подвески +1, подвеска +30%', 'suspension'),
  // кузов
  P('polish', 'Полировка и воск', 'body', 1, 6_500, 10, 'Кузов +10%'),
  P('rust-treat', 'Антикор и обработка арок', 'body', 1, 8_800, 18, 'Кузов +18%'),
  P('fender', 'Новое крыло', 'body', 1, 11_000, 15, 'Кузов +15%'),
  P('bumper', 'Бампер в сборе', 'body', 1, 14_500, 20, 'Кузов +20%'),
  P('door', 'Новая дверь', 'body', 2, 16_000, 22, 'Кузов +22%'),
  P('hood', 'Капот', 'body', 2, 19_000, 25, 'Кузов +25%'),
  P('ceramic', 'Керамическое покрытие', 'body', 2, 39_000, 20, 'Кузов +20%'),
  P('carbon-spoiler', 'Карбоновый спойлер', 'body', 3, 72_000, 5, 'Визуал +1 уровень', 'visual'),
  P('widebody', 'Широкий обвес «Вайдбоди»', 'body', 4, 190_000, 15, 'Визуал +1 уровень, кузов +15%', 'visual'),
  // электрика
  P('sensors', 'Датчики (кислород, ABS)', 'electrics', 1, 9_800, 18, 'Электрика +18%'),
  P('wiring', 'Новая проводка', 'electrics', 1, 11_000, 22, 'Электрика +22%'),
  P('headlights', 'Фары в сборе', 'electrics', 1, 12_500, 20, 'Электрика +20%'),
  P('alternator', 'Генератор', 'electrics', 2, 15_000, 25, 'Электрика +25%'),
  P('alarm', 'Сигнализация с автозапуском', 'electrics', 2, 18_000, 10, 'Электрика +10%'),
  P('led-kit', 'Светодиодная оптика «Лазер»', 'electrics', 3, 24_000, 12, 'Визуал +1 уровень', 'visual'),
  // салон
  P('carpet', 'Коврики и обшивка пола', 'interior', 1, 6_500, 15, 'Салон +15%'),
  P('seat-cover', 'Чехлы на сиденья', 'interior', 1, 7_200, 18, 'Салон +18%'),
  P('steering', 'Новый руль', 'interior', 1, 14_000, 20, 'Салон +20%'),
  P('dash-restore', 'Реставрация торпеды', 'interior', 2, 22_000, 45, 'Салон +45%'),
  P('climate', 'Климат-контроль', 'interior', 2, 31_000, 40, 'Салон +40%'),
  P('audio', 'Аудиосистема «Бас-Неон»', 'interior', 2, 46_000, 10, 'Салон +10%'),
  P('sport-seats', 'Спортивные ковши', 'interior', 3, 68_000, 35, 'Салон +35%'),
]

/* ------------------------------------------------------------------ */
/*  Воры и персонажи чёрного рынка                                     */
/* ------------------------------------------------------------------ */

export const THIEF_NAMES = [
  'Костя «Отмычка»', 'Рыжий Валера', 'Толик «Фомка»', 'Гоша «Тень»', 'Стёпа «Щуп»', 'Лёха «Гвоздь»',
  'Борис «Лом»', 'Мишаня «Ключик»', 'Дэн «Глушитель»', 'Жека «Сквозняк»', 'Паша «Дубликат»', 'Вовчик «Монтировка»',
  'Лысый Ренат', 'Ильдар «Шнурок»', 'Саня «Катушка»', 'Кирюха «Домкрат»', 'Тимур «Кошка»', 'Гриня «Кусачки»',
  'Эдик «Ноль-Ноль»', 'Макс «Скотч»', 'Влад «Люк»', 'Рома «Капюшон»', 'Хасан «Шестерёнка»', 'Витёк «Туман»',
  'Серый «Фонарик»', 'Андрюха «Сверло»', 'Назар «Мотылёк»', 'Дима «Подкоп»', 'Фёдор «Бензопила»', 'Оксанка «Шпилька»',
  'Тёма «Скрепка»', 'Баха «Железный»', 'Пётр «Зажигалка»', 'Дядя Миша «Кастет»', 'Анжела «Тихушница»',
]

export const BLACK_SELLERS = [
  'Контрабандист Артур', 'Тётя Люда с таможни', 'Гена «Растаможка»', 'Шеф «Серый порт»', 'Рафик «Без бумаг»',
  'Дон Карлеоне с Автозавода', 'Мадам Шина', 'Борода «Конфискат»', 'Мистер Икс из Владика', 'Кабан «Эвакуатор»',
  'Зинаида «Залог»', 'Ося «Левый ПТС»', 'Ковбой Слава', 'Пират «Фрахт»', 'Лиса из Ростова', 'Сеня «Ночной рейс»',
  'Бригадир Тимофей', 'Академик «Дубликат»', 'Шурик «Тёмный склад»', 'Леди Дрифт',
]

/* ------------------------------------------------------------------ */
/*  Достижения: награды по сложности (макс. 2 000 000)                 */
/* ------------------------------------------------------------------ */

export const ACHIEVEMENT_REWARD_CAP = 2_000_000

export type AchievementTier = 'easy' | 'medium' | 'hard' | 'legend'

export interface AchievementDef {
  id: string
  title: string
  description: string
  tier: AchievementTier
  reward: number
  rule?: (s: GameState) => boolean
}

const n = (v: number | undefined) => v ?? 0
const up = (s: GameState) => s.upgrades

const A = (
  tier: AchievementTier,
  reward: number,
  id: string,
  title: string,
  description: string,
  rule?: (s: GameState) => boolean,
): AchievementDef => ({ id, title, description, tier, reward: Math.min(ACHIEVEMENT_REWARD_CAP, reward), rule })

export const TIER_LABELS: Record<AchievementTier, string> = { easy: 'Простое', medium: 'Среднее', hard: 'Сложное', legend: 'Легендарное' }

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- простые: 100 000 ---
  A('easy', 100_000, 'first-buy', 'Первая ласточка', 'Купи первую машину', (s) => s.stats.carsBought >= 1),
  A('easy', 100_000, 'first-sale', 'Навар пошёл', 'Продай первую машину', (s) => s.stats.carsSold >= 1),
  A('easy', 100_000, 'auction-win', 'Молоток!', 'Выиграй аукцион', (s) => s.stats.auctionsWon >= 1),
  A('easy', 100_000, 'shady', 'Серая зона', 'Выполни теневой заказ', (s) => s.stats.shadyDone >= 1),
  A('easy', 100_000, 'license-1', 'Корочка есть', 'Получи лицензию Нотариуса I', (s) => s.license >= 1),
  A('easy', 100_000, 'first-bolt', 'Первый болт', 'Установи первую деталь', (s) => s.stats.partsInstalled >= 1),
  A('easy', 100_000, 'first-repair', 'Рукастый', 'Отремонтируй зону машины', (s) => n(s.stats.repairs) >= 1),
  A('easy', 100_000, 'first-drive', 'Прокатимся', 'Завершите первый тест-драйв', (s) => n(s.stats.drives) >= 1),
  A('easy', 100_000, 'first-black', 'Тёмная лошадка', 'Купи машину на чёрном рынке', (s) => n(s.stats.blackBought) >= 1),
  A('easy', 100_000, 'level-3', 'Не новичок', 'Достигни 3 уровня', (s) => s.level >= 3),
  A('easy', 100_000, 'day-3', 'Три дня на рынке', 'Доживи до 3-го дня', (s) => s.day >= 3),
  A('easy', 100_000, 'thief-fail', 'Сторож не спит', 'Отрази попытку кражи', (s) => n(s.stats.thievesStopped) >= 1),
  A('easy', 100_000, 'shop-1', 'Инвестор', 'Купи пакет нота-койнов в магазине', undefined),
  A('easy', 100_000, 'sell-timer', 'Терпеливый продавец', 'Дождись конца таймера продажи', undefined),
  A('easy', 100_000, 'first-legal', 'Чистые бумаги', 'Успешно легализуй машину', (s) => n(s.stats.legalized) >= 1),
  A('easy', 100_000, 'first-upgrade', 'Хозяин гаража', 'Купи первое улучшение гаража', (s) => up(s).slots + up(s).cleanliness + up(s).tools + up(s).security + up(s).office >= 1),
  // --- средние: 150 000 – 400 000 ---
  A('medium', 150_000, 'level-5', 'Опытный перекуп', 'Достигни 5 уровня', (s) => s.level >= 5),
  A('medium', 200_000, 'profit-100k', 'Сотка сверху', 'Заработай 100 000 ₽ на одной сделке', (s) => s.stats.bestDeal >= 100_000),
  A('medium', 200_000, 'cars-10', 'Десяток', 'Купи 10 машин', (s) => s.stats.carsBought >= 10),
  A('medium', 200_000, 'full-lot', 'Полная стоянка', 'Заполни стоянку (от 8 машин)', (s) => s.lot.length >= 8),
  A('medium', 200_000, 'parts-20', 'Складской король', 'Накопи 20 единиц запчастей на складе', (s) => s.inventory.reduce((a, i) => a + i.qty, 0) >= 20),
  A('medium', 200_000, 'repair-10', 'Мастер на все руки', 'Выполни 10 ремонтов', (s) => n(s.stats.repairs) >= 10),
  A('medium', 250_000, 'auction-5', 'Аукционный хищник', 'Выиграй 5 аукционов', (s) => s.stats.auctionsWon >= 5),
  A('medium', 250_000, 'duel-3', 'Глаз-алмаз', 'Выиграй 3 дуэли оценщиков', (s) => s.stats.duelsWon >= 3),
  A('medium', 250_000, 'tuner', 'Тюнер', 'Установи 10 деталей', (s) => s.stats.partsInstalled >= 10),
  A('medium', 250_000, 'security-3', 'Крепость', 'Охрана 3+ уровня', (s) => up(s).security >= 3),
  A('medium', 250_000, 'sport-sale', 'Спорт на продажу', 'Продай спорткар', undefined),
  A('medium', 250_000, 'clean-5', 'Аккуратный водитель', 'Проедь 5 тест-драйвов без единого удара', (s) => n(s.stats.cleanDrives) >= 5),
  A('medium', 300_000, 'license-2', 'Нотариус II', 'Получи лицензию Нотариуса II', (s) => s.license >= 2),
  A('medium', 300_000, 'level-10', 'Ветеран', 'Достигни 10 уровня', (s) => s.level >= 10),
  A('medium', 300_000, 'saint', 'Святой перекуп', 'Репутация 90+', (s) => s.reputation >= 90),
  A('medium', 300_000, 'day-30', 'Месяц на рынке', 'Доживи до 30-го дня', (s) => s.day >= 30),
  A('medium', 300_000, 'sales-10', 'Торговец', 'Продай 10 машин', (s) => s.stats.carsSold >= 10),
  A('medium', 300_000, 'black-3', 'Свой в тёмных кругах', 'Купи 3 машины на чёрном рынке', (s) => n(s.stats.blackBought) >= 3),
  A('medium', 350_000, 'legal-5', 'Печать решает', 'Легализуй 5 машин', (s) => n(s.stats.legalized) >= 5),
  A('medium', 400_000, 'parts-buy-30', 'Оптовик запчастей', 'Купи 30 запчастей', (s) => n(s.stats.partsBought) >= 30),
  A('medium', 400_000, 'office-2', 'Нотариальная контора', 'Офис нотариуса 2+ уровня', (s) => up(s).office >= 2),
  // --- сложные: 500 000 – 1 000 000 ---
  A('hard', 500_000, 'rep-100', 'Безупречная репутация', 'Репутация 100', (s) => s.reputation >= 100),
  A('hard', 600_000, 'profit-1m', 'Миллионер', 'Заработай 1 000 000 ₽ на одной сделке', (s) => s.stats.bestDeal >= 1_000_000),
  A('hard', 600_000, 'black-10', 'Король серого рынка', 'Купи 10 машин на чёрном рынке', (s) => n(s.stats.blackBought) >= 10),
  A('hard', 600_000, 'office-4', 'Премиум-нотариат', 'Офис нотариуса на максимуме', (s) => up(s).office >= 4),
  A('hard', 700_000, 'total-10m', 'Оборотистый', 'Суммарная прибыль 10 000 000 ₽', (s) => s.stats.totalProfit >= 10_000_000),
  A('hard', 700_000, 'auction-20', 'Хозяин молотка', 'Выиграй 20 аукционов', (s) => s.stats.auctionsWon >= 20),
  A('hard', 700_000, 'installs-100', 'Тюнинг-ателье', 'Установи 100 деталей', (s) => s.stats.partsInstalled >= 100),
  A('hard', 700_000, 'slots-10', 'Империя стоянок', 'Расширь стоянку до 10 уровня', (s) => up(s).slots >= 10),
  A('hard', 800_000, 'license-3', 'Мастер печатей', 'Стань Мастер-нотариусом', (s) => s.license >= 3),
  A('hard', 800_000, 'cars-50', 'Автопарк', 'Купи 50 машин', (s) => s.stats.carsBought >= 50),
  A('hard', 800_000, 'level-20', 'Акула рынка', 'Достигни 20 уровня', (s) => s.level >= 20),
  A('hard', 800_000, 'legal-15', 'Левые бумаги — легальный бизнес', 'Легализуй 15 машин', (s) => n(s.stats.legalized) >= 15),
  A('hard', 900_000, 'sales-50', 'Поток сделок', 'Продай 50 машин', (s) => s.stats.carsSold >= 50),
  A('hard', 900_000, 'security-6', 'Неприступный', 'Охрана на максимуме', (s) => up(s).security >= 6),
  A('hard', 1_000_000, 'license-4', 'Старший нотариус', 'Получи лицензию Старшего нотариуса', (s) => s.license >= 4),
  A('hard', 1_000_000, 'day-100', 'Сто дней на рынке', 'Доживи до 100-го дня', (s) => s.day >= 100),
  // --- легендарные: до 1 000 000 (потолок 2 000 000) ---
  A('legend', 1_000_000, 'level-30', 'Легенда автобарахолки', 'Достигни 30 уровня', (s) => s.level >= 30),
  A('legend', 1_000_000, 'total-50m', 'Неоновый магнат', 'Суммарная прибыль 50 000 000 ₽', (s) => s.stats.totalProfit >= 50_000_000),
  A('legend', 1_000_000, 'license-5', 'Нотариус-легенда', 'Получи высшую лицензию', (s) => s.license >= 5),
  A('legend', 1_000_000, 'garage-max', 'Гараж мечты', 'Доведи гараж до максимального уровня', (s) => garageLevelOf(s.upgrades) >= 6),
]

/** Уровень гаража (1–6): растёт вместе с улучшениями и меняет 3D-вид гаража */
export function garageLevelOf(u: GameState['upgrades']): number {
  const pts = Math.floor(u.slots / 3) + u.cleanliness + u.tools + u.security + u.office
  if (pts >= 22) return 6
  if (pts >= 16) return 5
  if (pts >= 10) return 4
  if (pts >= 6) return 3
  if (pts >= 2) return 2
  return 1
}
