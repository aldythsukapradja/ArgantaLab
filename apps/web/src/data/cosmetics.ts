// ============================================================
//  ARGANTALAB · AVATAR COSMETICS CATALOG  (Roblox-style)
//  Six independent slots. Each item has a `render` key that the
//  Buddy avatar knows how to draw, plus a diamond price (0 = free).
//  Try-on is free; buying spends diamonds and unlocks for keeps.
// ============================================================

export type Slot = 'skin' | 'hat' | 'face' | 'back' | 'hand' | 'bg'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Cosmetic {
  id: string            // unique, e.g. 'hat:wizard'
  slot: Slot
  render: string        // drawing key the Buddy switches on
  name: string
  color: string
  price: number         // diamonds; 0 = free / starter
  rarity: Rarity
}

export const SLOTS: { key: Slot; label: string; emoji: string }[] = [
  { key: 'skin', label: 'Skins', emoji: '🎨' },
  { key: 'hat', label: 'Hats', emoji: '🎩' },
  { key: 'face', label: 'Face', emoji: '🕶️' },
  { key: 'back', label: 'Back', emoji: '🪽' },
  { key: 'hand', label: 'Hand', emoji: '🪄' },
  { key: 'bg', label: 'Worlds', emoji: '🌌' },
]

export const RARITY_META: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'COMMON', color: '#94a3b8' },
  rare: { label: 'RARE', color: '#3b82f6' },
  epic: { label: 'EPIC', color: '#a855f7' },
  legendary: { label: 'LEGENDARY', color: '#f59e0b' },
}

const c = (slot: Slot, render: string, name: string, color: string, price: number, rarity: Rarity): Cosmetic =>
  ({ id: `${slot}:${render}`, slot, render, name, color, price, rarity })

// ── SKINS (body colour / pattern) ───────────────────────────
const SKINS: Cosmetic[] = [
  c('skin', 'default', 'Purple Pal', '#8b5cf6', 0, 'common'),
  c('skin', 'blue', 'Blueberry', '#3b82f6', 0, 'common'),
  c('skin', 'mint', 'Minty', '#10b981', 0, 'common'),
  c('skin', 'sunny', 'Sunny', '#f59e0b', 20, 'common'),
  c('skin', 'bubble', 'Bubblegum', '#ec4899', 20, 'common'),
  c('skin', 'robot', 'Robot', '#9ca3af', 60, 'rare'),
  c('skin', 'alien', 'Alien', '#22c55e', 60, 'rare'),
  c('skin', 'slime', 'Slime', '#84cc16', 70, 'rare'),
  c('skin', 'ice', 'Ice', '#67e8f9', 90, 'epic'),
  c('skin', 'lava', 'Lava', '#ef4444', 90, 'epic'),
  c('skin', 'dragon', 'Dragon', '#dc2626', 120, 'epic'),
  c('skin', 'galaxy', 'Galaxy', '#6366f1', 160, 'legendary'),
  c('skin', 'rainbow', 'Rainbow', '#f43f5e', 200, 'legendary'),
  c('skin', 'golden', 'Golden', '#facc15', 250, 'legendary'),
]

// ── HATS ────────────────────────────────────────────────────
const HATS: Cosmetic[] = [
  c('hat', 'cap', 'Ball Cap', '#3b82f6', 15, 'common'),
  c('hat', 'beanie', 'Beanie', '#ef4444', 15, 'common'),
  c('hat', 'beret', 'Artist Beret', '#1e293b', 20, 'common'),
  c('hat', 'flower', 'Flower Crown', '#ec4899', 30, 'common'),
  c('hat', 'party', 'Party Cone', '#f59e0b', 30, 'common'),
  c('hat', 'bucket', 'Bucket Hat', '#14b8a6', 35, 'rare'),
  c('hat', 'cowboy', 'Cowboy Hat', '#b45309', 45, 'rare'),
  c('hat', 'chef', 'Chef Hat', '#f8fafc', 45, 'rare'),
  c('hat', 'grad', 'Graduation Cap', '#0f172a', 55, 'rare'),
  c('hat', 'pirate', 'Pirate Hat', '#111827', 60, 'rare'),
  c('hat', 'wizard', 'Wizard Hat', '#7c3aed', 80, 'epic'),
  c('hat', 'tophat', 'Top Hat', '#111827', 80, 'epic'),
  c('hat', 'halo', 'Angel Halo', '#fde047', 120, 'epic'),
  c('hat', 'crown', 'Royal Crown', '#facc15', 200, 'legendary'),
]

// ── FACE ────────────────────────────────────────────────────
const FACE: Cosmetic[] = [
  c('face', 'glasses', 'Round Glasses', '#1e293b', 15, 'common'),
  c('face', 'shades', 'Cool Shades', '#0f172a', 25, 'common'),
  c('face', 'star', 'Star Glasses', '#f59e0b', 35, 'rare'),
  c('face', 'monocle', 'Fancy Monocle', '#facc15', 40, 'rare'),
  c('face', 'goggles', 'Lab Goggles', '#10b981', 40, 'rare'),
  c('face', 'eyepatch', 'Pirate Patch', '#111827', 45, 'rare'),
  c('face', 'ski', 'Ski Goggles', '#06b6d4', 55, 'rare'),
  c('face', '3d', '3D Glasses', '#ef4444', 60, 'epic'),
  c('face', 'vr', 'VR Headset', '#6366f1', 110, 'epic'),
  c('face', 'cyber', 'Cyber Visor', '#22d3ee', 150, 'legendary'),
]

