// V1 — cameraGrammar: the "camera codes" compiler that stands in for
// Higgsfield's Cinema Studio on our 8GB sovereign stack. Wan 2.2 Fun Camera
// (model-level camera control) targets a bigger GPU than we have, so v1
// compiles named camera moves + lens + motion weight + look into deterministic
// prompt/negative clauses fed to the existing comfyVideo() t2v/i2v graph — no
// graph changes required. Pure function, no I/O — easy to keep correct.

export type CameraMove =
  | 'static' | 'dolly-in' | 'dolly-out' | 'orbit-l' | 'orbit-r'
  | 'crane-up' | 'crane-down' | 'pan-l' | 'pan-r' | 'tracking' | 'push-handheld' | 'slow-zoom'

export type Lens = '24mm' | '35mm' | '50mm' | '85mm' | 'macro'
export type MotionWeight = 'slow' | 'natural' | 'energetic'
export type Look = 'clean' | 'film-grain' | 'teal-orange' | 'noir'

export interface MoveDef { id: CameraMove; label: string; glyph: string; clause: string }

export const MOVES: MoveDef[] = [
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
]

const LENS_CLAUSE: Record<Lens, string> = {
  '24mm': '24mm wide-angle lens, expansive perspective, deep depth of field',
  '35mm': '35mm lens, natural cinematic perspective',
  '50mm': '50mm lens, standard perspective, moderate depth of field',
  '85mm': '85mm portrait lens, shallow depth of field, soft background bokeh',
  'macro': 'macro lens, extreme close focus, very shallow depth of field',
}

const WEIGHT_CLAUSE: Record<MotionWeight, string> = {
  slow: 'slow contemplative pacing, gentle drift',
  natural: 'natural even pacing',
  energetic: 'fast energetic pacing, dynamic motion',
}

const LOOK_CLAUSE: Record<Look, string> = {
  clean: 'clean modern digital cinematography',
  'film-grain': 'subtle film grain, analog film look',
  'teal-orange': 'teal and orange color grade, cinematic color contrast',
  noir: 'high-contrast noir lighting, deep shadows, moody atmosphere',
}

const BASE_NEGATIVE = 'static, blurry, low quality, watermark, distorted, jump cut, warping, morphing, flicker'

export interface ShotSpec {
  move: CameraMove
  lens: Lens
  weight: MotionWeight
  look: Look
  prompt: string
}

export interface CompiledShot {
  prompt: string
  negative: string
}

/** Compile a Cinema Rack selection + subject prompt into graph-ready prompt/negative clauses. */
export function compileShot(spec: ShotSpec): CompiledShot {
  const move = MOVES.find((m) => m.id === spec.move) ?? MOVES[0]
  const subject = spec.prompt.trim()
  const clauses = [subject, move.clause, LENS_CLAUSE[spec.lens], WEIGHT_CLAUSE[spec.weight], LOOK_CLAUSE[spec.look]].filter(Boolean)
  return { prompt: clauses.join(', '), negative: BASE_NEGATIVE }
}

export const LENSES: Lens[] = ['24mm', '35mm', '50mm', '85mm', 'macro']
export const WEIGHTS: MotionWeight[] = ['slow', 'natural', 'energetic']
export const LOOKS: Look[] = ['clean', 'film-grain', 'teal-orange', 'noir']
