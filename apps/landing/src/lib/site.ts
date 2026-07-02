// ── SITE — the single source of truth for every static fact on the landing page.
// Brand copy, thesis, market refs, products, founder, the North Star, the demo
// dashboard. Every tab and presentation imports from here — no inline literals —
// so a number is written once and is consistent everywhere.

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
  thesis: { a: 'Kids see play.', b: 'Parents see growth.' },
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

  problem: {
    stat: '2.5', unit: 'hrs / day',
    line: 'A childhood of screens, building nothing.',
    detail: 'That’s ~900 hours a year of a child’s attention — the most valuable resource on earth — spent on infinite scroll instead of skills.',
  },

  market: {
    refs: [
      { n: '1.9B', l: 'children under 15 worldwide — the largest connected generation ever.' },
      { n: '$340B', l: 'consumer & digital learning spend by 2030.' },
      { n: '$0', l: 'trusted OS that owns the whole family relationship — the seat is empty.' },
    ],
    note: 'Directional global references — the wedge is the family, not a single category.',
  },

  // three multi-billion behaviors we fuse into one product
  whyNow: [
    { n: '124B', l: 'hours on Roblox, 2025 — kids already live in digital worlds.' },
    { n: '50M+', l: 'daily Duolingo learners — gamified habit works at scale.' },
    { n: '98M', l: 'families on Life360 — households organize in circles.' },
  ],

  // home proof strip (compact form of the above)
  proof: [
    ['2.5h', 'a day on screens'],
    ['124B', 'hours on Roblox'],
    ['50M+', 'daily Duolingo'],
    ['98M', 'families · Life360'],
  ] as [string, string][],

  products: [
    { id: 'argantalab', name: 'ArgantaLab', color: '#8b5cf6', tag: 'Six-world learning', line: 'Learn, build & ship games — with KinQuest, the RPG that teaches.' },
    { id: 'kinetik', name: 'KinetikCircle', color: '#06b6d4', tag: 'The family OS', line: 'Today, calendar, moments — the rhythm of family life.' },
    { id: 'circleapps', name: 'Circle Apps', color: '#10b981', tag: 'One platform, many apps', line: 'Travel, Matchday, Kitchen, Vault — every task, one circle.' },
  ],

  founder: {
    name: 'Aldyth Sukapradja',
    role: 'Founder & human CEO',
    quote: 'I wanted the calm, ambitious version of childhood screen time — so I built the company to make it, and staffed it with a full team of AI agents.',
    note: 'add photo + story',
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

  ask: {
    headline: 'Raising to reach 10,000 families.',
    uses: [
      { l: 'Scale the agent workforce', d: 'Deepen content across every world and age stage.' },
      { l: 'Prove the paywall', d: 'Turn demonstrated pay-intent into subscription revenue.' },
      { l: 'Ignite the two-hook flywheel', d: 'Family & classroom invite loops toward k > 1.' },
    ],
    intros: 'intros to family / edtech operators in Doha + Indonesia',
  },
} as const
