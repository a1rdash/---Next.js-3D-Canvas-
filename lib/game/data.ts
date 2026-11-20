import { EXTRA_PARTS, NEW_MODELS } from './content'
import type { BodyType, PartDef, Phase, Rival, Segment, SellerType, Weather, Zone } from './types'

export const ZONES: Zone[] = ['engine', 'body', 'interior', 'suspension', 'electrics', 'documents']

export const ZONE_LABELS: Record<Zone, string> = {
  engine: 'Двигатель',
  body: 'Кузов',
  interior: 'Салон',
  suspension: 'Подвеска',
  electrics: 'Электрика',
  documents: 'Документы',
}

export const SEGMENT_LABELS: Record<Segment, string> = {
  junk: 'Хлам',
  budget: 'Бюджет',
  mid: 'Средний класс',
  premium: 'Премиум',
  sport: 'Спорт',
  hyper: 'Люкс / Гипер',
}

export const PHASE_LABELS: Record<Phase, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  night: 'Ночь',
}

export const WEATHER_LABELS: Record<Weather, string> = {
  clear: 'Ясно',
  rain: 'Дождь',
  fog: 'Туман',
}

export const SELLER_LABELS: Record<SellerType, string> = {
  honest: 'Честный работяга',
  cunning: 'Хитрый перекуп',
  shady: 'Мутный тип',
}

export const PHASES: Phase[] = ['morning', 'day', 'evening', 'night']

interface ModelDef {
  brand: string
  model: string
  segment: Segment
  bodyType: BodyType
  base: number
}

