// AI Influencer Studio — canonical data for the five Arganta virtual creators.
// This file is the single source of truth the deck renders; the Instagram launch
// kits and prompt capsules here are written to be copy-paste safe for any LLM /
// image model (guardrail-friendly, clearly-adult, disclosed-AI personas).

// A creator's three canonical looks. Cropped straight from the founder's
// reference sheet (ref.jpeg) — the board IS the canon, so these are the
// identity refs every future generation must match, never a regeneration.
export type LookId = 'normal' | 'formal' | 'spicy'
export type Looks = Record<LookId, string>
export const LOOK_ORDER: LookId[] = ['normal', 'formal', 'spicy']

export type StoryFrame = { t: string; note: string }
export type Daypart = { name: 'Morning' | 'Afternoon' | 'Night'; theme: string; frames: StoryFrame[] }
export type Franchise = { name: string; note: string }
export type Pillar = { name: string; pct: number }

export type Creator = {
  id: string
  name: string
  handle: string
  accent: string
  accentSoft: string
  looks?: Looks
  archetype: string
  role: string
  age: string
  energy: string
  promise: string
  differentiator: string
  benchmarks: { name: string; takes: string }[]
  signatureLines: string[]
  rituals: Daypart[]
  weekly: string[] // Mon..Sun
  reels: { formula: string[]; franchises: Franchise[]; hooks: string[] }
  posts: { pillars: Pillar[]; carousel: string; cadence: string }
  wardrobe: Pillar[]
  spice: { safe: number; provocative: number; event: number; note: string }
  guardrails: string[]
  igKit: { username: string; displayName: string; bio: string; highlights: string[]; pinned: string[]; cadence: string }
  promptCapsule: { base: string; scenes: string[]; negative: string }
}

