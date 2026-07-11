// Ambient audio bed — the GENERATIVE MUSIC engine (@arganta/audio's
// MusicTransport) instead of a single pad. Each map has its own theme; the
// bed composes it live (zero assets, CSP-safe, never loops identically). HQ's
// Music Forge authors the themes and publishes them per realm; the game boots
// them (initMusic) so the bed is whatever the operator shipped, else the
// package defaults. SSR-safe (no-op without WebAudio). Started on the first
// user gesture (autoplay policy). Public API: start/stop/setEnabled/setVolume/
// duck + setRealm(realmId) + refreshTheme().

import { MusicTransport, createMasterChain, ACTIVE_THEMES } from '@arganta/audio';

const CAN_AUDIO = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
const LS_ON = 'lashira_ambient_on';
const LS_VOL = 'lashira_ambient_vol';
const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

class Ambient {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.revBus = null;
    this.transport = null;
    this.running = false;
    this.realm = 'farm';
    this._swapTimer = null;
    this.enabled = this._get(LS_ON, '1') === '1';
    this.volume = clamp(parseFloat(this._get(LS_VOL, '0.5')) || 0.5);
  }
  _get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
  _set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  _gain() { return this.volume * 0.45; } // music bed sits under the action SFX
  _themeFor(realm) { return ACTIVE_THEMES[realm] || ACTIVE_THEMES.farm; }

  // Build a fresh master chain + transport playing `realm`'s theme at `gain0`.
  _build(realm, gain0) {
    const { master, reverbBus } = createMasterChain(this.ctx, gain0);
    this.master = master; this.revBus = reverbBus;
    this.transport = new MusicTransport(this.ctx, { master, revBus: reverbBus });
    this.transport.setTheme(this._themeFor(realm));
    this.transport.start();
  }

  // Called on the first gesture. Builds + starts the bed if enabled. RESUME-
  // AWARE: only starts the transport once the context is actually running, and
  // rolls back on failure so the NEXT gesture can retry (no stuck `running`).
  start() {
    if (!CAN_AUDIO || this.running || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = this.ctx || new AC();
    this.running = true;
    const go = () => {
      if (!this.running) return;              // disabled while resuming
      if (this.ctx.state !== 'running') { this._rollback(); return; } // couldn't unlock → allow retry
      this._build(this.realm, this._gain());
    };
    if (this.ctx.state === 'running') go();
    else this.ctx.resume().then(go).catch(() => this._rollback());
  }
  // Undo a failed start so a later gesture can try again (don't latch running).
  _rollback() {
    this.running = false;
    try { this.transport?.stop(); } catch { /* ignore */ }
    try { this.master?.disconnect(); } catch { /* ignore */ }
    this.transport = null; this.master = null; this.revBus = null;
  }

  // Switch the map's theme with a CLEAN HANDOFF: fade the old bed out, then
  // hard-stop + disconnect the old graph (which cuts ALL ringing tails — the
  // long pads/reverb that used to bleed into the next world), build a fresh
  // transport for the new theme, and fade it in. Coalesces rapid switches.
  setRealm(realmId) {
    if (!realmId) return;
    if (realmId === this.realm && this.running) return; // already on it
    this.realm = realmId;
    if (!this.running || !this.transport) return;        // start() will use this.realm
    const ctx = this.ctx, oldMaster = this.master, oldTransport = this.transport;
    const now = ctx.currentTime;
    if (oldMaster) {
      const g = oldMaster.gain;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now + 0.28);
    }
    clearTimeout(this._swapTimer);
    this._swapTimer = setTimeout(() => {
      if (!this.running) return;                          // disabled mid-swap
      try { oldTransport?.stop(); } catch { /* ignore */ }
      try { oldMaster?.disconnect(); } catch { /* ignore */ } // cuts old tails
      this._build(this.realm, 0.0001);
      const g = this.master.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(this._gain(), t + 0.4);
    }, 300);
  }

  // Adopt a newly-published theme for the CURRENT realm without a realm change
  // (initMusic calls this after boot, so a bed that started on defaults swaps
  // to the operator's published theme live). Same realm → no tail issue.
  refreshTheme() {
    if (this.running && this.transport) this.transport.setTheme(this._themeFor(this.realm));
  }

  stop() {
    this.running = false;
    clearTimeout(this._swapTimer); this._swapTimer = null;
    try { this.transport?.stop(); } catch { /* ignore */ }
    try { this.master?.disconnect(); } catch { /* ignore */ }
    this.transport = null; this.master = null; this.revBus = null;
  }

  // Briefly dips the bed so a prominent sfx cue cuts through — called from sfx.js.
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