const BASE_MODELS: ModelDef[] = [
  // ——— Хлам ———
  { brand: 'Ладога', model: 'Копейка-Ржавь', segment: 'junk', bodyType: 'sedan', base: 45_000 },
  { brand: 'Ладога', model: 'Шестёрка «Дача»', segment: 'junk', bodyType: 'sedan', base: 70_000 },
  { brand: 'Москвич-Н', model: '412 «Наследство»', segment: 'junk', bodyType: 'sedan', base: 55_000 },
  { brand: 'Волга-Н', model: '24 «Такси»', segment: 'junk', bodyType: 'sedan', base: 95_000 },
  { brand: 'Ока-Мини', model: '1111', segment: 'junk', bodyType: 'hatch', base: 40_000 },
  { brand: 'Таврия-Юг', model: 'Славутич', segment: 'junk', bodyType: 'hatch', base: 60_000 },
  // ——— Бюджет ———
  { brand: 'Ладога', model: 'Пятёрка', segment: 'budget', bodyType: 'sedan', base: 220_000 },
  { brand: 'Ладога', model: 'Гранта-С', segment: 'budget', bodyType: 'sedan', base: 720_000 },
  { brand: 'Ладога', model: 'Калинка', segment: 'budget', bodyType: 'hatch', base: 480_000 },
  { brand: 'Ладога', model: 'Веста-Н', segment: 'budget', bodyType: 'sedan', base: 1_050_000 },
  { brand: 'Ладога', model: 'Нива-Трейл', segment: 'budget', bodyType: 'suv', base: 980_000 },
  { brand: 'Кира', model: 'Рио-Нова', segment: 'budget', bodyType: 'hatch', base: 1_150_000 },
  { brand: 'Хёнда', model: 'Солярис-Х', segment: 'budget', bodyType: 'sedan', base: 1_250_000 },
  { brand: 'Хёнда', model: 'Крета-Сити', segment: 'budget', bodyType: 'suv', base: 1_650_000 },
  { brand: 'Рено-Дач', model: 'Логан', segment: 'budget', bodyType: 'sedan', base: 890_000 },
  { brand: 'Рено-Дач', model: 'Дастер-X', segment: 'budget', bodyType: 'suv', base: 1_480_000 },
  { brand: 'Волга-Н', model: 'Фургон', segment: 'budget', bodyType: 'van', base: 1_450_000 },
  { brand: 'УАЗ-Патриот', model: 'Пикап-Р', segment: 'budget', bodyType: 'pickup', base: 1_320_000 },
  { brand: 'Черри-Амлет', model: 'Тигго-2', segment: 'budget', bodyType: 'suv', base: 1_380_000 },
  { brand: 'Джили-Коул', model: 'Атлас-Лайт', segment: 'budget', bodyType: 'suv', base: 1_720_000 },
  // ——— Средний ———
  { brand: 'Тойо', model: 'Камри-X', segment: 'mid', bodyType: 'sedan', base: 2_850_000 },
  { brand: 'Тойо', model: 'РАВ-4 Неон', segment: 'mid', bodyType: 'suv', base: 3_100_000 },
  { brand: 'Тойо', model: 'Альфа-Вэн', segment: 'mid', bodyType: 'van', base: 3_600_000 },
  { brand: 'Мазза', model: 'Шесть', segment: 'mid', bodyType: 'sedan', base: 2_250_000 },
  { brand: 'Мазза', model: 'СХ-5 Город', segment: 'mid', bodyType: 'suv', base: 2_650_000 },
  { brand: 'Шкода-Р', model: 'Октавиа-Р', segment: 'mid', bodyType: 'hatch', base: 2_050_000 },
  { brand: 'Шкода-Р', model: 'Кодиак', segment: 'mid', bodyType: 'suv', base: 2_900_000 },
  { brand: 'Ниссо', model: 'Хвост-Трейл', segment: 'mid', bodyType: 'suv', base: 2_450_000 },
  { brand: 'Ниссо', model: 'Кашкай-С', segment: 'mid', bodyType: 'suv', base: 2_280_000 },
  { brand: 'Фольк', model: 'Тигуан-Ф', segment: 'mid', bodyType: 'suv', base: 2_950_000 },
  { brand: 'Фольк', model: 'Пассат-Бизнес', segment: 'mid', bodyType: 'sedan', base: 2_400_000 },
  { brand: 'Кира', model: 'Спортейдж-Н', segment: 'mid', bodyType: 'suv', base: 2_550_000 },
  { brand: 'Хёнда', model: 'Туссан', segment: 'mid', bodyType: 'suv', base: 2_620_000 },
  { brand: 'Митсу', model: 'Аутлендер', segment: 'mid', bodyType: 'suv', base: 2_350_000 },
  { brand: 'Субару-Н', model: 'Форестер', segment: 'mid', bodyType: 'suv', base: 2_700_000 },
  { brand: 'Хонда-С', model: 'ЦР-В', segment: 'mid', bodyType: 'suv', base: 2_800_000 },
  // ——— Премиум ———
  { brand: 'Бэха', model: 'Пятый ряд', segment: 'premium', bodyType: 'sedan', base: 4_600_000 },
  { brand: 'Бэха', model: 'Х5-Неон', segment: 'premium', bodyType: 'suv', base: 6_200_000 },
  { brand: 'Бэха', model: 'Третий ряд', segment: 'premium', bodyType: 'sedan', base: 3_400_000 },
  { brand: 'Мерс', model: 'Е-Класс', segment: 'premium', bodyType: 'sedan', base: 5_100_000 },
  { brand: 'Мерс', model: 'ГЛЕ-Купе', segment: 'premium', bodyType: 'suv', base: 6_800_000 },
  { brand: 'Мерс', model: 'С-Класс', segment: 'premium', bodyType: 'sedan', base: 9_500_000 },
  { brand: 'Аудиум', model: 'Ку-7', segment: 'premium', bodyType: 'suv', base: 5_600_000 },
  { brand: 'Аудиум', model: 'А6-Бизнес', segment: 'premium', bodyType: 'sedan', base: 4_200_000 },
  { brand: 'Лексор', model: 'РХ-Нео', segment: 'premium', bodyType: 'suv', base: 5_300_000 },
  { brand: 'Лексор', model: 'ЕС-350', segment: 'premium', bodyType: 'sedan', base: 4_400_000 },
  { brand: 'Ровер', model: 'Рэйндж', segment: 'premium', bodyType: 'suv', base: 7_800_000 },
  { brand: 'Вольво-С', model: 'ХС90', segment: 'premium', bodyType: 'suv', base: 5_900_000 },
  { brand: 'Инфинити-Н', model: 'QX80', segment: 'premium', bodyType: 'suv', base: 6_400_000 },
  { brand: 'Порш', model: 'Кайен', segment: 'premium', bodyType: 'suv', base: 8_900_000 },
  // ——— Спорт ———
  { brand: 'Ниссо', model: 'ГТ-Р «Годзилла»', segment: 'sport', bodyType: 'coupe', base: 9_200_000 },
  { brand: 'Порш', model: '911 Турбо-Н', segment: 'sport', bodyType: 'coupe', base: 14_500_000 },
  { brand: 'Порш', model: '718 Бокстер', segment: 'sport', bodyType: 'roadster', base: 7_200_000 },
  { brand: 'Тойо', model: 'Супра-90', segment: 'sport', bodyType: 'coupe', base: 7_800_000 },
  { brand: 'Бэха', model: 'М-Четыре', segment: 'sport', bodyType: 'coupe', base: 8_200_000 },
  { brand: 'Бэха', model: 'М2 Компет', segment: 'sport', bodyType: 'coupe', base: 6_500_000 },
  { brand: 'Мазза', model: 'РХ-Семь', segment: 'sport', bodyType: 'coupe', base: 3_600_000 },
  { brand: 'Мазза', model: 'МХ-5 Родстер', segment: 'sport', bodyType: 'roadster', base: 2_800_000 },
  { brand: 'Форд-Н', model: 'Мустанг GT', segment: 'sport', bodyType: 'coupe', base: 5_400_000 },
  { brand: 'Шевро-Н', model: 'Камаро SS', segment: 'sport', bodyType: 'coupe', base: 5_100_000 },
  { brand: 'Ягуар-Н', model: 'Ф-Тайп', segment: 'sport', bodyType: 'coupe', base: 6_800_000 },
  { brand: 'Аудиум', model: 'РС5', segment: 'sport', bodyType: 'coupe', base: 7_400_000 },
  // ——— Гипер / Люкс ———
  { brand: 'Ламбо-Н', model: 'Ураган', segment: 'hyper', bodyType: 'coupe', base: 22_000_000 },
  { brand: 'Ламбо-Н', model: 'Авента SV', segment: 'hyper', bodyType: 'coupe', base: 38_000_000 },
  { brand: 'Феррари-Н', model: '488 Писта', segment: 'hyper', bodyType: 'coupe', base: 28_000_000 },
  { brand: 'Феррари-Н', model: 'СФ90', segment: 'hyper', bodyType: 'coupe', base: 42_000_000 },
  { brand: 'Макларен-Н', model: '720S', segment: 'hyper', bodyType: 'coupe', base: 26_000_000 },
  { brand: 'Бугатти-Н', model: 'Широн-Н', segment: 'hyper', bodyType: 'coupe', base: 95_000_000 },
  { brand: 'Роллс-Н', model: 'Фантом-Н', segment: 'hyper', bodyType: 'sedan', base: 48_000_000 },
  { brand: 'Бентли-Н', model: 'Континенталь GT', segment: 'hyper', bodyType: 'coupe', base: 24_000_000 },
  { brand: 'Астон-Н', model: 'DB11', segment: 'hyper', bodyType: 'coupe', base: 18_000_000 },
  // ——— Легенда: орбитальный родстер ———
  { brand: 'Тесла-Н', model: 'Роадстер «Орбита»', segment: 'hyper', bodyType: 'roadster', base: 90_000_000 },
]