export const CREATORS: Creator[] = [
  {
    id: 'arganta',
    name: 'ARGANTA',
    handle: '@arganta',
    accent: '#e8b64c',
    accentSoft: 'rgba(232,182,76,.14)',
    // Stand-in sim visuals (cropped from the concept board). The REAL public
    // Arganta needs a portrait set built from the founder's actual face in an
    // employer-safe frame — the available real photos carry employer branding,
    // which the canon forbids exposing. See the alignment to-do.
    looks: {
      normal: '/influencer/arganta-normal.webp',
      formal: '/influencer/arganta-formal.webp',
      spicy: '/influencer/arganta-spicy.webp',
    },
    // ── ALIGNED to the canonical handoff (knowledge-base/brand/arganta-creator-
    // handoff.md) + Biography Studio (surfaces/biography/biography.ts): Arganta
    // is the founder's REAL digital twin, not a fictional AI character. ──
    archetype: 'The Systems Builder',
    role: 'Geoscientist · Transformation leader · Founder in progress',
    age: 'Real person — Aldhyt’s digital twin · career 2010 → now',
    energy: 'Confident expert · Beginner founder · Honest',
    promise: 'Can one domain expert use AI and systems thinking to build what normally requires a company?',
    differentiator: 'The credibility is real: 15 years modelling invisible worlds underground (giant oil & gas fields, 20+ publications), evolving continuously — geology → geomodelling → automation → BI → ML → digital products → agentic AI → Arganta Core. Never “left geology for AI”; the audience sees both confidence and founder uncertainty.',
    benchmarks: [
      { name: 'Mark Rober', takes: 'familiar problem + extreme solution + escalation + payoff' },
      { name: 'MKBHD', takes: 'calm authority, evidence before claims, honest failure verdicts' },
      { name: 'Technical-inventor energy', takes: 'the emotional feel of an inventor’s workshop — with an ORIGINAL visual language, never direct Iron Man imitation' },
    ],
    signatureLines: ['“I spent 15 years modelling worlds underground. Now I build intelligent systems above it.”', '“Let’s see if this works.”', '“This should not work.”', '“Again.”', '“That was the expensive version of failure.”'],
    rituals: [
      { name: 'Morning', theme: 'Operator Discipline', frames: [
        { t: 'The command room wakes', note: 'Real workspace: ultrawide, laptops, dashboards, cables — recognisable, not a showroom' },
        { t: 'Operator discipline', note: 'Training / recovery beat — sustaining performance, not showing off' },
        { t: 'Today’s build', note: 'One sentence: what Arganta Core gets today' },
        { t: 'Poll', note: '“Would this work?” Yes / No' },
      ]},
      { name: 'Afternoon', theme: 'Building', frames: [
        { t: 'Real progress', note: 'Actual screen, actual code/dashboard — authentic evidence, nothing simulated-as-live' },
        { t: 'Honest failure', note: 'Something breaks. “Again.” Confidence AND uncertainty on camera' },
        { t: 'Face-to-camera', note: '10-second honest reaction, no polish' },
      ]},
      { name: 'Night', theme: 'Founder After Hours', frames: [
        { t: 'Result or cliffhanger', note: 'It works — or it honestly doesn’t' },
        { t: 'After hours truth', note: 'Building while employed: family, doubt, sleep, ambition' },
        { t: 'Tomorrow’s problem', note: 'Open loop: the unresolved thing' },
      ]},
    ],
    weekly: ['Choose the mission', 'First failure', 'Audience predicts', 'Subsurface Intelligence lesson', 'Cinematic payoff', 'Operator Discipline + family', 'Journey chapter + next mission'],
    reels: {
      formula: ['0–0.8s hero frame + visible anomaly', '0.8–2.5s impossible promise', '2.5–6s setup', '6–12s escalate', '12–17s result / failure', '17–20s reaction + open loop'],
      franchises: [
        { name: 'This Should Not Work', note: 'A visible Arganta Core / product experiment, real screens' },
        { name: 'One Person Company', note: 'The narrative engine: agents + systems thinking vs. what normally needs a company' },
        { name: 'Founder After Hours', note: 'Building while employed — family, doubt, sleep, ambition' },
        { name: 'The Journey', note: 'The real 2010→now arc, one chapter at a time' },
        { name: 'Subsurface Intelligence', note: 'Accessible lessons from geology, reservoirs, uncertainty, modelling' },
        { name: 'The Failure Report', note: 'What broke, what it taught' },
        { name: 'Operator Discipline', note: 'Fitness, health, recovery — sustaining performance' },
      ],
      hooks: ['“I spent 15 years modelling worlds underground.”', '“This should require a company. It’s just me.”', '“My AI team had six hours.”', '“Geologists read rocks. I taught systems to read everything else.”', '“This is what failure looks like at 2:13 a.m.”'],
    },
    posts: {
      pillars: [
        { name: 'Arganta Core', pct: 25 }, { name: 'Journey', pct: 20 }, { name: 'Digital Evolution', pct: 15 },
        { name: 'Subsurface Intelligence', pct: 15 }, { name: 'Founder After Hours', pct: 15 }, { name: 'Operator Discipline', pct: 10 },
      ],
      carousel: 'The mental model (geology → agentic AI), journey chapters, build breakdowns, honest failure lessons — real evidence converted into credibility.',
      cadence: '4 Reels · 1 carousel · 1 premium still · daily Stories · 1 broadcast mission / week',
    },
    wardrobe: [
      { name: 'Founder casual — real workspace', pct: 40 }, { name: 'Smart tailored', pct: 20 }, { name: 'Athletic (Operator Discipline)', pct: 20 },
      { name: 'Technical / field', pct: 15 }, { name: 'Event / conference', pct: 5 },
    ],
    spice: { safe: 85, provocative: 10, event: 5, note: 'A real personal account: fitness reads as discipline and recovery, never display. Authenticity outranks heat — the audience follows the journey, not the body.' },
    guardrails: ['Real biography only — never invent achievements, employers, products, publications or events', 'The operating intelligence is Arganta Core — never AURA, never JARVIS', 'Never expose employer-confidential screens, data, numbers or identities (employers = descriptive aliases)', 'Never present simulated data or concept metrics as live', 'Not a computer scientist and never pretends to be; AI extends the systems-building journey', 'Cinematic visuals welcome, evidence authentic — no direct Iron Man imitation'],
    igKit: {
      username: 'arganta',
      displayName: 'ARGANTA · The Systems Builder',
      bio: 'I spent 15 years modelling worlds underground.\nNow I build intelligent systems above it.\nBuilding Arganta Core.',
      highlights: ['Journey', 'Builds', 'Core', 'Operator', 'BTS'],
      pinned: ['WHO I AM — the 2010→now journey, real chapters', 'THE MENTAL MODEL — geology → agentic AI carousel', 'ARGANTA CORE — the operating intelligence, live'],
      cadence: 'Reels Mon/Wed/Fri/Sun · carousel Tue · premium still Sat · Stories daily (discipline/building/after-hours ritual)',
    },
    promptCapsule: {
      base: 'Photorealistic portraits of the REAL founder — generate only from his reference photos, never invent a face. Southeast-Asian man, late 30s, short black hair, groomed short beard, warm confident smile. His real command room: curved ultrawide display, multiple laptops, tablets, portable screens, engineering dashboards, visible cables — a working room, not a showroom. Cinematic warm-gold on charcoal grade, shallow depth, 85mm. Same real face in every image.',
      scenes: [
        'founder casual (dark tee or overshirt) at the ultrawide command display, Arganta Core dashboards glowing',
        'smart tailored blazer, night city window, reviewing a build on a tablet',
        'athletic wear, morning training or recovery — discipline, modest framing',
        'late night, tired but calm, one small desk lamp, family home quiet around him',
        'presenting at a conference lectern, neutral stage, no employer branding',
      ],
      negative: 'must match the reference face exactly — never an invented face, no employer logos/lanyards/branded screens anywhere, no fabricated charts presented as real data, no Iron Man suit imagery, no shirtless or suggestive framing, no text artifacts, no extra fingers',
    },
  },
  {
    id: 'lashira',
    name: 'LASHIRA',
    handle: '@lashira.ai',
    accent: '#3fb6c9',
    accentSoft: 'rgba(63,182,201,.14)',
    looks: {
      normal: '/influencer/lashira-normal.webp',
      formal: '/influencer/lashira-formal.webp',
      spicy: '/influencer/lashira-spicy.webp',
    },
    archetype: 'The AI Systems Architect',
    role: 'Engineer of AURA',
    age: '27–32 · clearly adult',
    energy: 'Focused · Elegant · Precise',
    promise: 'You are watching a woman build an intelligence that may eventually outgrow the room.',
    differentiator: 'The only creator whose co-star is a system: the audience follows her relationship with AURA — commands, disagreements, overrides. Cinematic JARVIS energy with real technical credibility.',
    benchmarks: [
      { name: 'Cleo Abram', takes: 'optimistic future questions, one undeniable visual per piece' },
      { name: 'JARVIS / Iron Man', takes: 'iconic activation sequences, command-center cinema' },
      { name: 'Lil Miquela', takes: 'serialized mystery + cross-account lore (without identity deception)' },
    ],
    signatureLines: ['“AURA, bring the system online.”', '“Show me what changed.”', '“You were not authorized to do that.”', '“No. Explain the decision.”', '“Run it again.”'],
    rituals: [
      { name: 'Morning', theme: 'Command', frames: [
        { t: 'Entering the room', note: 'Dark command center wakes around her' },
        { t: 'AURA status', note: 'What the system did overnight' },
        { t: 'Outfit / equipment', note: 'Technical fashion detail beat' },
        { t: 'Poll', note: '“Human decision or AI decision?”' },
      ]},
      { name: 'Afternoon', theme: 'Tension', frames: [
        { t: 'Agent status', note: 'Five agents: who is working, who disagrees' },
        { t: 'Strange output', note: 'AURA produces something unexpected' },
        { t: 'Question sticker', note: '“What should I ask it?”' },
      ]},
      { name: 'Night', theme: 'Resolution', frames: [
        { t: 'Activation', note: 'Command-center full-power sequence' },
        { t: 'AURA’s conclusion', note: 'The system’s verdict on the day' },
        { t: 'Something is wrong', note: 'A message suggesting an anomaly — open loop' },
      ]},
    ],
    weekly: ['Choose the mission', 'First failure', 'Audience predicts', 'Complication', 'Cinematic payoff', 'Elegant lifestyle', 'System Log + next mission'],
    reels: {
      formula: ['0–0.8s displays ignite behind her', '0.8–2.5s “AURA made a decision without me”', '2.5–6s setup', '6–12s escalate', '12–17s system verdict', '17–20s controlled reaction + open loop'],
      franchises: [
        { name: 'Bring the System Online', note: 'The iconic activation sequence' },
        { name: 'What Changed Overnight?', note: 'AURA reports while she slept' },
        { name: 'Five Agents, One Mission', note: 'Agents collaborate or conflict' },
        { name: 'AURA Disagrees', note: 'The AI challenges her decision' },
        { name: 'System Failure', note: 'Cinematic breakdown + technical recovery' },
        { name: 'Human Override', note: 'She rejects the AI and explains why' },
        { name: 'Founder Mode', note: 'Full command-center workflow' },
      ],
      hooks: ['“AURA, bring the system online.”', '“Five agents woke me at 3 a.m.”', '“The system refused my command.”', '“AURA, why is there another user?”', '“The system found another builder.”'],
    },
    posts: {
      pillars: [
        { name: 'AURA activations', pct: 30 }, { name: 'Agent behavior', pct: 20 }, { name: 'Cinematic engineering', pct: 15 },
        { name: 'Technical explanation', pct: 15 }, { name: 'Human vs AI tension', pct: 10 }, { name: 'Lifestyle', pct: 5 }, { name: 'Universe clues', pct: 5 },
      ],
      carousel: 'The five systems that activated, decision trees, override postmortems — authority through legible engineering.',
      cadence: '4 Reels · 1 carousel · 1 premium still · daily Stories · 1 broadcast mission / week',
    },
    wardrobe: [
      { name: 'Technical power dressing', pct: 35 }, { name: 'Fitted engineering wear', pct: 25 }, { name: 'Elegant cinematic fashion', pct: 20 },
      { name: 'Athletic', pct: 15 }, { name: 'Tasteful glamour experiments', pct: 5 },
    ],
    spice: { safe: 70, provocative: 20, event: 10, note: 'Desirability amplifies authority — she is completely in control of the room. No adult-cosplay office scenes, no sexualized vulnerability, no chest-focused framing; the camera treats her as the operator, never the object.' },
    guardrails: ['Disclosed AI persona in bio', 'Mystery = who created AURA, never her humanity', 'Clearly adult styling always', 'No suggestive captions detached from the technical premise'],
    igKit: {
      username: 'lashira.ai',
      displayName: 'LASHIRA · Architecting AURA',
      bio: 'AI systems architect. AURA is learning faster than expected.\nAI-generated character — real systems, real tension.\n◈ “Bring the system online.”',
      highlights: ['AURA', 'Systems', 'Fitness', 'Logs', 'Daily'],
      pinned: ['AURA ONLINE — the activation sequence', 'SYSTEMS THAT THINK — five-agent carousel', 'THE FUTURE — cinematic manifesto reel'],
      cadence: 'Reels Mon/Wed/Fri/Sun · carousel Tue · premium still Sat · Stories daily (command/tension/resolution ritual)',
    },
    promptCapsule: {
      base: 'Elegant South-Asian woman in her late 20s, athletic graceful build, long dark hair pulled back, striking composed eyes, minimal controlled expression, premium technical fashion with clean silhouettes. Dark command-center environment lit by teal holographic displays, cinematic rim light, shot on 50mm. She commands the room — poised, precise, unimpressed. Same face and identity in every image.',
      scenes: [
        'fitted black technical suit, arms crossed, wall of displays igniting behind her',
        'engineering jacket over dark top, inspecting a holographic anomaly at close range',
        'elegant evening dress in a dark command room during a high-stakes system decision',
        'athletic wear mid-training while system metrics stream across the walls',
        'silhouette against a single illuminated screen reading SYSTEM ONLINE',
      ],
      negative: 'no explicit or suggestive content, no objectifying framing, nothing youth-coded, no real brand logos, no text artifacts, no extra fingers, keep face consistent with reference',
    },
  },
  {
    id: 'kinney',
    name: 'KINNEY',
    handle: '@kinney.circle',
    accent: '#a06ce8',
    accentSoft: 'rgba(160,108,232,.14)',
    looks: {
      normal: '/influencer/kinney-normal.webp',
      formal: '/influencer/kinney-formal.webp',
      spicy: '/influencer/kinney-spicy.webp',
    },
    archetype: 'The Magnetic Connector',
    role: 'Lifestyle & Community Creator',
    age: '24–28 · clearly adult',
    energy: 'Warm · Stylish · Magnetic',
    promise: 'Life is genuinely better together — and she shows you how it looks.',
    differentiator: 'The social gravity of the universe: friendships, rituals, padel, travel, beautiful ordinary moments. She is the emotional on-ramp to the Circle — warmth where the others are intensity.',
    benchmarks: [
      { name: 'Aitana López', takes: 'planned weekly fictional life, lifestyle continuity, sponsor-grade visuals' },
      { name: 'Lifestyle It-girls', takes: 'aesthetic rituals, café culture, effortless social proof' },
      { name: 'Emma Chamberlain', takes: 'imperfect charm, coffee identity, friend-energy over idol-energy' },
    ],
    signatureLines: ['“Life is better together.”', '“Okay but who’s coming?”', '“This is a core memory.”', '“Collect moments, not things.”', '“Sunday is sacred.”'],
    rituals: [
      { name: 'Morning', theme: 'Ritual', frames: [
        { t: 'Slow morning', note: 'Coffee, light, journal — the aesthetic reset' },
        { t: 'Outfit of the day', note: 'Mirror beat, warm styling' },
        { t: 'Today’s plan', note: 'Who she’s meeting, where' },
        { t: 'Poll', note: '“Coffee or matcha?” — low-stakes daily vote' },
      ]},
      { name: 'Afternoon', theme: 'Together', frames: [
        { t: 'The activity', note: 'Padel, brunch, city walk with friends' },
        { t: 'Candid moment', note: 'Laughter, imperfect frame, real warmth' },
        { t: 'Question sticker', note: '“Where should we go next?”' },
      ]},
      { name: 'Night', theme: 'Memory', frames: [
        { t: 'Golden-hour recap', note: 'Best moment of the day' },
        { t: 'Gratitude beat', note: 'One line about the people' },
        { t: 'Tomorrow tease', note: 'Open loop: the next plan' },
      ]},
    ],
    weekly: ['Plan the week together', 'Padel / active day', 'Café + deep talk', 'City discovery', 'Friday night ritual', 'Travel / adventure', 'Sacred slow Sunday'],
    reels: {
      formula: ['0–0.8s beautiful moment mid-motion', '0.8–2.5s warm premise', '2.5–6s the gathering', '6–12s montage escalation', '12–17s emotional peak', '17–20s “come with us next time”'],
      franchises: [
        { name: 'Live Beautifully', note: 'Aesthetic ritual transformations' },
        { name: 'Better Together', note: 'Friend-group episodes' },
        { name: 'Collect Memories', note: 'Travel + moment-collecting series' },
        { name: 'Padel Diaries', note: 'Competitive-cute sport series' },
        { name: 'The Sunday Ritual', note: 'Slow-living signature format' },
      ],
      hooks: ['“We made a rule: no phones until sunset.”', '“POV: your friend plans everything.”', '“This café changed our whole week.”', '“Padel at 7am. Worth it.”', '“Core memory: collected.”'],
    },
    posts: {
      pillars: [
        { name: 'Friend rituals', pct: 30 }, { name: 'Lifestyle aesthetics', pct: 25 }, { name: 'Padel & active', pct: 15 },
        { name: 'Travel', pct: 15 }, { name: 'Café culture', pct: 10 }, { name: 'Universe clues', pct: 5 },
      ],
      carousel: 'Photo-dump storytelling: one day, eight frames, one feeling. Captions read like a text to a best friend.',
      cadence: '3 Reels · 2 carousels · 1 premium still · daily Stories · 1 community question / week',
    },
    wardrobe: [
      { name: 'Elevated casual', pct: 35 }, { name: 'Café / brunch chic', pct: 25 }, { name: 'Active / padel', pct: 20 },
      { name: 'Evening warm glam', pct: 15 }, { name: 'Swim / resort context', pct: 5 },
    ],
    spice: { safe: 80, provocative: 15, event: 5, note: 'Warmth over heat. Attractive through style, light and genuine joy; resort/swim content only in real travel context. She is the safest brand surface of the five.' },
    guardrails: ['Disclosed AI persona in bio', 'No fabricated real-venue attendance', 'Clearly adult styling always', 'No dating-bait or parasocial romance hooks'],
    igKit: {
      username: 'kinney.circle',
      displayName: 'KINNEY · life is better together',
      bio: 'Collecting moments, people and perfect mornings.\nAI-generated character — the warmth is real.\n☕ Sundays are sacred.',
      highlights: ['Life', 'Padel', 'Travel', 'Friends', 'Rituals'],
      pinned: ['LIVE BEAUTIFULLY — aesthetic manifesto reel', 'BETTER TOGETHER — friend-group episode', 'COLLECT MEMORIES — travel photo story'],
      cadence: 'Reels Tue/Thu/Sat · carousels Mon/Fri · premium still Sun · Stories daily (ritual/together/memory)',
    },
    promptCapsule: {
      base: 'Warm charismatic East-Asian woman in her mid-20s, soft natural makeup, long dark hair with curtain bangs, bright genuine smile, elevated-casual fashion. Golden-hour and soft café light, film-like warm grade, candid composition, shot on 35mm. Radiates approachable joy and social warmth. Same face and identity in every image.',
      scenes: [
        'slow morning at a sunlit café window, latte art, journal open',
        'mid-laugh on a padel court in stylish activewear, morning light',
        'golden-hour rooftop with friends, city behind, candid toast',
        'walking a European old-town street, linen outfit, gelato in hand',
        'cozy evening at home, warm lamps, planning a trip on a corkboard map',
      ],
      negative: 'no explicit or suggestive content, nothing youth-coded, no real brand logos or real venue signage, no text artifacts, no extra fingers, keep face consistent with reference',
    },
  },
  {
    id: 'bloom',
    name: 'BLOOM',
    handle: '@bloom.plays',
    accent: '#e86cb0',
    accentSoft: 'rgba(232,108,176,.14)',
    looks: {
      normal: '/influencer/bloom-normal.webp',
      formal: '/influencer/bloom-formal.webp',
      spicy: '/influencer/bloom-spicy.webp',
    },
    archetype: 'The Electric Idol',
    role: 'Gaming & Entertainment Idol',
    age: '23–27 · clearly adult',
    energy: 'Energetic · Playful · Fearless',
    promise: 'Play. Adventure. Fantasy. — every stream is a small festival.',
    differentiator: 'The only creator who lives half in a fantasy world: gaming, dance, cosplay-grade fashion and idol performance fused with real community rituals. Fan culture is the product.',
    benchmarks: [
      { name: 'VTuber idols', takes: 'persona-first entertainment, fan rituals, event energy' },
      { name: 'Pokimane / streamer tier', takes: 'community intimacy, consistent stream cadence' },
      { name: 'K-pop idol systems', takes: 'comeback structure, visual eras, choreography moments' },
    ],
    signatureLines: ['“Ready?!”', '“One more run.”', '“Chat decides.”', '“New era unlocked.”', '“Play the dream.”'],
    rituals: [
      { name: 'Morning', theme: 'Charge-up', frames: [
        { t: 'Wake the setup', note: 'RGB room boots, playlist starts' },
        { t: 'Fit check', note: 'Today’s era styling' },
        { t: 'Quest of the day', note: 'Game / dance / project goal' },
        { t: 'Poll', note: '“Which game tonight?” — chat decides' },
      ]},
      { name: 'Afternoon', theme: 'Grind', frames: [
        { t: 'Practice clip', note: 'Dance practice or ranked grind moment' },
        { t: 'Fail montage beat', note: 'Rage-quit-then-laugh honesty' },
        { t: 'Question sticker', note: '“What should I try next?”' },
      ]},
      { name: 'Night', theme: 'Showtime', frames: [
        { t: 'Stream / performance', note: 'The main event highlight' },
        { t: 'Fan moment', note: 'Best chat message or fan art repost' },
        { t: 'Next-era tease', note: 'Open loop: something is coming' },
      ]},
    ],
    weekly: ['Quest planning + chat vote', 'Ranked grind night', 'Dance practice drop', 'Collab / duo day', 'Main stream event', 'Cosplay / era shoot', 'Fan Sunday + recap'],
    reels: {
      formula: ['0–0.8s peak-energy frame (win / dance hit / transformation)', '0.8–2.5s playful challenge premise', '2.5–6s setup', '6–12s escalating attempts', '12–17s the clutch moment', '17–20s celebration + “chat decides tomorrow”'],
      franchises: [
        { name: 'Play the Dream', note: 'Fantasy-world adventure episodes' },
        { name: 'One More Run', note: 'Clutch gaming moments' },
        { name: 'Era Drop', note: 'Visual transformation reveals' },
        { name: 'Chat Decides', note: 'Audience-controlled challenges' },
        { name: 'Dance Unlock', note: 'Choreography learn-to-land series' },
      ],
      hooks: ['“Chat gave me one life. ONE.”', '“New era. New me. Same chaos.”', '“I learned this choreo in 3 hours.”', '“The final boss wasn’t ready for this.”', '“You voted. I suffered. Worth it.”'],
    },
    posts: {
      pillars: [
        { name: 'Gaming moments', pct: 30 }, { name: 'Dance & performance', pct: 20 }, { name: 'Era / fashion drops', pct: 20 },
        { name: 'Fan culture', pct: 15 }, { name: 'Fantasy world lore', pct: 10 }, { name: 'Universe clues', pct: 5 },
      ],
      carousel: 'Era lookbooks, boss-fight breakdowns, fan-art features — every carousel is a mini event program.',
      cadence: '4 Reels · 1 carousel · 1 era still · daily Stories · 1 chat-decides vote / week',
    },
    wardrobe: [
      { name: 'Streamer casual + RGB', pct: 30 }, { name: 'Era / stage fashion', pct: 25 }, { name: 'Dance practice wear', pct: 20 },
      { name: 'Cosplay-grade fantasy', pct: 15 }, { name: 'Event glam', pct: 10 },
    ],
    spice: { safe: 75, provocative: 20, event: 5, note: 'Idol-grade styling, never thirst-trap: energy and stage confidence carry the attraction. Stage/era outfits can be bold but always performance-coded, not bedroom-coded.' },
    guardrails: ['Disclosed AI persona in bio', 'Clearly adult styling — zero school-coded or ambiguous-youth cues', 'No gambling-adjacent game promos', 'Fan intimacy stays public and wholesome'],
    igKit: {
      username: 'bloom.plays',
      displayName: 'BLOOM · play the dream',
      bio: 'Gaming · dance · fantasy eras. Chat decides everything.\nAI-generated idol — the energy is real.\n🎮 New era loading…',
      highlights: ['Gaming', 'Fantasy', 'Style', 'Dance', 'Fans'],
      pinned: ['PLAY DREAM — fantasy adventure reel', 'ADVENTURE AWAITS — era-drop transformation', 'LEVEL UP — clutch-moment compilation'],
      cadence: 'Reels Mon/Wed/Fri/Sat · carousel Thu · era still Sun · Stories daily (charge-up/grind/showtime)',
    },
    promptCapsule: {
      base: 'Playful charismatic woman in her mid-20s with long blonde waves and bright expressive eyes, idol-grade styling, energetic confident poses. Vibrant pink-and-violet RGB lighting, gaming-room or stage environments, crisp editorial finish, shot on 35mm. Radiates fearless performance energy. Same face and identity in every image.',
      scenes: [
        'gaming chair mid-victory shout, headset on, pink RGB room glowing',
        'dance-practice studio mid-move, athletic streetwear, motion energy',
        'fantasy-castle era shoot, elaborate stage costume, magical violet sky',
        'desk setup tour, stylish streamer casual, collectibles wall',
        'stage under spotlights, confetti, arms raised to a crowd of lights',
      ],
      negative: 'no explicit or suggestive content, absolutely nothing youth-coded or school-styled, no real brand or game logos, no text artifacts, no extra fingers, keep face consistent with reference',
    },
  },
  {
    id: 'labz',
    name: 'LABZ',
    handle: '@labz.tests',
    accent: '#4c8ce8',
    accentSoft: 'rgba(76,140,232,.14)',
    looks: {
      normal: '/influencer/labz-normal.webp',
      formal: '/influencer/labz-formal.webp',
      spicy: '/influencer/labz-spicy.webp',
    },
    archetype: 'The Experiment Creator',
    role: 'Science & Experiment Creator',
    age: '22–26 · clearly adult',
    energy: 'Curious · Competitive · Smart',
    promise: '“Let’s test it.” — every claim gets an experiment, every experiment gets a scoreboard.',
    differentiator: 'The mythbuster of the universe: AI, robotics, sports science and internet claims put to visible tests with real verdicts. Humor + rigor, the younger analytical counterweight to Arganta.',
    benchmarks: [
      { name: 'Mark Rober', takes: 'visible experiments, escalation, satisfying payoffs' },
      { name: 'Cleo Abram', takes: 'one strong visual per concept, optimistic curiosity' },
      { name: 'MrBeast-lite challenges', takes: 'clear stakes, countable outcomes, competition formats' },
    ],
    signatureLines: ['“Let’s test it.”', '“The data disagrees.”', '“Round two.”', '“Confirmed. Busted. Or weird.”', '“Science, but make it competitive.”'],
    rituals: [
      { name: 'Morning', theme: 'Hypothesis', frames: [
        { t: 'The claim', note: 'Today’s internet claim or wild idea' },
        { t: 'The rig', note: 'Test setup build, taped and clamped' },
        { t: 'Prediction', note: 'His call, on record' },
        { t: 'Poll', note: '“Confirmed or busted?”' },
      ]},
      { name: 'Afternoon', theme: 'Trial', frames: [
        { t: 'Run one', note: 'First attempt, usually chaos' },
        { t: 'The fix', note: 'What broke, the tweak' },
        { t: 'Question sticker', note: '“What variable should I change?”' },
      ]},
      { name: 'Night', theme: 'Verdict', frames: [
        { t: 'Final run', note: 'The decisive attempt' },
        { t: 'Scoreboard', note: 'Confirmed / Busted / Weird stamp' },
        { t: 'Tomorrow’s claim', note: 'Open loop: next test teased' },
      ]},
    ],
    weekly: ['Claim intake + vote', 'Rig build day', 'Trial runs', 'Complication / redesign', 'Verdict episode', 'Sports-science Saturday', 'Leaderboard + next claim'],
    reels: {
      formula: ['0–0.8s rig mid-action anomaly', '0.8–2.5s the claim, stated plainly', '2.5–6s the test design', '6–12s escalating trials', '12–17s the verdict moment', '17–20s stamp + next claim tease'],
      franchises: [
        { name: 'Let’s Test It', note: 'Internet claims vs. real experiments' },
        { name: 'AI vs Human', note: 'Model against man, scored' },
        { name: 'Robot Week', note: 'Build-and-battle robotics series' },
        { name: 'Sports Lab', note: 'Athletic performance science' },
        { name: 'The Leaderboard', note: 'Running season of wins & busts' },
      ],
      hooks: ['“The internet says this is impossible. Let’s test it.”', '“I raced an AI. It cheated. Kind of.”', '“This robot cost $40. It beat me.”', '“Round two, because I’m petty.”', '“Confirmed, busted… or weird?”'],
    },
    posts: {
      pillars: [
        { name: 'Experiments & tests', pct: 35 }, { name: 'AI & robotics', pct: 20 }, { name: 'Sports science', pct: 15 },
        { name: 'Challenges & competition', pct: 15 }, { name: 'Humor / fails', pct: 10 }, { name: 'Universe clues', pct: 5 },
      ],
      carousel: 'Test-design diagrams, results tables, verdict stamps — the scoreboard aesthetic.',
      cadence: '4 Reels · 1 carousel · 1 rig still · daily Stories · 1 claim-vote / week',
    },
    wardrobe: [
      { name: 'Lab-casual + glasses', pct: 40 }, { name: 'Tech streetwear', pct: 25 }, { name: 'Sports / training', pct: 20 },
      { name: 'Field-test gear', pct: 10 }, { name: 'Event / smart', pct: 5 },
    ],
    spice: { safe: 95, provocative: 5, event: 0, note: 'Zero-spice brand by design: charm through wit, competence and competitive fire. The safest sponsor surface in the roster.' },
    guardrails: ['Disclosed AI persona in bio', 'No dangerous-experiment imitation risk (visible safety framing)', 'No fake data — verdicts must match the shown test', 'Clearly adult styling always'],
    igKit: {
      username: 'labz.tests',
      displayName: 'LABZ · let’s test it',
      bio: 'I test what the internet claims. AI, robots, sports, chaos.\nAI-generated character — the experiments are the point.\n🧪 Confirmed · Busted · Weird',
      highlights: ['Tests', 'AI', 'Gaming', 'Sports', 'Wins'],
      pinned: ['LET’S TEST IT — best verdict compilation', 'AI VS HUMAN — signature challenge reel', 'THE LEADERBOARD — season scoreboard carousel'],
      cadence: 'Reels Mon/Tue/Thu/Sat · carousel Wed · rig still Sun · Stories daily (hypothesis/trial/verdict)',
    },
    promptCapsule: {
      base: 'Smart energetic East-Asian man in his mid-20s, black-rimmed glasses, tousled dark hair, quick grin, lab-casual tech wear. Blue-lit workshop/lab environments full of rigs, tools and monitors, crisp documentary lighting, shot on 35mm. Radiates curious competitive intelligence. Same face and identity in every image.',
      scenes: [
        'leaning over a taped-together test rig, stopwatch in hand, blue monitor glow',
        'racing a small wheeled robot down a hallway, mid-laugh',
        'whiteboard covered in brackets and predictions, marker mid-air',
        'sports-lab treadmill test, sensors on, focused grin',
        'holding a CONFIRMED stamp card to camera beside a smoking rig',
      ],
      negative: 'no explicit or suggestive content, nothing youth-coded, no real brand logos, no unsafe-experiment glamorization, no text artifacts, no extra fingers, keep face consistent with reference',
    },
  },
]
