// Tiny WebAudio synth — no assets, just oscillators. Every game gets
// pops, zaps and jingles for free; mute lives on the shell HUD.

export class Sfx {
  private ctx: AudioContext | null = null
  muted = false

  private ac(): AudioContext | null {
    if (this.muted) return null
    try { this.ctx = this.ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)() } catch { return null }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  tone(freq: number, dur = 0.08, type: OscillatorType = 'square', vol = 0.08, slide = 0) {
    const ac = this.ac(); if (!ac) return
    const o = ac.createOscillator(), g = ac.createGain()
    o.type = type; o.frequency.value = freq
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur)
    g.gain.value = vol
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
    o.connect(g).connect(ac.destination)
    o.start(); o.stop(ac.currentTime + dur)
  }

  pop()   { this.tone(660, 0.06, 'square', 0.07, 220) }
  coin()  { this.tone(880, 0.05, 'square', 0.06); setTimeout(() => this.tone(1320, 0.09, 'square', 0.06), 50) }
  hit()   { this.tone(160, 0.12, 'sawtooth', 0.09, -60) }
  boom()  { this.tone(70, 0.3, 'sawtooth', 0.12, -30) }
  zap()   { this.tone(980, 0.08, 'sawtooth', 0.06, -600) }
  win()   { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.08), i * 110)) }
  lose()  { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.08), i * 140)) }
  tick()  { this.tone(440, 0.03, 'square', 0.04) }
}
