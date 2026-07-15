// Zero-asset voice-copilot SFX — synthesized with the Web Audio API, no
// files to fetch or self-host. Matches the house style of the deterministic
// audio engines elsewhere in HQ (Music/Video Builder's formant synth).

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(c: AudioContext, freq: number, startAt: number, duration: number, peakGain: number) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t0 = c.currentTime + startAt
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** Two-note ascending chime — mic just armed and listening started. */
export function playListenChime() {
  const c = getCtx()
  if (!c) return
  tone(c, 660, 0, 0.11, 0.05)
  tone(c, 880, 0.09, 0.14, 0.055)
}

/** Two-note descending blip — mic disarmed. */
export function playCloseChime() {
  const c = getCtx()
  if (!c) return
  tone(c, 700, 0, 0.09, 0.045)
  tone(c, 480, 0.07, 0.12, 0.04)
}

/** Short high tick — a spoken phrase matched and ran. */
export function playConfirmTick() {
  const c = getCtx()
  if (!c) return
  tone(c, 1200, 0, 0.055, 0.035)
}
