// ── Featured games ───────────────────────────────────────────────────────
// The flagship KinetikCircle games that ship inside ArgantaLab as static HTML
// (served from <arganta>/games/<file>). They are built-in — the Game Builder
// shows them in the Featured group for visibility + live preview, but they are
// not edited here. The list is sized for 4 today, scales to 10+ later.

export interface FeaturedGame {
  id: string
  file: string
  name: string
  emoji: string
  tags: string[]
  hue: number
  desc: string
}

export const FEATURED_GAMES: FeaturedGame[] = [
  { id: 'strike',   file: 'AppGame_Strike_Zone_3D.html',           name: 'Strike Zone 3D',    emoji: '🎯', tags: ['3D', 'Shooter'],  hue: 210, desc: 'Health, weapons, coins, and a shop. The first product built with AI + HTML.' },
  { id: 'nitro',    file: 'AppGame_Nitro_Edge_Racing.html',        name: 'Nitro Edge Racing', emoji: '🏎️', tags: ['Racing', 'Arcade'], hue: 18,  desc: 'High-speed neon racer. Drift the edge and chase the leaderboard.' },
  { id: 'critter',  file: 'AppGame_Strike_Zone_Critter_Keys.html', name: 'Critter Keys',      emoji: '⌨️', tags: ['Typing', 'Arcade'], hue: 285, desc: 'Catch critters by hitting the right keys. Fast typing fun.' },
  { id: 'kincatch', file: 'AppGame_Strike_Zone_Kincatch.html',     name: 'Kincatch',          emoji: '🥅', tags: ['Catch', 'Reflex'],  hue: 150, desc: 'A reflex catching game. Quick hands, quick mind.' },
]

// Where the built-in games are hosted. Override per-environment with
// VITE_ARGANTA_URL; falls back to the production ArgantaLab deployment.
export const ARGANTA_URL =
  ((import.meta.env.VITE_ARGANTA_URL as string) || 'https://argantalab.vercel.app').replace(/\/$/, '')

export const featuredUrl = (file: string) => `${ARGANTA_URL}/games/${file}`

// Gradient art for a featured card, matching ArgantaLab's gameThumb hue scheme.
export const featuredArt = (hue: number) => ({
  background: `linear-gradient(135deg, hsl(${hue},75%,52%) 0%, hsl(${(hue + 55) % 360},65%,30%) 100%)`,
})
