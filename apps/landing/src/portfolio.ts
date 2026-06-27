// ── Portfolio data ────────────────────────────────────────────────────────
// Real shipped work, surfaced on the company site. Games are the HTML titles
// hosted inside ArgantaLab (lab.arganta.app/games/<file>).

const LAB = 'https://lab.arganta.app'

export interface Product {
  id: string
  name: string
  category: string
  tagline: string
  desc: string
  href: string
  gradient: string
  accent: string
  status: 'Live' | 'Beta'
}

export const PRODUCTS: Product[] = [
  {
    id: 'kinetik',
    name: 'KinetikCircle',
    category: 'Family Social',
    tagline: "Your family's private universe",
    desc: 'A private social app built only for families — moments, stories, albums and routines, shared inside a closed circle away from public feeds.',
    href: 'https://circle.arganta.app',
    gradient: 'linear-gradient(135deg, #0891b2, #22d3ee)',
    accent: '#0891b2',
    status: 'Live',
  },
  {
    id: 'lab',
    name: 'ArgantaLab',
    category: 'Kids Education',
    tagline: 'Where kids fall in love with learning',
    desc: 'A gamified learning super-app — mastery-based lessons, AI-authored mini-games, diamond rewards, and family circles that keep parents in the loop.',
    href: 'https://lab.arganta.app',
    gradient: 'linear-gradient(135deg, #5b21b6, #a78bfa)',
    accent: '#7c3aed',
    status: 'Live',
  },
  {
    id: 'hq',
    name: 'Circle HQ',
    category: 'Operator Platform',
    tagline: 'The command center for the ecosystem',
    desc: 'The founder OS that sits above every app — analytics, content management, a broadcast engine, and AI-powered builders for games, apps and lessons.',
    href: 'https://hq.arganta.app',
    gradient: 'linear-gradient(135deg, #7c3aed, #0ea5e9)',
    accent: '#6366f1',
    status: 'Live',
  },
]

export interface Game {
  id: string
  name: string
  emoji: string
  tags: string[]
  hue: number
  desc: string
  href: string
}

export const GAMES: Game[] = [
  { id: 'strike',   name: 'Strike Zone 3D',    emoji: '🎯', tags: ['3D', 'Shooter'],  hue: 210, desc: 'Health, weapons, coins and a shop. The first product built with AI + HTML.', href: `${LAB}/games/AppGame_Strike_Zone_3D.html` },
  { id: 'nitro',    name: 'Nitro Edge Racing', emoji: '🏎️', tags: ['Racing', 'Arcade'], hue: 18,  desc: 'High-speed neon racer. Drift the edge and chase the leaderboard.', href: `${LAB}/games/AppGame_Nitro_Edge_Racing.html` },
  { id: 'critter',  name: 'Critter Keys',      emoji: '⌨️', tags: ['Typing', 'Arcade'], hue: 285, desc: 'Catch critters by hitting the right keys. Fast, addictive typing fun.', href: `${LAB}/games/AppGame_Strike_Zone_Critter_Keys.html` },
  { id: 'kincatch', name: 'Kincatch',          emoji: '🥅', tags: ['Catch', 'Reflex'],  hue: 150, desc: 'A reflex catching game. Quick hands, quick mind.', href: `${LAB}/games/AppGame_Strike_Zone_Kincatch.html` },
]

export const ART = (hue: number) =>
  `linear-gradient(135deg, hsl(${hue},75%,52%) 0%, hsl(${(hue + 55) % 360},65%,32%) 100%)`
