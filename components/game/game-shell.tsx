'use client'

import { useEffect, useState } from 'react'
import { GameProvider, useGame } from '@/lib/game/store'
import { LocaleProvider } from '@/lib/i18n'
import { ThemeProvider } from '@/lib/theme'
import { EnvironmentProvider, useEnv } from '@/lib/environment'
import { SettingsProvider } from '@/lib/settings'
import { Tutorial } from './tutorial'
import { GarageStudio } from './tabs/garage-studio'
import { TabBackdrop } from './car3d/tab-backdrop'
import type { TabId } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { BottomNav } from './bottom-nav'
import { Hud } from './hud'
import { getSynth } from '@/lib/game/audio'
import { garageLevelOf } from '@/lib/game/data'
import { MusicPlayer } from './music-player'
import { AboutTab } from './tabs/about-tab'
import { AuctionTab } from './tabs/auction-tab'
import { GarageTab } from './tabs/garage-tab'
import { LotTab } from './tabs/lot-tab'
import { MarketTab } from './tabs/market-tab'
import { ProfileTab } from './tabs/profile-tab'
import { Toasts } from './toasts'
import { AuthGate } from './auth-gate'
import { DailyRewardModal } from './daily-reward'
import { TestDriveOverlay } from './test-drive'
import { WeatherOverlay } from './weather-overlay'

const PHASE_TINT = {
  morning: 'from-warn/15 via-transparent to-transparent',
  day: 'from-neon/12 via-transparent to-transparent',
  evening: 'from-magenta/20 via-magenta/5 to-transparent',
  night: 'from-background via-background to-transparent',
} as const

function Screen() {
  const { state } = useGame()
  const env = useEnv()
  const [tab, setTabRaw] = useState<TabId>('home')
  const [dir, setDir] = useState<'right' | 'left'>('right')
  const TAB_ORDER: TabId[] = ['home', 'garage', 'lot', 'auction', 'market', 'profile', 'about']
  const setTab = (next: TabId) => {
    if (next === tab) return
    setDir(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 'right' : 'left')
    setTabRaw(next)
  }
  const [musicOpen, setMusicOpen] = useState(false)
  const [authDone, setAuthDone] = useState(false)

  // Ambient music: respect profile toggle, start on first user gesture if needed
  useEffect(() => {
    const preferred = () => localStorage.getItem('avto-notarius-music') !== 'off'
    const tryPlay = () => {
      if (!preferred()) {
        getSynth().stop()
        return
      }
      try {
        getSynth().setVolume(0.35)
        getSynth().play(state.phase === 'night' ? 'night' : state.phase === 'evening' ? 'chase' : state.phase === 'morning' ? 'fog' : 'neon')
      } catch {
        /* autoplay blocked until gesture */
      }
    }
    tryPlay()
    const onToggle = (e: Event) => {
      const on = (e as CustomEvent<boolean>).detail
      if (on) tryPlay()
      else getSynth().stop()
    }
    window.addEventListener('avto-music-toggle', onToggle as EventListener)
    const unlock = () => {
      tryPlay()
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => {
      window.removeEventListener('avto-music-toggle', onToggle as EventListener)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [state.phase])


  return (
    <div
      className={cn(
        'relative flex h-dvh w-full flex-col overflow-hidden bg-background garage-grid pt-[max(env(safe-area-inset-top),0.35rem)]',
        'sm:aspect-[9/16] sm:h-[calc(100dvh-2rem)] sm:w-auto sm:rounded-[2rem] sm:border sm:border-border sm:shadow-2xl',
      )}
    >
      <TabBackdrop tab={tab} phase={env.phaseOf(state.phase)} garageLevel={garageLevelOf(state.upgrades)} />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-b transition-colors duration-1000', PHASE_TINT[state.phase])} aria-hidden />
      {state.phase === 'night' && <div className="pointer-events-none absolute inset-0 bg-background/40" aria-hidden />}
      <WeatherOverlay weather={env.weatherOf(state.weather)} />

      <Hud onOpenMusic={() => setMusicOpen(true)} />

      <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-4 pt-2 scrollbar-none">
        <div key={tab} className={dir === 'right' ? 'tab-enter-right' : 'tab-enter-left'}>
          {tab === 'home' && <GarageTab onNavigate={setTab} />}
          {tab === 'garage' && <GarageStudio onNavigate={setTab} />}
          {tab === 'lot' && <LotTab onNavigate={setTab} />}
          {tab === 'auction' && <AuctionTab />}
          {tab === 'market' && <MarketTab />}
          {tab === 'profile' && <ProfileTab />}
          {tab === 'about' && <AboutTab />}
        </div>
      </div>

      <BottomNav active={tab} onChange={setTab} lotCount={state.lot.length} clientCount={state.clients.length} />
      <Toasts />
      <MusicPlayer open={musicOpen} onClose={() => setMusicOpen(false)} phase={state.phase} />
      {!authDone && !state.authUser && <AuthGate onSkip={() => setAuthDone(true)} />}
      <DailyRewardModal />
      <TestDriveOverlay />
    </div>
  )
}

export function GameShell() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <EnvironmentProvider>
          <LocaleProvider>
            <GameProvider>
              <Screen />
              <Tutorial />
            </GameProvider>
          </LocaleProvider>
        </EnvironmentProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}
