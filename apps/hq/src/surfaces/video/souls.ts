// V2 — soul_profile registry (data-driven, per plan §3/§V2). Data file first;
// a Supabase table can replace this later with zero call-site changes.
export interface StylePreset { id: string; label: string; clause: string }
export interface SoulProfile {
  id: string
  name: string
  triggerToken: string
  loraHint: string   // human-readable pointer to where the trained weights live
  status: 'draft' | 'approved'
}

export const SOULS: SoulProfile[] = [
  { id: 'arganta', name: 'ARGANTA', triggerToken: 'argxsoul', loraHint: 'arganta-character-studio/characters/arganta/training/checkpoints/v003-high', status: 'draft' },
]

export const STYLE_PRESETS: StylePreset[] = [
  { id: 'editorial', label: 'Editorial', clause: 'editorial photography, studio lighting, magazine quality' },
  { id: 'golden-hour', label: 'Golden Hour', clause: 'golden hour sunlight, warm tones, outdoor' },
  { id: 'studio-portrait', label: 'Studio Portrait', clause: 'studio portrait, seamless backdrop, soft key light' },
  { id: 'film-noir', label: 'Film Noir', clause: 'film noir lighting, high contrast black and white, dramatic shadows' },
  { id: 'street', label: 'Street', clause: 'candid street photography, natural light, urban background' },
  { id: 'y2k', label: 'Y2K', clause: 'Y2K aesthetic, digital camera flash, early 2000s style' },
]

export const POSE_PRESETS: StylePreset[] = [
  { id: 'front', label: 'Front closeup', clause: 'front-facing close-up portrait' },
  { id: 'three-q', label: '¾ profile', clause: 'three-quarter profile view' },
  { id: 'seated', label: 'Seated lean', clause: 'seated, leaning forward slightly' },
  { id: 'standing', label: 'Full-body stand', clause: 'full-body standing pose' },
]

/** 8-prompt identity consistency test matrix (per plan V2 acceptance). */
export function identityTestPrompts(): string[] {
  return [
    'front-facing close-up portrait, neutral expression, studio lighting',
    'three-quarter profile, smiling, golden hour sunlight',
    'seated, leaning forward, hand on chin, editorial photography',
    'full-body standing pose, navy suit, white seamless backdrop',
    'looking over shoulder, candid street photography, urban background',
    'laughing, three-quarter profile, warm outdoor light',
    'serious expression, film noir lighting, high contrast',
    'walking, full body, natural daylight',
  ]
}
