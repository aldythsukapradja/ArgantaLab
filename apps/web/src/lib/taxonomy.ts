// Maps each item to a Bloom cognitive level and a Cambridge Life Competency,
// so analytics can report *depth of thinking* and *competency growth* — not just
// subject coverage. Pure functions; no state.

// ── Bloom's revised taxonomy (depth of thinking) ────────────────
// Derived from the interaction type. Five working bands (Evaluate folds into
// Create for kid-facing reporting).
export type Bloom = 'remember' | 'understand' | 'apply' | 'analyze' | 'create'

const BLOOM_BY_TYPE: Record<string, Bloom> = {
  listen: 'remember', speed: 'remember', match: 'remember',
  mcq: 'understand', multi: 'understand', type: 'understand', cloze: 'understand',
  bank: 'apply', sort: 'apply', seq: 'apply', numline: 'apply', slider: 'apply',
  fix: 'analyze', label: 'analyze', map: 'analyze', pte: 'analyze',
  code: 'create', party: 'create',
}

export function bloomFor(type: string): Bloom {
  return BLOOM_BY_TYPE[type] ?? 'understand'
}

export const BLOOM_ORDER: Bloom[] = ['remember', 'understand', 'apply', 'analyze', 'create']
export const BLOOM_META: Record<Bloom, { label: string; color: string }> = {
  remember:   { label: 'Remember',  color: '#378ADD' },
  understand: { label: 'Understand', color: '#1D9E75' },
  apply:      { label: 'Apply',      color: '#639922' },
  analyze:    { label: 'Analyse',    color: '#BA7517' },
  create:     { label: 'Create',     color: '#D85A30' },
}

// ── Cambridge Life Competencies (cross-curricular spine) ────────
export type Competency =
  | 'critical-thinking' | 'creativity' | 'learning-to-learn'
  | 'communication' | 'collaboration' | 'social-responsibility'
  | 'emotional-development' | 'digital-literacy'

export const COMPETENCY_META: Record<Competency, { label: string; short: string }> = {
  'critical-thinking':     { label: 'Critical thinking',     short: 'Thinking' },
  'creativity':            { label: 'Creativity',            short: 'Creativity' },
  'learning-to-learn':     { label: 'Learning to learn',     short: 'Learning' },
  'communication':         { label: 'Communication',         short: 'Comms' },
  'collaboration':         { label: 'Collaboration',         short: 'Teamwork' },
  'social-responsibility': { label: 'Social responsibility', short: 'Society' },
  'emotional-development': { label: 'Emotional development',  short: 'Emotions' },
  'digital-literacy':      { label: 'Digital literacy',      short: 'Digital' },
}

// World → default competency, with a few skill-level overrides where a skill
// clearly exercises a different competency than its world's default.
const COMPETENCY_BY_WORLD: Record<string, Competency> = {
  NUM: 'critical-thinking',
  WRD: 'communication',
  WON: 'critical-thinking',
  LOG: 'digital-literacy',
  WLD: 'social-responsibility',
  LIF: 'emotional-development',
}
const COMPETENCY_OVERRIDE: Record<string, Competency> = {
  'LOG/logic': 'critical-thinking',
  'NUM/geometry': 'critical-thinking',
  'WRD/writing': 'creativity',
  'WRD/reading': 'critical-thinking',
  'LIF/party': 'collaboration',
  'LIF/kindness': 'social-responsibility',
  'LIF/habits': 'learning-to-learn',
  'WON/earth': 'social-responsibility',
}

export function competencyFor(world: string, skill: string): Competency {
  return COMPETENCY_OVERRIDE[`${world}/${skill}`] ?? COMPETENCY_BY_WORLD[world] ?? 'critical-thinking'
}