export const COLORS = [
  'Чёрный металлик',
  'Белый перламутр',
  'Серебро',
  'Вишня',
  'Синий неон',
  'Мокрый асфальт',
  'Баклажан',
  'Зелёный хамелеон',
  'Оранжевый',
  'Графит',
]

export const FIRST_NAMES = [
  'Валера',
  'Гоша',
  'Михалыч',
  'Артур',
  'Света',
  'Олег',
  'Зураб',
  'Наталья',
  'Дэн',
  'Ашот',
  'Игорёк',
  'Тимур',
  'Петрович',
  'Лиза',
  'Руслан',
  'Карина',
  'Семён',
  'Борис',
]

export const NICKNAMES: Record<SellerType, string[]> = {
  honest: ['с завода', 'таксист', 'пенсионер', 'учительница', 'дальнобой', 'семьянин'],
  cunning: ['Перекуп', 'Автоподбор', 'с рынка', 'Шустрый', 'Дилер-самоучка'],
  shady: ['Тень', 'Без фамилии', 'Из гаражей', 'Ночной', 'Серый'],
}

export const SELLER_QUOTES: Record<SellerType, string[]> = {
  honest: [
    'Машина как родная, обслуживал строго по регламенту.',
    'Продаю, потому что купил семейный минивэн. Всё честно.',
    'Есть пару мелочей, скрывать не буду.',
    'Сам ездил, жена ездила. Не бита, не крашена.',
  ],
  cunning: [
    'Брат, такой машины больше нет! Бери не думай.',
    'Пробег родной, клянусь. Немец сам ездил.',
    'Торг уместен… но небольшой. У меня ещё трое на очереди.',
    'Свежий привоз, ни одной царапины. Ну почти.',
  ],
  shady: [
    'Документы? Будут. Потом. Может быть.',
    'Не спрашивай откуда. Бери за полцены.',
    'Только наличка и только сегодня.',
    'Номера не смотри, они временные.',
  ],
}

