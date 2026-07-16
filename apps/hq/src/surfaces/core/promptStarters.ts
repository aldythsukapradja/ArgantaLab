// C5-B7 · Prompt starters — "what can I even ask for?", answered concretely.
//
// The Analytics category is DERIVED from the chart registry rather than typed
// out by hand. That's the whole point: a hand-written pill can drift into a
// prompt that no longer matches any chart (and would land in the picker, or
// worse, the wrong chart). Generating each pill from the entry's own vocabulary
// means every analytics pill is guaranteed to resolve to that exact chart.
import { CHART_REGISTRY, pickChart } from '../../lib/core/chartRegistry'

export interface StarterCategory {
  id: string
  label: string
  hint: string
  pills: string[]
}

/** A pill phrase for an entry. The title first — it's written for humans, while
 * the term vocabulary is written for matching and reads like fragments ("Show me
 * what games"). Falls back to the longest phrase term when a title doesn't
 * resolve to its own chart.
 *
 * The guarantee: a candidate only ships if the picker actually resolves it to
 * THIS chart. If neither does, the pill is DROPPED — offering a prompt that
 * misfires would reintroduce exactly the wrong-chart problem C5-B1 fixed. */
function pillFor(id: string): string | null {
  const e = CHART_REGISTRY.find(c => c.id === id)
  if (!e) return null
  const phrase = [...e.terms].filter(t => t.includes(' ')).sort((a, b) => b.length - a.length)[0]
  const candidates = [e.title, phrase ? `Show me ${phrase}` : null].filter(Boolean) as string[]
  return candidates.find(c => pickChart(c).best?.id === id) ?? null
}

// One per office, chosen as the questions a founder actually asks first.
const ANALYTICS_IDS = ['north-star', 'app-usage', 'retention-cohorts', 'diamond-mint-burn', 'ai-cost-by-day', 'runs-by-provider', 'power-curve', 'games-by-genre', 'arr-vs-families', 'usage-punchcard']

export const STARTER_CATEGORIES: StarterCategory[] = [
  {
    id: 'analytics', label: 'Analytics', hint: 'Every one of these resolves to a specific chart — no guessing.',
    pills: ANALYTICS_IDS.map(pillFor).filter(Boolean) as string[],
  },
  {
    id: 'image', label: 'Image', hint: 'Runs a real image model through your gateway.',
    pills: [
      'Generate an image of a glowing arc reactor core, dark studio background',
      'Generate a wide hero image for the ArgantaLab landing page',
      'Generate a friendly mascot for KinetikCircle, flat vector style',
      'Generate a cozy pixel-art farm scene for LashiraBloom',
    ],
  },
  {
    id: 'voice', label: 'Voice', hint: 'Real text-to-speech, saved to your Supabase bucket.',
    pills: [
      'Read this out loud: Arganta builds worlds that teach.',
      'Generate a 20-second investor intro voice-over for ArgantaLab',
      'Voice a warm welcome message for new KinetikCircle families',
    ],
  },
  {
    id: 'build', label: 'Build', hint: 'Real single-file artifacts you can preview, refine in the Builder, and publish.',
    pills: [
      'Build a landing page for Arganta Family with pricing and a signup form',
      'Build a small app: a diamond-budget calculator for guardians',
      // GB-7 — games are a first-class thing Core can make now (create_game).
      'Build a playable arcade game where you dodge asteroids and collect stars',
      'Build a match-3 puzzle game for the ArgantaLab catalogue',
      'Make a deck about the ArgantaLab portfolio for investors',
      'Make a brand kit for LashiraBloom',
    ],
  },
  {
    id: 'offices', label: 'Offices', hint: 'Delegates to a C-Level office; shows the chart behind the answer.',
    pills: [
      'Ask the COO how engagement is trending',
      'Ask the CFO whether the diamond economy is inflating',
      'Ask the CTO which model provider we lean on most',
      'Ask the Bridge what the portfolio should focus on next',
      'Who is on the agent roster?',
    ],
  },
  {
    id: 'memory', label: 'Memory', hint: 'Semantic search across your Vault and past threads.',
    pills: [
      'Search my Vault for what we decided about monetization',
      'What did we say about the rank ladder being a marathon?',
      'Find my notes on the Brand OS contract',
    ],
  },
]
