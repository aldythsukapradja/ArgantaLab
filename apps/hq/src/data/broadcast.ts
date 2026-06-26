/**
 * BROADCAST — the "Discover" feed engine library.
 *
 * Platform-authored content that fills every KinetikCircle feed so it is never
 * empty. NO LLM: operators mix & match a FORMAT (how it reads) with a THEME
 * (what it's about), paste the copy + an optional media URL, and schedule it.
 *
 * This file is the static, client-side content library — it works fully offline
 * so the Studio + Library are usable before Supabase is wired. The LIBRARY is a
 * starter bank you clone-and-edit; grow it freely (it's just data).
 */

export type BFormat =
  | 'fact' | 'did_you_know' | 'top10' | 'tip' | 'quote' | 'story'
  | 'on_this_day' | 'this_or_that' | 'mind_blown' | 'by_numbers' | 'challenge'
export type BTheme =
  | 'family' | 'kids' | 'parenting' | 'friends'
  | 'funfacts' | 'wellbeing' | 'history' | 'nature'
  | 'space' | 'animals' | 'science' | 'food' | 'sports' | 'world'
export type BStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type BMediaKind = 'none' | 'image' | 'video'
export type BAudience = 'circle' | 'grownups'

export interface FormatDef {
  key: BFormat
  label: string
  emoji: string
  blurb: string          // what this format is
  hint: string           // how to write the body well
}

export interface ThemeDef {
  key: BTheme
  label: string
  emoji: string
  accent: string         // card accent hex
  blurb: string
}

/** A reusable starter post in the Library — clone into the Studio and tweak. */
export interface LibraryItem {
  id: string
  format: BFormat
  theme: BTheme
  title: string
  body: string
  emoji: string
  source?: string
}

/** A weekly trend the Research desk surfaces to steer what to author. */
export interface ResearchItem {
  week: string           // e.g. '2026-W26'
  trend: string
  theme: BTheme
  formats: BFormat[]     // formats that fit this trend
  note: string
  hot?: boolean
}

/** A broadcast record (mirrors kinetik_broadcast). */
export interface Broadcast {
  id: string
  format: BFormat
  theme: BTheme
  title: string
  body: string | null
  mediaKind: BMediaKind
  mediaUrl: string | null
  source: string | null
  emoji: string | null
  accent: string | null
  audience: BAudience
  status: BStatus
  publishAt: string | null
  publishedAt: string | null
  viewCount: number
  reactionCount: number
  createdAt: string
}

// ── Formats (how a post reads) ────────────────────────────────
export const FORMATS: FormatDef[] = [
  { key: 'fact', label: 'Fun Fact', emoji: '💡',
    blurb: 'One surprising, true thing.',
    hint: 'One sentence. Lead with the surprise, end with the why.' },
  { key: 'did_you_know', label: 'Did You Know', emoji: '🤔',
    blurb: 'A myth-busting or perspective-flipping nugget.',
    hint: 'Open with “Did you know…”. Keep it under 2 short lines.' },
  { key: 'top10', label: 'Top 10', emoji: '🔟',
    blurb: 'A short ranked / numbered list.',
    hint: 'Title = the list theme. Body = numbered lines (1–5 is plenty).' },
  { key: 'tip', label: 'Tip', emoji: '✅',
    blurb: 'A practical parenting / family / wellbeing tip.',
    hint: 'Actionable. “Try this:” then the one move. No lecture.' },
  { key: 'quote', label: 'Quote', emoji: '❝',
    blurb: 'A short timeless quote + who said it.',
    hint: 'Body = the quote. Source = the person. Keep it short.' },
  { key: 'story', label: 'Story Beat', emoji: '📖',
    blurb: 'A 2–3 sentence mini story or moment in history.',
    hint: 'Tiny arc: setup → turn. Make them feel something.' },
  { key: 'on_this_day', label: 'On This Day', emoji: '📅',
    blurb: 'A “this day in history” moment — a recurring daily hook.',
    hint: 'Open with the date. One surprising event, told in one breath.' },
  { key: 'this_or_that', label: 'This or That', emoji: '⚖️',
    blurb: 'A fun either/or the whole family weighs in on (reactions = the vote).',
    hint: 'Two options, balanced. End with “Which are you?”. No wrong answer.' },
  { key: 'mind_blown', label: 'Mind-Blown', emoji: '🤯',
    blurb: 'A reframe that makes you go “wait… what?”.',
    hint: 'Set up the obvious, then flip it. Land the twist in the last line.' },
  { key: 'by_numbers', label: 'By the Numbers', emoji: '🔢',
    blurb: 'One striking number that reframes something familiar.',
    hint: 'Lead with the number. Make it concrete and comparable to daily life.' },
  { key: 'challenge', label: 'Mini Challenge', emoji: '🎯',
    blurb: 'A tiny do-it-today family challenge.',
    hint: 'One small action for today, doable in minutes. Light, not homework.' },
]

