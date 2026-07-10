// SFX live usage tracker — game side. sfx.js buffers play counts in memory
// (@arganta/audio's logPlay); this periodically flushes the buffer as ONE
// batched RPC so a cue triggered 50x doesn't send 50 requests. Best-effort:
// a lost tab loses whatever's unflushed since the last interval, which is
// fine for a "which cue is worth polishing" signal, not a billing ledger.
import { flushUsage } from '@arganta/audio';
import { supabase } from './supabase.js';

const FLUSH_MS = 15000;
let started = false;

export function initAudioUsage() {
  if (started) return;
  started = true;
  const tick = () => { flushUsage(supabase); };
  setInterval(tick, FLUSH_MS);
  // Best-effort flush on tab hide/close so a short session isn't lost entirely.
  document.addEventListener('visibilitychange', () => { if (document.hidden) tick(); });
  window.addEventListener('pagehide', tick);
}
