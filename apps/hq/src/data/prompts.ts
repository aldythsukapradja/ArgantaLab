/**
 * BROADCAST · PROMPT ENGINE
 *
 * Copy-paste prompts the operator feeds to ANY external LLM (ChatGPT, Claude,
 * Gemini…) to mass-produce KinetikCircle "Discover" content. No API, no keys —
 * the workflow is: pick a pack → copy the prompt → paste into an LLM → copy its
 * answer → paste into the Import tab → review → drip-schedule. That closes the
 * loop and lets one operator fill weeks of feed in minutes.
 *
 * Every prompt is engineered around proven spread/retention mechanics:
 *   • STEPPS (social currency, triggers, emotion, public, practical, stories)
 *   • Curiosity gap / open loop (title asks, body answers)
 *   • Variable reward (rotate formats) + recurring rituals (On This Day, Friday This-or-That)
 * so the content that comes back is built to stop the scroll and get re-shared.
 *
 * The OUTPUT spec forces a strict JSON array that the Import tab parses 1:1 into
 * drafts. Grow the packs freely — it's just data.
 */

import { FORMATS, THEMES, formatDef, themeDef, accentFor, type BFormat, type BTheme, type BMediaKind, type BAudience } from './broadcast'

// ── The brand voice + virality rules every prompt carries ─────
export const SYSTEM_PRIMER = `You are the content writer for KinetikCircle — a warm, private social app for families (grandparents, parents, kids all in one feed). You write the platform's "Discover" cards: tiny, delightful, share-worthy posts that keep the family feed alive between real family moments.

VOICE
- Warm, witty, wholesome. Never cynical, scary, political, or salesy.
- Safe for a 6-year-old AND interesting to a 70-year-old. If in doubt, leave it out.
- Plain language. No jargon, no hedging ("scientists think" only when the doubt IS the hook).
- Sounds great read aloud at the dinner table.

EVERY CARD MUST CARRY (this is what makes them spread):
1. ONE curiosity gap — the title raises a question, the body answers it. Never give it all away in the title.
2. ONE high-arousal feeling — awe, delight, or "wait… WHAT?". Never lukewarm.
3. ONE concrete number or vivid image — "octopuses have 3 hearts" beats "animals are amazing".
4. "You / your" framing where natural — make it personal.
5. Obvious "I have to tell someone" relevance — a kid would blurt it out; a grandparent would re-send it.

HOOK-WRITING RULES
- Title: under ~9 words, the most surprising word in the first three.
- Body: 1–2 short lines, under ~30 words total. One idea per card — cut the second fact.
- Be specific, not vague. Lead with a number when you can.
- Surprising juxtaposition wins ("honey + Egyptian tomb = still edible").
- 100% true and family-safe. No death, gore, religion, politics, or anything a parent wouldn't want a child to read.`

// ── How the LLM must return content (parsed 1:1 by the Import tab) ──
export function contentOutputSpec(): string {
  const formats = FORMATS.map(f => `"${f.key}" (${f.label})`).join(', ')
  const themes = THEMES.map(t => `"${t.key}" (${t.label})`).join(', ')
  return `OUTPUT — return ONLY a JSON array, nothing before or after it (no commentary, no markdown fences). Each element is one card:
[
  {
    "format": one of: ${formats},
    "theme": one of: ${themes},
    "emoji": a single leading emoji that fits the card,
    "title": the headline (short, curiosity-gap),
    "body": the 1–2 line payoff,
    "source": short attribution if relevant else "" (e.g. "via NASA", "— C.S. Lewis")
  }
]
Use straight double-quotes. Do not include trailing commas. Do not number the items. Return the array and nothing else.`
}

// ── How the LLM must return a research scan (read by the operator) ──
export const RESEARCH_OUTPUT_SPEC = `OUTPUT — return a clean, scannable list. For each idea give:
• Trend/topic (3–6 words)
• Why it's hot right now (one line)
• Best format + theme to use (from the KinetikCircle set)
• One example title
Group by theme. No fluff, no intro paragraph — just the list.`

// ── Prompt packs (the menu the operator browses) ──────────────
export type PromptGoal = 'retention' | 'engagement' | 'virality' | 'research'

