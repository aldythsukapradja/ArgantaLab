// The SFX cue library as DATA instead of code — one array of tone/noise
// layers per cue name. This is what makes the cues HQ-editable: Music Builder
// edits this table (or an override merged over it); the game's sfx.js just
// executes whatever SFX_RECIPES[name] says via @arganta/audio's engine.js.
// Ported 1:1 from the hand-tuned recipes that shipped in
// apps/lashira/web/src/audio/sfx.js's polish pass — same numbers, now data.

export const AUDIO_VERSION = 1;

export const DEFAULT_SFX_RECIPES = {
  tap: [{ kind: 'tone', type: 'sine', f0: 620, t: 0.06, gain: 0.16 }],
  plant: [
    { kind: 'noise', t: 0.12, gain: 0.16, lp: 900, jitter: true },
    { kind: 'tone', type: 'sine', f0: 300, f1: 220, t: 0.1, gain: 0.14, jitter: true },
  ],
  harvest: [
    { kind: 'tone', type: 'triangle', f0: 520, f1: 900, t: 0.14, gain: 0.24, layers: 2, reverb: 0.15 },
    { kind: 'tone', type: 'sine', f0: 1200, t: 0.08, gain: 0.1, delay: 0.06, reverb: 0.15 },
  ],
  collect: [{ kind: 'tone', type: 'triangle', f0: 420, f1: 720, t: 0.12, gain: 0.2, jitter: true }],
  sell: [
    { kind: 'tone', type: 'triangle', f0: 880, t: 0.09, gain: 0.18, delay: 0, layers: 2, jitter: true, reverb: 0.12 },
    { kind: 'tone', type: 'triangle', f0: 1100, t: 0.09, gain: 0.18, delay: 0.06, layers: 2, jitter: true, reverb: 0.12 },
    { kind: 'tone', type: 'triangle', f0: 1320, t: 0.09, gain: 0.18, delay: 0.12, layers: 2, jitter: true, reverb: 0.12 },
  ],
  buy: [
    { kind: 'tone', type: 'triangle', f0: 523, t: 0.09, gain: 0.18 },
    { kind: 'tone', type: 'triangle', f0: 392, t: 0.11, gain: 0.16, delay: 0.08 },
  ],
  sickle: [{ kind: 'noise', t: 0.16, gain: 0.22, lp: 3200, hp: 600, jitter: true, drive: 0.15 }],
  sleep: [
    { kind: 'tone', type: 'sine', f0: 420, f1: 130, t: 0.5, gain: 0.2, reverb: 0.35 },
    { kind: 'tone', type: 'sine', f0: 780, t: 0.3, gain: 0.08, delay: 0.28, reverb: 0.35 },
  ],
  mount: [
    { kind: 'tone', type: 'square', f0: 300, f1: 460, t: 0.1, gain: 0.14 },
    { kind: 'tone', type: 'square', f0: 460, f1: 620, t: 0.1, gain: 0.12, delay: 0.08 },
  ],
  quest: [
    { kind: 'tone', type: 'triangle', f0: 523, t: 0.12, gain: 0.2, delay: 0, layers: 2, reverb: 0.2 },
    { kind: 'tone', type: 'triangle', f0: 659, t: 0.12, gain: 0.2, delay: 0.08, layers: 2, reverb: 0.2 },
    { kind: 'tone', type: 'triangle', f0: 784, t: 0.12, gain: 0.2, delay: 0.16, layers: 2, reverb: 0.2 },
    { kind: 'tone', type: 'triangle', f0: 1047, t: 0.12, gain: 0.2, delay: 0.24, layers: 2, reverb: 0.2 },
  ],
  reward: [
    { kind: 'tone', type: 'sine', f0: 988, t: 0.1, gain: 0.16, delay: 0, reverb: 0.25 },
    { kind: 'tone', type: 'sine', f0: 1319, t: 0.1, gain: 0.16, delay: 0.05, reverb: 0.25 },
  ],
  error: [{ kind: 'tone', type: 'square', f0: 170, f1: 120, t: 0.12, gain: 0.14 }],
  swing: [{ kind: 'noise', t: 0.12, gain: 0.2, lp: 2600, hp: 400, jitter: true }],
  hit: [
    { kind: 'noise', t: 0.1, gain: 0.24, lp: 1400, drive: 0.3, jitter: true },
    { kind: 'tone', type: 'square', f0: 220, f1: 120, t: 0.08, gain: 0.16, jitter: true },
  ],
  monsterAttack: [{ kind: 'tone', type: 'sawtooth', f0: 180, f1: 90, t: 0.14, gain: 0.14, jitter: true }],
  hurt: [
    { kind: 'tone', type: 'square', f0: 240, f1: 110, t: 0.16, gain: 0.2 },
    { kind: 'noise', t: 0.1, gain: 0.14, lp: 1000 },
  ],
  faint: [{ kind: 'tone', type: 'sine', f0: 320, f1: 70, t: 0.6, gain: 0.22, reverb: 0.25 }],
  die: [
    { kind: 'noise', t: 0.22, gain: 0.2, lp: 1800, drive: 0.2 },
    { kind: 'tone', type: 'triangle', f0: 400, f1: 120, t: 0.2, gain: 0.14, reverb: 0.2 },
  ],
  towerSentry: [{ kind: 'tone', type: 'square', f0: 900, f1: 500, t: 0.07, gain: 0.16, jitter: true }],
  towerBramble: [{ kind: 'noise', t: 0.1, gain: 0.2, lp: 700, hp: 80, jitter: true, drive: 0.1 }],
  towerFrostbud: [{ kind: 'tone', type: 'sine', f0: 700, f1: 1300, t: 0.09, gain: 0.16, jitter: true, reverb: 0.1 }],
  towerSunspire: [
    { kind: 'tone', type: 'sawtooth', f0: 1400, f1: 500, t: 0.16, gain: 0.14, jitter: true },
    { kind: 'tone', type: 'sine', f0: 1800, t: 0.06, gain: 0.1, reverb: 0.1 },
  ],
  take: [
    { kind: 'noise', t: 0.08, gain: 0.14, lp: 1200 },
    { kind: 'tone', type: 'sine', f0: 260, f1: 180, t: 0.09, gain: 0.12 },
  ],
  Victory: [
    { kind: 'tone', type: 'triangle', f0: 660, f1: 880, t: 0.12, gain: 0.22, layers: 2, reverb: 0.3 },
    { kind: 'tone', type: 'triangle', f0: 880, f1: 1175, t: 0.14, gain: 0.2, delay: 0.1, layers: 2, reverb: 0.3 },
    { kind: 'tone', type: 'sine', f0: 1568, t: 0.12, gain: 0.14, delay: 0.2, reverb: 0.3 },
  ],
  Smile: [{ kind: 'tone', type: 'sine', f0: 700, f1: 950, t: 0.1, gain: 0.18 }],
  Cry: [
    { kind: 'tone', type: 'sine', f0: 500, f1: 340, t: 0.22, gain: 0.16 },
    { kind: 'tone', type: 'sine', f0: 420, f1: 280, t: 0.2, gain: 0.12, delay: 0.18 },
  ],
  Blush: [{ kind: 'tone', type: 'sine', f0: 1000, f1: 1300, t: 0.09, gain: 0.12 }],
  Wink: [
    { kind: 'tone', type: 'square', f0: 900, t: 0.05, gain: 0.14 },
    { kind: 'tone', type: 'square', f0: 900, t: 0.05, gain: 0.14, delay: 0.1 },
  ],
  Yawn: [{ kind: 'tone', type: 'sine', f0: 380, f1: 220, t: 0.4, gain: 0.16 }],
  Sleep: [
    { kind: 'tone', type: 'sine', f0: 440, f1: 180, t: 0.5, gain: 0.18, reverb: 0.3 },
    { kind: 'tone', type: 'sine', f0: 900, t: 0.25, gain: 0.08, delay: 0.3, reverb: 0.3 },
  ],
  Surprise: [{ kind: 'tone', type: 'square', f0: 300, f1: 900, t: 0.12, gain: 0.2 }],
  Angry: [
    { kind: 'tone', type: 'sawtooth', f0: 150, f1: 100, t: 0.18, gain: 0.2 },
    { kind: 'noise', t: 0.1, gain: 0.14, lp: 800 },
  ],
  Merong: [
    { kind: 'tone', type: 'triangle', f0: 520, t: 0.08, gain: 0.18 },
    { kind: 'tone', type: 'triangle', f0: 660, t: 0.1, gain: 0.16, delay: 0.09 },
  ],
  Kongi: [
    { kind: 'tone', type: 'sine', f0: 500, t: 0.08, gain: 0.14 },
    { kind: 'tone', type: 'sine', f0: 400, t: 0.1, gain: 0.12, delay: 0.1 },
  ],
  Pish: [{ kind: 'noise', t: 0.1, gain: 0.16, lp: 2200, hp: 1200 }],
  Dance: [440, 550, 660, 550].map((f, i) => ({ kind: 'tone', type: 'triangle', f0: f, t: 0.09, gain: 0.16, delay: i * 0.09, jitter: true })),
  Cold: [700, 650, 700, 650, 700].map((f, i) => ({ kind: 'tone', type: 'sine', f0: f, t: 0.05, gain: 0.1, delay: i * 0.06 })),
  HandToMouth: [
    { kind: 'tone', type: 'sine', f0: 800, f1: 1000, t: 0.06, gain: 0.12 },
    { kind: 'tone', type: 'sine', f0: 900, f1: 1100, t: 0.06, gain: 0.1, delay: 0.07 },
  ],
};

