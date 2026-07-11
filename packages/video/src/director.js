// The Director bridge: a natural-language prompt → a storyboard → a real project
// the editor can then tweak by hand. `localStoryboard` is the deterministic
// offline/fallback author (used when no LLM is connected); `storyboardToProject`
// turns EITHER an LLM storyboard or the local one into an editable project.
import { blankProject, PALETTES, textLayer, recomputeDuration } from './project.js';

const FMT_SCENES = { short: [2, 3], reel: [3, 4], square: [4, 5], long: [5, 7] };

function shorten(s) {
  const words = String(s).replace(/[.]+$/, '').trim().split(/\s+/).slice(0, 6);
  if (words.length >= 4) { const mid = Math.ceil(words.length / 2); return words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' '); }
  return words.join(' ');
}
function chunkWords(text, n) {
  const w = text.trim().split(/\s+/); const per = Math.ceil(w.length / n); const out = [];
  for (let i = 0; i < w.length; i += per) out.push(w.slice(i, i + per).join(' '));
  return out;
}
function pickPalette(p) {
  const s = p.toLowerCase();
  if (/calm|ocean|blue|cool|trust/.test(s)) return 'ocean';
  if (/warm|cozy|love|family|heart/.test(s)) return 'ember';
  if (/fresh|green|grow|health|mint/.test(s)) return 'mint';
  if (/fun|play|kid|bright|purple/.test(s)) return 'grape';
  return 'dusk';
}

// Deterministic storyboard from a prompt — no model needed. Good enough to be a
// real first draft; the LLM route produces sharper copy.
export function localStoryboard(prompt, opts = {}) {
  const p = String(prompt || '').replace(/\s+/g, ' ').trim();
  const format = opts.format || (/reel/i.test(p) ? 'reel' : /long|minute|explainer|\b3 ?min/i.test(p) ? 'long' : /square|feed|1:1/i.test(p) ? 'square' : 'short');
  const [lo, hi] = FMT_SCENES[format];
  const sentences = p.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 1);
  let bits = sentences.length >= lo ? sentences : chunkWords(p || 'Your video', lo);
  bits = bits.slice(0, hi);
  const scenes = bits.map((b, i) => ({ text: shorten(b), anim: i === 0 ? 'cascade' : 'cinematic', durationSec: 3 }));
  return {
    format, palette: pickPalette(p),
    fx: { camera: true, grain: true, vignette: true, sweep: true, letterbox: format === 'long' },
    scenes,
    voiceScript: p || 'Your video.',
    voiceId: 'narrator',
    sfx: [{ cue: 'whoosh', atSec: 0 }],
  };
}

// Turn a (validated) storyboard into an editable project. Text layers are laid
// out sequentially; voice/captions/SFX/stock are added by the caller (they're async).
export function storyboardToProject(sb) {
  const p = blankProject(sb.format);
  const pal = PALETTES.find((x) => x.id === sb.palette) || PALETTES[0];
  const bg = p.layers.find((l) => l.type === 'background');
  if (bg) { bg.colors = [...pal.colors]; bg.accent = pal.accent; }
  p.palette = pal.id;
  p.fx = { ...p.fx, ...(sb.fx || {}) };
  p.layers = p.layers.filter((l) => l.type === 'background');
  let t = 0;
  for (const sc of sb.scenes || []) {
    if ((sc.text || '').trim()) p.layers.push(textLayer(sc.text, { anim: sc.anim, dur: sc.durationSec, start: t, yN: 0.42 }));
    t += sc.durationSec || 3;
  }
  p.meta = { ...p.meta, voiceText: sb.voiceScript || '', voiceId: sb.voiceId || 'narrator' };
  // stash scene image queries + sfx so the UI can fetch stock / add cues
  p._directives = { imageQueries: (sb.scenes || []).map((s) => s.imageQuery).filter(Boolean), sfx: sb.sfx || [] };
  recomputeDuration(p);
  return p;
}