export const DEFECT_TEMPLATES: Record<Zone, string[]> = {
  engine: ['Масложор', 'Стук гидрокомпенсаторов', 'Течь прокладки ГБЦ', 'Растянута цепь ГРМ', 'Пинки АКПП'],
  body: ['Скрытая ржавчина порогов', 'Шпаклёвка на крыле', 'Следы ДТП на лонжероне', 'Перекрашенная дверь', 'Гнилые арки'],
  interior: ['Прожжённое сиденье', 'Затёртый руль (скрутка?)', 'Запах сырости', 'Сломанный климат', 'Трещина торпеды'],
  suspension: ['Убиты амортизаторы', 'Люфт рулевой рейки', 'Стук ШРУСа', 'Изношены сайлентблоки', 'Кривой диск'],
  electrics: ['Глючит ЭБУ', 'Мёртвый аккумулятор', 'Не работает фара', 'Ошибки ABS', 'Скрутка одометра'],
  documents: ['Залог в банке', 'Перебитый VIN', 'Ограничение на регистрацию', 'Дубликат ПТС', 'Несовпадение номера двигателя'],
}

const BASE_PARTS: PartDef[] = [
  { id: 'oil-kit', name: 'Комплект ТО (масло+фильтры)', category: 'engine', tier: 1, basePrice: 4_500, repairAmount: 15, description: 'Восстанавливает двигатель на 15%' },
  { id: 'timing-kit', name: 'Комплект ГРМ', category: 'engine', tier: 2, basePrice: 18_000, repairAmount: 35, description: 'Серьёзный ремонт мотора, +35%' },
  { id: 'contract-engine', name: 'Контрактный мотор', category: 'engine', tier: 3, basePrice: 120_000, repairAmount: 100, description: 'Полная замена двигателя' },
  { id: 'turbo', name: 'Турбо-кит «Неон»', category: 'engine', tier: 3, basePrice: 185_000, repairAmount: 0, tuning: 'engine', description: 'Тюнинг двигателя +1 уровень' },
  { id: 'tires-cheap', name: 'Шины «Китайский бюджет»', category: 'tires', tier: 1, basePrice: 12_000, repairAmount: 20, description: 'Подвеска +20%' },
  { id: 'tires-pro', name: 'Шины «Мишлень-Про»', category: 'tires', tier: 2, basePrice: 32_000, repairAmount: 40, description: 'Подвеска +40%' },
  { id: 'shocks', name: 'Амортизаторы', category: 'suspension', tier: 2, basePrice: 28_000, repairAmount: 45, description: 'Подвеска +45%' },
  { id: 'coilovers', name: 'Койловеры «Street»', category: 'suspension', tier: 3, basePrice: 95_000, repairAmount: 30, tuning: 'suspension', description: 'Тюнинг подвески +1, подвеска +30%' },
  { id: 'paint', name: 'Набор кузовного ремонта', category: 'body', tier: 1, basePrice: 18_000, repairAmount: 30, description: 'Кузов +30%' },
  { id: 'panel-set', name: 'Новые кузовные панели', category: 'body', tier: 2, basePrice: 65_000, repairAmount: 60, description: 'Кузов +60%' },
  { id: 'bodykit', name: 'Обвес «Синтвейв»', category: 'body', tier: 3, basePrice: 85_000, repairAmount: 10, tuning: 'visual', description: 'Визуал +1 уровень, кузов +10%' },
  { id: 'battery', name: 'Аккумулятор + проводка', category: 'electrics', tier: 1, basePrice: 8_500, repairAmount: 30, description: 'Электрика +30%' },
  { id: 'ecu', name: 'Новый ЭБУ', category: 'electrics', tier: 2, basePrice: 45_000, repairAmount: 65, description: 'Электрика +65%' },
  { id: 'neon-light', name: 'Неоновая подсветка днища', category: 'electrics', tier: 2, basePrice: 15_000, repairAmount: 0, tuning: 'visual', description: 'Визуал +1 уровень' },
  { id: 'chem', name: 'Химчистка салона', category: 'interior', tier: 1, basePrice: 5_500, repairAmount: 25, description: 'Салон +25%' },
  { id: 'leather', name: 'Перетяжка в кожу', category: 'interior', tier: 2, basePrice: 55_000, repairAmount: 60, description: 'Салон +60%' },
  { id: 'air-tanks', name: 'Воздушные баки «Орбита»', category: 'electrics', tier: 3, basePrice: 2_500_000, repairAmount: 0, description: 'Только для Тесла Роадстер: +1 уровень полёта (до 3)' },
]


