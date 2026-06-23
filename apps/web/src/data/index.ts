// ============================================================
//  ARGANTALAB · DATA LAYER  (ported from monolith)
// ============================================================

export interface LessonSlide {
  ic: string; t: string; an: string; re: string
}
export interface Lesson {
  tab: string; num: string; title: string; blurb: string; key: string
  slides: (LessonSlide | [string, string, string])[]
  vocab: [string, string][]; mission: string[]; xp: number
  interactive?: string; lock?: string[]
}
export interface Game {
  id: string; file: string; name: string; tags: string[]
  hue: number; featured: boolean; desc: string
}
export interface NavItem {
  tab: string; label: string; short: string; icon: string; group: string
}
export interface ModuleItem {
  id: string
  l: Pick<Lesson, 'num' | 'title' | 'blurb' | 'xp'>
}

// ── Icons ────────────────────────────────────────────────────
export const I: Record<string, string> = {
  arganta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="6" width="18" height="12" rx="4"/><circle cx="8.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><path d="M15 11v2M16 12h-2" stroke-linecap="round"/></svg>`,
  web: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18"/></svg>`,
  ai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" stroke-linejoin="round"/><circle cx="18" cy="17" r="1.4"/><circle cx="6" cy="17" r="1"/></svg>`,
  data: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M5 19V11M10 19V6M15 19v-5M20 19v-9"/></svg>`,
  studio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8M12 17v4M8 9h3M8 12h5M16 9h1M16 12h1"/></svg>`,
  launch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round"><path d="M5 15c-1 2-1 4-1 4s2 0 4-1m-3-3c1-5 4-9 11-11 0 7-4 10-9 11l-2 0z"/><path d="M9 15l-1-1c0-2 1-4 3-6"/><circle cx="14.5" cy="9.5" r="1.3"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M10 14v3M14 14v3M8 20h8M9 20l.5-3M15 20l-.5-3"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" opacity=".5"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r="1" fill="currentColor"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  full: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
}

export const LOGO = `<svg width="32" height="32" viewBox="0 0 40 40"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4D9FFF"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs><rect x="3" y="3" width="34" height="34" rx="11" fill="url(#lg)"/><g style="transform-origin:20px 20px;animation:spinlogo 9s linear infinite"><path d="M20 10l8 4.5v9L20 28l-8-4.5v-9z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.9)" stroke-width="1.4" stroke-linejoin="round"/><path d="M20 10v18M12 14.5l8 4 8-4" stroke="rgba(255,255,255,.6)" stroke-width="1.1" fill="none"/></g><circle cx="20" cy="20" r="2.4" fill="#fff"/><style>@keyframes spinlogo{to{transform:rotate(360deg)}}</style></svg>`

// ── Navigation ───────────────────────────────────────────────
//  Play (home) · Learn (6 learning worlds) · Build · Ship · You
export const NAV: NavItem[] = [
  { tab: 'arganta',   label: 'ArgantaLab',   short: 'Home',     icon: 'arganta',   group: 'PLAY' },
  { tab: 'quests',    label: 'Quests',       short: 'Quests',   icon: 'quests',    group: 'PLAY' },
  { tab: 'num',       label: 'NumberDash',   short: 'Number',   icon: 'num',       group: 'LEARN' },
  { tab: 'wrd',       label: 'WordQuest',    short: 'Words',    icon: 'wrd',       group: 'LEARN' },
  { tab: 'won',       label: 'WonderLab',    short: 'Science',  icon: 'won',       group: 'LEARN' },
  { tab: 'log',       label: 'LogicLand',    short: 'Logic',    icon: 'log',       group: 'LEARN' },
  { tab: 'wld',       label: 'WorldTrail',   short: 'World',    icon: 'wld',       group: 'LEARN' },
  { tab: 'lif',       label: 'LifeQuest',    short: 'Life',     icon: 'lif',       group: 'LEARN' },
  { tab: 'studio',    label: 'Game Wizard',  short: 'Wizard',   icon: 'studio',    group: 'BUILD' },
  { tab: 'lab',       label: 'Builder Lab',  short: 'Lab',      icon: 'lab',       group: 'BUILD' },
  { tab: 'pitch',     label: 'Pitch Studio', short: 'Pitch',    icon: 'studio',    group: 'BUILD' },
  { tab: 'discover',  label: 'Discover',     short: 'Discover', icon: 'discover',  group: 'SHIP' },
  { tab: 'gamestore', label: 'My GameStore', short: 'Store',    icon: 'store',     group: 'SHIP' },
  { tab: 'profile',   label: 'Profile',      short: 'Profile',  icon: 'profile',   group: 'YOU' },
  { tab: 'parent',    label: 'Family Pulse', short: 'Pulse',    icon: 'parent2',   group: 'YOU' },
]