// ── Themes (what a post is about) ─────────────────────────────
export const THEMES: ThemeDef[] = [
  { key: 'family',    label: 'Family',     emoji: '👨‍👩‍👧', accent: '#F43F5E', blurb: 'Togetherness, traditions, home.' },
  { key: 'kids',      label: 'Kids',       emoji: '🧒',     accent: '#FBBF24', blurb: 'Wonder & facts kids love.' },
  { key: 'parenting', label: 'Parenting',  emoji: '🤱',     accent: '#34D399', blurb: 'Tips for grown-ups.' },
  { key: 'friends',   label: 'Friends',    emoji: '🫂',     accent: '#22D3EE', blurb: 'Bonds, fun, belonging.' },
  { key: 'funfacts',  label: 'Fun Facts',  emoji: '🤯',     accent: '#8B5CF6', blurb: 'The internet’s favourite genre.' },
  { key: 'wellbeing', label: 'Wellbeing',  emoji: '🌿',     accent: '#10B981', blurb: 'Calm, sleep, kindness, movement.' },
  { key: 'history',   label: 'History',    emoji: '🏛️',     accent: '#A16207', blurb: 'The past, made surprising.' },
  { key: 'nature',    label: 'Nature',     emoji: '🌍',     accent: '#0EA5E9', blurb: 'The planet, oceans, weather.' },
  { key: 'space',     label: 'Space',      emoji: '🪐',     accent: '#6366F1', blurb: 'Planets, stars, the universe.' },
  { key: 'animals',   label: 'Animals',    emoji: '🐾',     accent: '#F97316', blurb: 'Creatures & their superpowers.' },
  { key: 'science',   label: 'Science',    emoji: '🔬',     accent: '#14B8A6', blurb: 'The “why” behind everyday things.' },
  { key: 'food',      label: 'Food',       emoji: '🍳',     accent: '#DB2777', blurb: 'Food origins, myths & fun.' },
  { key: 'sports',    label: 'Sports',     emoji: '⚽',     accent: '#84CC16', blurb: 'Records, play, movement.' },
  { key: 'world',     label: 'World',      emoji: '🗺️',     accent: '#0891B2', blurb: 'Geography & places that surprise.' },
]

export const formatDef = (k: BFormat): FormatDef => FORMATS.find(f => f.key === k) || FORMATS[0]
export const themeDef = (k: BTheme): ThemeDef => THEMES.find(t => t.key === k) || THEMES[0]
export const accentFor = (k: BTheme): string => themeDef(k).accent

