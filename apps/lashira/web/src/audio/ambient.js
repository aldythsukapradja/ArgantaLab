// Ambient audio bed — now the GENERATIVE MUSIC engine (@arganta/audio's
// MusicTransport) instead of a single pad. Each map has its own theme; the
// bed composes it live (zero assets, CSP-safe, never loops identically). HQ's
// Music Forge authors the themes and publishes them per realm; the game boots
// them (initMusic) so the bed is whatever the operator shipped, else the
// package defaults. SSR-safe (no-op without WebAudio). Started on the first
// user gesture (autoplay policy). Keeps the same public API the game already
// uses (start/stop/setEnabled/setVolume/duck) + a new setRealm(realmId).

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
    this.enabled = this._get(LS_ON, '1') === '1';
    this.volume = clamp(parseFloat(this._get(LS_VOL, '0.5')) || 0.5);
  }
  _get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
  _set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  _gain() { return this.volume * 0.45; } // music bed sits under the action SFX

  // Called on the first gesture. Builds + starts the bed if enabled.
  start() {
    if (!CAN_AUDIO || this.running || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = this.ctx || new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const { master, reverbBus } = createMasterChain(this.ctx, this._gain());
    this.master = master; this.revBus = reverbBus;
    this.transport = new MusicTransport(this.ctx, { master, revBus: reverbBus });
    this.transport.setTheme(ACTIVE_THEMES[this.realm] || ACTIVE_THEMES.farm);
    this.transport.start();
    this.running = true;
  }

  // Switch the map's theme. Live-swaps if playing (with a short dip so the
  // change doesn't jar); remembers the realm for the next start() otherwise.
  setRealm(realmId) {
    if (!realmId || realmId === this.realm) { this.realm = realmId || this.realm; return; }
    this.realm = realmId;
    if (this.running && this.transport) {
      this.duck(400, 0.7);
      this.transport.setTheme(ACTIVE_THEMES[realmId] || ACTIVE_THEMES.farm);
    }
  }

  stop() {
    this.running = false;
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
