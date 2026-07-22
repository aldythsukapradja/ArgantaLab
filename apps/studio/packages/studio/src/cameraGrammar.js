"use client";

// ─── ArgantaStudio camera grammar ────────────────────────────────────────────
//
// Ported from apps/hq/src/surfaces/video/cameraGrammar.ts (V1) — the compiler
// that stands in for Higgsfield's Cinema Studio: named camera MOVES (motion
// language) + motion weight + look, compiled into deterministic prompt/negative
// clauses. CinemaStudio already compiles camera BODY/lens/aperture into a still
// prompt (buildNanoBananaPrompt) — this fills the missing piece: movement.
// Pure function, no I/O.

export const MOVES = [
  { id: 'static', label: 'Static', glyph: '▢', clause: 'locked static camera, no camera movement, stable framing' },
  { id: 'dolly-in', label: 'Dolly In', glyph: '→▢', clause: 'camera slowly dollies in toward the subject, smooth cinematic push-in' },
  { id: 'dolly-out', label: 'Dolly Out', glyph: '▢→', clause: 'camera slowly dollies out away from the subject, revealing pull-back' },
  { id: 'orbit-l', label: 'Orbit Left', glyph: '↺', clause: 'camera orbits smoothly around the subject to the left, circular tracking motion' },
  { id: 'orbit-r', label: 'Orbit Right', glyph: '↻', clause: 'camera orbits smoothly around the subject to the right, circular tracking motion' },
  { id: 'crane-up', label: 'Crane Up', glyph: '↑', clause: 'camera cranes upward, rising vertical movement revealing the scene from above' },
  { id: 'crane-down', label: 'Crane Down', glyph: '↓', clause: 'camera cranes downward, descending vertical movement' },
  { id: 'pan-l', label: 'Pan Left', glyph: '⟲', clause: 'camera pans horizontally to the left, smooth rotation on axis' },
  { id: 'pan-r', label: 'Pan Right', glyph: '⟳', clause: 'camera pans horizontally to the right, smooth rotation on axis' },
  { id: 'tracking', label: 'Tracking', glyph: '⇶', clause: 'camera tracks alongside the subject, following lateral movement' },
  { id: 'push-handheld', label: 'Push + Handheld', glyph: '≈→', clause: 'handheld camera pushes in toward the subject, natural handheld sway, documentary feel' },
  { id: 'slow-zoom', label: 'Slow Zoom', glyph: '◎', clause: 'slow optical zoom in on the subject, gradual tightening of frame' },
];

const WEIGHT_CLAUSE = {
  slow: 'slow contemplative pacing, gentle drift',
  natural: 'natural even pacing',
  energetic: 'fast energetic pacing, dynamic motion',
};

const LOOK_CLAUSE = {
  clean: 'clean modern digital cinematography',
  'film-grain': 'subtle film grain, analog film look',
  'teal-orange': 'teal and orange color grade, cinematic color contrast',
  noir: 'high-contrast noir lighting, deep shadows, moody atmosphere',
};

export const WEIGHTS = ['slow', 'natural', 'energetic'];
export const LOOKS = ['clean', 'film-grain', 'teal-orange', 'noir'];

const BASE_NEGATIVE = 'static, blurry, low quality, watermark, distorted, jump cut, warping, morphing, flicker';

/** Compile a camera-move selection into a prompt clause (motion + weight + look). */
export function compileCameraClause({ move = 'static', weight = 'natural', look = 'clean' } = {}) {
  const m = MOVES.find((x) => x.id === move) || MOVES[0];
  const clauses = [m.clause, WEIGHT_CLAUSE[weight] || '', LOOK_CLAUSE[look] || ''].filter(Boolean);
  return clauses.join(', ');
}

/** Full compile: subject prompt + camera grammar → { prompt, negative }. */
export function compileShot({ prompt = '', move = 'static', weight = 'natural', look = 'clean' } = {}) {
  const clause = compileCameraClause({ move, weight, look });
  const subject = prompt.trim();
  return {
    prompt: [subject, clause].filter(Boolean).join(', '),
    negative: BASE_NEGATIVE,
  };
}
