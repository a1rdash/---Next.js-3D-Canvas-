'use client'

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { createInitialState, gameReducer, type GameAction } from './reducer'
import type { GameState } from './types'

const SAVE_KEY = 'avto-notarius-save-v1'

interface GameContextValue {
  state: GameState
  dispatch: Dispatch<GameAction>
}

const GameContext = createContext<GameContextValue | null>(null)

function loadSaved(): GameState {
  if (typeof window === 'undefined') return createInitialState()
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as GameState
    if (!parsed || typeof parsed.money !== 'number' || !Array.isArray(parsed.lot)) {
      return createInitialState()
    }
    const base = createInitialState()
    const listings = parsed.listings && typeof parsed.listings === 'object' ? parsed.listings : {}
    // migrate old BuyerOffer[] listings → CarListing
    const migratedListings: typeof base.listings = {}
    for (const [id, val] of Object.entries(listings as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        const now = Date.now()
        migratedListings[id] = { offers: val as never, listedAt: now, readyAt: now }
      } else if (val && typeof val === 'object' && 'offers' in (val as object)) {
        migratedListings[id] = val as never
      }
    }
    return {
      ...base,
      ...parsed,
      listings: migratedListings,
      authUser: parsed.authUser ?? null,
      marketSoftLeft: typeof parsed.marketSoftLeft === 'number' ? parsed.marketSoftLeft : 5,
      marketNextSoftAt: typeof parsed.marketNextSoftAt === 'number' ? parsed.marketNextSoftAt : Date.now() + 3 * 60_000,
      marketNextMajorAt: typeof parsed.marketNextMajorAt === 'number' ? parsed.marketNextMajorAt : Date.now() + 24 * 60 * 60_000,
      lastPartsTheftAt: parsed.lastPartsTheftAt ?? 0,
      difficulty: parsed.difficulty ?? 'easy',
      completedDifficulties: Array.isArray(parsed.completedDifficulties) ? parsed.completedDifficulties : [],
      loan: parsed.loan ?? null,
      ownedLooks: Array.isArray(parsed.ownedLooks) ? parsed.ownedLooks : [],
      daily: parsed.daily ?? { streak: 0, lastClaimDay: '' },
      contracts: Array.isArray(parsed.contracts) ? parsed.contracts : [],
      blackMarket:
        Array.isArray(parsed.blackMarket) && parsed.blackMarket.filter((l) => l.status === 'open').length === 4
          ? parsed.blackMarket.filter((l) => l.status === 'open')
          : base.blackMarket,
      stats: { ...base.stats, ...(parsed.stats || {}) },
      pendingDriveCarId: parsed.pendingDriveCarId ?? null,
      googleBonusClaimed: Boolean(parsed.googleBonusClaimed),
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
      
      donateHistory: Array.isArray(parsed.donateHistory) ? parsed.donateHistory : [],

      upgrades: {
        slots: 0,
        cleanliness: 0,
        tools: 0,
        security: 0,
        office: 0,
        ...(parsed.upgrades || {}),
      },

      toasts: [],
      activeClientId: null,
      money: typeof parsed.money === 'number' && parsed.money < 80_000 ? 450_000 : (typeof parsed.money === 'number' ? parsed.money : 450_000),
    }
  } catch {
    return createInitialState()
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadSaved)

  useEffect(() => {
    try {
      const { toasts: _t, ...rest } = state
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...rest, toasts: [] }))
    } catch {
      /* quota / private mode */
    }
  }, [state])

  // Игровая хронология идёт по реальному времени: фаза суток = местные часы, события «нового дня» — по смене даты
  useEffect(() => {
    const sync = () => dispatch({ type: 'SYNC_CLOCK', hour: new Date().getHours(), now: Date.now() })
    sync()
    const id = window.setInterval(sync, 30_000)
    return () => window.clearInterval(id)
  }, [])

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside GameProvider')
  return ctx
}
