import { registerAudioContext } from '@/lib/audio-focus'
export type TrackId = 'neon' | 'night' | 'fog' | 'chase' | 'funk' | 'rain' | 'bazaar' | 'voltage' | 'asphalt' | 'papers' | 'deal' | 'highway' | 'warehouse' | 'sunset'

interface TrackSpec {
  bpm: number
  chords: number[][]
  bassWave: OscillatorType
  padWave: OscillatorType
  arp: boolean
  drums: 'synthwave' | 'lofi' | 'none' | 'driving'
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const TRACKS: Record<TrackId, TrackSpec> = {
  neon: {
    bpm: 100,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ],
    bassWave: 'sawtooth',
    padWave: 'sawtooth',
    arp: true,
    drums: 'synthwave',
  },
  night: {
    bpm: 76,
    chords: [
      [50, 53, 57, 60],
      [55, 59, 62, 65],
      [48, 52, 55, 59],
      [45, 48, 52, 55],
    ],
    bassWave: 'triangle',
    padWave: 'triangle',
    arp: false,
    drums: 'lofi',
  },
  fog: {
    bpm: 60,
    chords: [
      [52, 59, 64, 67],
      [48, 55, 60, 64],
      [50, 57, 62, 65],
      [47, 54, 59, 62],
    ],
    bassWave: 'sine',
    padWave: 'sine',
    arp: true,
    drums: 'none',
  },
  chase: {
    bpm: 118,
    chords: [
      [45, 48, 52],
      [45, 48, 52],
      [41, 45, 48],
      [43, 47, 50],
    ],
    bassWave: 'square',
    padWave: 'sawtooth',
    arp: true,
    drums: 'driving',
  },
  funk: {
    bpm: 140,
    chords: [[50, 53, 57], [48, 52, 55], [53, 57, 60], [45, 48, 52]],
    bassWave: 'square',
    padWave: 'triangle',
    arp: true,
    drums: 'driving',
  },
  rain: {
    bpm: 82,
    chords: [[48, 52, 55, 59], [50, 53, 57, 60], [45, 48, 52, 55], [47, 50, 53, 57]],
    bassWave: 'sine',
    padWave: 'triangle',
    arp: false,
    drums: 'lofi',
  },
  bazaar: {
    bpm: 92,
    chords: [[52, 55, 59], [50, 53, 57], [48, 52, 55], [53, 57, 60]],
    bassWave: 'triangle',
    padWave: 'sawtooth',
    arp: true,
    drums: 'lofi',
  },
  voltage: {
    bpm: 108,
    chords: [[57, 60, 64], [55, 59, 62], [52, 55, 59], [50, 53, 57]],
    bassWave: 'sawtooth',
    padWave: 'sawtooth',
    arp: true,
    drums: 'synthwave',
  },
  asphalt: {
    bpm: 132,
    chords: [[45, 48, 52], [43, 47, 50], [41, 45, 48], [48, 52, 55]],
    bassWave: 'square',
    padWave: 'square',
    arp: true,
    drums: 'driving',
  },
  papers: {
    bpm: 70,
    chords: [[48, 52, 55, 59], [47, 50, 53, 57], [45, 48, 52, 55], [50, 53, 57, 60]],
    bassWave: 'sine',
    padWave: 'sine',
    arp: false,
    drums: 'none',
  },
  deal: {
    bpm: 96,
    chords: [[50, 53, 57], [48, 52, 55], [53, 57, 60], [45, 49, 52]],
    bassWave: 'triangle',
    padWave: 'sawtooth',
    arp: false,
    drums: 'lofi',
  },
  highway: {
    bpm: 124,
    chords: [[52, 55, 59], [50, 53, 57], [48, 52, 55], [55, 59, 62]],
    bassWave: 'sawtooth',
    padWave: 'square',
    arp: true,
    drums: 'driving',
  },
  warehouse: {
    bpm: 105,
    chords: [[45, 48, 52], [43, 47, 50], [41, 45, 48], [47, 50, 53]],
    bassWave: 'square',
    padWave: 'triangle',
    arp: false,
    drums: 'synthwave',
  },
  sunset: {
    bpm: 98,
    chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [55, 59, 62]],
    bassWave: 'sawtooth',
    padWave: 'triangle',
    arp: true,
    drums: 'synthwave',
  },
}

class SynthEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private step = 0
  private nextTime = 0
  private track: TrackSpec = TRACKS.neon
  private noise: AudioBuffer | null = null
  private volume = 0.5

  private ensure() {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    registerAudioContext(ctx) // автопауза при сворачивании / потере фокуса
    const master = ctx.createGain()
    master.gain.value = this.volume * 0.35
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 4200
    filter.connect(master)
    master.connect(ctx.destination)
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.ctx = ctx
    this.master = master
    this.filter = filter
    this.noise = buffer
    return ctx
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master) this.master.gain.value = v * 0.35
  }

  play(id: TrackId) {
    const ctx = this.ensure()
    void ctx.resume()
    this.track = TRACKS[id]
    if (this.filter) this.filter.frequency.value = id === 'night' ? 1800 : id === 'fog' ? 2400 : 4200
    this.stopTimer()
    this.step = 0
    this.nextTime = ctx.currentTime + 0.05
    this.timer = setInterval(() => this.schedule(), 25)
  }

  stop() {
    this.stopTimer()
    void this.ctx?.suspend()
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx) return
    const sixteenth = 60 / this.track.bpm / 4
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, sixteenth)
      this.nextTime += sixteenth
      this.step = (this.step + 1) % 64
    }
  }

  private tone(freq: number, time: number, dur: number, wave: OscillatorType, gain: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(gain, time + Math.min(0.03, dur / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(g).connect(this.filter!)
    osc.start(time)
    osc.stop(time + dur + 0.05)
  }

  private kick(time: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.setValueAtTime(140, time)
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.25)
    g.gain.setValueAtTime(0.9, time)
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.3)
    osc.connect(g).connect(this.master!)
    osc.start(time)
    osc.stop(time + 0.32)
  }

  private hat(time: number, gain: number, length = 0.05) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, time)
    g.gain.exponentialRampToValueAtTime(0.001, time + length)
    src.connect(hp).connect(g).connect(this.master!)
    src.start(time)
    src.stop(time + length + 0.02)
  }

  private playStep(step: number, time: number, sixteenth: number) {
    const t = this.track
    const chord = t.chords[Math.floor(step / 16) % t.chords.length]
    const inBar = step % 16

    if (inBar === 0) chord.forEach((n) => this.tone(midi(n), time, sixteenth * 16, t.padWave, 0.05))
    if (inBar % 4 === 0 || (t.drums === 'driving' && inBar % 2 === 0)) {
      this.tone(midi(chord[0] - 12), time, sixteenth * 1.8, t.bassWave, 0.18)
    }
    if (t.arp && inBar % 2 === 0) {
      const note = chord[(inBar / 2) % chord.length] + 12
      this.tone(midi(note), time, sixteenth * 1.5, 'square', 0.035)
    }

    switch (t.drums) {
      case 'synthwave':
        if (inBar % 4 === 0) this.kick(time)
        if (inBar === 4 || inBar === 12) this.hat(time, 0.35, 0.18)
        if (inBar % 2 === 1) this.hat(time, 0.08)
        break
      case 'driving':
        if (inBar % 4 === 0) this.kick(time)
        if (inBar === 4 || inBar === 12) this.hat(time, 0.4, 0.15)
        this.hat(time, 0.06)
        break
      case 'lofi':
        if (inBar === 0 || inBar === 10) this.kick(time)
        if (inBar === 4 || inBar === 12) this.hat(time, 0.25, 0.22)
        if (inBar % 2 === 0) this.hat(time + sixteenth * 0.15, 0.05)
        break
      default:
        break
    }
  }
}

let engine: SynthEngine | null = null

export function getSynth() {
  if (!engine) engine = new SynthEngine()
  return engine
}

