'use client'

import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSynth, type TrackId } from '@/lib/game/audio'
import { MUSIC_TRACKS } from '@/lib/game/data'
import type { Phase } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { Sheet } from './ui'

const PHASE_TRACK: Record<Phase, TrackId> = {
  morning: 'fog',
  day: 'neon',
  evening: 'chase',
  night: 'night',
}

export function MusicPlayer({ open, onClose, phase }: { open: boolean; onClose: () => void; phase: Phase }) {
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [autoMood, setAutoMood] = useState(false)
  const track = MUSIC_TRACKS[trackIndex]

  useEffect(() => {
    if (!autoMood) return
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === PHASE_TRACK[phase])
    if (idx >= 0) {
      setTrackIndex(idx)
      if (playing) getSynth().play(PHASE_TRACK[phase])
    }
  }, [phase, autoMood, playing])

  useEffect(() => () => getSynth().stop(), [])

  const playTrack = (idx: number) => {
    setTrackIndex(idx)
    setPlaying(true)
    getSynth().play(MUSIC_TRACKS[idx].id as TrackId)
  }

  const toggle = () => {
    if (playing) {
      getSynth().stop()
      setPlaying(false)
    } else playTrack(trackIndex)
  }

  const step = (dir: number) => playTrack((trackIndex + dir + MUSIC_TRACKS.length) % MUSIC_TRACKS.length)

  return (
    <Sheet open={open} onClose={onClose} title="Гаражное радио «Неон FM»">
      <div className="rounded-2xl border border-magenta/40 bg-gradient-to-br from-magenta/20 via-card to-neon/10 p-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Сейчас в эфире</p>
        <p className="mt-1 font-display text-lg text-foreground">{track?.title}</p>
        <p className="text-xs text-muted-foreground">
          {track?.mood} · {track?.bpm} BPM
        </p>
        <div className="mt-3 flex h-10 items-end justify-center gap-1">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className={cn('w-1.5 rounded-sm bg-neon/70 transition-all duration-300', playing ? 'animate-pulse' : 'opacity-30')}
              style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${(i % 6) * 120}ms` }}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={() => step(-1)} className="rounded-full p-2 text-foreground hover:bg-muted" aria-label="Предыдущий трек">
            <SkipBack className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex size-14 items-center justify-center rounded-full bg-magenta text-accent-foreground magenta-glow"
            aria-label={playing ? 'Пауза' : 'Играть'}
          >
            {playing ? <Pause className="size-6" /> : <Play className="size-6 translate-x-0.5" />}
          </button>
          <button type="button" onClick={() => step(1)} className="rounded-full p-2 text-foreground hover:bg-muted" aria-label="Следующий трек">
            <SkipForward className="size-5" />
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="size-4" aria-hidden />
          <span className="sr-only">Громкость</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value)
              setVolume(v)
              getSynth().setVolume(v)
            }}
            className="flex-1 accent-magenta"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center justify-between rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm">
        <span>
          Авто-настроение
          <span className="block text-[11px] text-muted-foreground">Трек меняется со временем суток</span>
        </span>
        <input type="checkbox" checked={autoMood} onChange={(e) => setAutoMood(e.target.checked)} className="size-5 accent-neon" />
      </label>

      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto scrollbar-none">
        {MUSIC_TRACKS.map((tr, i) => (
          <li key={tr.id}>
            <button
              type="button"
              onClick={() => playTrack(i)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs',
                i === trackIndex ? 'bg-neon/15 text-neon' : 'hover:bg-muted',
              )}
            >
              <span className="font-semibold">{tr.title}</span>
              <span className="text-muted-foreground">{tr.bpm} BPM</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
