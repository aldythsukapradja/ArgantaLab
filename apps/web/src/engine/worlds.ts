// World palettes live in the engine (they're baked into every generated
// game); data/studio.ts re-exports them for the wizard UI.

export interface WorldDef {
  key: string; label: string; emoji: string
  bg1: string; bg2: string; tile: string; accent: string; glow: string
  price?: number; rarity?: 'rare' | 'epic' | 'legendary'
}

export const STUDIO_WORLDS: WorldDef[] = [
  { key: 'space',   label: 'Space',       emoji: '🌌', bg1: '#0a0e27', bg2: '#1a1147', tile: '#232a63', accent: '#818cf8', glow: '#c4b5fd' },
  { key: 'ocean',   label: 'Ocean',       emoji: '🌊', bg1: '#012a4a', bg2: '#01497c', tile: '#0b5e8f', accent: '#38bdf8', glow: '#7dd3fc' },
  { key: 'volcano', label: 'Volcano',     emoji: '🌋', bg1: '#2b0a0a', bg2: '#6a1212', tile: '#7f1d1d', accent: '#f97316', glow: '#fdba74' },
  { key: 'ice',     label: 'Ice Kingdom', emoji: '🧊', bg1: '#0a2a3a', bg2: '#16526b', tile: '#155e75', accent: '#67e8f9', glow: '#cffafe' },
  { key: 'jungle',  label: 'Jungle',      emoji: '🌿', bg1: '#0c2a12', bg2: '#1a4d24', tile: '#166534', accent: '#4ade80', glow: '#bbf7d0' },
  { key: 'city',    label: 'Neon City',   emoji: '🏙️', bg1: '#0a0a1a', bg2: '#241047', tile: '#312e81', accent: '#e879f9', glow: '#f0abfc' },
  { key: 'desert',  label: 'Lost Desert', emoji: '🏜️', bg1: '#3a2408', bg2: '#7c4a12', tile: '#92600e', accent: '#fbbf24', glow: '#fde68a', price: 60, rarity: 'rare' },
  { key: 'candy',   label: 'Candy Land',  emoji: '🍭', bg1: '#3d0a2e', bg2: '#7c1a5c', tile: '#9d2777', accent: '#f9a8d4', glow: '#fce7f3', price: 90, rarity: 'epic' },
  { key: 'galaxy',  label: 'Galaxy',      emoji: '🌠', bg1: '#050514', bg2: '#1e1b4b', tile: '#2e1065', accent: '#a78bfa', glow: '#ddd6fe', price: 120, rarity: 'legendary' },
]

export const worldDef = (key: string): WorldDef => STUDIO_WORLDS.find(w => w.key === key) ?? STUDIO_WORLDS[0]