// The 6 learning worlds (Learn group), in display order.
export const WORLD_TABS = ['num', 'wrd', 'won', 'log', 'wld', 'lif']

// ── Mobile navigation: 5 grouped tabs ──
//  `members` = tabs that keep this dock item highlighted.
//  `pills`   = optional centre sub-nav pills (omit for hub-style groups).
export interface MobileTab { key: string; label: string; icon: string; members: string[]; pills?: string[] }
export const MOBILE_TABS: MobileTab[] = [
  { key: 'play',   label: 'Play',   icon: 'arganta',  members: ['arganta', 'quests'], pills: ['arganta', 'quests'] },
  { key: 'learn',  label: 'Learn',  icon: 'learn',    members: ['learn', ...WORLD_TABS] },
  { key: 'build',  label: 'Build',  icon: 'studio',   members: ['studio', 'lab', 'pitch'], pills: ['studio', 'lab', 'pitch'] },
  { key: 'ship',   label: 'Ship',   icon: 'discover', members: ['discover', 'gamestore'], pills: ['discover', 'gamestore'] },
  { key: 'avatar', label: 'You',    icon: 'avatar',   members: ['profile', 'parent', 'avatar', 'fame', 'shop'], pills: ['profile', 'parent'] },
]

// ── Games ────────────────────────────────────────────────────
export const GAMES: Game[] = [
  { id: 'strike',  file: 'AppGame_Strike_Zone_3D.html',          name: 'Strike Zone 3D',   tags: ['3D','Shooter'],  hue: 210, featured: true,  desc: 'Health, weapons, coins, and a shop. The first product built with AI + HTML.' },
  { id: 'nitro',   file: 'AppGame_Nitro_Edge_Racing.html',       name: 'Nitro Edge Racing', tags: ['Racing','Arcade'], hue: 18,  featured: false, desc: 'High-speed neon racer. Drift the edge and chase the leaderboard.' },
  { id: 'critter', file: 'AppGame_Strike_Zone_Critter_Keys.html', name: 'Critter Keys',     tags: ['Typing','Arcade'], hue: 285, featured: false, desc: 'Catch critters by hitting the right keys. Fast typing fun.' },
  { id: 'kincatch', file: 'AppGame_Strike_Zone_Kincatch.html',   name: 'Kincatch',          tags: ['Catch','Reflex'],  hue: 150, featured: false, desc: 'A reflex catching game. Quick hands, quick mind.' },
]

export function gameThumb(hue: number): string {
  return `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="t${hue}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},75%,55%)"/><stop offset="1" stop-color="hsl(${(hue+55)%360},65%,30%)"/></linearGradient></defs><rect width="300" height="200" fill="url(#t${hue})"/><circle cx="55" cy="50" r="65" fill="rgba(255,255,255,.12)"/><circle cx="250" cy="170" r="90" fill="rgba(0,0,0,.16)"/><polygon points="130,80 180,100 130,120" fill="rgba(255,255,255,.92)"/></svg>`
}

