// WS-6 slice — an OPT-IN sovereign-model insight on top of the deterministic
// Analytics chart. `analytics.ts`'s `analyze()` stays pure, synchronous, and
// authoritative for chart-picking (instant, offline, $0) — this only adds a
// short natural-language caption when the founder explicitly asks for one.
//
// The chart's underlying numbers are real revenue/monetization data, so this
// is classified 'confidential' — governance (ADR-0003) forces it to Tier 0
// (local model) automatically; it can never silently escalate to a paid API.

import { intelligence } from '../../lib/ai'
import type { Analysis } from './analytics'

export interface Insight { text: string; provenance: any }

export async function askInsight(question: string, a: Analysis): Promise<Insight | null> {
  const summary = JSON.stringify(a.data).slice(0, 800)
  const res = await intelligence.ask('summarize', {
    dataClass: 'confidential', // real revenue numbers → forced local by governance
    messages: [
      { role: 'system', content: 'You are a terse analyst. Given a chart\'s underlying data, state the single most useful insight in one sentence, under 160 characters. No preamble, no restating the question.' },
      { role: 'user', content: `Question: ${question}\nChart: ${a.title}\nData: ${summary}` },
    ],
  })
  if (res.rejected || !res.text) return null
  return { text: res.text.trim(), provenance: res.provenance }
}