const CUE_GROUPS = {
  Action: ['tap', 'plant', 'harvest', 'collect', 'sell', 'buy', 'sickle', 'sleep', 'mount', 'take'],
  Progression: ['quest', 'reward', 'error'],
  Combat: ['swing', 'hit', 'monsterAttack', 'hurt', 'faint', 'die'],
  'Bloomwall towers': ['towerSentry', 'towerBramble', 'towerFrostbud', 'towerSunspire'],
  Emotes: ['Victory', 'Smile', 'Cry', 'Blush', 'Wink', 'Yawn', 'Sleep', 'Surprise', 'Angry', 'Merong', 'Kongi', 'Pish', 'Dance', 'Cold', 'HandToMouth'],
};
export function cueGroups() { return CUE_GROUPS; }

const clone = (o) => JSON.parse(JSON.stringify(o));

// The LIVE cue table — both the game and HQ's own preview player read this
// object. Starts as a copy of the defaults; applyAudioLibrary() mutates it
// in place so every importer holding this same reference sees the update.
export const SFX_RECIPES = clone(DEFAULT_SFX_RECIPES);

const NUM = (v, d) => (Number.isFinite(v) ? v : d);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const TONE_TYPES = new Set(['sine', 'square', 'triangle', 'sawtooth']);

// Clamps one layer's fields to sane, non-destructive ranges. Unknown/garbage
// input degrades to a quiet default tone rather than throwing or NaN-ing out.
function sanitizeLayer(layer) {
  if (!layer || typeof layer !== 'object') return { kind: 'tone', type: 'sine', f0: 440, t: 0.1, gain: 0.15 };
  const kind = layer.kind === 'noise' ? 'noise' : 'tone';
  const t = Math.max(0.01, Math.min(2, NUM(layer.t, 0.12)));
  const gain = clamp01(NUM(layer.gain, 0.2));
  const delay = Math.max(0, Math.min(2, NUM(layer.delay, 0)));
  const jitter = !!layer.jitter;
  const reverb = clamp01(NUM(layer.reverb, 0));
  if (kind === 'noise') {
    return {
      kind, t, gain, delay, jitter, reverb,
      lp: Math.max(100, Math.min(20000, NUM(layer.lp, 2000))),
      hp: Math.max(0, Math.min(20000, NUM(layer.hp, 0))),
      drive: clamp01(NUM(layer.drive, 0)),
    };
  }
  return {
    kind, t, gain, delay, jitter, reverb,
    type: TONE_TYPES.has(layer.type) ? layer.type : 'sine',
    f0: Math.max(20, Math.min(20000, NUM(layer.f0, 440))),
    f1: layer.f1 == null ? null : Math.max(1, Math.min(20000, NUM(layer.f1, layer.f0 || 440))),
    layers: Math.max(1, Math.min(3, Math.round(NUM(layer.layers, 1)))),
  };
}