// ── Library: starter bank (mix & match). Grow this freely. ────
// Each item is engineered for one curiosity gap + one high-arousal feeling
// (awe / delight / surprise) + one concrete number or image. Clone & tweak.
export const LIBRARY: LibraryItem[] = [
  // ── Fun facts ───────────────────────────────────────────────
  { id: 'lib-honey', format: 'did_you_know', theme: 'food', emoji: '🍯',
    title: 'Honey never spoils', source: 'archaeology',
    body: 'Archaeologists found 3,000-year-old honey in Egyptian tombs — and it was still perfectly edible.' },
  { id: 'lib-banana', format: 'did_you_know', theme: 'food', emoji: '🍌',
    title: 'Bananas are berries — strawberries aren’t',
    body: 'Botanically, a banana counts as a berry and a strawberry doesn’t. Nature has a sense of humour.' },
  { id: 'lib-lightning', format: 'fact', theme: 'science', emoji: '⚡',
    title: 'Lightning is five times hotter than the Sun',
    body: 'A single bolt reaches ~30,000°C — about five times hotter than the surface of the Sun, in a flash too fast to see.' },
  { id: 'lib-carrots', format: 'did_you_know', theme: 'food', emoji: '🥕',
    title: 'Carrots used to be purple',
    body: 'Orange carrots were bred only ~400 years ago. Before that they were purple, white and yellow.' },
  { id: 'lib-rain', format: 'mind_blown', theme: 'funfacts', emoji: '🌧️',
    title: 'It rains diamonds on two planets',
    body: 'On Neptune and Uranus, extreme pressure turns carbon into diamonds that fall like rain. Somewhere out there, it’s literally raining gems.' },
  { id: 'lib-eiffel', format: 'did_you_know', theme: 'world', emoji: '🗼',
    title: 'The Eiffel Tower grows in summer',
    body: 'Heat expands the iron, making the tower up to 15 cm taller on a hot day. It quietly shrinks again when it cools.' },

  // ── Animals ─────────────────────────────────────────────────
  { id: 'lib-octopus', format: 'fact', theme: 'animals', emoji: '🐙',
    title: 'Octopuses have three hearts',
    body: 'Two pump blood to the gills, one to the body — and the body heart stops when they swim, so swimming literally tires them out.' },
  { id: 'lib-flamingo', format: 'fact', theme: 'animals', emoji: '🦩',
    title: 'A group of flamingos is a “flamboyance”',
    body: 'And they’re born grey — the famous pink comes entirely from what they eat.' },
  { id: 'lib-wombat', format: 'fact', theme: 'animals', emoji: '🟫',
    title: 'Wombats make cube-shaped poop',
    body: 'They’re the only animal on Earth that does — the cubes don’t roll away, so they make perfect territory markers.' },
  { id: 'lib-axolotl', format: 'mind_blown', theme: 'animals', emoji: '🦎',
    title: 'This animal can regrow its brain',
    body: 'The axolotl can regrow legs, its tail, even parts of its heart and brain — and it keeps its baby face for life.' },
  { id: 'lib-tardigrade', format: 'fact', theme: 'animals', emoji: '🐻',
    title: 'A creature that survives space',
    body: 'Tardigrades — “water bears” — can survive boiling, freezing, radiation, and the vacuum of space. They’re smaller than a grain of sand.' },
  { id: 'lib-seahorse', format: 'did_you_know', theme: 'animals', emoji: '🐠',
    title: 'In seahorses, dads give birth',
    body: 'The male seahorse carries the eggs in a pouch and delivers the babies. He’s the only “pregnant” father in the animal kingdom.' },
  { id: 'lib-cow', format: 'this_or_that', theme: 'animals', emoji: '🐮',
    title: 'Cows have best friends',
    body: 'Studies show cows pair up with a best friend and get stressed when apart. Team “animals have feelings” or team “coincidence”? Tap your vote.' },

  // ── Space ───────────────────────────────────────────────────
  { id: 'lib-stars', format: 'mind_blown', theme: 'space', emoji: '⭐',
    title: 'You’re made of star stuff',
    body: 'Almost every atom in your body was forged inside a star billions of years ago. You are, quite literally, stardust.' },
  { id: 'lib-venus', format: 'by_numbers', theme: 'space', emoji: '🪐',
    title: 'A day on Venus is longer than its year',
    body: 'Venus spins so slowly that one day there lasts longer than the time it takes to orbit the Sun. The day is literally longer than the year.' },
  { id: 'lib-footprints', format: 'did_you_know', theme: 'space', emoji: '👟',
    title: 'The Moon’s footprints will outlast us all',
    body: 'With no wind or rain, the astronauts’ footprints on the Moon could stay perfectly intact for millions of years.' },
  { id: 'lib-saturn', format: 'fact', theme: 'space', emoji: '🪐',
    title: 'Saturn would float in water',
    body: 'It’s so light for its size that, if you had a bathtub big enough, the whole planet would bob on the surface.' },
  { id: 'lib-silent', format: 'mind_blown', theme: 'space', emoji: '🌌',
    title: 'Space is completely silent',
    body: 'Sound needs air to travel, and space has none. The biggest explosions in the universe happen in total silence.' },

  // ── Human body / science ────────────────────────────────────
  { id: 'lib-tongue', format: 'fact', theme: 'kids', emoji: '👅',
    title: 'Your tongue print is unique',
    body: 'Just like fingerprints, no two tongue prints are the same. Stick yours out — it’s one of a kind.' },
  { id: 'lib-nose', format: 'by_numbers', theme: 'science', emoji: '👃',
    title: 'Your nose remembers 1 trillion smells',
    body: 'Scientists estimate the human nose can tell apart around a trillion different scents — far more than we ever thought.' },
  { id: 'lib-bones', format: 'did_you_know', theme: 'science', emoji: '🦴',
    title: 'Babies have more bones than you',
    body: 'A baby is born with about 300 bones. Many fuse together as they grow, leaving adults with just 206.' },
  { id: 'lib-yawn', format: 'fact', theme: 'science', emoji: '🥱',
    title: 'Why reading this might make you yawn',
    body: 'Yawning is contagious — just seeing, hearing, or reading the word can set one off. Did it get you?' },
  { id: 'lib-heart', format: 'by_numbers', theme: 'science', emoji: '❤️',
    title: 'Your heart beats 100,000 times a day',
    body: 'Without you ever thinking about it, your heart beats around 100,000 times every single day — over 3 billion times in a lifetime.' },

  // ── Nature / planet ─────────────────────────────────────────
  { id: 'lib-ocean', format: 'mind_blown', theme: 'nature', emoji: '🌊',
    title: 'We’ve mapped Mars better than our oceans',
    body: 'Over 80% of the ocean has never been explored. We have better maps of Mars and the Moon than of our own seafloor.' },
  { id: 'lib-tree', format: 'did_you_know', theme: 'nature', emoji: '🌳',
    title: 'The oldest tree is nearly 5,000 years old',
    body: 'A bristlecone pine nicknamed “Methuselah” was already alive before the pyramids were built — and it’s still growing.' },
  { id: 'lib-sky', format: 'fact', theme: 'science', emoji: '🌤️',
    title: 'Why the sky is blue',
    body: 'Sunlight is made of every colour. Air scatters blue light most of all, so it’s blue that fills the sky in every direction.' },
  { id: 'lib-snail', format: 'did_you_know', theme: 'animals', emoji: '🐌',
    title: 'Snails can sleep for years',
    body: 'When it’s too dry, a snail can sleep for up to three years, waiting for better weather.' },

  // ── History ─────────────────────────────────────────────────
  { id: 'lib-cleopatra', format: 'mind_blown', theme: 'history', emoji: '🏛️',
    title: 'Cleopatra is closer to us than to the pyramids',
    body: 'Cleopatra lived nearer in time to the first Moon landing than to the building of the Great Pyramid. History is older than it feels.' },
  { id: 'lib-oxford', format: 'did_you_know', theme: 'history', emoji: '📜',
    title: 'Oxford is older than the Aztecs',
    body: 'Oxford University was teaching students for over 200 years before the Aztec Empire even began.' },
  { id: 'lib-story-everest', format: 'story', theme: 'history', emoji: '🏔️',
    title: 'The first to the top',
    body: 'In 1953, Hillary and Tenzing reached the summit of Everest. Hillary never said who stepped on first — they’d agreed they did it together, as a team.' },
  { id: 'lib-story-apollo', format: 'story', theme: 'space', emoji: '🚀',
    title: 'A computer weaker than your phone',
    body: 'The computer that guided Apollo 11 to the Moon had less memory than a single photo on your phone. They got there on courage, maths, and teamwork.' },
  { id: 'lib-otd-flight', format: 'on_this_day', theme: 'history', emoji: '✈️',
    title: 'December 17, 1903', source: 'Wright brothers',
    body: 'On this day, two bicycle makers flew the first powered plane — for just 12 seconds. Sixty-six years later, we landed on the Moon.' },
  { id: 'lib-otd-everest', format: 'on_this_day', theme: 'history', emoji: '🗻',
    title: 'May 29, 1953',
    body: 'On this day, humans stood on the highest point on Earth for the first time. The view had waited 60 million years for them.' },

  // ── World / geography ───────────────────────────────────────
  { id: 'lib-russia', format: 'by_numbers', theme: 'world', emoji: '🕰️',
    title: 'Russia spans 11 time zones',
    body: 'When it’s breakfast on one side, it’s already tomorrow’s bedtime on the other. One country, 11 different clocks.' },
  { id: 'lib-africa', format: 'mind_blown', theme: 'world', emoji: '🗺️',
    title: 'Africa is way bigger than the map shows',
    body: 'The USA, China, India and most of Europe all fit inside Africa at once. Flat maps shrink it — the real thing is enormous.' },
  { id: 'lib-finland', format: 'this_or_that', theme: 'world', emoji: '🌲',
    title: 'A country with more saunas than cars',
    body: 'Finland has around 3 million saunas for 5.5 million people. Sauna night or movie night — which would your family pick? Tap below.' },

  // ── This-or-That (engagement / debate) ──────────────────────
  { id: 'lib-tot-beach', format: 'this_or_that', theme: 'family', emoji: '🏖️',
    title: 'Beach day or mountain day?',
    body: 'The eternal family debate. Sandy toes or fresh mountain air? Tap your side — let’s see where this family lands.' },
  { id: 'lib-tot-breakfast', format: 'this_or_that', theme: 'food', emoji: '🥞',
    title: 'Pancakes or waffles?',
    body: 'There is no wrong answer… but there is a right one. Tap your team and settle it once and for all.' },
  { id: 'lib-tot-superpower', format: 'this_or_that', theme: 'kids', emoji: '🦸',
    title: 'Fly or turn invisible?',
    body: 'You can only pick one, forever. Soaring over the clouds, or sneaking around unseen? Tap your power.' },

  // ── Top-10 / lists ──────────────────────────────────────────
  { id: 'lib-top-screenfree', format: 'top10', theme: 'family', emoji: '🎲',
    title: '5 screen-free things to do tonight',
    body: '1. Build a blanket fort\n2. Cook one dish together\n3. Family quiz: kids vs grown-ups\n4. Draw each other\n5. Stargaze for 10 minutes' },
  { id: 'lib-top-questions', format: 'top10', theme: 'family', emoji: '💬',
    title: '5 dinner questions better than “how was your day?”',
    body: '1. What made you laugh today?\n2. What was tricky?\n3. Who were you kind to?\n4. What surprised you?\n5. What are you looking forward to?' },
  { id: 'lib-top-rainy', format: 'top10', theme: 'kids', emoji: '☔',
    title: '5 rainy-day adventures',
    body: '1. Indoor treasure hunt\n2. Sock puppet show\n3. Bake & decorate\n4. Build the tallest tower\n5. Invent a board game' },
  { id: 'lib-top-car', format: 'top10', theme: 'family', emoji: '🚗',
    title: '5 car games that kill the “are we there yet?”',
    body: '1. I-spy\n2. The license-plate alphabet\n3. 20 questions\n4. The quiet game (parents’ favourite)\n5. Story tag — each person adds a line' },

  // ── Tips (practical value) ──────────────────────────────────
  { id: 'lib-tip-connect', format: 'tip', theme: 'parenting', emoji: '🤗',
    title: 'The 10-minute reconnect',
    body: 'Try this: 10 minutes of fully-present, child-led play a day. They pick, you follow. It buys more cooperation than an hour of nagging.' },
  { id: 'lib-tip-sleep', format: 'tip', theme: 'wellbeing', emoji: '😴',
    title: 'Wind-down, not power-down',
    body: 'Try this: dim the lights an hour before bed. Lower light cues melatonin — the whole house falls asleep easier, grown-ups included.' },
  { id: 'lib-tip-feelings', format: 'tip', theme: 'parenting', emoji: '🫶',
    title: 'Name it to tame it',
    body: 'Try this: when a child melts down, name the feeling first (“you’re frustrated”). Labelling an emotion calms the brain before you problem-solve.' },
  { id: 'lib-gratitude', format: 'tip', theme: 'wellbeing', emoji: '🌿',
    title: 'Three good things',
    body: 'Try this: each night, everyone shares three good things from the day. Two weeks of it measurably lifts the whole family’s mood.' },
  { id: 'lib-tip-awe', format: 'tip', theme: 'wellbeing', emoji: '🌅',
    title: 'One minute of awe',
    body: 'Try this: step outside and really look at the sky for 60 seconds. A daily dose of awe measurably lowers stress and lifts mood.' },

  // ── Challenges (tiny, do-it-today) ──────────────────────────
  { id: 'lib-ch-compliment', format: 'challenge', theme: 'family', emoji: '🎯',
    title: 'Today’s tiny challenge',
    body: 'Give every person in the house one honest compliment before bed. Watch what it does to dinner.' },
  { id: 'lib-ch-phone', format: 'challenge', theme: 'wellbeing', emoji: '📵',
    title: 'The phone-basket dinner',
    body: 'Tonight: every phone goes in a basket until the plates are cleared. 30 minutes, fully present. See who lasts.' },
  { id: 'lib-ch-walk', format: 'challenge', theme: 'wellbeing', emoji: '🚶',
    title: '10-minute after-dinner walk',
    body: 'Whole family, around the block, no destination. It’s the easiest reset for mood, sleep, and conversation there is.' },

  // ── Quotes (identity / wisdom) ──────────────────────────────
  { id: 'lib-quote-kids', format: 'quote', theme: 'parenting', emoji: '❝',
    title: 'On children', source: 'Maria Montessori',
    body: 'Play is the work of the child.' },
  { id: 'lib-friend', format: 'quote', theme: 'friends', emoji: '❝',
    title: 'On friendship', source: 'C.S. Lewis',
    body: 'Friendship is born at the moment one person says to another, “What! You too? I thought I was the only one.”' },
  { id: 'lib-quote-time', format: 'quote', theme: 'family', emoji: '❝',
    title: 'On time with kids', source: 'unknown',
    body: 'The days are long, but the years are short.' },
  { id: 'lib-quote-kind', format: 'quote', theme: 'wellbeing', emoji: '❝',
    title: 'On kindness', source: 'Aesop',
    body: 'No act of kindness, no matter how small, is ever wasted.' },

  // ── Sports / play ───────────────────────────────────────────
  { id: 'lib-sport-whale', format: 'by_numbers', theme: 'sports', emoji: '🏊',
    title: 'Usain Bolt vs a… sloth?',
    body: 'Bolt hit 27 mph at his fastest. A sloth tops out around 0.17 mph. He could run his race ~160 times before the sloth finished once.' },
  { id: 'lib-sport-olympic', format: 'did_you_know', theme: 'sports', emoji: '🥇',
    title: 'The Olympics once gave medals for art',
    body: 'From 1912 to 1948, you could win Olympic gold for painting, music, and poetry — sport and art, side by side.' },
]

