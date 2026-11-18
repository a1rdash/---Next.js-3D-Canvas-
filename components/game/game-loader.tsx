'use client'

import dynamic from 'next/dynamic'

const GameShell = dynamic(() => import('./game-shell').then((m) => m.GameShell), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[9/16] h-dvh max-h-dvh w-full max-w-[min(100vw,calc(100dvh*9/16))] items-center justify-center sm:h-[calc(100dvh-2rem)] sm:rounded-3xl sm:border sm:border-border">
      <p className="font-display text-xl text-neon neon-text">Заводим мотор…</p>
    </div>
  ),
})

export function GameLoader() {
  return <GameShell />
}
