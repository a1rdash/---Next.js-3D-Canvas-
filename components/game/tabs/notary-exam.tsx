'use client'

import { useState } from 'react'
import { EXAM_FEES, LICENSE_LEVELS } from '@/lib/game/data'
import { buildExam, type ExamQuestion } from '@/lib/game/exams'
import { formatMoney } from '@/lib/game/random'
import { useGame } from '@/lib/game/store'
import { cn } from '@/lib/utils'
import { NeonButton, Sheet } from '../ui'

/**
 * Экзамены нотариуса «по своему усмотрению»: игрок сам выбирает этап (можно перескакивать через уровни),
 * может потренироваться бесплатно. Это игра: 5 вопросов, нужно 3 верных, после каждого ответа показывается
 * пояснение, есть подсказка 50/50, а провал стоит только половину сбора.
 */
type Mode = { stage: number; practice: boolean }

const PASS_NEED = 3

export function NotaryExam() {
  const { state, dispatch } = useGame()
  const [mode, setMode] = useState<Mode | null>(null)
  const [qs, setQs] = useState<ExamQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [hidden, setHidden] = useState<number[]>([])
  const [lifeline, setLifeline] = useState(true)
  const [result, setResult] = useState<{ passed: boolean; correct: number } | null>(null)

  const start = (stage: number, practice: boolean) => {
    if (!practice && state.money < EXAM_FEES[stage - 1]) return
    setMode({ stage, practice })
    setQs(buildExam(stage - 1))
    setIdx(0)
    setCorrect(0)
    setPicked(null)
    setHidden([])
    setLifeline(true)
    setResult(null)
  }

  const close = () => {
    setMode(null)
    setResult(null)
  }

  const q = qs[idx]

  const pick = (i: number) => {
    if (picked !== null || !q) return
    setPicked(i)
    if (i === q.correct) setCorrect((c) => c + 1)
  }

  const fifty = () => {
    if (!lifeline || picked !== null || !q) return
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correct)
    setHidden(wrong.sort(() => Math.random() - 0.5).slice(0, 2))
    setLifeline(false)
  }

  const next = () => {
    if (!mode) return
    if (idx + 1 < qs.length) {
      setIdx(idx + 1)
      setPicked(null)
      setHidden([])
      return
    }
    const passed = correct >= PASS_NEED
    if (mode.practice) dispatch({ type: 'PRACTICE_DONE', correct, total: qs.length })
    else dispatch({ type: 'EXAM_RESULT', passed, stage: mode.stage })
    setResult({ passed, correct })
  }

  const stages = LICENSE_LEVELS.map((lv, i) => ({ stage: i, title: lv.title })).filter((s) => s.stage >= 1)

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <p className="text-[11px] text-muted-foreground">
        Выбирайте этап сами: можно сдавать выше текущего и пропускать уровни. {PASS_NEED} верных из 5 — зачёт; провал стоит половину сбора. Тренировка бесплатна.
      </p>
      {stages.map(({ stage, title }) => {
        const owned = state.license >= stage
        const fee = EXAM_FEES[stage - 1]
        return (
          <div key={stage} className={cn('flex items-center gap-2 rounded-xl border p-2 text-xs', owned ? 'border-success/40 bg-success/5' : 'border-border')}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{stage}. {title}{owned ? ' ✓' : ''}</p>
              <p className="text-[10px] text-muted-foreground">{owned ? 'Уже получена' : `Сбор ${formatMoney(fee)}`}</p>
            </div>
            <NeonButton size="sm" tone="ghost" onClick={() => start(stage, true)} aria-label={`Тренировка этапа ${stage}`}>Тренировка</NeonButton>
            {!owned && (
              <NeonButton size="sm" tone="magenta" disabled={state.money < fee} onClick={() => start(stage, false)} aria-label={`Сдать экзамен этапа ${stage}`}>
                Сдать
              </NeonButton>
            )}
          </div>
        )
      })}

      {mode && (
        <Sheet open onClose={close} title={result ? (mode.practice ? 'Тренировка завершена' : result.passed ? 'Экзамен сдан!' : 'Экзамен не сдан') : `${mode.practice ? 'Тренировка' : 'Экзамен'} · этап ${mode.stage} · вопрос ${idx + 1}/${qs.length}`}>
          {result ? (
            <div className="space-y-3 text-sm">
              <p>Верных ответов: <b>{result.correct}</b> из {qs.length}.</p>
              {mode.practice ? (
                <p className="text-muted-foreground">Тренировка не меняет лицензию, но даёт немного опыта.</p>
              ) : result.passed ? (
                <p className="text-success">Лицензия повышена до этапа {mode.stage}: «{LICENSE_LEVELS[mode.stage]?.title}».</p>
              ) : (
                <p className="text-warn">Не хватило до зачёта. Потрачена половина сбора. Потренируйтесь и пересдайте.</p>
              )}
              <NeonButton className="w-full" onClick={close}>Готово</NeonButton>
            </div>
          ) : q ? (
            <div>
              <p className="text-sm leading-relaxed">{q.prompt}</p>
              <div className="mt-3 flex flex-col gap-2">
                {q.options.map((opt, i) => {
                  if (hidden.includes(i)) return null
                  const done = picked !== null
                  const tone = !done ? 'ghost' : i === q.correct ? 'success' : i === picked ? 'danger' : 'ghost'
                  return (
                    <NeonButton key={i} tone={tone} className="w-full justify-start text-left" disabled={done && i !== picked && i !== q.correct} onClick={() => pick(i)}>
                      {opt}
                    </NeonButton>
                  )
                })}
              </div>
              {picked !== null && (
                <div className="mt-3 space-y-2">
                  <p className={cn('text-xs', picked === q.correct ? 'text-success' : 'text-warn')}>
                    {picked === q.correct ? 'Верно!' : 'Неверно.'} {q.explanation}
                  </p>
                  <NeonButton className="w-full" onClick={next}>{idx + 1 < qs.length ? 'Дальше' : 'Завершить'}</NeonButton>
                </div>
              )}
              {picked === null && (
                <NeonButton size="sm" tone="ghost" className="mt-3" disabled={!lifeline} onClick={fifty}>Подсказка 50/50{lifeline ? '' : ' (использована)'}</NeonButton>
              )}
            </div>
          ) : null}
        </Sheet>
      )}
    </div>
  )
}
