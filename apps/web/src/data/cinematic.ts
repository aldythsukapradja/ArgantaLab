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
  effect?: 'normal' | 'xray' | 'paint'   // visual treatment of the city
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

  'web/build-map': {
    id: 'web/build-map',
    tab: 'web',
    world: 'city',
    num: '03',
    title: 'Build Map',
    location: 'Construction Site',
    blurb: 'index.html, components, game files',
    xp: 30,
    lock: ['web/app-machine'],
    scenes: [
      {
        id: 'plan', cam: 'orbit', emoji: '📐', badge: 'THE BLUEPRINT',
        headline: 'Every app starts as a plan.',
        analogy: 'A blueprint on a table before a single brick is laid.',
        real: 'index.html is the master plan the whole of ArgantaLab is built from.',
      },
      {
        id: 'lobby', cam: 'approach', emoji: '🏢', badge: 'index.html',
        headline: 'index.html is the front lobby.',
        analogy: 'The lobby every floor and room connects back to.',
        real: 'One file loads the whole app and opens every tab you click.',
        spotlight: 0,
      },
      {
        id: 'blocks', cam: 'street', emoji: '🧩', badge: 'COMPONENTS',
        headline: 'Components are reused blocks.',
        analogy: 'One LEGO brick, used a hundred times in different places.',
        real: 'Every game card looks the same because it is ONE component, reused.',
        spotlight: 0,
      },
      {
        id: 'worlds', cam: 'drive', emoji: '🛰️', badge: 'GAME FILES',
        headline: 'Each game is its own world.',
        analogy: 'Separate planets you fly to only when you visit them.',
        real: 'Every game you build is its own HTML file, opened only when you play it.',
        spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to open a game world' },
      },
    ],
  },

  'web/system-chain': {
    id: 'web/system-chain',
    tab: 'web',
    world: 'city',
    num: '04',
    title: 'System Chain',
    location: 'The Marble Run',
    blurb: 'Input, process, output, feedback',
    xp: 30,
    lock: ['web/build-map'],
    scenes: [
      {
        id: 'chain', cam: 'orbit', emoji: '⛓️', badge: 'THE CHAIN',
        headline: 'Everything is a chain.',
        analogy: 'A marble run — one start, one finish, every time.',
        real: 'Input → Process → Output. Every app, every click, the same shape.',
      },
      {
        id: 'input', cam: 'street', emoji: '🔘', badge: 'INPUT',
        headline: 'Input starts the chain.',
        analogy: 'Dropping the marble at the very top of the run.',
        real: 'Pressing Play, tapping a key, clicking a card — that is the input.',
      },
      {
        id: 'process', cam: 'ground', emoji: '⚙️', badge: 'PROCESS',
        headline: 'Process does the work.',
        analogy: 'Every gear, ramp, and flip moving the marble along.',
        real: 'Code figures out which game you picked and gets it ready.',
        spotlight: 0,
      },
      {
        id: 'output', cam: 'approach', emoji: '🎁', badge: 'OUTPUT',
        headline: 'Output is what you see.',
        analogy: 'The bell that rings at the end of the marble run.',
        real: 'The game opens on your screen. That is the output.',
        spotlight: 0,
      },
      {
        id: 'feedback', cam: 'drive', emoji: '🔁', badge: 'FEEDBACK',
        headline: 'Output becomes the next input.',
        analogy: 'The marble rolls back to the top to run again.',
        real: 'Finishing a lesson earns XP, which unlocks the next lesson.',
        spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to run the whole chain' },
      },
    ],
  },

  'web/html-bones': {
    id: 'web/html-bones',
    tab: 'web',
    world: 'city',
    num: '05',
    title: 'HTML Bones',
    location: 'X-Ray Building',
    blurb: 'Tags, elements, the canvas',
    xp: 40,
    lock: ['web/system-chain'],
    scenes: [
      {
        id: 'solid', cam: 'approach', emoji: '🏢', badge: 'THE BUILDING', effect: 'normal',
        headline: 'Put on your X-ray glasses.',
        analogy: 'A solid building you have walked past a hundred times.',
        real: 'Every game looks solid — but it is built on a hidden skeleton.',
        spotlight: 0,
      },
      {
        id: 'bones', cam: 'approach', emoji: '🦴', badge: 'HTML BONES', effect: 'xray',
        headline: 'HTML is the skeleton.',
        analogy: 'The bones inside every body, holding the shape together.',
        real: '<div>, <canvas>, and <button> are the bones of your game.',
        spotlight: 0,
      },
      {
        id: 'tags', cam: 'street', emoji: '📦', badge: 'TAGS = BOXES', effect: 'xray',
        headline: 'Tags are labelled boxes.',
        analogy: 'Boxes inside boxes — rooms inside rooms.',
        real: '<div id="player"> is a box that holds your hero on the screen.',
        spotlight: 0,
      },
      {
        id: 'canvas', cam: 'ground', emoji: '🎭', badge: 'THE CANVAS', effect: 'xray',
        headline: 'The canvas is the stage.',
        analogy: 'A blank theatre stage where the whole show happens.',
        real: 'Your game draws everything — car, enemies, score — inside <canvas>.',
        spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap a bone to light it up' },
      },
    ],
  },

  'web/css-costume': {
    id: 'web/css-costume',
    tab: 'web',
    world: 'city',
    num: '06',
    title: 'CSS Costume',
    location: 'The Paint Factory',
    blurb: 'Colors, sizes, position, variables',
    xp: 40,
    lock: ['web/html-bones'],
    scenes: [
      {
        id: 'grey', cam: 'approach', emoji: '🩶', badge: 'NO COSTUME', effect: 'xray',
        headline: 'The skeleton has no costume yet.',
        analogy: 'A plain grey mannequin, waiting to be dressed.',
        real: 'HTML on its own has no colour — it is only structure.',
        spotlight: 0,
      },
      {
        id: 'paint', cam: 'approach', emoji: '🎨', badge: 'CSS COSTUME', effect: 'paint',
        headline: 'CSS paints everything.',
        analogy: 'A costume wardrobe — same actor, a brand-new look.',
        real: 'background: #0a0a2e; turns your whole game midnight blue in one line.',
        spotlight: 0,
      },
      {
        id: 'place', cam: 'street', emoji: '📐', badge: 'SIZE & PLACE', effect: 'paint',
        headline: 'CSS places every piece.',
        analogy: 'Pinning a photo to a corkboard exactly where you want it.',
        real: 'top: 50px; left: 100px; places your car precisely on the screen.',
        spotlight: 0,
      },
      {
        id: 'tin', cam: 'drive', emoji: '🌈', badge: 'ONE TIN', effect: 'paint',
        headline: 'Change one colour, change everything.',
        analogy: 'One named paint tin used on every wall in the city.',
        real: 'A CSS variable — change it once and the whole game restyles instantly.',
        spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to repaint the whole city' },
      },
    ],
  },

  'web/js-brain': {
    id: 'web/js-brain',
    tab: 'web',
    world: 'city',
    num: '07',
    title: 'JavaScript Brain',
    location: 'The Control Room',
    blurb: 'Variables, if/then, functions',
    xp: 40,
    lock: ['web/css-costume'],
    scenes: [
      {
        id: 'brain', cam: 'inside', emoji: '🧠', badge: 'THE BRAIN',
        headline: 'JavaScript is the brain.',
        analogy: 'The rulebook of a board game — every "if you land here…" lives here.',
        real: 'JS decides what happens, when it happens, and to what.',
      },
      {
        id: 'vars', cam: 'inside', emoji: '📦', badge: 'VARIABLES',
        headline: 'Variables are labelled jars.',
        analogy: 'A jar you can fill, empty, and change whenever you like.',
        real: 'let speed = 5 — change the 5 to 10 and your car doubles its speed.',
        spotlight: 0,
      },
      {
        id: 'ifthen', cam: 'street', emoji: '🚦', badge: 'IF / THEN',
        headline: 'Games are just IF / THEN rules.',
        analogy: 'Traffic lights — IF red THEN stop, IF green THEN go.',
        real: 'if (hit) { lives-- } — IF you crash THEN you lose a life.',
        spotlight: 0,
      },
      {
        id: 'fn', cam: 'approach', emoji: '⚙️', badge: 'FUNCTIONS',
        headline: 'Functions are reusable buttons.',
        analogy: 'A vending machine button — press D7, get the same snack every time.',
        real: 'function jump() runs the exact same jump code each time you call it.',
        spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Press the function button' },
      },
    ],
  },

  'web/game-loop': {
    id: 'web/game-loop',
    tab: 'web',
    world: 'city',
    num: '08',
    title: 'Game Loop',
    location: 'The Carousel',
    blurb: 'Check, update, draw — 60 times a second',
    xp: 50,
    lock: ['web/js-brain'],
    scenes: [
      {
        id: 'heartbeat', cam: 'orbit', emoji: '🫀', badge: 'THE HEARTBEAT',
        headline: 'A game has a heartbeat.',
        analogy: 'A drummer keeping the beat — stop, and everything freezes.',
        real: '60 times every second, your game updates and redraws itself.',
      },
      {
        id: 'check', cam: 'street', emoji: '🕹️', badge: 'STEP 1 · CHECK',
        headline: 'Step 1: check the controls.',
        analogy: 'Checking your phone for new messages, over and over.',
        real: 'Each frame: is an arrow key pressed? Is space held down?',
        spotlight: 0,
      },
      {
        id: 'update', cam: 'ground', emoji: '⚙️', badge: 'STEP 2 · UPDATE',
        headline: 'Step 2: move everything.',
        analogy: 'Spinning the board one turn — every piece shifts forward.',
        real: 'Move the enemies, check for crashes, add points to the score.',
        spotlight: 0,
      },
      {
        id: 'draw', cam: 'approach', emoji: '🎨', badge: 'STEP 3 · DRAW',
        headline: 'Step 3: paint the new frame.',
        analogy: 'Wiping the whiteboard clean and redrawing it.',
        real: 'Clear the canvas, then draw everything in its new position.',
        spotlight: 0,
      },
      {
        id: 'fast', cam: 'drive', emoji: '🏁', badge: '60× A SECOND',
        headline: 'Do it fast — and it comes alive.',
        analogy: 'A flip-book flicked fast looks like real movement.',
        real: 'requestAnimationFrame runs the whole loop about 60 times per second.',
        spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to start the game loop' },
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
