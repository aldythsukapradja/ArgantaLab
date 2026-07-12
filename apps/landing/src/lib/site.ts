// ── SITE — the single source of truth for every static fact on the landing page.
// Brand copy, thesis, market refs, products, founder, the North Star, competition,
// velocity, valuation and substrate facts. Every tab and presentation imports from
// here — no inline literals — so a number is written once and is consistent
// everywhere. Researched / reconciled to the HQ knowledge graph 2026-07-11.

export const SITE = {
  brand: {
    name: 'Arganta',
    tagline: 'One trusted OS for the modern family',
    email: 'hello@arganta.app',
    labUrl: 'https://lab.arganta.app',
  },

  hero: {
    kicker: 'Arganta',
    title: ['One trusted OS for', 'the modern family'],
    lede: 'We turn the screen time families already spend into intelligence, connection and growth — inside circles you trust.',
  },

  // the sharpened thesis + the real North Star (mirrors Circle HQ)
  thesis: { a: 'Kids see play.', b: 'Parents see growth.', c: 'The family plays together.' },
  northStar: {
    name: 'Weekly Two-Hook Families',
    short: 'W2F',
    def: 'A child learned AND a parent coordinated — in the same week.',
    line: 'Two customers who never conflict — the kid’s pull, the parent’s stick. The North Star can only rise if both products work.',
    hooks: [
      { k: 'The kid’s pull', v: 'A game worth opening every day — build, learn, earn, share.' },
      { k: 'The parent’s stick', v: 'The calm family OS the household actually runs on.' },
    ],
  },

  // ~5.5 hrs/day is the Common Sense Media tween figure — we were understating our
  // own problem at 2.5h. Directional, cited as a reference not a claim.
  problem: {
    stat: '5.5', unit: 'hrs / day',
    line: 'A childhood of screens, building nothing.',
    detail: 'That’s ~2,000 hours a year of a child’s attention — the most valuable resource on earth — spent on infinite scroll instead of skills.',
    source: 'Tween daily entertainment screen use, directional (Common Sense Media).',
  },

  market: {
    refs: [
      { n: '1.9B', l: 'children under 15 worldwide — the largest connected generation ever.' },
      { n: '$340B', l: 'consumer & digital learning spend by 2030.' },
      { n: 'both', l: 'nobody owns learning AND family coordination in one trusted graph — that seat is open.' },
    ],
    note: 'Directional global references — the wedge is the family graph, not a single category.',
  },

  // three multi-billion behaviors we fuse into one product (public-market anchored)
  whyNow: [
    { n: '124B', l: 'hours on Roblox, 2025 — kids already live in digital worlds.' },
    { n: '50M+', l: 'daily Duolingo learners — gamified habit works at scale.' },
    { n: '80M+', l: 'users on Life360 — households already organize in circles.' },
  ],

  // home proof strip (compact form of the above)
  proof: [
    ['5.5h', 'a day on screens'],
    ['124B', 'hours on Roblox'],
    ['50M+', 'daily Duolingo'],
    ['80M+', 'users · Life360'],
  ] as [string, string][],

  // safety — the #1 parent question, answered head-on (we have a GC office for it)
  trust: {
    line: 'Built safe, by design.',
    chips: ['No ads', 'No strangers', 'Private circles', 'COPPA / GDPR-K posture'],
  },

  // Owner-set order: KinetikCircle → ArgantaLab → LashiraBloom. Circle Apps is
  // hidden for now (hidden: true) — data kept so un-hiding is a one-flag change.
  products: [
    { id: 'kinetik', name: 'KinetikCircle', color: '#06b6d4', tag: 'The parent’s stick', line: 'Today, calendar, moments — the rhythm of family life.',
      wedge: 'Skylight and Cozi organize the week; none of them know what your kid learned today.', hidden: false },
    { id: 'argantalab', name: 'ArgantaLab', color: '#8b5cf6', tag: 'The kid’s pull', line: 'Learn, build & ship games — with KinQuest, the RPG that teaches.',
      wedge: 'Roblox has the hours, Duolingo has the habit — neither shows a parent what grew.', hidden: false },
    { id: 'lashira', name: 'LashiraBloom', color: '#65a30d', tag: 'The family plays together', line: 'A farm RPG the whole family plays — adults play, kids learn, same world.',
      wedge: 'The first family game where a parent’s playtime funds the kid’s learning — no incumbent has this loop.', hidden: false },
    { id: 'circleapps', name: 'Circle Apps', color: '#10b981', tag: 'One platform, many apps', line: 'Travel, Matchday, Kitchen, Vault — every task, one circle.',
      wedge: 'Every app inherits the trusted circle — no new graph to build, ever.', hidden: true },
  ],
  // the company's brain — the living knowledge system (mirrors the HQ ontology graph)
  brain: {
    line: 'A living knowledge graph, wired to sensors.',
    detail: 'Every RPC is a sensor. Sensors feed a 76-node ontology graph; every node carries a provenance badge (live / modeled / pending) and a health state; six offices read the graph and file verdicts. The company doesn’t look at dashboards — it runs on a nervous system.',
    nodes: 76, sensors: 147, coveragePct: 78,
    flow: ['Sensors · 147 RPCs', 'Knowledge graph · 76 nodes', 'Six offices · verdicts', 'One human · the call'],
  },

  // the six offices' instrumentation coverage — the mini-cockpit's health dials.
  // Modeled from the HQ graph's per-office coverage (overall 78%, CTO ~69%); ◐.
  offices: [
    { id: 'bridge',     label: 'Bridge',     accent: '#8b5cf6', cov: 82 },
    { id: 'operations', label: 'Operations', accent: '#a855f7', cov: 80 },
    { id: 'technology', label: 'Technology', accent: '#06b6d4', cov: 69 },
    { id: 'treasury',   label: 'Treasury',   accent: '#10b981', cov: 74 },
    { id: 'legal',      label: 'Legal',      accent: '#f59e0b', cov: 88 },
    { id: 'guild',      label: 'The Guild',  accent: '#ef4444', cov: 76 },
  ] as { id: string; label: string; accent: string; cov: number }[],

  // the moat argument: seven front-ends on one spine (owner's platform doc)
  substrate: {
    line: 'Seven front-ends. One spine.',
    detail: 'One Supabase project, one identity & circle model, one wallet, shared engine packages. Every product is a skin on the same substrate — competitors would have to rebuild the spine, not clone an app.',
    tables: 71, rpcs: 147, frontEnds: 7,
    engines: ['audio', 'character', 'combat', 'heroes-engine'],
    fronts: ['ArgantaLab', 'KinetikCircle', 'LashiraBloom', 'Kingdom', 'Circle HQ', 'Landing', 'The Bridge (MCP)'],
  },

  // competitor landscape — every incumbent owns ONE axis; Arganta owns the corner.
  // x = learning depth, y = family coordination (0..1 for the 2-axis plot).
  competitors: [
    { name: 'Roblox',      owns: 'Kids’ hours & UGC games', scale: '$40B',   x: 0.15, y: 0.10, note: 'No learning signal, no parent trust.' },
    { name: 'Duolingo',    owns: 'Daily learning habit',    scale: '$6B',    x: 0.85, y: 0.15, note: 'Single-player; family is an afterthought.' },
    { name: 'Khan / Prodigy', owns: 'Curriculum content',   scale: 'low ARPU', x: 0.75, y: 0.20, note: 'No family OS, weak game pull.' },
    { name: 'Life360',     owns: 'Family location graph',   scale: '$4.6B',  x: 0.10, y: 0.70, note: 'Safety-only; nothing to do together daily.' },
    { name: 'Skylight',    owns: 'Family calendar',         scale: '9.3M users', x: 0.12, y: 0.80, note: 'Organizes the week; blind to learning.' },
    { name: 'Cozi / Maple', owns: 'Family organizer',       scale: '~$4M val', x: 0.20, y: 0.65, note: 'Commodity features, no moat graph.' },
    { name: 'Arganta',     owns: 'Learning × the family graph', scale: 'us', x: 0.85, y: 0.85, note: 'The only one in the corner.', us: true },
  ],

  // valuation ladder — snapshot of the HQ six-method engine (apps/hq graph/valuation.ts),
  // date-stamped. ALL modeled. Refreshed 2026-07-11 after the cost-to-duplicate re-measure.
  valuation: {
    asOf: '2026-07-11',
    now: { low: 1.79, high: 2.36 },       // synthesized pre-money, pre-traction weights
    methods: [
      { key: 'cost_to_duplicate', label: 'Cost-to-Duplicate', low: 0.35, high: 0.60 },
      { key: 'berkus',            label: 'Berkus',             low: 0.81, high: 1.11 },
      { key: 'first_chicago',     label: 'First Chicago',      low: 2.60, high: 3.41 },
      { key: 'vc_method',         label: 'VC Method',          low: 3.50, high: 4.38 },
      { key: 'risk_factor_sum',   label: 'Risk Factor Sum',    low: 4.00, high: 5.25 },
      { key: 'scorecard',         label: 'Scorecard',          low: 4.00, high: 5.00 },
    ] as { key: string; label: string; low: number; high: number }[],
    ladder: [
      { step: 'Today', range: [1.79, 2.36] as [number, number], note: 'Pre-traction weighting favors Cost-to-Duplicate + Berkus.' },
      { step: 'Payment live', range: [3.5, 5.3] as [number, number], note: 'First paying families +$1.28M Berkus & flip the weights to the traction methods.' },
      { step: '~$1M ARR', range: [6, 10] as [number, number], note: 'W2F retention proven, priced at 2026 comps (Duolingo ≈6× · Life360 ≈9× rev).' },
    ],
    lever: 'The #1 lever isn’t code — it’s the first paying family. It adds ~$1.28M and re-rates the whole engine.',
  },

  // what the agent OS shipped — the velocity proof (one founder, 12 months)
  velocity: {
    line: 'What one founder + an agent OS shipped in 12 months.',
    products: ['ArgantaLab', 'KinetikCircle', 'LashiraBloom', 'KinQuest RPG', 'Arganta Studio v2', 'Circle HQ'],
    builders: ['Game', 'App', 'Learn', 'Agent', 'Content', 'Character Forge', 'Skill Forge', 'Music', 'Video', 'Pixel Vault'],
    stat: { loc: '122k', commits: '430+', apps: 7 },
  },

  founder: {
    name: 'Aldyth Sukapradja',
    role: 'Founder & human CEO',
    monogram: 'AS',
    quote: 'I’m a parent who watched the same battle every family knows — the screen always wins. So instead of fighting it, I rebuilt what’s on the other side of it. I couldn’t hire a team, so I built one: twenty-seven AI agents across six offices, run from a command deck I also built.',
    short: 'One parent, building the company his own family runs on.',
    story: 'Every evening after work I shipped another piece: a learning world my own kids actually ask to open, a calendar my household actually runs on, a farm we play together on weekends. Arganta is my answer to one question — what if the hours our kids already spend on screens quietly became the hours that build them?',
  },

  // "the humans" — what a human still does in an agent-run company (recruiting)
  humans: {
    line: 'A company of agents still needs human judgment.',
    does: ['Taste & product direction', 'Curriculum & learning design', 'Parenting insight', 'The hard calls agents escalate'],
    stack: ['React 19', 'Supabase', 'GSAP', 'd3', 'PixiJS', 'three / R3F', 'Agent OS'],
    cta: 'Work with us → hello@arganta.app',
  },

  // one canonical sample parent-dashboard (used by Editorial + General "parent view")
  demoDash: {
    streak: 7, todayMin: 41, rings: '6 / 6',
    skills: [
      ['Number sense', 82, '#f59e0b'],
      ['Reading', 64, '#3b82f6'],
      ['Science', 91, '#10b981'],
      ['Logic & code', 47, '#8b5cf6'],
    ] as [string, number, string][],
  },

  // go-to-market — the wedge expansion (was buried in the ask before)
  gtm: {
    line: 'From one circle to every family.',
    steps: [
      { k: 'Invite loop', v: 'Every circle invites the next — k-factor toward viral.' },
      { k: 'Classrooms', v: 'A teacher’s class is a circle — the same product, more seats.' },
      { k: 'Communities', v: 'Family & edtech operators in Doha + Indonesia — warm, concentrated wedges.' },
    ],
  },

  ask: {
    // amount stays placeholder-safe until the owner sets it; deck reads "a pre-seed round".
    amount: null as string | null,
    headline: 'Raising a pre-seed to reach 10,000 families.',
    uses: [
      { l: 'Scale the agent workforce', d: 'Deepen content across every world and age stage.' },
      { l: 'Prove the paywall', d: 'Turn demonstrated pay-intent into subscription revenue.' },
      { l: 'Ignite the two-hook flywheel', d: 'Family & classroom invite loops toward k > 1.' },
    ],
    intros: 'intros to family / edtech operators in Doha + Indonesia',
  },
} as const
