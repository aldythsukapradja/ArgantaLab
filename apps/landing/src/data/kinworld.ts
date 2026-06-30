// Real kin drawn from the ArgantaLab catalog (apps/web/src/data/openworld/kin.ts),
// curated to renders that exist in the ported KinSprite. These wander the KinWorld
// town basemap. x/y = start %, dx/dy = px patrol offset, dur = seconds.
export interface TownKin { render: string; color: string; name: string; x: number; y: number; dx: number; dy: number; dur: number }

export const TOWN_KIN: TownKin[] = [
  { render: 'countfox', color: '#f59e0b', name: 'Countfox', x: 16, y: 50, dx: 150, dy: 0, dur: 9 },
  { render: 'letterowl', color: '#3b82f6', name: 'Letterowl', x: 50, y: 14, dx: 0, dy: 130, dur: 8 },
  { render: 'datadragon', color: '#8b5cf6', name: 'Datadragon', x: 78, y: 46, dx: -140, dy: 0, dur: 10 },
  { render: 'mapturtle', color: '#ef4444', name: 'Mapturtle', x: 50, y: 80, dx: 0, dy: -120, dur: 11 },
  { render: 'galaxyfawn', color: '#10b981', name: 'Galaxyfawn', x: 30, y: 30, dx: 90, dy: 60, dur: 12 },
  { render: 'moodlamb', color: '#ec4899', name: 'Moodlamb', x: 68, y: 70, dx: -80, dy: -70, dur: 10 },
  { render: 'ciphercat', color: '#22c55e', name: 'Ciphercat', x: 24, y: 70, dx: 110, dy: -30, dur: 9 },
  { render: 'auroracrane', color: '#a855f7', name: 'Auroracrane', x: 72, y: 26, dx: -90, dy: 50, dur: 11 },
  { render: 'riverotter', color: '#0ea5e9', name: 'Riverotter', x: 40, y: 58, dx: 70, dy: 0, dur: 7 },
  { render: 'novabear', color: '#6366f1', name: 'Novabear', x: 60, y: 44, dx: -60, dy: 40, dur: 9 },
  { render: 'rhymefrog', color: '#2563eb', name: 'Rhymefrog', x: 34, y: 42, dx: 50, dy: 50, dur: 8 },
  { render: 'cloudcat', color: '#14b8a6', name: 'Cloudcat', x: 58, y: 60, dx: -50, dy: -40, dur: 10 },
]

// The six world habitats that make up the town (Nexus-style).
export const TOWN_HABITATS: { emoji: string; name: string; color: string; x: number; y: number }[] = [
  { emoji: '🏜️', name: 'Sunny Dunes', color: '#f59e0b', x: 12, y: 14 },
  { emoji: '🌳', name: 'Whisper Grove', color: '#3b82f6', x: 86, y: 14 },
  { emoji: '🔌', name: 'Neon Circuit', color: '#8b5cf6', x: 12, y: 86 },
  { emoji: '🐚', name: 'Tide Lagoon', color: '#ef4444', x: 86, y: 86 },
  { emoji: '☁️', name: 'Cloud Skyfield', color: '#10b981', x: 88, y: 50 },
  { emoji: '🌸', name: 'Mood Meadow', color: '#ec4899', x: 12, y: 50 },
]

// The cosmetic shop — real cosmetic render keys from the Buddy slots.
export const SHOP_COSMETICS: { slot: 'hat' | 'face' | 'back' | 'hand'; render: string; color: string; name: string; price: number }[] = [
  { slot: 'hat', render: 'crown', color: '#f59e0b', name: 'Royal Crown', price: 240 },
  { slot: 'hat', render: 'wizard', color: '#8b5cf6', name: 'Wizard Hat', price: 160 },
  { slot: 'face', render: 'shades', color: '#1e293b', name: 'Cool Shades', price: 90 },
  { slot: 'back', render: 'fairywings', color: '#ec4899', name: 'Fairy Wings', price: 200 },
  { slot: 'back', render: 'jetpack', color: '#06b6d4', name: 'Jetpack', price: 320 },
  { slot: 'hand', render: 'saber', color: '#22d3ee', name: 'Light Saber', price: 280 },
]
export const SHOP_MOUNTS: { render: string; color: string; name: string; price: number }[] = [
  { render: 'sandstrider', color: '#f59e0b', name: 'Sandstrider', price: 400 },
  { render: 'sandstrider', color: '#8b5cf6', name: 'Dawn Strider', price: 520 },
  { render: 'sandstrider', color: '#10b981', name: 'Meadow Strider', price: 460 },
]