// ── Lessons ──────────────────────────────────────────────────
export const LESSONS: Record<string, Lesson> = {
  'web/internet-map': {
    tab:'web', num:'01', title:'Internet Map', blurb:'Web, websites, URLs, hosting, domains',
    key:'The internet is a network of computers sharing HTML files. A browser fetches and shows them.',
    slides:[
      {ic:'🌐',t:'The Web',an:'A giant city of houses joined by roads.',re:'Billions of computers worldwide passing files to each other right now.'},
      {ic:'🏠',t:'Website = a house',an:'A place people visit; each page is a room inside.',re:'argantalab.com is a website — its rooms are pages like Play and Learn.'},
      {ic:'📮',t:'Domain = the address',an:'The street address so visitors can find your house.',re:'Typing "argantalab.com" tells the browser where your files live.'},
      {ic:'🏝️',t:'Hosting = the land',an:'The plot of land your house sits on, open 24/7.',re:'GitHub Pages is free land that keeps ArgantaLab online day and night.'},
      {ic:'🚗',t:'Browser = the car',an:'The car that drives you to the address and shows the house.',re:'Chrome or Safari loads index.html and paints it on your screen.'},
    ],
    vocab:[['URL','web address'],['Domain','the name'],['Host','the server'],['HTML','the file'],['Browser','the reader']],
    mission:['Open DevTools (F12)','Look at the URL bar','Find index.html'], xp:40,
  },
  'web/app-machine': {
    tab:'web', num:'02', title:'App Machine', blurb:'Frontend, backend, database, API',
    key:'Every app has parts: the screen (frontend), hidden helpers (backend), memory (database), messengers (API).',
    slides:[
      {ic:'🕹️',t:'Frontend',an:"The arcade machine's screen and buttons you touch.",re:'The colorful pages, cards, and Play buttons you tap in ArgantaLab.'},
      {ic:'⚙️',t:'Backend',an:'The hidden engine inside the machine doing the work.',re:'Code that decides what happens when you press Play or finish a lesson.'},
      {ic:'🗄️',t:'Database',an:'A memory card that never forgets.',re:'Your XP, badges, and finished lessons, saved for next time.'},
      {ic:'📮',t:'API',an:'A waiter carrying orders between you and the kitchen.',re:'The messenger that fetches your coins and brings them to the screen.'},
    ],
    vocab:[['Frontend','the screen'],['Backend','the engine'],['Database','the vault'],['API','the messenger']],
    mission:['Press Play in ArgantaLab','Watch the game load','Notice progress saves'], xp:40,
  },
  'web/build-map': {
    tab:'web', num:'03', title:'Build Map', blurb:'Architecture, files, components',
    key:'index.html is the center of ArgantaLab. Tabs and game files orbit it.',
    slides:[
      {ic:'🏢',t:'index.html',an:'The lobby of a building everything connects to.',re:'The one file that loads ArgantaLab and opens every tab and game.'},
      {ic:'🧩',t:'Components',an:'LEGO blocks you reuse to build faster.',re:'Cards, buttons, and the nav are blocks reused on every screen.'},
      {ic:'🛰️',t:'Game files',an:'Separate planets you fly to when you visit.',re:'Each AppGame_*.html is its own world, opened only when you play it.'},
      {ic:'🌊',t:'Data flow',an:'Water flowing from a tap into a glass.',re:'A click sends data through the code, and the screen fills with the result.'},
    ],
    vocab:[['Shell','main file'],['Component','a block'],['Flow','how data moves']],
    mission:['Find index.html','List the 5 tabs','Spot an AppGame file'], xp:40, lock:['web/internet-map','web/app-machine'],
  },
  'web/system-chain': {
    tab:'web', num:'04', title:'System Chain', blurb:'Input, process, output, feedback',
    key:'Everything is a chain: Input then Process then Output. Output can loop back as new input.',
    slides:[
      {ic:'🔘',t:'Input',an:'Pressing a button on a vending machine.',re:'Your click, key press, or tap that starts everything.'},
      {ic:'⚙️',t:'Process',an:'The machine choosing and dropping your snack.',re:'Code decides what should happen from your input.'},
      {ic:'🎁',t:'Output',an:'The snack landing in the tray.',re:'The new screen, score, or game that appears for you.'},
      {ic:'🔁',t:'Feedback',an:'Eating it, then wanting another.',re:'Finishing a lesson raises XP, which unlocks the next lesson.'},
    ],
    vocab:[['Input','the start'],['Process','the work'],['Output','the result'],['State','what is saved']],
    mission:['Click Play, watch the chain','Finish a lesson, watch XP rise','Name one feedback loop'], xp:40, lock:['web/build-map'],
  },
  'ai/prompt-power': {
    tab:'ai', num:'01', title:'Prompt Power', blurb:'The 8-step prompt formula',
    key:'A messy prompt makes messy results. A structured prompt becomes a clean blueprint.',
    slides:[
      {ic:'🍕',t:'A prompt is an order',an:'Ordering food — the clearer you ask, the better it comes.',re:'A prompt is the text you give an AI to say exactly what to build.'},
      {ic:'💥',t:'Messy prompt',an:'"Make me food" — you get something random.',re:'"make a fun game" gives a confusing, random result.'},
      {ic:'📐',t:'Clear prompt',an:'"A cheese pizza, medium, no onions." Perfect order.',re:'"A 3D arena game for ages 8-14, keyboard controls, with coins."'},
      {ic:'🔁',t:'Iterate',an:'Sending the dish back to add more cheese.',re:'You refine the prompt again and again until the game feels right.'},
    ],
    vocab:[['Prompt','what you ask'],['Requirement','what you need'],['Iterate','improve again']],
    mission:['Write a bad prompt','Rewrite it with 4 steps','Compare results'], xp:40, interactive:'promptBuilder',
  },
  'ai/chatgpt-brain': {
    tab:'ai', num:'02', title:'ChatGPT Brain', blurb:'Idea partner, explainer, reviewer',
    key:'ChatGPT helps you think — but YOU are the director. It suggests; you decide.',
    slides:[
      {ic:'💡',t:'Idea partner',an:'A friend who brainstorms ten ideas in seconds.',re:'Ask ChatGPT for game ideas and it lists ten instantly.'},
      {ic:'📖',t:'Explainer',an:'A teacher who makes hard things simple.',re:'It can explain what an "iframe" is in one kid-friendly sentence.'},
      {ic:'🎨',t:'Designer',an:'An architect sketching before builders start.',re:'It plans the screens and colors before any code is written.'},
      {ic:'🎬',t:'You are the director',an:'You direct the movie; the AI is the crew.',re:'It suggests — you choose, change, and own the final game.'},
    ],
    vocab:[['LLM','language model'],['Prompt','your request'],['Director','you!']],
    mission:['Ask for 3 game ideas','Pick your favourite','Ask it to design first'], xp:40, lock:['ai/prompt-power'],
  },
  'ai/codex-builder': {
    tab:'ai', num:'03', title:'Codex Builder', blurb:'Your coding teammate',
    key:'Codex edits files and fixes bugs. Give it the file, expected behaviour, the bug, and a clear scope.',
    slides:[
      {ic:'🧑‍🔧',t:'Coding teammate',an:'A mechanic who fixes your car when you point to the noise.',re:'Codex edits your game files and repairs bugs you describe.'},
      {ic:'📁',t:'Name the file',an:'Telling the mechanic which car to open.',re:'Point to the exact game file you want Codex to edit.'},
      {ic:'🔍',t:'Expected vs actual',an:'"It should turn left, but it turns right."',re:'Describe what should happen and what actually goes wrong.'},
      {ic:'🎯',t:'Scope',an:'"Only fix the brakes, don\'t repaint the car."',re:'"Only change the movement code" keeps the rest of the game safe.'},
    ],
    vocab:[['Bug','a mistake'],['Fix','the repair'],['Scope','the limit']],
    mission:['Pick a file','Describe expected vs actual','Limit the scope'], xp:40, lock:['ai/chatgpt-brain'],
  },
  'ai/agent-command': {
    tab:'ai', num:'04', title:'Agent Command', blurb:'LLM + tools + memory + goal',
    key:'An agent = an LLM that uses tools, remembers, and chases a goal — step by step, on its own.',
    slides:[
      {ic:'🧠',t:'LLM',an:'A brain that understands and speaks language.',re:'The part of the AI that reads your words and writes back.'},
      {ic:'🔧',t:'Tools',an:'Hands that can actually pick things up.',re:'Abilities like reading files, searching, or running code.'},
      {ic:'📓',t:'Memory',an:'A notebook it carries between steps.',re:'What it remembers about your goal while it works.'},
      {ic:'🤖',t:'Agent = all of it',an:'A robot with a brain, hands, a notebook, and a mission.',re:'LLM + tools + memory + a goal, working step by step on its own.'},
    ],
    vocab:[['Agent','LLM + tools + goal'],['Tool','an ability'],['Workflow','the steps']],
    mission:['Name a goal','List 2 tools','Describe 1 step'], xp:40, lock:['ai/codex-builder'],
  },
  'data/game-stats': {
    tab:'data', num:'01', title:'Game Stats', blurb:'Count, average, max, min',
    key:'Statistics turn a pile of numbers into meaning: how many, what is normal, what is best.',
    slides:[
      {ic:'🫙',t:'Count',an:'Counting how many marbles are in a jar.',re:'How many matches you played — here it is 5.'},
      {ic:'⚖️',t:'Average',an:'Sharing candy equally among friends.',re:'Add all coins and split evenly — the normal amount per match (72).'},
      {ic:'🏔️',t:'Max & Min',an:'The tallest and shortest kid in class.',re:'Your best match (120 coins) and your worst (30 coins).'},
      {ic:'📈',t:'Trend',an:'Watching a plant grow taller each week.',re:'Are your coins climbing match after match? That is the trend.'},
    ],
    vocab:[['Count','total number'],['Average','the middle'],['Trend','up or down']],
    mission:['Find total matches','Calculate average coins','Spot the trend'], xp:40, interactive:'statsExplorer',
  },
  'data/chart-magic': {
    tab:'data', num:'02', title:'Chart Magic', blurb:'Line, bar, pie, heatmap',
    key:'A chart is a picture of data. Pick the right chart and the story jumps out instantly.',
    slides:[
      {ic:'📈',t:'Line chart',an:'Footprints showing the path you walked.',re:'Coins for each match — watch them rise and fall over time.'},
      {ic:'📊',t:'Bar chart',an:'Stacking blocks to see whose tower is tallest.',re:'Which weapon won the most games, compared side by side.'},
      {ic:'🥧',t:'Pie chart',an:'Slicing a pizza into shares.',re:'How much each weapon was used out of the whole.'},
      {ic:'🔥',t:'Heatmap',an:'A calendar where busy days glow brighter.',re:'Which days of the week you played the most.'},
    ],
    vocab:[['Axis','the sides'],['Series','a data line'],['Legend','the key']],
    mission:['Pick a chart type','Read the trend','Explain in 1 line'], xp:40, interactive:'chartMagic', lock:['data/game-stats'],
  },
  'data/boss-dashboard': {
    tab:'data', num:'03', title:'Boss Dashboard', blurb:'Business intelligence',
    key:'A dashboard shows the most important numbers in one place so an owner can decide fast.',
    slides:[
      {ic:'🎯',t:'KPIs',an:'The few dials on a car dashboard you really watch.',re:'Matches, win rate, coins, and XP — your most important numbers.'},
      {ic:'🧭',t:'Trends',an:'A compass showing which way you are heading.',re:'Are your wins climbing or dropping lately?'},
      {ic:'💡',t:'Insight',an:'The "aha!" that tells you what to do next.',re:'"Use the Marksman — it wins 80% of the time."'},
    ],
    vocab:[['KPI','key metric'],['BI','business intel'],['Insight','the takeaway']],
    mission:['Find best weapon','Find worst day','Write one insight'], xp:40, interactive:'dashboard', lock:['data/chart-magic'],
  },
  'data/prediction-bot': {
    tab:'data', num:'04', title:'Prediction Bot', blurb:'Rule-based prediction & ML',
    key:'Data science finds patterns. Machine learning lets the computer learn patterns from examples.',
    slides:[
      {ic:'🕵️',t:'Signals',an:'Clues a detective collects.',re:'Accuracy, win streak, deaths, and weapon are the clues.'},
      {ic:'🧮',t:'Formula',an:'A recipe that mixes clues into a score.',re:'Combine the signals with weights into one win-score.'},
      {ic:'⛅',t:'Predict',an:'A weather forecast — a smart guess, not magic.',re:'Turn the score into a win-chance, like 78%.'},
      {ic:'📚',t:'Machine learning',an:'A puppy learning tricks from lots of practice.',re:'Real ML sharpens its guesses by studying tons of past games.'},
    ],
    vocab:[['Data science','find patterns'],['ML','learns from data'],['Predict','a smart guess']],
    mission:['Move the sliders','Read the win chance','Try to reach 80%'], xp:40, interactive:'predictBot', lock:['data/boss-dashboard'],
  },
  'launch/github-trail': {
    tab:'launch', num:'02', title:'GitHub Trail', blurb:'Repo, commit, branch, README',
    key:'GitHub is like Google Drive for code, but every save has a story. A commit is a save point.',
    slides:[
      ['📦','Repository','The folder that holds your whole project.'],
      ['💾','Commit','A save point with a short story.'],
      ['🌿','Branch','A safe copy to try ideas on.'],
      ['📄','README','The front page that explains it all.'],
    ],
    vocab:[['Repo','project folder'],['Commit','a save'],['Branch','a copy']],
    mission:['Create a repo','Make a first commit','View history'], xp:40,
  },
  'launch/launch-pad': {
    tab:'launch', num:'03', title:'Launch Pad', blurb:'Deploy, hosting, GitHub Pages, PWA',
    key:'Deploy means publish to the web. GitHub Pages turns your repo into a live website with one switch.',
    slides:[
      ['🚀','Deploy','Push your files and flip Pages on.'],
      ['🏝','Hosting','GitHub keeps it online for free.'],
      ['📍','URL','Share username.github.io/argantalab.'],
      ['📱','Install','A PWA can live on the home screen.'],
    ],
    vocab:[['Deploy','go live'],['Pages','free hosting'],['PWA','app-like site']],
    mission:['Enable GitHub Pages','Copy the live URL','Open it on a phone'], xp:40, lock:['launch/github-trail'],
  },
}

