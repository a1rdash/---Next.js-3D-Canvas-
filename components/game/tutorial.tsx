'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

/** Мини-схема кнопок управления для шага про вождение */
function ControlsDiagram() {
  const pill = 'grid place-items-center rounded-full border border-white/30 bg-white/15 text-white'
  return (
    <div className="relative mx-auto mt-2 flex h-28 w-full max-w-xs items-end justify-between rounded-xl border border-border bg-[#0b1020] p-3" aria-hidden>
      <div className="flex gap-2">
        <div className="flex flex-col items-center gap-1"><span className={cn(pill, 'size-11 text-lg')}>◀</span><span className="text-[10px] text-muted-foreground">влево</span></div>
        <div className="flex flex-col items-center gap-1"><span className={cn(pill, 'size-11 text-lg')}>▶</span><span className="text-[10px] text-muted-foreground">вправо</span></div>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col items-center gap-1"><span className={cn(pill, 'size-11 bg-rose-500/40 text-xs font-bold')}>СТОП</span><span className="text-[10px] text-muted-foreground">тормоз</span></div>
        <div className="flex flex-col items-center gap-1"><span className={cn(pill, 'size-14 bg-emerald-400/40 text-xs font-bold')}>ГАЗ</span><span className="text-[10px] text-muted-foreground">держать</span></div>
      </div>
    </div>
  )
}

const STEPS: { title: string; body: string[]; extra?: 'controls' }[] = [
  {
    title: 'Добро пожаловать, перекуп!',
    body: [
      'Цель игры: покупать машины подешевле, улучшать и продавать дороже. Зарабатывайте деньги, репутацию и опыт.',
      'Следите за состоянием машины: чем сильнее износ, тем ниже цена и хуже скорость.',
    ],
  },
  {
    title: 'Как устроена игра',
    body: [
      'Главная: клиенты и задачи. Гараж: тюнинг, покраска и осмотр последней машины. Стоянка: все ваши машины.',
      'Аукцион и чёрный рынок: выгодные лоты. Рынок: запчасти, ателье, улучшения и банк. Профиль: лицензия нотариуса, достижения, настройки.',
    ],
  },
  {
    title: 'Управление на тест-драйве',
    body: [
      'Удерживайте ГАЗ: скорость плавно растёт до максимума машины. Отпустили газ: машина катится и замедляется.',
      'ВЛЕВО и ВПРАВО держите одновременно с газом (два пальца). ТОРМОЗ останавливает машину.',
      'На компьютере: W или ↑ — газ, S или ↓ — тормоз, A/D или ←/→ — повороты.',
    ],
    extra: 'controls',
  },
  {
    title: 'Правила дороги',
    body: [
      'На красный светофор останавливайтесь полностью. Пешеходов пропускайте: они переходят на красный для машин.',
      'Уступайте дорогу полиции, скорой и пожарным. Нарушения и аварии дают штрафы и износ машины.',
    ],
  },
  {
    title: 'Лицензия нотариуса',
    body: [
      'В Профиле сдавайте экзамены: чем выше этап лицензии, тем дороже машины вы сможете легально оформить.',
      'Этап выбираете сами; можно потренироваться бесплатно. Это обучение можно открыть снова в Профиле → Настройки.',
    ],
  },
]

/** Интерактивный гайд для новичков: показывается при первом запуске, его можно пропустить или пересмотреть в профиле. */
export function Tutorial() {
  const { tutorialOpen, closeTutorial } = useSettings()
  const [i, setI] = useState(0)
  if (!tutorialOpen) return null
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const close = () => {
    setI(0)
    closeTutorial()
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Обучение" className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-neon/40 bg-card p-4 shadow-2xl neon-glow">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg leading-tight text-neon">{step.title}</p>
          <button type="button" onClick={close} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground" aria-label="Пропустить обучение">
            Пропустить <X className="size-3.5" aria-hidden />
          </button>
        </div>
        <div className="mt-3 space-y-2 text-sm leading-relaxed">
          {step.body.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
        {step.extra === 'controls' && <ControlsDiagram />}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Шаг ${i + 1} из ${STEPS.length}`}>
            {STEPS.map((_, k) => (
              <span key={k} className={cn('size-2 rounded-full', k === i ? 'bg-neon' : 'bg-muted')} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-border text-muted-foreground disabled:opacity-30" aria-label="Назад">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => (last ? close() : setI(i + 1))} className="flex min-h-10 items-center gap-1 rounded-xl bg-neon px-4 text-sm font-bold text-primary-foreground">
              {last ? 'Начать игру' : 'Далее'} {!last && <ChevronRight className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