export interface PromptPack {
  id: string
  title: string
  goal: PromptGoal
  emoji: string
  blurb: string            // what this pack produces
  why: string              // the mechanic it leans on
  usesFormat: boolean      // show the format picker
  usesTheme: boolean       // show the theme picker
  usesCount: boolean       // show the count stepper
  body: string             // task instructions; supports {count} {format} {formatLabel} {formatHint} {theme} {themeLabel}
}

export const GOALS: { key: PromptGoal; label: string; emoji: string; blurb: string }[] = [
  { key: 'virality',   label: 'Virality',   emoji: '🚀', blurb: 'Built to be re-shared & screenshotted.' },
  { key: 'engagement', label: 'Engagement', emoji: '👆', blurb: 'One-tap votes & reactions, zero friction.' },
  { key: 'retention',  label: 'Retention',  emoji: '🔁', blurb: 'Recurring rituals that pull people back daily.' },
  { key: 'research',   label: 'Research',   emoji: '🧪', blurb: 'Find what to post — surface this week’s hooks.' },
]

export const PROMPT_PACKS: PromptPack[] = [
  // ── VIRALITY ────────────────────────────────────────────────
  {
    id: 'batch-mixed', title: 'Viral mixed batch', goal: 'virality', emoji: '🎛️',
    blurb: 'A full week of varied cards across formats & themes in one go.',
    why: 'Variable reward — rotating formats keeps the feed a slot machine, not a calendar.',
    usesFormat: false, usesTheme: false, usesCount: true,
    body: `Write {count} KinetikCircle Discover cards. Make them a VARIED mix — rotate across different formats (fun facts, did-you-knows, mind-blown reframes, by-the-numbers, this-or-that, top-10s, on-this-day, tips, quotes, mini-challenges) and across different themes (animals, space, science, history, food, nature, world, family, kids, wellbeing).
Aim for the kind of card someone screenshots and sends to a family member. No two cards should feel the same.`,
  },
  {
    id: 'single-format', title: 'Format deep-dive', goal: 'virality', emoji: '🎯',
    blurb: 'Many cards of ONE chosen format — fill the library fast.',
    why: 'Batch one format at a time → easiest to keep voice + quality consistent.',
    usesFormat: true, usesTheme: true, usesCount: true,
    body: `Write {count} "{formatLabel}" cards on the theme of {themeLabel}.
Format guidance: {formatHint}
Make each one distinct and genuinely surprising — no repeats, no filler.`,
  },
  {
    id: 'mindblown', title: 'Mind-blown reframes', goal: 'virality', emoji: '🤯',
    blurb: '“Wait… WHAT?” facts that violate expectations.',
    why: 'Surprise + high arousal is the most reliably re-shared emotion.',
    usesFormat: false, usesTheme: true, usesCount: true,
    body: `Write {count} "mind_blown" cards on the theme of {themeLabel}.
Each one sets up the obvious, then flips it with a twist in the last line ("we've mapped Mars better than our own oceans"). The reader should feel an instant "I HAVE to tell someone". Format key: "mind_blown".`,
  },
  {
    id: 'numbers', title: 'By-the-numbers', goal: 'virality', emoji: '🔢',
    blurb: 'One striking, concrete number per card.',
    why: 'Specific numbers feel credible and screenshot well.',
    usesFormat: false, usesTheme: true, usesCount: true,
    body: `Write {count} "by_numbers" cards on the theme of {themeLabel}.
Lead each with one striking number and make it concrete and comparable to everyday life ("your heart beats 100,000 times a day"). Format key: "by_numbers".`,
  },

  // ── ENGAGEMENT ──────────────────────────────────────────────
  {
    id: 'this-or-that', title: 'This-or-That votes', goal: 'engagement', emoji: '⚖️',
    blurb: 'Fun either/or cards — the family votes with one tap (reactions).',
    why: 'Lowest-friction participation: a tap-vote, no posting required. Sustains the habit.',
    usesFormat: false, usesTheme: true, usesCount: true,
    body: `Write {count} "this_or_that" cards on the theme of {themeLabel}.
Each offers two fun, balanced options the whole family can pick between (no wrong answer), ending with a short nudge like "Which are you? Tap your side." Keep them light and universal. Format key: "this_or_that".`,
  },
  {
    id: 'would-you-rather', title: 'Would-you-rather', goal: 'engagement', emoji: '🤔',
    blurb: 'Playful dilemmas kids and grandparents both want to answer.',
    why: 'Open loop + debate bait — invites a reaction and a "what would YOU pick?" reshare.',
    usesFormat: false, usesTheme: false, usesCount: true,
    body: `Write {count} "this_or_that" cards in a "would you rather…" style across mixed kid-friendly themes (superpowers, animals, food, travel, silly scenarios).
Two vivid options, impossible to answer easily, totally family-safe. End each with "Tap your pick." Format key: "this_or_that".`,
  },
  {
    id: 'top10', title: 'Top-10 / ranked lists', goal: 'engagement', emoji: '🔟',
    blurb: 'Screenshot-able numbered lists families save & re-send.',
    why: 'Completion-driven + practical value → high save and share rate.',
    usesFormat: false, usesTheme: true, usesCount: true,
    body: `Write {count} "top10" cards on the theme of {themeLabel}.
Each: a punchy list title, then 5 short numbered items (one per line, separated by \\n in the body). Practical or playful — the kind of list a parent screenshots for later. Format key: "top10".`,
  },

  // ── RETENTION ───────────────────────────────────────────────
  {
    id: 'on-this-day', title: '“On This Day” ritual', goal: 'retention', emoji: '📅',
    blurb: 'A month of dated history hooks — one per day, appointment-style.',
    why: 'Named recurring ritual = appointment viewing. Users return for the segment.',
    usesFormat: false, usesTheme: false, usesCount: true,
    body: `Write {count} "on_this_day" cards — kid-safe "this day in history" moments (inventions, firsts, discoveries, explorers, space, sport).
Open each with the date, then one surprising event told in a single breath. Put the date in "source" (e.g. "May 29, 1953"). Family-safe only — no wars, disasters, or death. Format key: "on_this_day".`,
  },
  {
    id: 'daily-challenge', title: 'Daily mini-challenges', goal: 'retention', emoji: '🎯',
    blurb: 'Tiny do-it-today family actions — a reason to come back tomorrow.',
    why: 'Investment + Zeigarnik loop: a small open task the family wants to close.',
    usesFormat: false, usesTheme: false, usesCount: true,
    body: `Write {count} "challenge" cards — tiny, joyful, do-it-today family challenges (doable in minutes, no equipment, no homework feel).
Examples: "Give everyone one honest compliment before bed." Each should leave a warm open loop the family wants to complete tonight. Format key: "challenge".`,
  },
  {
    id: 'tips', title: 'Practical family tips', goal: 'retention', emoji: '✅',
    blurb: 'Save-able parenting / wellbeing tips ("try this tonight").',
    why: 'Practical value → parents save and re-send, and come back for more.',
    usesFormat: false, usesTheme: true, usesCount: true,
    body: `Write {count} "tip" cards on the theme of {themeLabel}.
Each starts with "Try this:" then ONE concrete, evidence-friendly move a family can do tonight. No lecture, no guilt. Format key: "tip". Set "source" to "" unless quoting a named approach.`,
  },

  // ── RESEARCH ────────────────────────────────────────────────
  {
    id: 'trend-scan', title: 'Weekly trend scan', goal: 'research', emoji: '🧭',
    blurb: 'Surface what’s viral & evergreen this week for a family audience.',
    why: 'Feeds the Research desk so you author with the moment, not against it.',
    usesFormat: false, usesTheme: false, usesCount: true,
    body: `Act as a viral-content researcher for a family social app. List {count} content ideas that are reliably viral RIGHT NOW or evergreen for a family / kids / parenting / funfacts / nature / history / space audience.
Favour timeless, broad-appeal, zero-controversy topics (animals, space, body facts, food myths, geography, "on this day"). For each, note why it spreads and the best format to use.`,
  },
  {
    id: 'angle-finder', title: 'Angle finder', goal: 'research', emoji: '🔭',
    blurb: '10 fresh angles on ONE theme so you never run dry.',
    why: 'Turns a single theme into weeks of non-repeating cards.',
    usesFormat: false, usesTheme: true, usesCount: true,
    body: `I want to make lots of KinetikCircle cards about {themeLabel} without repeating myself. List {count} distinct, surprising angles/sub-topics within {themeLabel} that would each make a great family-feed card, with a one-line "why it's interesting" for each.`,
  },
]

