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

export type BFormat = 'fact' | 'top10' | 'did_you_know' | 'tip' | 'quote' | 'story'
export type BTheme =
  | 'family' | 'kids' | 'parenting' | 'friends'
  | 'funfacts' | 'wellbeing' | 'history' | 'nature'
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
  { key: 'nature',    label: 'Nature',     emoji: '🌍',     accent: '#0EA5E9', blurb: 'Animals, space, the planet.' },
]

export const formatDef = (k: BFormat): FormatDef => FORMATS.find(f => f.key === k) || FORMATS[0]
export const themeDef = (k: BTheme): ThemeDef => THEMES.find(t => t.key === k) || THEMES[0]
export const accentFor = (k: BTheme): string => themeDef(k).accent

// ── Library: starter bank (mix & match). Grow this freely. ────
export const LIBRARY: LibraryItem[] = [
  // Fun facts / nature
  { id: 'lib-honey', format: 'did_you_know', theme: 'funfacts', emoji: '🍯',
    title: 'Honey never spoils', source: 'archaeology',
    body: 'Archaeologists found 3,000-year-old honey in Egyptian tombs — and it was still perfectly edible.' },
  { id: 'lib-octopus', format: 'fact', theme: 'nature', emoji: '🐙',
    title: 'Octopuses have three hearts',
    body: 'Two pump blood to the gills, one to the body — and the body heart stops when they swim, so swimming literally tires them out.' },
  { id: 'lib-cleopatra', format: 'did_you_know', theme: 'history', emoji: '🏛️',
    title: 'Cleopatra is closer to us than to the pyramids',
    body: 'Cleopatra lived nearer in time to the Moon landing than to the building of the Great Pyramid.' },
  { id: 'lib-flamingo', format: 'fact', theme: 'nature', emoji: '🦩',
    title: 'A group of flamingos is a “flamboyance”',
    body: 'And they’re born grey — the pink comes entirely from what they eat.' },
  { id: 'lib-wombat', format: 'fact', theme: 'nature', emoji: '🟫',
    title: 'Wombats make cube-shaped poop',
    body: 'They’re the only animal on Earth that does — the cubes stop it rolling away, marking their territory.' },
  { id: 'lib-lightning', format: 'fact', theme: 'funfacts', emoji: '⚡',
    title: 'Lightning is hotter than the Sun',
    body: 'A bolt of lightning reaches ~30,000°C — about five times hotter than the surface of the Sun.' },
  { id: 'lib-banana', format: 'did_you_know', theme: 'funfacts', emoji: '🍌',
    title: 'Bananas are berries — strawberries aren’t',
    body: 'Botanically, a banana counts as a berry and a strawberry doesn’t. Nature has a sense of humour.' },

  // Kids
  { id: 'lib-stars', format: 'fact', theme: 'kids', emoji: '⭐',
    title: 'You’re made of star stuff',
    body: 'Almost every atom in your body was forged inside a star billions of years ago. You are, quite literally, stardust.' },
  { id: 'lib-tongue', format: 'fact', theme: 'kids', emoji: '👅',
    title: 'Your tongue print is unique',
    body: 'Just like fingerprints, no two tongue prints are the same. Stick yours out — it’s one of a kind.' },
  { id: 'lib-snail', format: 'did_you_know', theme: 'kids', emoji: '🐌',
    title: 'Snails can sleep for years',
    body: 'When it’s too dry, a snail can sleep for up to three years to wait for better weather.' },

  // Top 10s
  { id: 'lib-top-screenfree', format: 'top10', theme: 'family', emoji: '🎲',
    title: '5 screen-free things to do tonight',
    body: '1. Build a blanket fort\n2. Cook one dish together\n3. Family quiz, kids vs grown-ups\n4. Draw each other\n5. Stargaze for 10 minutes' },
  { id: 'lib-top-questions', format: 'top10', theme: 'family', emoji: '💬',
    title: '5 dinner questions that beat “how was your day?”',
    body: '1. What made you laugh today?\n2. What was tricky?\n3. Who were you kind to?\n4. What surprised you?\n5. What are you looking forward to?' },
  { id: 'lib-top-rainy', format: 'top10', theme: 'kids', emoji: '🌧️',
    title: '5 rainy-day adventures',
    body: '1. Indoor treasure hunt\n2. Sock puppet show\n3. Bake & decorate\n4. Build the tallest tower\n5. Make up a board game' },

  // Parenting tips (grown-ups)
  { id: 'lib-tip-connect', format: 'tip', theme: 'parenting', emoji: '🤗',
    title: 'The 10-minute reconnect',
    body: 'Try this: 10 minutes of fully-present, child-led play a day. They pick, you follow. It buys more cooperation than an hour of nagging.' },
  { id: 'lib-tip-sleep', format: 'tip', theme: 'wellbeing', emoji: '😴',
    title: 'Wind-down, not power-down',
    body: 'Try this: dim the lights an hour before bed. Lower light cues melatonin — the whole house falls asleep easier, grown-ups included.' },
  { id: 'lib-tip-feelings', format: 'tip', theme: 'parenting', emoji: '🫶',
    title: 'Name it to tame it',
    body: 'Try this: when a child melts down, name the feeling first (“you’re frustrated”). Labelling emotions calms the brain before you problem-solve.' },

  // Wellbeing / friends
  { id: 'lib-gratitude', format: 'tip', theme: 'wellbeing', emoji: '🌿',
    title: 'Three good things',
    body: 'Try this: each night, everyone shares three good things from the day. Two weeks of it measurably lifts the whole family’s mood.' },
  { id: 'lib-friend', format: 'quote', theme: 'friends', emoji: '❝',
    title: 'On friendship', source: 'C.S. Lewis',
    body: 'Friendship is born at the moment one person says to another, “What! You too? I thought I was the only one.”' },

  // Quotes / story
  { id: 'lib-quote-kids', format: 'quote', theme: 'parenting', emoji: '❝',
    title: 'On children', source: 'Maria Montessori',
    body: 'Play is the work of the child.' },
  { id: 'lib-story-everest', format: 'story', theme: 'history', emoji: '🏔️',
    title: 'The first to the top',
    body: 'In 1953, Edmund Hillary and Tenzing Norgay reached the summit of Everest. Hillary never said who stepped on first — they’d agreed they did it together, as a team.' },
  { id: 'lib-story-apollo', format: 'story', theme: 'history', emoji: '🚀',
    title: 'A computer with less power than your phone',
    body: 'The computer that guided Apollo 11 to the Moon had less memory than a single modern photo. They got there on courage, maths, and teamwork.' },
]