export const MODELS: (ModelDef & { rarity?: number })[] = [...BASE_MODELS, ...NEW_MODELS]

export const PARTS: PartDef[] = [...BASE_PARTS, ...EXTRA_PARTS]

export const PART_ZONE: Record<PartDef['category'], Zone> = {
  engine: 'engine',
  tires: 'suspension',
  suspension: 'suspension',
  body: 'body',
  electrics: 'electrics',
  interior: 'interior',
}

export const RIVALS: Rival[] = [
  { id: 'r1', name: 'Жора «Бульдог»', aggression: 0.7, budget: 1.25, tagline: 'Беру всё, что едет' },
  { id: 'r2', name: 'Марина Автоподбор', aggression: 0.45, budget: 1.1, tagline: 'Только чистые тачки' },
  { id: 'r3', name: 'Дядя Вахтанг', aggression: 0.85, budget: 1.4, tagline: 'Деньги не проблема' },
  { id: 'r4', name: 'Стас Флиппер', aggression: 0.55, budget: 1.05, tagline: 'Быстро купил — быстро продал' },
]

export const LICENSE_LEVELS = [
  { title: 'Без лицензии', perk: 'Доступ к бюджетным и средним машинам' },
  { title: 'Нотариус I', perk: 'Проверка VIN, премиум-сегмент' },
  { title: 'Нотариус II', perk: 'Спорткары и банковские аукционы' },
  { title: 'Мастер-нотариус', perk: 'Гиперкары, Роадстер, +10% к продаже, VIP' },
  { title: 'Старший нотариус', perk: 'Легализация дорогих машин проходит заметно надёжнее' },
  { title: 'Нотариус-легенда', perk: 'Максимальный престиж: легализует практически любой транспорт' },
]

/** Стоимость экзаменов по этапам лицензии (0→1, 1→2, …) */
export const EXAM_FEES = [15_000, 55_000, 160_000, 450_000, 1_200_000]

