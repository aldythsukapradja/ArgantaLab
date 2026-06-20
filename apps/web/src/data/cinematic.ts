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

  // ==========================================================
  //  WORLD 2 — THE SPACE OBSERVATORY  (Data Lab)
  // ==========================================================

  'data/game-stats': {
    id: 'data/game-stats', tab: 'data', world: 'space', num: '01',
    title: 'Game Stats', location: 'The Numbers Planet',
    blurb: 'Count, average, max, min, trend', xp: 40,
    scenes: [
      { id: 'planet', cam: 'orbit', emoji: '🪐', badge: 'NUMBERS PLANET',
        headline: 'This whole planet is made of data.',
        analogy: 'A planet whose moons are floating numbers.',
        real: "Right now it's just noise — let's turn it into meaning." },
      { id: 'count', cam: 'surface', emoji: '🫙', badge: 'COUNT',
        headline: 'Count is the simplest stat.',
        analogy: 'Counting how many marbles are in a jar.',
        real: 'You played 5 matches. Count = 5. That easy.' },
      { id: 'avg', cam: 'surface', emoji: '⚖️', badge: 'AVERAGE',
        headline: 'Average is the fair share.',
        analogy: 'Sharing candy equally among friends.',
        real: '(80+40+120+90+30) ÷ 5 = 72 coins per match.' },
      { id: 'maxmin', cam: 'approach', emoji: '🏔️', badge: 'MAX & MIN',
        headline: 'Max and min are best and worst.',
        analogy: 'The tallest and shortest kid in class.',
        real: 'Best match: 120 coins. Worst match: 30 coins.', spotlight: 0 },
      { id: 'trend', cam: 'drift', emoji: '📈', badge: 'TREND',
        headline: 'Trend is the direction you are heading.',
        analogy: 'Height marks on a door frame — are you growing?',
        real: 'Are your coins climbing match after match?', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to plot your trend' } },
    ],
  },

  'data/chart-magic': {
    id: 'data/chart-magic', tab: 'data', world: 'space', num: '02',
    title: 'Chart Magic', location: 'The Hologram Room',
    blurb: 'Line, bar, pie, heatmap', xp: 40, lock: ['data/game-stats'],
    scenes: [
      { id: 'holo', cam: 'orbit', emoji: '✨', badge: 'HOLOGRAM ROOM',
        headline: 'Charts are pictures of data.',
        analogy: 'A hologram that turns numbers into shapes you can see.',
        real: 'Pick the right chart and the story jumps out instantly.' },
      { id: 'line', cam: 'surface', emoji: '📈', badge: 'LINE',
        headline: 'A line shows change over time.',
        analogy: 'Footprints showing the path you walked.',
        real: 'Coins each match — watch them rise and fall.' },
      { id: 'bar', cam: 'surface', emoji: '📊', badge: 'BAR',
        headline: 'Bars compare things side by side.',
        analogy: 'Stacking blocks to see whose tower is tallest.',
        real: 'Which weapon won the most games?', spotlight: 0 },
      { id: 'pie', cam: 'approach', emoji: '🥧', badge: 'PIE',
        headline: 'A pie shows shares of a whole.',
        analogy: 'Slicing a pizza into pieces.',
        real: 'How much each weapon was used out of the total.', spotlight: 0 },
      { id: 'heat', cam: 'drift', emoji: '🔥', badge: 'HEATMAP',
        headline: 'A heatmap shows where it is busy.',
        analogy: 'A calendar where busy days glow brighter.',
        real: 'Which days of the week you played the most.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to reveal the pattern' } },
    ],
  },

  'data/game-dashboard': {
    id: 'data/game-dashboard', tab: 'data', world: 'space', num: '03',
    title: 'My Game Dashboard', location: 'Mission Control',
    blurb: 'KPIs, trends, insight, action', xp: 40, lock: ['data/chart-magic'],
    scenes: [
      { id: 'control', cam: 'console', emoji: '🛰️', badge: 'MISSION CONTROL',
        headline: 'A dashboard shows what matters most.',
        analogy: 'The few dials on a spaceship you actually watch.',
        real: 'Your most important numbers, all in one place.' },
      { id: 'kpi', cam: 'console', emoji: '🎯', badge: 'KPIs',
        headline: 'KPIs are your key numbers.',
        analogy: 'Speed, fuel, temperature — the dials that matter.',
        real: 'Plays this week, star rating, diamonds earned.', spotlight: 0 },
      { id: 'trend', cam: 'approach', emoji: '🧭', badge: 'TRENDS',
        headline: 'Trends show your direction.',
        analogy: 'A compass pointing where you are heading.',
        real: 'More players this week than last? That is a trend.', spotlight: 0 },
      { id: 'insight', cam: 'surface', emoji: '💡', badge: 'INSIGHT',
        headline: 'An insight tells you what to do next.',
        analogy: "The 'aha!' that explains why your team won.",
        real: '"Games with power-ups get 2× plays — add one!"', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to reveal the insight' } },
    ],
  },

  'data/prediction-bot': {
    id: 'data/prediction-bot', tab: 'data', world: 'space', num: '04',
    title: 'Prediction Bot', location: 'The Weather Tower',
    blurb: 'Signals, formula, predict, ML', xp: 40, lock: ['data/game-dashboard'],
    scenes: [
      { id: 'tower', cam: 'orbit', emoji: '⛅', badge: 'WEATHER TOWER',
        headline: 'A prediction is a smart guess.',
        analogy: 'A weather forecast — clever, not magic.',
        real: 'Data finds patterns, then guesses what comes next.' },
      { id: 'signals', cam: 'surface', emoji: '🕵️', badge: 'SIGNALS',
        headline: 'Signals are the clues.',
        analogy: 'Clues a detective collects at the scene.',
        real: 'Accuracy, win streak, deaths, weapon — the clues.' },
      { id: 'formula', cam: 'approach', emoji: '🧮', badge: 'FORMULA',
        headline: 'A formula mixes the clues into a score.',
        analogy: 'A recipe combining ingredients into one dish.',
        real: 'Weigh the signals together into a single win-score.', spotlight: 0 },
      { id: 'ml', cam: 'console', emoji: '📚', badge: 'MACHINE LEARNING',
        headline: 'ML learns from lots of examples.',
        analogy: 'A puppy learning tricks from practice.',
        real: 'Real ML sharpens its guesses by studying tons of past games.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to forecast a win' } },
    ],
  },

  'data/diamond-scroll': {
    id: 'data/diamond-scroll', tab: 'data', world: 'space', num: '05',
    title: 'Diamond Scroll', location: 'The Crystal Cave',
    blurb: 'Earn, spend, track, creator economy', xp: 50, lock: ['data/prediction-bot'],
    scenes: [
      { id: 'cave', cam: 'orbit', emoji: '💎', badge: 'CRYSTAL CAVE',
        headline: 'Diamonds are the money of ArgantaLab.',
        analogy: 'A cave glittering with crystals you have earned.',
        real: 'Understanding where they come from and go is real BI.' },
      { id: 'earn', cam: 'surface', emoji: '🍋', badge: 'EARNING',
        headline: 'You earn by making things people enjoy.',
        analogy: 'A lemonade stand — more buyers, more earnings.',
        real: 'Each play of your game earns you +1 💎.' },
      { id: 'spend', cam: 'approach', emoji: '💸', badge: 'SPENDING',
        headline: 'Spending is investing in yourself.',
        analogy: 'Buying a new kit — costs now, shines later.',
        real: '50 💎 for a Legendary skin makes your profile stand out.', spotlight: 0 },
      { id: 'economy', cam: 'console', emoji: '🏦', badge: 'CREATOR ECONOMY',
        headline: 'Popular creators earn while they sleep.',
        analogy: 'A musician paid each time someone streams their song.',
        real: 'Your game is a song; every play is a stream. You are the artist.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to grow your diamonds' } },
    ],
  },

  'data/leaderboard-math': {
    id: 'data/leaderboard-math', tab: 'data', world: 'space', num: '06',
    title: 'Leaderboard Math', location: 'The Arena',
    blurb: 'Ranking, scoring, circle vs world, badges', xp: 50, lock: ['data/diamond-scroll'],
    scenes: [
      { id: 'arena', cam: 'orbit', emoji: '🏟️', badge: 'THE ARENA',
        headline: 'A leaderboard is just sorted data.',
        analogy: 'A sports table — same teams, sorted by score.',
        real: 'Every player has a number; sort highest to lowest. Done.' },
      { id: 'score', cam: 'surface', emoji: '⚖️', badge: 'SCORING',
        headline: 'The formula decides who wins.',
        analogy: 'A report card — each subject weighted differently.',
        real: 'XP = lessons×5 + games×30 + reviews×10 + plays×1.' },
      { id: 'scope', cam: 'approach', emoji: '🌍', badge: 'CIRCLE vs WORLD',
        headline: 'Two arenas: your circle and the world.',
        analogy: 'School champion vs national champion.',
        real: 'Your circle is your school; the world board is the Olympics.', spotlight: 0 },
      { id: 'badges', cam: 'drift', emoji: '🎖️', badge: 'BADGES',
        headline: 'Badges you earn once and keep forever.',
        analogy: 'Merit badges sewn on for good.',
        real: '"First Game", "100 Players", "5-Star Game" — all yours.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to climb the ranks' } },
    ],
  },

  // ==========================================================
  //  WORLD 3 — THE NEURAL FORGE  (AI Forge)
  // ==========================================================

  'ai/prompt-power': {
    id: 'ai/prompt-power', tab: 'ai', world: 'neural', num: '01',
    title: 'Prompt Power', location: 'The Message Terminal',
    blurb: 'Messy vs clear prompts, iterate', xp: 40,
    scenes: [
      { id: 'forge', cam: 'orbit', emoji: '🧠', badge: 'NEURAL FORGE',
        headline: 'Step inside the thinking machine.',
        analogy: 'A city of light where ideas travel as pulses.',
        real: 'Everything you ask an AI begins here, with a prompt.' },
      { id: 'prompt', cam: 'terminal', emoji: '💬', badge: 'THE PROMPT',
        headline: 'A prompt is your instruction.',
        analogy: 'Ordering food — the clearer you ask, the better it comes.',
        real: 'A prompt is the text you give AI to say what to build.' },
      { id: 'fuzzy', cam: 'terminal', emoji: '💥', badge: 'MESSY',
        headline: 'A messy prompt gives a fuzzy result.',
        analogy: "Ordering 'food' at a restaurant — you get... something.",
        real: '"make a game" → AI has no idea of type, age, controls, or style.' },
      { id: 'clear', cam: 'core', emoji: '📐', badge: 'CRYSTAL CLEAR',
        headline: 'A clear prompt gives a sharp result.',
        analogy: '"A cheese pizza, medium, no onions." Perfect order.',
        real: '"A 2D racing game for a 9-year-old, keyboard, neon, 3 lives."', spotlight: 0 },
      { id: 'iterate', cam: 'drift', emoji: '🔁', badge: 'ITERATE',
        headline: 'Make it better, again and again.',
        analogy: 'Sending the dish back for a little more cheese.',
        real: 'Refine the prompt until the game feels just right.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to sharpen the prompt' } },
    ],
  },

  'ai/chatgpt-brain': {
    id: 'ai/chatgpt-brain', tab: 'ai', world: 'neural', num: '02',
    title: 'ChatGPT Brain', location: 'The Neuron Cluster',
    blurb: 'Idea partner, explainer, designer, director', xp: 40, lock: ['ai/prompt-power'],
    scenes: [
      { id: 'idea', cam: 'approach', emoji: '💡', badge: 'IDEA PARTNER',
        headline: 'AI brainstorms with you.',
        analogy: 'A friend who lists ten ideas in seconds.',
        real: 'Ask for game ideas and it gives you ten instantly.' },
      { id: 'explain', cam: 'core', emoji: '📖', badge: 'EXPLAINER',
        headline: 'AI makes hard things simple.',
        analogy: 'A teacher who shrinks big words down to size.',
        real: 'It can explain "iframe" in one kid-friendly sentence.', spotlight: 0 },
      { id: 'design', cam: 'approach', emoji: '🎨', badge: 'DESIGNER',
        headline: 'AI plans before building.',
        analogy: 'An architect sketching before builders start.',
        real: 'It plans the screens and colours before any code is written.' },
      { id: 'direct', cam: 'terminal', emoji: '🎬', badge: 'YOU DIRECT',
        headline: 'You are the director.',
        analogy: 'You direct the movie; the AI is the crew.',
        real: 'It suggests — you choose, change, and own the final game.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to direct the AI' } },
    ],
  },

  'ai/ai-game-helper': {
    id: 'ai/ai-game-helper', tab: 'ai', world: 'neural', num: '03',
    title: 'AI Game Helper', location: 'The Workshop',
    blurb: 'Your build teammate — ask, read the diff, decide', xp: 40, lock: ['ai/chatgpt-brain'],
    scenes: [
      { id: 'shop', cam: 'terminal', emoji: '🧑‍🔧', badge: 'THE WORKSHOP',
        headline: 'AI is your build teammate.',
        analogy: 'A mechanic you describe the noise to — it fixes, you drive.',
        real: 'Type "make my car faster" → AI changes speed = 5 to speed = 10.' },
      { id: 'specific', cam: 'core', emoji: '🎯', badge: 'BE SPECIFIC',
        headline: 'Specific asks get better fixes.',
        analogy: '"Fix the front-left tyre," not "fix the car."',
        real: '"Change the background to dark blue" beats "make it cooler."', spotlight: 0 },
      { id: 'diff', cam: 'approach', emoji: '👀', badge: 'READ THE DIFF',
        headline: 'Always read what changed.',
        analogy: 'The mechanic shows you exactly what they tightened.',
        real: 'Builder Lab highlights changed lines in yellow before you accept.' },
      { id: 'decide', cam: 'drift', emoji: '✅', badge: 'YOU DECIDE',
        headline: 'Test it before you keep it.',
        analogy: 'A test-drive before you pay the mechanic.',
        real: 'Press Preview after AI changes — does it play better? Keep it.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to fix the game' } },
    ],
  },

  'ai/agent-command': {
    id: 'ai/agent-command', tab: 'ai', world: 'neural', num: '04',
    title: 'Agent Command', location: 'The Drone Bay',
    blurb: 'LLM + tools + memory + goal', xp: 40, lock: ['ai/ai-game-helper'],
    scenes: [
      { id: 'bay', cam: 'orbit', emoji: '🤖', badge: 'THE DRONE BAY',
        headline: 'An agent works on its own.',
        analogy: 'A robot with a brain, hands, a notebook, and a mission.',
        real: 'LLM + tools + memory + a goal, working step by step.' },
      { id: 'llm', cam: 'core', emoji: '🧠', badge: 'LLM',
        headline: 'The LLM is the brain.',
        analogy: 'A brain that understands and speaks language.',
        real: 'The part that reads your words and writes back.', spotlight: 0 },
      { id: 'tools', cam: 'approach', emoji: '🔧', badge: 'TOOLS',
        headline: 'Tools are its hands.',
        analogy: 'Hands that can actually pick things up.',
        real: 'Reading files, searching, and running code.' },
      { id: 'goal', cam: 'terminal', emoji: '📓', badge: 'MEMORY + GOAL',
        headline: 'Memory and a goal keep it on track.',
        analogy: 'A notebook it carries while chasing a mission.',
        real: 'It remembers your goal and works toward it on its own.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to launch the agent' } },
    ],
  },

  'ai/builder-assist': {
    id: 'ai/builder-assist', tab: 'ai', world: 'neural', num: '05',
    title: 'Builder Assist', location: 'The Lab',
    blurb: 'Explain button, prompt bar, templates', xp: 50, lock: ['ai/agent-command'],
    scenes: [
      { id: 'explain', cam: 'terminal', emoji: '❓', badge: 'EXPLAIN BUTTON',
        headline: 'Every line of code has a story.',
        analogy: 'A dictionary where every word has a picture.',
        real: 'Click [?] on any line to see what it does in kid language.' },
      { id: 'bar', cam: 'core', emoji: '🖱️', badge: 'PROMPT BAR',
        headline: 'Just ask in plain words.',
        analogy: 'Texting a friend "can you move the couch?" — they do it.',
        real: 'Type "make my background space" → AI updates the CSS for you.', spotlight: 0 },
      { id: 'templates', cam: 'approach', emoji: '🔀', badge: 'TEMPLATES',
        headline: 'Start from a template.',
        analogy: 'Starting with a recipe instead of inventing one.',
        real: 'Pick Racing → working code loads → customise it from there.' },
      { id: 'yours', cam: 'drift', emoji: '🚀', badge: 'MAKE IT YOURS',
        headline: 'Every great game starts as someone’s template.',
        analogy: 'A plain t-shirt you print your own design on.',
        real: 'Load, tweak, publish — now it is yours.', spotlight: 0,
        interactive: { kind: 'tap', prompt: 'Tap to start building' } },
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
