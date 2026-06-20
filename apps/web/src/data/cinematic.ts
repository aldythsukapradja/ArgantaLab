// ============================================================
//  ARGANTALAB · CINEMATIC LEARN LAYER
//  3D worlds + camera-driven lesson scenes (GSAP + Three.js)
// ============================================================

export type WorldId = 'city' | 'space' | 'neural'

export interface CScene {
  id: string
  cam: string          // camera preset name inside the world scene
  emoji: string        // big scene glyph
  badge?: string       // small pill label (e.g. "INPUT", "argantalab.com")
  headline: string     // the cinematic title for this beat
  analogy: string      // 🧩 analogy line
  real: string         // ⚙️ real-life / real-code line
  spotlight?: number   // index of a city building / object to highlight
  interactive?: {
    kind: 'type' | 'click' | 'slider' | 'tap'
    prompt: string     // instruction shown to the kid
  }
}

export interface CLesson {
  id: string
  tab: string
  world: WorldId
  num: string
  title: string
  location: string     // the named place in the world
  blurb: string
  scenes: CScene[]
  xp: number
  lock?: string[]
}

// ── World meta (intro card shown before the map) ─────────────
export const WORLDS: Record<WorldId, {
  tab: string
  name: string
  tagline: string
  enterLine: string
}> = {
  city: {
    tab: 'web',
    name: 'The Digital City',
    tagline: 'Every website is a building. You are the browser.',
    enterLine: 'The internet is a city. Right now.',
  },
  space: {
    tab: 'data',
    name: 'The Space Observatory',
    tagline: 'Data is invisible — until you look through the right lens.',
    enterLine: 'Out here, numbers become stars.',
  },
  neural: {
    tab: 'ai',
    name: 'The Neural Forge',
    tagline: 'This is what thinking looks like when electricity does it.',
    enterLine: 'Step inside the brain.',
  },
}

// ============================================================
//  WORLD 1 — THE DIGITAL CITY  (Web Quest)
// ============================================================

export const CINEMATIC_LESSONS: Record<string, CLesson> = {
  'web/internet-map': {
    id: 'web/internet-map',
    tab: 'web',
    world: 'city',
    num: '01',
    title: 'Internet Map',
    location: 'City Overview',
    blurb: 'Web, websites, domains, hosting, browser',
    xp: 30,
    scenes: [
      {
        id: 'orbit',
        cam: 'orbit',
        emoji: '🌃',
        badge: 'THE WEB',
        headline: 'The internet is a city. Right now.',
        analogy: 'A giant city of glowing buildings, joined by roads of light.',
        real: 'Billions of computers worldwide passing files to each other this second.',
      },
      {
        id: 'building',
        cam: 'approach',
        emoji: '🏢',
        badge: 'argantalab.com',
        headline: 'A website is just a building.',
        analogy: 'A house people visit — each page is a room inside it.',
        real: 'ArgantaLab is a website. Its rooms are Play, Learn, Build, and Ship.',
        spotlight: 0,
      },
      {
        id: 'street',
        cam: 'street',
        emoji: '📮',
        badge: 'THE ADDRESS',
        headline: 'The domain is the street address.',
        analogy: 'Your home address, so the pizza always finds your door.',
        real: 'Typing "argantalab.com" tells every browser on Earth where your files live.',
        spotlight: 0,
      },
      {
        id: 'ground',
        cam: 'ground',
        emoji: '🏝️',
        badge: 'HOSTING',
        headline: 'Hosting is the land it stands on.',
        analogy: 'The plot of land your house sits on — open 24 hours, every day.',
        real: 'Vercel keeps ArgantaLab online even at 3am here in Qatar.',
        spotlight: 0,
      },
      {
        id: 'drive',
        cam: 'drive',
        emoji: '🚗',
        badge: 'YOU = THE BROWSER',
        headline: 'You are the browser. Drive to a website.',
        analogy: 'The car that drives to the address and shows you the house.',
        real: 'Chrome or Safari loads index.html and paints it on your screen.',
        spotlight: 0,
        interactive: {
          kind: 'type',
          prompt: 'Type a website address and watch the city light it up.',
        },
      },
    ],
  },

  'web/app-machine': {
    id: 'web/app-machine',
    tab: 'web',
    world: 'city',
    num: '02',
    title: 'App Machine',
    location: 'The Skyscraper',
    blurb: 'Frontend, backend, database, API',
    xp: 30,
    lock: ['web/internet-map'],
    scenes: [
      {
        id: 'tower',
        cam: 'approach',
        emoji: '🏙️',
        badge: 'THE LAYERS',
        headline: 'Every app has layers, like floors.',
        analogy: 'A glass skyscraper — each floor does a different job.',
        real: 'ArgantaLab has a screen, an engine, a memory, and messengers.',
        spotlight: 0,
      },
      {
        id: 'lobby',
        cam: 'street',
        emoji: '🕹️',
        badge: 'FRONTEND',
        headline: 'Frontend — the part you touch.',
        analogy: 'The shiny lobby with buttons, screens, and a smiling welcome.',
        real: 'The Play button, the game cards, the lesson tiles — all frontend.',
        spotlight: 0,
      },
      {
        id: 'engine',
        cam: 'ground',
        emoji: '⚙️',
        badge: 'BACKEND',
        headline: 'Backend — the hidden engine.',
        analogy: 'The kitchen behind the restaurant. You never see it; it makes the food.',
        real: 'When you press Play, backend code decides which game file to send.',
        spotlight: 0,
      },
      {
        id: 'vault',
        cam: 'orbit',
        emoji: '🗄️',
        badge: 'DATABASE',
        headline: 'Database — the memory that never forgets.',
        analogy: 'A magic notebook that writes itself and never loses a page.',
        real: 'Your XP, badges, and diamonds are all stored in the database.',
        spotlight: 0,
      },
      {
        id: 'api',
        cam: 'drive',
        emoji: '📮',
        badge: 'API',
        headline: 'API — the messenger between every part.',
        analogy: 'Pneumatic tubes shooting messages between floors.',
        real: 'Your login → API → backend checks it → database saves → screen shows your name.',
        spotlight: 0,
        interactive: {
          kind: 'tap',
          prompt: 'Tap to send a message through the city and watch it travel.',
        },
      },
    ],
  },
}

// ── Helpers ───────────────────────────────────────────────────
export function isCinematic(lessonId: string): boolean {
  return lessonId in CINEMATIC_LESSONS
}

export function cinematicForTab(tab: string): CLesson[] {
  return Object.values(CINEMATIC_LESSONS).filter(l => l.tab === tab)
}