/** Минимальный уровень лицензии, чтобы пытаться залегализовать машину сегмента */
export const SEGMENT_LICENSE_REQ: Record<string, number> = {
  junk: 0,
  budget: 0,
  mid: 1,
  premium: 2,
  sport: 3,
  hyper: 4,
}

export const LICENSE_FAIL_MESSAGE = 'Вашего опыта в нотариусе не хватает, чтобы залицензировать этот транспорт'

export const RANK_TITLES = [
  'Новичок с гаражом',
  'Барыга с района',
  'Перекуп-любитель',
  'Уверенный флиппер',
  'Автоподборщик',
  'Король авторынка',
  'Акула перепродаж',
  'Магнат стоянок',
  'Легенда автобарахолки',
  'Неоновый барон',
]

export const UPGRADE_DEFS = {
  slots: {
    label: 'Расширение стоянки',
    max: 28,
    describe: (lvl: number) => `${lvl + 2} мест из 30 · бетонированная площадка`,
    cost: (lvl: number) => Math.round(120_000 * Math.pow(1.42, lvl)),
  },
  cleanliness: {
    label: 'Мойка и детейлинг',
    max: 6,
    describe: (lvl: number) => `+${lvl * 3}% к предложениям покупателей`,
    cost: (lvl: number) => 85_000 * (lvl + 1) * (lvl + 1),
  },
  tools: {
    label: 'Диагностика и инструмент',
    max: 4,
    describe: (lvl: number) =>
      ['Базовый набор', 'OBD-сканер', 'Толщиномер ЛКП', 'Эндоскоп мотора', 'Пост диагностики'][lvl],
    cost: (lvl: number) => [150_000, 420_000, 980_000, 2_200_000][lvl] ?? 0,
  },
  security: {
    label: 'Охрана стоянки',
    max: 6,
    describe: (lvl: number) =>
      [
        'Нет охраны — риск налётов',
        'Сторожевой пёс',
        'Камеры по периметру',
        'Охранник с рацией',
        'ЧОП «Стальной двор»',
        'Лазерная сигнализация',
        'Вооружённый пост 24/7',
      ][lvl],
    cost: (lvl: number) => [180_000, 450_000, 980_000, 2_100_000, 4_500_000, 9_500_000][lvl] ?? 0,
  },
  office: {
    label: 'Офис нотариуса',
    max: 4,
    describe: (lvl: number) =>
      ['Стол и печать', 'Архив ПТС', 'Связи в ГАИ', 'Штатный юрист', 'Премиум-нотариат'][lvl],
    cost: (lvl: number) => [200_000, 550_000, 1_400_000, 3_200_000][lvl] ?? 0,
  },
} as const

export { LOOK_CATALOG, FREE_LOOKS, LOOK_COLOR_COST } from './content'
export { ACHIEVEMENTS, TIER_LABELS, THIEF_NAMES, BLACK_SELLERS, ACHIEVEMENT_REWARD_CAP, garageLevelOf } from './content'

export const MUSIC_TRACKS = [
  { id: 'neon', title: 'Неоновый въезд', mood: 'Синтвейв', bpm: 100 },
  { id: 'night', title: 'Ночной гараж', mood: 'Лоу-фай', bpm: 76 },
  { id: 'fog', title: 'Туман на МКАД', mood: 'Эмбиент', bpm: 60 },
  { id: 'chase', title: 'Погоня за лотом', mood: 'Драйв', bpm: 118 },
  { id: 'funk', title: 'Фонк с Автозавода', mood: 'Фонк', bpm: 140 },
  { id: 'rain', title: 'Дождь на крыше', mood: 'Лоу-фай', bpm: 82 },
  { id: 'bazaar', title: 'Утро на авторыке', mood: 'Чилл', bpm: 92 },
  { id: 'voltage', title: 'Высокое напряжение', mood: 'Синтвейв', bpm: 108 },
  { id: 'asphalt', title: 'Горячий асфальт', mood: 'Фонк', bpm: 132 },
  { id: 'papers', title: 'Печать в ПТС', mood: 'Эмбиент', bpm: 70 },
  { id: 'deal', title: 'Сделка за кеш', mood: 'Хип-хоп бит', bpm: 96 },
  { id: 'highway', title: 'Трасса М-11', mood: 'Драйв', bpm: 124 },
  { id: 'warehouse', title: 'Склад запчастей', mood: 'Индастриал', bpm: 105 },
  { id: 'sunset', title: 'Закат над стоянкой', mood: 'Синтвейв', bpm: 98 },
] as const


