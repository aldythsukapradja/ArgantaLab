// ============================================================
//  GAME WIZARD — option catalogue (keys shared with gameGen.ts)
// ============================================================

export interface Opt { key: string; label: string; emoji: string; note?: string; price?: number; rarity?: 'rare' | 'epic' | 'legendary' }

export interface WizardConfig {
  type: string
  world: string
  character: string
  style: string
  speed: string
  difficulty: string
  powerups: string[]
  title: string
}

export const GAME_TYPES: Opt[] = [
  { key: 'catch', label: 'Catch', emoji: '🧺', note: 'Catch the good stuff, dodge the bombs.' },
  { key: 'dodge', label: 'Dodge', emoji: '🏎️', note: 'Weave through obstacles, grab coins.' },
  { key: 'blast', label: 'Blast', emoji: '🚀', note: 'Shoot the invaders before they land.' },
]

export const WORLDS: Opt[] = [
  { key: 'space', label: 'Space', emoji: '🌌' },
  { key: 'ocean', label: 'Ocean', emoji: '🌊' },
  { key: 'volcano', label: 'Volcano', emoji: '🌋' },
  { key: 'ice', label: 'Ice Kingdom', emoji: '🧊' },
  { key: 'jungle', label: 'Jungle', emoji: '🌿' },
  { key: 'city', label: 'Neon City', emoji: '🏙️' },
  { key: 'desert', label: 'Lost Desert', emoji: '🏜️', price: 60, rarity: 'rare' },
  { key: 'candy', label: 'Candy Land', emoji: '🍭', price: 90, rarity: 'epic' },
  { key: 'galaxy', label: 'Galaxy', emoji: '🌠', price: 120, rarity: 'legendary' },
]

// Everything purchasable, for the Diamond Shop.
export function shopItems(): { kind: 'character' | 'world'; opt: Opt }[] {
  return [
    ...CHARACTERS.filter(o => o.price).map(opt => ({ kind: 'character' as const, opt })),
    ...WORLDS.filter(o => o.price).map(opt => ({ kind: 'world' as const, opt })),
  ]
}

export const CHARACTERS: Opt[] = [
  { key: 'robot', label: 'Robot', emoji: '🤖' },
  { key: 'dino', label: 'Dino', emoji: '🦕' },
  { key: 'dragon', label: 'Dragon', emoji: '🐉' },
  { key: 'unicorn', label: 'Unicorn', emoji: '🦄' },
  { key: 'ninja', label: 'Ninja', emoji: '🥷' },
  { key: 'astro', label: 'Astronaut', emoji: '👨‍🚀' },
  { key: 'wizard', label: 'Wizard', emoji: '🧙' },
  { key: 'cat', label: 'Cat', emoji: '🐱' },
  { key: 'ghost', label: 'Ghost', emoji: '👻', price: 50, rarity: 'rare' },
  { key: 'alien', label: 'Alien', emoji: '👽', price: 60, rarity: 'rare' },
  { key: 'fairy', label: 'Fairy', emoji: '🧚', price: 70, rarity: 'rare' },
  { key: 'trex', label: 'T-Rex', emoji: '🦖', price: 90, rarity: 'epic' },
  { key: 'hero', label: 'Super Hero', emoji: '🦸', price: 120, rarity: 'epic' },
  { key: 'gdragon', label: 'Golden Dragon', emoji: '🐲', price: 180, rarity: 'legendary' },
]

export const STYLES: Opt[] = [
  { key: 'classic', label: 'Classic', emoji: '🎮' },
  { key: 'neon', label: 'Neon', emoji: '⚡' },
  { key: 'kawaii', label: 'Kawaii', emoji: '🌸' },
  { key: 'retro', label: 'Retro 8-bit', emoji: '👾' },
]

export const SPEEDS: Opt[] = [
  { key: 'slow', label: 'Slow', emoji: '🐢' },
  { key: 'normal', label: 'Normal', emoji: '🐕' },
  { key: 'fast', label: 'Fast', emoji: '🐆' },
  { key: 'turbo', label: 'Turbo', emoji: '🚀' },
]

export const DIFFICULTIES: Opt[] = [
  { key: 'easy', label: 'Easy', emoji: '⭐' },
  { key: 'medium', label: 'Medium', emoji: '⭐⭐' },
  { key: 'hard', label: 'Hard', emoji: '⭐⭐⭐' },
]

export const POWERUPS: Opt[] = [
  { key: 'shield', label: 'Shield', emoji: '🛡️', note: 'A few seconds where nothing can hurt you.' },
  { key: 'magnet', label: 'Magnet', emoji: '🧲', note: 'Pulls the good things toward you.' },
  { key: 'double', label: 'Double Score', emoji: '⭐', note: 'Every point counts twice for a while.' },
  { key: 'life', label: 'Extra Life', emoji: '❤️', note: 'Find one to win back a heart.' },
]

// Each wizard step teaches a real concept (HTML / CSS / JS).
export const STEP_HINTS: Record<string, { tag: string; text: string }> = {
  type: { tag: '🧠 JS Brain', text: 'The Game Type is the brain — the rules that decide what happens when you play.' },
  world: { tag: '🎨 CSS Costume', text: 'The World is the costume — it paints the background and the colours of your game.' },
  character: { tag: '🦴 HTML Bones', text: 'Your Character is something placed on the screen — like a picture in a box.' },
  style: { tag: '🎨 CSS Variables', text: 'Style changes one set of colours, and the whole game matches it instantly.' },
  settings: { tag: '🧠 JS Variable', text: 'Speed is a number in the code: let speed = 5. A bigger number means a faster game!' },
  powerups: { tag: '🧠 IF / THEN', text: 'Power-ups are rules: IF you grab the shield, THEN nothing can hurt you for a while.' },
}

export const STEPS = ['type', 'world', 'character', 'style', 'settings', 'powerups', 'play'] as const
export type WizardStep = typeof STEPS[number]

export function defaultConfig(): WizardConfig {
  return { type: '', world: '', character: '', style: 'classic', speed: 'normal', difficulty: 'easy', powerups: [], title: '' }
}

// A friendly auto-title from the choices, e.g. "Neon Ninja Blast".
export function suggestTitle(c: WizardConfig): string {
  const style = STYLES.find(s => s.key === c.style)?.label ?? ''
  const char = CHARACTERS.find(s => s.key === c.character)?.label ?? ''
  const type = GAME_TYPES.find(s => s.key === c.type)?.label ?? 'Game'
  return [style !== 'Classic' ? style : '', char, type].filter(Boolean).join(' ').trim() || 'My Game'
}
