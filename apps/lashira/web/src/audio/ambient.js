// Ambient farm audio bed — a soft synth pad + occasional birdsong, fully
// synthesized (no assets, CSP-safe). Low volume, default ON, independently
// toggleable from the SFX volume. SSR-safe (no-op without WebAudio). Started on
// the first user gesture (autoplay policy); pauses its chirps when the tab is
// hidden.

const CAN_AUDIO = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
const LS_ON = 'lashira_ambient_on';
const LS_VOL = 'lashira_ambient_vol';
const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

class Ambient {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.pad = null;
    this.birdTimer = 0;
    this.running = false;
    this.enabled = this._get(LS_ON, '1') === '1';
    this.volume = clamp(parseFloat(this._get(LS_VOL, '0.5')) || 0.5);
  }
  _get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
  _set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  _gain() { return this.volume * 0.09; } // ambience stays well under the action SFX

  // Called on the first gesture. Builds + starts the bed if enabled.
  start() {
    if (!CAN_AUDIO || this.running || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = this.ctx || new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this._gain();
    this.master.connect(ctx.destination);

    // pad: two detuned low voices through a lowpass, gently swelled by an LFO.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    lp.connect(this.master);
    const voices = [110, 164.81, 220]; // A2 · E3 · A3 (open, calm)
    const oscs = voices.map((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle';
      o.frequency.value = f; o.detune.value = (i - 1) * 6;
      const g = ctx.createGain(); g.gain.value = i === 2 ? 0.18 : 0.3;
      o.connect(g); g.connect(lp); o.start();
      return o;
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = this._gain() * 0.5;
    lfo.connect(lfoGain); lfoGain.connect(this.master.gain); lfo.start();
    this.pad = { oscs, lfo };

    this.running = true;
    this._scheduleBird();
  }

  _scheduleBird() {
    clearTimeout(this.birdTimer);
    const next = 3500 + Math.random() * 6000;
    this.birdTimer = window.setTimeout(() => { this._bird(); this._scheduleBird(); }, next);
  }
  _bird() {
    if (!this.running || !this.ctx || document.hidden) return;
    const ctx = this.ctx;
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = 1600 + Math.random() * 900;
    for (let i = 0; i < notes; i++) {
      const t0 = ctx.currentTime + i * 0.09;
      const o = ctx.createOscillator(); o.type = 'sine';
      const f = base * (1 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(this._gain() * 0.5, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.1);
    }
  }

  stop() {
    this.running = false;
    clearTimeout(this.birdTimer);
    try { this.pad?.oscs.forEach((o) => o.stop()); this.pad?.lfo.stop(); } catch { /* already stopped */ }
    try { this.master?.disconnect(); } catch { /* ignore */ }
    this.pad = null; this.master = null;
  }

  // Briefly dips the bed so a prominent sfx cue (harvest, victory, a hit...)
  // cuts through instead of getting masked — called from sfx.js, not user-facing.
  duck(ms = 180, amount = 0.45) {
    if (!this.running || !this.master || !this.ctx) return;
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    const base = this._gain();
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(base * (1 - amount), now + 0.03);
    g.linearRampToValueAtTime(base, now + 0.03 + ms / 1000);
  }

  isEnabled() { return this.enabled; }
  setEnabled(on) {
    this.enabled = !!on; this._set(LS_ON, on ? '1' : '0');
    if (on) this.start(); else this.stop();
  }
  getVolume() { return this.volume; }
  setVolume(v) {
    this.volume = clamp(v); this._set(LS_VOL, String(this.volume));
    if (this.master) this.master.gain.value = this._gain();
  }
}

export const ambient = new Ambient();
