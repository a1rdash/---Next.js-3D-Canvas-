/**
 * Автопауза звука при потере фокуса и возобновление при возврате.
 *
 * Все AudioContext (музыка, звук мотора) регистрируются здесь. Когда вкладка скрыта (document.hidden),
 * окно теряет фокус (blur) или страница уходит в фон (pagehide), контексты приостанавливаются (suspend);
 * при возврате (visibilitychange / focus / pageshow) — возобновляются (resume), но только те,
 * которые приостановили мы сами, поэтому ручное «без звука» не ломается.
 * Также есть помощник для HTML5-аудио (HTMLMediaElement).
 */

const contexts = new Set<AudioContext>()
const media = new Set<HTMLMediaElement>()
const suspendedByUs = new WeakSet<AudioContext>()
const pausedByUs = new WeakSet<HTMLMediaElement>()
let installed = false

function pauseAll() {
  for (const ctx of contexts) {
    if (ctx.state === 'running') {
      suspendedByUs.add(ctx)
      ctx.suspend().catch(() => {})
    }
  }
  for (const el of media) {
    if (!el.paused) {
      pausedByUs.add(el)
      el.pause()
    }
  }
}

function resumeAll() {
  for (const ctx of contexts) {
    if (suspendedByUs.has(ctx)) {
      suspendedByUs.delete(ctx)
      ctx.resume().catch(() => {})
    }
  }
  for (const el of media) {
    if (pausedByUs.has(el)) {
      pausedByUs.delete(el)
      el.play().catch(() => {})
    }
  }
}

/** Единожды подписывается на события видимости/фокуса */
function install() {
  if (installed || typeof window === 'undefined') return
  installed = true
  // вкладка свернута или переключена
  document.addEventListener('visibilitychange', () => (document.hidden ? pauseAll() : resumeAll()))
  // окно потеряло/получило фокус (например, переключились на другое приложение)
  window.addEventListener('blur', pauseAll)
  window.addEventListener('focus', () => {
    if (!document.hidden) resumeAll()
  })
  // мобильные браузеры / bfcache
  window.addEventListener('pagehide', pauseAll)
  window.addEventListener('pageshow', () => {
    if (!document.hidden) resumeAll()
  })
}

export function registerAudioContext(ctx: AudioContext) {
  contexts.add(ctx)
  install()
  // если контекст создан, пока вкладка уже неактивна, сразу ставим на паузу
  if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) pauseAll()
}

export function unregisterAudioContext(ctx: AudioContext) {
  contexts.delete(ctx)
}

export function registerMediaElement(el: HTMLMediaElement) {
  media.add(el)
  install()
}

export function unregisterMediaElement(el: HTMLMediaElement) {
  media.delete(el)
}