export const CARMETA: Record<string, { e: string; t: string; s: string }> = {
  web:    { e:'Web Quest',     t:'How the web really works',   s:'Four cinematic lessons. Tap a card to focus it, press Start to dive in.' },
  ai:     { e:'AI Forge',      t:'Speak fluent machine',       s:'Prompts, AI teammates, and agents — one immersive stage at a time.' },
  data:   { e:'Data Lab',      t:'Turn play into proof',       s:'Charts, dashboards, predictions — each an interactive experience.' },
  launch: { e:'Launch Studio', t:'Ship it & sell it',          s:'Publish, pitch, and present — step onto the stage.' },
}

export const LEARN_EXTRAS: Record<string, {
  lab: { title:string; blurb:string; goal:string; tasks:[string,string][] }
  map: { title:string; center:string; nodes:[string,string][] }
}> = {
  web: {
    lab:{ title:'Web Practical Lab', blurb:'Trace one click from button to game window.', goal:'Prove you understand how ArgantaLab opens a game from a plain HTML file.', tasks:[['Find','Open index.html and locate the game list plus the Play button action.'],['Trace','Follow the click into GameModal and identify the iframe file name.'],['Test','Add or rename one AppGame file, publish it, then confirm it appears.'],['Explain','Say the flow in one sentence: click, route, iframe, game.']] },
    map:{ title:'Web Mind Map', center:'Web App System', nodes:[['Browser','Reads HTML, CSS, and JS, then paints the app.'],['Files','index.html is the hub; AppGame files are separate worlds.'],['Hosting','GitHub Pages keeps the files online.'],['Flow','Input becomes code action, output becomes screen change.'],['State','localStorage remembers XP, badges, and progress.'],['Deploy','Push files, refresh the site, test the live URL.']] },
  },
  data: {
    lab:{ title:'Data Practical Lab', blurb:'Turn play results into one clear decision.', goal:'Use game stats to make a better player or product decision.', tasks:[['Collect','Write five match rows: result, coins, weapon, deaths.'],['Calculate','Find average coins, best weapon, and worst death count.'],['Visualize','Pick line, bar, or donut and explain why.'],['Decide','Write one action: what should the player change next?']] },
    map:{ title:'Data Mind Map', center:'Data Decision System', nodes:[['Raw data','The match rows before they mean anything.'],['Stats','Count, average, max, min, and trend.'],['Charts','Pictures that make patterns easier to see.'],['Dashboard','The few numbers that matter right now.'],['Prediction','A rule or model that makes a smart guess.'],['Action','The decision you make from the evidence.']] },
  },
  ai: {
    lab:{ title:'AI Practical Lab', blurb:'Write, test, and improve a builder prompt.', goal:'Use AI like a teammate without giving away your director role.', tasks:[['Brief','Describe the game, audience, goal, controls, and style.'],['Prompt','Turn the brief into a structured request for Codex or ChatGPT.'],['Review','Compare expected vs actual and name the biggest mismatch.'],['Iterate','Send a sharper follow-up with one clear fix.']] },
    map:{ title:'AI Mind Map', center:'AI Builder System', nodes:[['Prompt','The instruction that shapes the answer.'],['Context','Files, goals, constraints, and examples.'],['Iteration','Small improvements after every result.'],['Tools','Reading, editing, running, and testing code.'],['Agent','Model plus tools plus memory chasing a goal.'],['Director','You choose what matters and approve the result.']] },
  },
}

