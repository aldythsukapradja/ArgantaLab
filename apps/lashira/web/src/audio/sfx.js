// Synthesized sound effects — every cue is a data recipe (tone/noise layers)
// executed against WebAudio by @arganta/audio's shared engine, so there are
// NO asset files to ship or for the embed CSP to block, and Circle HQ's Music
// Builder edits the SAME recipe table this plays (see net/audioLibrary.js).
// One shared instance (`sfx`) is imported wherever an action fires. SSR-safe:
// with no window / AudioContext (node harnesses) every call is a silent no-op.
//
// The context is created lazily and only starts after a real user gesture
// (autoplay policy) — call sfx.arm() from a pointerdown/keydown listener once.

import { createMasterChain, scheduleTone, scheduleNoise, SFX_RECIPES } from '@arganta/audio';
import { ambient } from './ambient.js';

const CAN_AUDIO = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
const LS_MUTED = 'lashira_sfx_muted';
const LS_VOL = 'lashira_sfx_vol';
const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Cues loud/important enough to duck the ambient bed for a moment.
const PROMINENT = new Set(['harvest', 'sell', 'quest', 'reward', 'Victory', 'hit', 'die', 'faint']);

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;      // volume-controlled input to the mastering chain
    this.reverbBus = null;   // per-cue reverb sends land here
    this.armed = false;
    this.muted = this._get(LS_MUTED, '0') === '1';
    this.volume = clamp(parseFloat(this._get(LS_VOL, '0.7')) || 0.7);
  }
  _get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
  _set(k, v) { try { localStorage.setItem(k, v); } catch { /* quota / private mode */ } }

  _ensure() {
    if (!CAN_AUDIO) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const { master, reverbBus } = createMasterChain(this.ctx, this.volume);
      this.master = master; this.reverbBus = reverbBus;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  // Wire to the first user gesture so the audio context is allowed to start.
  arm() { if (this.armed) return; this.armed = true; this._ensure(); }

  setMuted(m) { this.muted = !!m; this._set(LS_MUTED, m ? '1' : '0'); }
  isMuted() { return this.muted; }
  setVolume(v) { this.volume = clamp(v); if (this.master) this.master.gain.value = this.volume; this._set(LS_VOL, String(this.volume)); }
  getVolume() { return this.volume; }

  tone(params) { if (this.ctx) scheduleTone(this.ctx, this.master, this.reverbBus, params); }
  noise(params) { if (this.ctx) scheduleNoise(this.ctx, this.master, this.reverbBus, params); }

  play(name) {
    if (this.muted || !CAN_AUDIO) return;
    const ctx = this._ensure();
    if (!ctx || ctx.state !== 'running') return;
    const recipe = SFX_RECIPES[name];
    if (!recipe) { this.tone({ type: 'sine', f0: 620, t: 0.06, gain: 0.16 }); return; } // unknown cue → quiet tap
    for (const layer of recipe) (layer.kind === 'noise' ? this.noise(layer) : this.tone(layer));
    if (PROMINENT.has(name)) { try { ambient.duck(); } catch { /* ambient not running */ } }
  }
}

export const sfx = new Sfx();
