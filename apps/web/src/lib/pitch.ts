// ============================================================
//  PITCH DECKS  (kids pitch their game)  — local-first store
//  A deck = a template + 6 filled slides. Saved per device and
//  surfaced in the Ship tab's pitch showcase.
// ============================================================

export interface PitchDeck {
  id: string
  template: string          // template key
  title: string
  author: string
  gameId?: string           // optional link to a built game
  slides: Record<string, string>  // slideKey → text
  emoji: string
  updatedAt: number
}

export const PITCH_SLIDES: { key: string; label: string; hint: string }[] = [
  { key: 'title', label: 'Title', hint: 'Your game\'s name' },
  { key: 'idea', label: 'The Big Idea', hint: 'What is your game about?' },
  { key: 'play', label: 'How to Play', hint: 'What does the player do?' },
  { key: 'best', label: 'Best Moment', hint: 'The most fun part!' },
  { key: 'learned', label: 'What I Learned', hint: 'A skill you used to build it' },
  { key: 'cta', label: 'Play Now!', hint: 'Why should they try it?' },
]

const KEY = 'argantalab_pitches_v1'

export function loadPitches(): PitchDeck[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function savePitch(deck: PitchDeck): PitchDeck[] {
  const all = loadPitches().filter(d => d.id !== deck.id)
  all.unshift({ ...deck, updatedAt: Date.now() })
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
  return all
}

export function deletePitch(id: string): PitchDeck[] {
  const all = loadPitches().filter(d => d.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
  return all
}

export function newPitch(template: string, author: string): PitchDeck {
  return {
    id: Math.random().toString(36).slice(2, 10),
    template,
    title: '',
    author,
    slides: {},
    emoji: PITCH_TEMPLATES.find(t => t.key === template)?.emoji ?? '🎮',
    updatedAt: Date.now(),
  }
}

export interface PitchTemplate {
  key: string
  name: string
  emoji: string
  tagline: string
  c1: string          // primary
  c2: string          // secondary
  particle: 'stars' | 'sparkles' | 'energy' | 'bubbles' | 'leaves'
}

export const PITCH_TEMPLATES: PitchTemplate[] = [
  { key: 'space', name: 'Space Mission', emoji: '🚀', tagline: 'Blast off into the stars', c1: '#6366f1', c2: '#06b6d4', particle: 'stars' },
  { key: 'fantasy', name: 'Fantasy Quest', emoji: '🏰', tagline: 'Magic, dragons & legends', c1: '#a855f7', c2: '#ec4899', particle: 'sparkles' },
  { key: 'sports', name: 'Sports Arena', emoji: '🏆', tagline: 'Go for the win', c1: '#22c55e', c2: '#84cc16', particle: 'energy' },
  { key: 'lab', name: 'Science Lab', emoji: '🧪', tagline: 'Experiment & discover', c1: '#0ea5e9', c2: '#14b8a6', particle: 'bubbles' },
  { key: 'adventure', name: 'Wild Adventure', emoji: '🗺️', tagline: 'Explore the unknown', c1: '#f59e0b', c2: '#ef4444', particle: 'leaves' },
]

export const TEMPLATE_BY_KEY: Record<string, PitchTemplate> =
  Object.fromEntries(PITCH_TEMPLATES.map(t => [t.key, t]))