export const SAMPLE = [
  {m:1,win:1,coins:80,weapon:'Rifle',deaths:2},
  {m:2,win:0,coins:40,weapon:'Pistol',deaths:5},
  {m:3,win:1,coins:120,weapon:'Marksman',deaths:1},
  {m:4,win:1,coins:90,weapon:'Marksman',deaths:2},
  {m:5,win:0,coins:30,weapon:'Pistol',deaths:6},
]

export const DEMO_SLIDES = [
  {t:'ArgantaLab',s:'Your HTML Game World',logo:true},
  {t:'What It Does',s:'Opens HTML games in one cinematic hub'},
  {t:'Live Demo',s:'Strike Zone 3D',demo:true},
  {t:'What I Learned',s:'Web · AI · Data · GitHub · Product'},
  {t:'What Comes Next',s:'More games · Leaderboard · Mobile 🚀'},
]

// ── Helpers ───────────────────────────────────────────────────
export function tabLessons(tab: string): [string, Lesson][] {
  return Object.entries(LESSONS).filter(([, l]) => l.tab === tab)
}

export function moduleItems(tab: string): ModuleItem[] {
  if (tab === 'launch') {
    const arr: ModuleItem[] = tabLessons('launch').map(([id, l]) => ({ id, l }))
    arr.push({ id:'pitch', l:{num:'04',title:'Pitch Studio',blurb:'The 9-step pitch formula and your editable script.',xp:40} })
    arr.push({ id:'demo',  l:{num:'05',title:'Demo Stage',  blurb:'A cinematic slide presentation with spotlight.',xp:40} })
    return arr
  }
  const arr: ModuleItem[] = tabLessons(tab).map(([id, l]) => ({ id, l }))
  const x = LEARN_EXTRAS[tab]
  if (x) {
    arr.push({ id:`lab/${tab}`,     l:{num:'LAB',title:x.lab.title,blurb:x.lab.blurb,xp:0} })
    arr.push({ id:`mindmap/${tab}`, l:{num:'MAP',title:x.map.title,blurb:'A one-screen summary of the whole concept.',xp:0} })
  }
  return arr
}