// ── Research desk: weekly viral trends to steer authoring ─────
// Seed data — replace each week with what’s actually trending. The Research tab
// reads this to suggest the best FORMAT × THEME mix for the moment.
export const RESEARCH: ResearchItem[] = [
  { week: '2026-W26', trend: 'Summer-break boredom busters', theme: 'family', formats: ['top10', 'challenge'], hot: true,
    note: 'Parents searching “things to do with kids” spikes as school ends — ship Top-10 activity lists + tiny challenges.' },
  { week: '2026-W26', trend: 'Ocean & deep-sea mysteries', theme: 'nature', formats: ['mind_blown', 'did_you_know'], hot: true,
    note: '“We’ve mapped Mars better than our oceans.” Awe + animal facts always over-index with kids and reshare hard.' },
  { week: '2026-W26', trend: 'Animal superpowers', theme: 'animals', formats: ['fact', 'mind_blown'], hot: true,
    note: 'Octopus hearts, axolotl regeneration, tardigrades. The single most reliably reshared family genre — infinite supply.' },
  { week: '2026-W26', trend: 'Friday This-or-That', theme: 'food', formats: ['this_or_that'],
    note: 'Reserve a recurring Friday slot. One-tap votes are the lowest-friction engagement loop in the feed.' },
  { week: '2026-W25', trend: 'Space & the night sky', theme: 'space', formats: ['mind_blown', 'on_this_day'],
    note: 'Meteor-shower season. “You’re made of stardust” + “look up tonight” prompts travel far and pair with a photo.' },
  { week: '2026-W25', trend: 'Dinner-table connection', theme: 'family', formats: ['top10', 'tip'],
    note: 'Question-prompt lists and the 10-minute reconnect drive saves and re-sends between parents.' },
  { week: '2026-W25', trend: 'Body weirdness (“your body…”)', theme: 'science', formats: ['by_numbers', 'fact'],
    note: 'You-framed facts (1 trillion smells, 100k heartbeats) over-index — personal + shareable.' },
  { week: '2026-W24', trend: 'Surprising history & “On This Day”', theme: 'history', formats: ['on_this_day', 'mind_blown'],
    note: 'Timeline-twist facts (Cleopatra/pyramids) are reliable reshare bait. “On This Day” is an evergreen recurring ritual.' },
  { week: '2026-W24', trend: 'Food origins & myths', theme: 'food', formats: ['did_you_know', 'this_or_that'],
    note: 'Banana-is-a-berry, purple carrots, honey never spoils. Myth-busting drives “I have to tell someone” reshares.' },
  { week: '2026-W24', trend: 'Geography that breaks your brain', theme: 'world', formats: ['mind_blown', 'by_numbers'],
    note: 'Africa’s true size, Russia’s 11 time zones. Map-twist facts screenshot and reshare extremely well.' },
]

/** Build a clean default draft for a chosen format + theme. */
export function blankDraft(format: BFormat, theme: BTheme): Partial<Broadcast> {
  return {
    format, theme,
    title: '', body: '',
    mediaKind: 'none', mediaUrl: null, source: null,
    emoji: formatDef(format).emoji,
    accent: accentFor(theme),
    audience: format === 'tip' && theme === 'parenting' ? 'grownups' : 'circle',
    status: 'draft',
  }
}