// ── BACK ────────────────────────────────────────────────────
const BACK: Cosmetic[] = [
  c('back', 'backpack', 'Backpack', '#f59e0b', 25, 'common'),
  c('back', 'scarf', 'Hero Scarf', '#ef4444', 30, 'common'),
  c('back', 'cape', 'Super Cape', '#3b82f6', 40, 'rare'),
  c('back', 'shell', 'Turtle Shell', '#16a34a', 45, 'rare'),
  c('back', 'balloon', 'Balloon Pack', '#ec4899', 50, 'rare'),
  c('back', 'fairywings', 'Fairy Wings', '#f0abfc', 70, 'epic'),
  c('back', 'batwings', 'Bat Wings', '#1e293b', 80, 'epic'),
  c('back', 'jetpack', 'Jetpack', '#94a3b8', 90, 'epic'),
  c('back', 'angelwings', 'Angel Wings', '#f8fafc', 120, 'epic'),
  c('back', 'dragonwings', 'Dragon Wings', '#dc2626', 160, 'legendary'),
  c('back', 'rocket', 'Rocket', '#ef4444', 180, 'legendary'),
]

// ── HAND ────────────────────────────────────────────────────
const HAND: Cosmetic[] = [
  c('hand', 'pencil', 'Pencil', '#f59e0b', 15, 'common'),
  c('hand', 'book', 'Book', '#3b82f6', 20, 'common'),
  c('hand', 'balloon', 'Balloon', '#ec4899', 20, 'common'),
  c('hand', 'flag', 'Flag', '#22c55e', 25, 'common'),
  c('hand', 'paintbrush', 'Paintbrush', '#a855f7', 30, 'rare'),
  c('hand', 'torch', 'Torch', '#f97316', 35, 'rare'),
  c('hand', 'mic', 'Microphone', '#6366f1', 45, 'rare'),
  c('hand', 'shield', 'Shield', '#0ea5e9', 55, 'rare'),
  c('hand', 'trophy', 'Trophy', '#facc15', 70, 'epic'),
  c('hand', 'wand', 'Magic Wand', '#a855f7', 80, 'epic'),
  c('hand', 'sword', 'Hero Sword', '#e2e8f0', 110, 'epic'),
  c('hand', 'saber', 'Light Saber', '#22d3ee', 160, 'legendary'),
]

// ── BACKGROUNDS (scene behind the avatar) ───────────────────
const BG: Cosmetic[] = [
  c('bg', 'studio', 'Studio', '#1e293b', 0, 'common'),
  c('bg', 'sky', 'Blue Sky', '#38bdf8', 0, 'common'),
  c('bg', 'grid', 'Neon Grid', '#7c3aed', 20, 'common'),
  c('bg', 'forest', 'Forest', '#16a34a', 30, 'common'),
  c('bg', 'beach', 'Beach', '#fbbf24', 35, 'rare'),
  c('bg', 'sunset', 'Sunset', '#fb7185', 40, 'rare'),
  c('bg', 'underwater', 'Underwater', '#0891b2', 45, 'rare'),
  c('bg', 'city', 'Neon City', '#6366f1', 55, 'rare'),
  c('bg', 'space', 'Outer Space', '#1e1b4b', 70, 'epic'),
  c('bg', 'candy', 'Candy Land', '#f472b6', 80, 'epic'),
  c('bg', 'galaxy', 'Galaxy', '#7c3aed', 120, 'legendary'),
  c('bg', 'rainbow', 'Rainbow Road', '#f43f5e', 150, 'legendary'),
]

export const COSMETICS: Cosmetic[] = [...SKINS, ...HATS, ...FACE, ...BACK, ...HAND, ...BG]
export const COSMETIC_BY_ID: Record<string, Cosmetic> = Object.fromEntries(COSMETICS.map(x => [x.id, x]))

export function cosmeticsForSlot(slot: Slot): Cosmetic[] {
  return COSMETICS.filter(x => x.slot === slot)
}

// The free starter loadout every kid begins with.
export const DEFAULT_OUTFIT: Record<Slot, string> = {
  skin: 'skin:default',
  hat: '',
  face: '',
  back: '',
  hand: '',
  bg: 'bg:sky',
}

// The Buddy renderer takes a resolved outfit: slot → {render, color}.
export type ResolvedOutfit = Partial<Record<Slot, { render: string; color: string }>>

export function resolveOutfit(equipped: Partial<Record<Slot, string>>): ResolvedOutfit {
  const out: ResolvedOutfit = {}
  for (const slot of Object.keys(equipped) as Slot[]) {
    const id = equipped[slot]
    if (!id) continue
    const item = COSMETIC_BY_ID[id]
    if (item) out[slot] = { render: item.render, color: item.color }
  }
  return out
}
