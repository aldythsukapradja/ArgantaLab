// Content richness — deterministic scoring + benchmark + insight rules.
// Same contract the rest of HQ uses: pure functions over real RPC data,
// returning a typed {severity, headline, driver, action} Insight. An LLM
// pass can later swap in behind these signatures with zero UI churn.

import type { ContentMatrix, ContentCell, ContentStage } from './types'

// Locked 2026-06-23: a world×stage cell needs ≥15 live items to support a
// spaced-retrieval loop without immediate repeats ("adequate").
export const MASTERY_TARGET = 15
const EXPECTED_RUNGS = 5          // difficulty ladder 1..5
const EXPECTED_INTERACTIONS = 5   // interaction-type variety target per cell

export type Verdict = 'rich' | 'adequate' | 'thin' | 'bare' | 'empty'

export interface CellScore {
  world: string
  stage: string
  live: number
  authored: number
  depth: number     // 0..1 — items vs mastery target
  variety: number   // 0..1 — interaction-type diversity
  curve: number     // 0..1 — difficulty rungs covered
  access: number    // 0..1 — live vs authored (draft-locked penalty)
  score: number     // 0..100 weighted
  verdict: Verdict
}

export interface Insight {
  severity: 'high' | 'med' | 'low' | 'ok'
  headline: string
  driver: string
  action: string
}

// Competitor density benchmarks (TTRS + DoodleMaths, locked 2026-06-23).
export interface Benchmark {
  id: string
  label: string
  world: string
  target: number
  unit: string
  note: string
}
export const BENCHMARKS: Benchmark[] = [
  { id: 'ttrs', label: 'Times Tables Rock Stars', world: 'NUM', target: 144,
    unit: 'fact-items', note: '12×12 multiplication/division grid, speed-graded & spaced' },
  { id: 'doodle', label: 'DoodleMaths', world: 'NUM', target: 35000,
    unit: 'questions', note: 'curriculum-mapped adaptive bank, ages 4–14' },
]

export function bandOf(live: number): Verdict {
  if (live === 0) return 'empty'
  if (live <= 7) return 'bare'
  if (live <= MASTERY_TARGET - 1) return 'thin'
  if (live <= 29) return 'adequate'
  return 'rich'
}

export function scoreCell(c: ContentCell): CellScore {
  const depth = Math.min(1, c.live / MASTERY_TARGET)
  const variety = Math.min(1, c.interactions / EXPECTED_INTERACTIONS)
  const curve = Math.min(1, c.rungs / EXPECTED_RUNGS)
  const access = c.authored > 0 ? c.live / c.authored : 0
  const score = Math.round(100 * (0.4 * depth + 0.2 * variety + 0.2 * curve + 0.2 * access))
  return {
    world: c.world, stage: c.stage, live: c.live, authored: c.authored,
    depth, variety, curve, access, score, verdict: bandOf(c.live),
  }
}

export interface MatrixAnalysis {
  scores: CellScore[]
  byKey: Map<string, CellScore>
  cellsTotal: number
  masteryReady: number          // cells with verdict adequate|rich
  stageLive: { stage: ContentStage; live: number }[]
  worldLive: Map<string, number>
  insights: Insight[]
}

const key = (w: string, s: string) => w + '|' + s

export function analyzeMatrix(m: ContentMatrix): MatrixAnalysis {
  const scores = m.cells.map(scoreCell)
  const byKey = new Map(scores.map((s) => [key(s.world, s.stage), s]))

  const stageLiveMap = new Map<string, number>()
  const worldLive = new Map<string, number>()
  for (const c of m.cells) {
    stageLiveMap.set(c.stage, (stageLiveMap.get(c.stage) || 0) + c.live)
    worldLive.set(c.world, (worldLive.get(c.world) || 0) + c.live)
  }
  const stageLive = m.stages.map((s) => ({ stage: s, live: stageLiveMap.get(s.key) || 0 }))

  const cellsTotal = m.worlds.length * m.stages.length
  const masteryReady = scores.filter((s) => s.verdict === 'adequate' || s.verdict === 'rich').length

  const insights: Insight[] = []

  // AccessLeak — authored content that isn't live (the 407/912 class of bug).
  const { authored, live } = m.totals
  if (authored > 0 && live / authored < 0.9) {
    const draft = authored - live
    insights.push({
      severity: live / authored < 0.6 ? 'high' : 'med',
      headline: `${Math.round((draft / authored) * 100)}% of authored content is not live`,
      driver: `${draft.toLocaleString()} of ${authored.toLocaleString()} items sit in draft — invisible to every learner today.`,
      action: 'Publish vetted drafts (set status = live) or prune what is truly retired.',
    })
  }

  // AgeCliff — stages starved relative to the median stage.
  const lives = stageLive.map((x) => x.live).sort((a, b) => a - b)
  const median = lives.length ? lives[Math.floor(lives.length / 2)] : 0
  const starved = stageLive.filter((x) => median > 0 && x.live < median * 0.3)
  if (starved.length) {
    const names = starved.map((x) => `${x.stage.label} (${x.stage.minAge}–${x.stage.maxAge})`).join(', ')
    const sum = starved.reduce((a, x) => a + x.live, 0)
    insights.push({
      severity: 'high',
      headline: `Age cliff: ${names} under-served`,
      driver: `${sum} live items across these bands — under 30% of the median stage. A learner there exhausts the catalog fast.`,
      action: 'Commission authoring for the thin age bands before widening subjects.',
    })
  }

  // ShallowObjectives — cells below the mastery floor.
  const shallow = scores.filter((s) => s.verdict === 'thin' || s.verdict === 'bare').length
  const empty = scores.filter((s) => s.verdict === 'empty').length + (cellsTotal - scores.length)
  if (shallow + empty > 0) {
    insights.push({
      severity: masteryReady / cellsTotal < 0.5 ? 'high' : 'med',
      headline: `Only ${masteryReady} of ${cellsTotal} cells are mastery-ready`,
      driver: `${shallow} cells fall below the ${MASTERY_TARGET}-item floor; ${empty} are empty. Spaced retrieval needs depth per objective.`,
      action: `Top each priority cell up to ≥${MASTERY_TARGET} live items.`,
    })
  }

  // InteractionMonotony — low-variety cells (proxy for one-format fatigue).
  const monotonous = scores.filter((s) => s.live >= 8 && s.variety <= 0.4).length
  if (monotonous > 0) {
    insights.push({
      severity: 'med',
      headline: `${monotonous} populated cells lean on ≤2 interaction types`,
      driver: 'Single-format cells (mostly mcq) drive quiz fatigue and weaker recall.',
      action: 'Mix in cloze, match, numline, and the signature rich interactions.',
    })
  }

  // BenchmarkGap — maths depth vs competitor density.
  const numLive = worldLive.get('NUM') || 0
  const ttrs = BENCHMARKS.find((b) => b.id === 'ttrs')
  if (ttrs && numLive > 0) {
    insights.push({
      severity: numLive < ttrs.target ? 'med' : 'ok',
      headline: `Maths depth is ${Math.round((numLive / ttrs.target) * 100)}% of a single TTRS skill`,
      driver: `${numLive} live NUM items vs ${ttrs.target} ${ttrs.unit} that ${ttrs.label} carries for times-tables alone.`,
      action: 'Deepen high-traffic maths skills toward fact-level mastery density.',
    })
  }

  return { scores, byKey, cellsTotal, masteryReady, stageLive, worldLive, insights }
}