// ── Research desk: weekly viral trends to steer authoring ─────
// Seed data — replace each week with what’s actually trending. The Research tab
// reads this to suggest the best FORMAT × THEME mix for the moment.
export const RESEARCH: ResearchItem[] = [
  { week: '2026-W26', trend: 'Summer-break boredom busters', theme: 'family', formats: ['top10', 'tip'], hot: true,
    note: 'Parents searching “things to do with kids” spikes as school ends — ship Top-10 activity lists.' },
  { week: '2026-W26', trend: 'Ocean & sea-creature facts', theme: 'nature', formats: ['fact', 'did_you_know'], hot: true,
    note: 'Shark Week-adjacent. Animal facts always over-index with kids + reshare well.' },
  { week: '2026-W26', trend: 'Calm bedtime routines', theme: 'wellbeing', formats: ['tip'],
    note: 'Evergreen parenting tip that performs on weekday evenings.' },
  { week: '2026-W25', trend: 'Space & the night sky', theme: 'kids', formats: ['fact', 'story'],
    note: 'Stargazing season. “You’re made of stardust” style facts travel far.' },
  { week: '2026-W25', trend: 'Dinner-table connection', theme: 'family', formats: ['top10', 'tip'],
    note: 'Question-prompt lists drive comments — families answer in-thread.' },
  { week: '2026-W24', trend: 'Surprising history', theme: 'history', formats: ['did_you_know', 'story'],
    note: 'Timeline-twist facts (Cleopatra/pyramids) are reliable reshare bait.' },
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