// ── SVG Charts (for interactive exercises) ───────────────────
export function lineChart(): string {
  const max=120, pts=SAMPLE.map((d,i)=>[24+i*72,130-(d.coins/max*100)])
  const path=pts.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' ')
  return `<svg viewBox="0 0 360 150" style="width:100%"><defs><linearGradient id="lc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><path d="${path} L${pts[pts.length-1][0]} 140 L${pts[0][0]} 140 Z" fill="url(#lc)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="var(--bg-2)" stroke="var(--accent)" stroke-width="2.5"/><text x="${p[0]}" y="148" font-size="10" fill="var(--t3)" text-anchor="middle">M${i+1}</text>`).join('')}</svg>`
}
export function barChart(): string {
  const w:{[k:string]:number}={Rifle:6,Pistol:2,Marksman:8},max=8,keys=Object.keys(w)
  return `<svg viewBox="0 0 360 150" style="width:100%">${keys.map((k,i)=>{const h=w[k]/max*100;return `<g><rect x="${46+i*108}" y="${130-h}" width="60" height="${h}" rx="9" fill="var(--accent)" opacity="${.5+i*.25}"/><text x="${76+i*108}" y="146" font-size="11" fill="var(--t2)" text-anchor="middle">${k}</text></g>`}).join('')}</svg>`
}
export function donutChart(): string {
  const d:[string,number,string][]=[['Marksman',8,'var(--accent)'],['Rifle',6,'var(--accent-2)'],['Pistol',2,'var(--cyan)']],total=16;let off=0;const R=46,C=2*Math.PI*R
  const segs=d.map(s=>{const len=C*(s[1]/total);const el=`<circle cx="80" cy="80" r="${R}" fill="none" stroke="${s[2]}" stroke-width="20" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`;off+=len;return el}).join('')
  return `<svg viewBox="0 0 160 160" style="width:120px">${segs}<text x="80" y="85" font-size="22" font-weight="800" fill="var(--t1)" text-anchor="middle">16</text></svg>`
}
