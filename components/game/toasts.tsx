'use client'

import { useCallback, useEffect } from 'react'
import { useGame } from '@/lib/game/store'
import type { Toast } from '@/lib/game/types'
import { cn } from '@/lib/utils'

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 3200)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <li>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={cn(
          'toast-in w-full rounded-xl border bg-card/95 px-3 py-2 text-left text-xs font-medium shadow-lg backdrop-blur',
          toast.tone === 'good' && 'border-success/50 text-success',
          toast.tone === 'bad' && 'border-destructive/50 text-destructive',
          toast.tone === 'info' && 'border-neon/40 text-foreground',
        )}
      >
        {toast.message}
      </button>
    </li>
  )
}

export function Toasts() {
  const { state, dispatch } = useGame()
  const dismiss = useCallback((id: string) => dispatch({ type: 'DISMISS_TOAST', id }), [dispatch])
  return (
    <ul aria-live="polite" className="pointer-events-auto absolute inset-x-3 top-24 z-50 flex flex-col gap-1.5">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </ul>
  )
}
