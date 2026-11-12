import { GameLoader } from '@/components/game/game-loader'

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background sm:p-4">
      <h1 className="sr-only">Авто-Нотариус: Неоновый Перекуп</h1>
      <GameLoader />
    </main>
  )
}