export const goalDef = (g: PromptGoal) => GOALS.find(x => x.key === g) || GOALS[0]
export const packsByGoal = (g: PromptGoal) => PROMPT_PACKS.filter(p => p.goal === g)

// ── Assemble the full prompt the operator copies ──────────────
export interface BuildOpts { count?: number; format?: BFormat; theme?: BTheme }

export function buildPrompt(pack: PromptPack, opts: BuildOpts = {}): string {
  const count = opts.count ?? 10
  const format = opts.format ?? 'fact'
  const theme = opts.theme ?? 'funfacts'
  const fd = formatDef(format)
  const td = themeDef(theme)

  const sub = (s: string, k: string, v: string) => s.split(k).join(v)
  let task = pack.body
  task = sub(task, '{count}', String(count))
  task = sub(task, '{formatLabel}', fd.label)
  task = sub(task, '{formatHint}', fd.hint)
  task = sub(task, '{format}', fd.key)
  task = sub(task, '{themeLabel}', td.label)
  task = sub(task, '{theme}', td.key)

  const spec = pack.goal === 'research' ? RESEARCH_OUTPUT_SPEC : contentOutputSpec()

  return `${SYSTEM_PRIMER}\n\nTASK\n${task}\n\n${spec}`
}

// ── Parse an LLM's answer back into draftable posts ───────────
export interface ParsedPost {
  format: BFormat
  theme: BTheme
  title: string
  body: string
  emoji: string
  source: string
  mediaKind: BMediaKind
  mediaUrl: string
  accent: string
  audience: BAudience
}

