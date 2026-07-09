// Synthesized sound effects — every cue is a tiny WebAudio envelope, so there
// are NO asset files to ship or for the embed CSP to block. One shared instance
// (`sfx`) is imported wherever an action fires. SSR-safe: with no window /
// AudioContext (node harnesses) every call is a silent no-op.
//
// The context is created lazily and only starts after a real user gesture
// (autoplay policy) — call sfx.arm() from a pointerdown/keydown listener once.

const CAN_AUDIO = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
const LS_MUTED = 'lashira_sfx_muted';
const LS_VOL = 'lashira_sfx_vol';
const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
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
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
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

  // A shaped oscillator tone. f1 → glide target; short exponential AR envelope.
  tone({ type = 'sine', f0 = 440, f1 = null, t = 0.12, gain = 0.3, delay = 0 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + t);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + t + 0.03);
  }
  // A filtered noise burst — thuds, swipes, whooshes, poofs.
  noise({ t = 0.15, gain = 0.2, delay = 0, lp = 2000, hp = 0 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const n = Math.max(1, Math.floor(ctx.sampleRate * t));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    let node = src;
    if (hp) { const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp; src.connect(hpf); node = hpf; }
    node.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + t + 0.02);
  }

  play(name) {
    if (this.muted || !CAN_AUDIO) return;
    const ctx = this._ensure();
    if (!ctx || ctx.state !== 'running') return;
    (CUES[name] || CUES.tap)(this);
  }
}

// Cue book — one entry per action. Kept gentle + short (kid-friendly, non-fatiguing).
const CUES = {
  tap: (s) => s.tone({ type: 'sine', f0: 620, t: 0.06, gain: 0.16 }),
  plant: (s) => { s.noise({ t: 0.12, gain: 0.16, lp: 900 }); s.tone({ type: 'sine', f0: 300, f1: 220, t: 0.1, gain: 0.14 }); },
  harvest: (s) => { s.tone({ type: 'triangle', f0: 520, f1: 900, t: 0.14, gain: 0.24 }); s.tone({ type: 'sine', f0: 1200, t: 0.08, gain: 0.1, delay: 0.06 }); },
  collect: (s) => s.tone({ type: 'triangle', f0: 420, f1: 720, t: 0.12, gain: 0.2 }),
  sell: (s) => { [880, 1100, 1320].forEach((f, i) => s.tone({ type: 'triangle', f0: f, t: 0.09, gain: 0.18, delay: i * 0.06 })); },
  buy: (s) => { s.tone({ type: 'triangle', f0: 523, t: 0.09, gain: 0.18 }); s.tone({ type: 'triangle', f0: 392, t: 0.11, gain: 0.16, delay: 0.08 }); },
  sickle: (s) => s.noise({ t: 0.16, gain: 0.22, lp: 3200, hp: 600 }),
  sleep: (s) => { s.tone({ type: 'sine', f0: 420, f1: 130, t: 0.5, gain: 0.2 }); s.tone({ type: 'sine', f0: 780, t: 0.3, gain: 0.08, delay: 0.28 }); },
  mount: (s) => { s.tone({ type: 'square', f0: 300, f1: 460, t: 0.1, gain: 0.14 }); s.tone({ type: 'square', f0: 460, f1: 620, t: 0.1, gain: 0.12, delay: 0.08 }); },
  quest: (s) => { [523, 659, 784, 1047].forEach((f, i) => s.tone({ type: 'triangle', f0: f, t: 0.12, gain: 0.2, delay: i * 0.08 })); },
  reward: (s) => { [988, 1319].forEach((f, i) => s.tone({ type: 'sine', f0: f, t: 0.1, gain: 0.16, delay: i * 0.05 })); },
  error: (s) => s.tone({ type: 'square', f0: 170, f1: 120, t: 0.12, gain: 0.14 }),
  swing: (s) => s.noise({ t: 0.12, gain: 0.2, lp: 2600, hp: 400 }),
  hit: (s) => { s.noise({ t: 0.1, gain: 0.24, lp: 1400 }); s.tone({ type: 'square', f0: 220, f1: 120, t: 0.08, gain: 0.16 }); },
  monsterAttack: (s) => s.tone({ type: 'sawtooth', f0: 180, f1: 90, t: 0.14, gain: 0.14 }),
  hurt: (s) => { s.tone({ type: 'square', f0: 240, f1: 110, t: 0.16, gain: 0.2 }); s.noise({ t: 0.1, gain: 0.14, lp: 1000 }); },
  faint: (s) => s.tone({ type: 'sine', f0: 320, f1: 70, t: 0.6, gain: 0.22 }),
  die: (s) => { s.noise({ t: 0.22, gain: 0.2, lp: 1800 }); s.tone({ type: 'triangle', f0: 400, f1: 120, t: 0.2, gain: 0.14 }); },
};

export const sfx = new Sfx();