// override: { cueName: [layer, ...] } — a FULL replacement recipe per cue
// (Music Builder always writes the whole array back, never a sparse patch).
export function validateAudioLibrary(override) {
  const errors = [], warnings = [];
  if (override && typeof override === 'object') {
    for (const [name, recipe] of Object.entries(override)) {
      if (!Array.isArray(recipe) || recipe.length === 0) { errors.push(`${name}: recipe must be a non-empty layer array`); continue; }
      if (recipe.length > 6) warnings.push(`${name}: ${recipe.length} layers is a lot — likely to sound cluttered`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

// Merges an override map over the defaults (per-cue full replacement, each
// layer sanitized) and returns a brand-new map — does not mutate SFX_RECIPES.
export function mergeAudioLibrary(override = {}) {
  const out = clone(DEFAULT_SFX_RECIPES);
  for (const [name, recipe] of Object.entries(override || {})) {
    if (Array.isArray(recipe)) out[name] = recipe.map(sanitizeLayer);
  }
  return out;
}

// Mutates the LIVE SFX_RECIPES object in place so every existing importer
// (the game's Sfx class, HQ's own preview) sees the new numbers immediately.
export function applyAudioLibrary(override = {}) {
  const effective = mergeAudioLibrary(override);
  for (const key of Object.keys(SFX_RECIPES)) delete SFX_RECIPES[key];
  Object.assign(SFX_RECIPES, effective);
  return SFX_RECIPES;
}

export function resetAudioLibrary() { return applyAudioLibrary({}); }

export function serializeAudioLibrary(override) {
  return JSON.stringify({ v: AUDIO_VERSION, override, published_at: new Date().toISOString() });
}
export function parseAudioLibrary(json) {
  try { const d = JSON.parse(json); return d && typeof d === 'object' ? d : null; } catch { return null; }
}
