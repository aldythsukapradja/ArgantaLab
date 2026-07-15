// S1/S2 — opt-in sovereign-model content assist for Website and Deck. Same
// discipline as analytics-intelligence.ts: the deterministic engine
// (engines.ts) is always the instant, authoritative result; this only
// upgrades the copy when explicitly asked, and marketing copy about the
// product is 'public' data — unlike Analytics' real revenue numbers, this is
// free to route through Sponsored/Economy tiers too (still local-first via
// the router's cheapest-capable-wins rule, just not FORCED local).

import { intelligence } from '../../lib/ai'
import type { WebsiteCopy } from './engines'

export interface AiResult<T> { data: T; provenance: any }

const WEBSITE_SCHEMA = { required: ['headline', 'features'], properties: { headline: { type: 'string' }, features: { type: 'array' } } }
const DECK_SCHEMA = { required: ['scenes'], properties: { scenes: { type: 'array' } } }

export async function askWebsiteCopy(brief: string): Promise<AiResult<WebsiteCopy> | null> {
  const res = await intelligence.ask('copy', {
    dataClass: 'public',
    schema: WEBSITE_SCHEMA,
    messages: [
      { role: 'system', content: 'You are a sharp marketing copywriter. Given a brief, return ONLY JSON {"headline": string, "features": string[]} — headline under 60 characters, exactly 3 features each under 50 characters. No preamble, no markdown fences.' },
      { role: 'user', content: brief },
    ],
  })
  if (res.rejected || !res.json?.headline) return null
  return { data: { headline: res.json.headline, features: Array.isArray(res.json.features) ? res.json.features.slice(0, 3) : [] }, provenance: res.provenance }
}

const VIDEO_SCHEMA = { required: ['lines'], properties: { lines: { type: 'array' } } }

/** S3 — topic → a short on-screen script (up to 4 punchy lines) for the video canvas. */
export async function askVideoScript(topic: string): Promise<AiResult<string[]> | null> {
  const res = await intelligence.ask('storyboard', {
    dataClass: 'public',
    schema: VIDEO_SCHEMA,
    messages: [
      { role: 'system', content: 'You write on-screen video captions. Given a topic, return ONLY JSON {"lines": string[]} — exactly 4 short punchy lines (each under 40 characters) that build like a launch-video script: hook, problem, product, call-to-action. No preamble, no markdown fences.' },
      { role: 'user', content: topic },
    ],
  })
  if (res.rejected || !Array.isArray(res.json?.lines) || res.json.lines.length === 0) return null
  return { data: res.json.lines.slice(0, 4), provenance: res.provenance }
}

export async function askDeckOutline(topic: string): Promise<AiResult<string[]> | null> {
  const res = await intelligence.ask('storyboard', {
    dataClass: 'public',
    schema: DECK_SCHEMA,
    messages: [
      { role: 'system', content: 'You are a keynote outline writer. Given a topic, return ONLY JSON {"scenes": string[]} — exactly 5 entries formatted "Title: one supporting sentence", covering problem, insight, product, traction, and the ask. No preamble, no markdown fences.' },
      { role: 'user', content: topic },
    ],
  })
  if (res.rejected || !Array.isArray(res.json?.scenes) || res.json.scenes.length === 0) return null
  return { data: res.json.scenes, provenance: res.provenance }
}