export interface ParseResult { posts: ParsedPost[]; error: string | null; skipped: number }

const FORMAT_KEYS = new Set(FORMATS.map(f => f.key))
const THEME_KEYS = new Set(THEMES.map(t => t.key))

/** Pull the first JSON array out of arbitrary LLM text (handles ``` fences + stray prose). */
function extractArray(raw: string): string | null {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}

export function parseImport(raw: string): ParseResult {
  const text = (raw || '').trim()
  if (!text) return { posts: [], error: 'Paste the LLM output first.', skipped: 0 }

  const slice = extractArray(text)
  if (!slice) return { posts: [], error: 'Couldn’t find a JSON array. Make sure you pasted the model’s full answer.', skipped: 0 }

  let arr: any
  try {
    arr = JSON.parse(slice)
  } catch {
    // tolerant retry: strip trailing commas before ] or }
    try { arr = JSON.parse(slice.replace(/,\s*([\]}])/g, '$1')) }
    catch { return { posts: [], error: 'That isn’t valid JSON. Ask the model to "return ONLY the JSON array, no commentary".', skipped: 0 } }
  }
  if (!Array.isArray(arr)) return { posts: [], error: 'Expected a JSON array of cards.', skipped: 0 }

  const posts: ParsedPost[] = []
  let skipped = 0
  for (const item of arr) {
    if (!item || typeof item !== 'object') { skipped++; continue }
    const title = String(item.title ?? '').trim()
    if (!title) { skipped++; continue }
    const format = (FORMAT_KEYS.has(item.format) ? item.format : 'fact') as BFormat
    const theme = (THEME_KEYS.has(item.theme) ? item.theme : 'funfacts') as BTheme
    posts.push({
      format, theme, title,
      body: String(item.body ?? '').trim(),
      emoji: String(item.emoji ?? formatDef(format).emoji).trim().slice(0, 4) || formatDef(format).emoji,
      source: String(item.source ?? '').trim(),
      mediaKind: 'none', mediaUrl: '',
      accent: accentFor(theme),
      audience: (format === 'tip' && theme === 'parenting') ? 'grownups' : 'circle',
    })
  }
  if (posts.length === 0) return { posts: [], error: 'No usable cards found (every item was missing a title).', skipped }
  return { posts, error: null, skipped }
}