export const DONATE_PACKS = [
  { id: 'pack_50', rub: 99, coins: 200_000, label: 'Старт' },
  { id: 'pack_100', rub: 299, coins: 800_000, label: 'Перекуп' },
  { id: 'pack_500', rub: 899, coins: 6_000_000, label: 'Магнат' },
] as const

export const CURRENCY_NAME = 'Рубли'
export const CURRENCY_SHORT = '₽'


export const DIFFICULTY_DEFS = {
  easy: { id: 'easy' as const, label: 'Лёгкий', moneyMul: 1.25, priceMul: 0.9, riskMul: 0.7, startBonus: 150_000 },
  normal: { id: 'normal' as const, label: 'Обычный', moneyMul: 1, priceMul: 1, riskMul: 1, startBonus: 0 },
  hard: { id: 'hard' as const, label: 'Сложный', moneyMul: 0.9, priceMul: 1.1, riskMul: 1.25, startBonus: 0 },
  brutal: { id: 'brutal' as const, label: 'Жёсткий', moneyMul: 0.8, priceMul: 1.2, riskMul: 1.5, startBonus: 0 },
  legend: { id: 'legend' as const, label: 'Легенда', moneyMul: 0.7, priceMul: 1.35, riskMul: 1.8, startBonus: 0 },
}

/** Порядок открытия сложностей и цели (суммарная прибыль) для прохождения */
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'brutal', 'legend'] as const
export const DIFFICULTY_GOALS: Record<string, number> = { easy: 3_000_000, normal: 15_000_000, hard: 60_000_000, brutal: 200_000_000, legend: Infinity }
/** Дополнительный износ машин у ворот (в пунктах состояния) и множитель пробега */
export const DIFFICULTY_WEAR: Record<string, { points: number; mileage: number }> = {
  easy: { points: 0, mileage: 1 }, normal: { points: 4, mileage: 1.1 }, hard: { points: 10, mileage: 1.3 },
  brutal: { points: 17, mileage: 1.55 }, legend: { points: 25, mileage: 1.9 },
}

export const LOAN_TIERS = [
  { amount: 100_000, rate: 0.04, days: 3, elite: false },
  { amount: 300_000, rate: 0.05, days: 6, elite: false },
  { amount: 500_000, rate: 0.06, days: 9, elite: false },
  { amount: 1_000_000, rate: 0.035, days: 12, elite: true },
  { amount: 1_500_000, rate: 0.035, days: 15, elite: true },
  { amount: 2_000_000, rate: 0.03, days: 18, elite: true },
] as const

export const PAINT_COLORS = ['Чёрный', 'Белый', 'Серебристый', 'Вишнёвый', 'Синий', 'Асфальт', 'Баклажан', 'Хамелеон', 'Оранжевый', 'Графит']
export const PAINT_COST = 5_000

export const DAILY_REWARDS = [
  { day: 1, coins: 8_000, label: 'Стартовый кеш' },
  { day: 2, coins: 12_000, label: 'Поддержка рынка' },
  { day: 3, coins: 18_000, label: 'Удачная смена' },
  { day: 4, coins: 28_000, label: 'Оборот' },
  { day: 5, coins: 40_000, label: 'Редкий контейнер запчастей', parts: true },
  { day: 6, coins: 55_000, label: 'Ночной кеш' },
  { day: 7, coins: 90_000, label: 'Джекпот недели' },
] as const
