// C3 · Arganta Core tool executor — the REAL implementation behind every
// name in @arganta/agent's TOOL_SPECS (C1, frozen). Each function returns a
// plain object the model reads back as a tool result AND (for media kinds)
// enough info for the caller to build a thread.js block. Never throws —
// loop.js already catches/records a thrown executor, but each tool degrades
// honestly on its own path too (never fabricates a result).
import { toolByName } from '@arganta/agent'
import { ai, logAgentRun, getSessionRuns, intelligenceRegistry } from '../ai'
import { selectModel, isRouteAllowed } from '@arganta/ai'
import { supabase, cloudEnabled } from '../supabase'
import { generateImageViaGateway, generateSpeechViaGateway, embedTextViaGateway, getNeuronQuota } from '../mediaGateway'
import { saveMediaAsset } from '../mediaAssets'
import { makeWebsite, makeDeck, makeBrand } from '../../surfaces/studios/engines'
import { analyzeQuestion, buildChartSpec, chartById, chartsForOffice, pickChart, isPicker, CHART_REGISTRY, type OfficeKey } from './chartRegistry'
import { OFFICE_META, routeConcern, delegationResponse, isOffice } from '@arganta/agent'
import { BUILDER_TOOL_SPECS, builderToolByName, validateHtml, classifyGameGenre } from '@arganta/builder'
import { generateWebsite, generateApplication, generateGame, reviseArtifact } from '../../builder-core/generate'
import { createArtifact, saveVersion, saveCurrentAsVersion, restoreVersion, getArtifact, listVersions, publishArtifact, publicArtifactUrl } from '../../builder-core/persist'
import { agentSense, agentCompute, agentMatch, agentFacts, agentGenerate, routeIntent, INTENT_ROLE, AGENTS } from '../../data/agents'
import { techSense, capoSense } from '../../data/officeSense'
import { agentMessages } from '@arganta/ai'

export interface ToolResult {
  data: unknown          // what the model reads back (JSON-stringified by the loop)
  block?: Record<string, unknown>  // makeBlock(kind, ...) input the caller renders, if any
  /** C5-B2 — additional blocks of an EXPLICIT kind, for tools whose answer is
   * more than one artifact (consult_office returns a delegation AND the chart
   * that grounds it). `block` above is kind-inferred from the tool name
   * (blockKindFor); these carry their own kind because a single tool can now
   * emit several different ones. */
  extraBlocks?: { kind: string; block: Record<string, unknown> }[]
  costUsd?: number
}

async function runImage(args: { prompt: string }): Promise<ToolResult> {
  const runId = crypto.randomUUID()
  const g = await generateImageViaGateway({ prompt: args.prompt, costClass: 1 })
  if (!g) return { data: { error: 'image generation unavailable' } }
  await logAgentRun({ runId, domain: 'media', task: 'image', dataClass: 'public', requestedCostClass: 1, actualCostClass: g.costClass, requestedProvider: g.provider, requestedModel: g.model, actualProvider: g.provider, actualModel: g.model, costUsd: g.costUsd, status: 'succeeded' })
  const saved = await saveMediaAsset({ runId, kind: 'image', bytes: g.bytes, mime: g.mime, prompt: args.prompt, provider: g.provider, model: g.model, costUsd: g.costUsd })
  return {
    data: { ok: true, provider: g.provider, model: g.model, saved },
    block: { assetId: saved ? runId : null, path: saved ? `${runId}.${g.mime.includes('png') ? 'png' : 'jpg'}` : null, mime: g.mime, provider: g.provider, model: g.model, costUsd: g.costUsd },
    costUsd: g.costUsd,
  }
}

async function runSpeech(args: { text: string; voice?: 'JM' | 'KF' }): Promise<ToolResult> {
  const runId = crypto.randomUUID()
  const voiceSpeaker = args.voice === 'KF' ? 'asteria' : 'orion'
  const g = await generateSpeechViaGateway({ text: args.text, voice: voiceSpeaker })
  if (!g) return { data: { error: 'speech generation unavailable' } }
  await logAgentRun({ runId, domain: 'media', task: 'tts', dataClass: 'public', requestedCostClass: 1, actualCostClass: g.costClass, requestedProvider: g.provider, requestedModel: g.model, actualProvider: g.provider, actualModel: g.model, costUsd: g.costUsd, status: 'succeeded' })
  const saved = await saveMediaAsset({ runId, kind: 'tts', bytes: g.bytes, mime: g.mime, prompt: args.text, provider: g.provider, model: g.model, costUsd: g.costUsd })
  return {
    data: { ok: true, provider: g.provider, model: g.model, saved },
    block: { assetId: saved ? runId : null, path: saved ? `${runId}.mp3` : null, mime: g.mime, provider: g.provider, model: g.model, costUsd: g.costUsd },
    costUsd: g.costUsd,
  }
}

function runWebsite(args: { brief: string }): ToolResult {
  const brand = makeBrand(args.brief)
  const html = makeWebsite(args.brief, brand)
  return { data: { ok: true, provider: 'deterministic-website', bytes: html.length }, block: { assetId: null, path: null, html } }
}
function runDeck(args: { topic: string }): ToolResult {
  const brand = makeBrand(args.topic)
  const html = makeDeck(args.topic, brand)
  return { data: { ok: true, provider: 'deterministic-deck', bytes: html.length }, block: { assetId: null, path: null, html } }
}
function runBrand(args: { seed: string }): ToolResult {
  const brand = makeBrand(args.seed)
  // 'brand' block (thread.js, frozen) only carries assetId/path/html — no raw
  // object field — so render a tiny inline swatch strip, same pattern website/
  // deck already use for their deterministic HTML.
  const swatches = Object.entries(brand.colors).map(([k, v]) => `<div style="background:${v};height:40px;flex:1" title="${k}: ${v}"></div>`).join('')
  const html = `<div style="display:flex;font-family:${brand.fonts.body}">${swatches}</div>`
  return { data: { ok: true, colors: brand.colors }, block: { assetId: null, path: null, html } }
}

// C5-B1 — routed through the chart registry, which either returns THE right
// chart or a picker. The old path called analyze() (studios/analytics.ts) whose
// fallthrough silently returned the ARR-vs-families model for any unrecognized
// question — a wrong chart presented as an answer. It cannot do that now: the
// registry has no fallthrough.
//
// What the MODEL reads back matters as much as what renders. On a picker we
// tell it plainly that nothing was charted and that the founder is choosing, so
// it can't narrate a chart that isn't there ("The analytics of your Arganta
// stacks show an area chart…" was the old failure). On a chart with no rows we
// hand back the honest note, never zeros dressed as a measurement.
async function runAnalyze(args: { question: string }): Promise<ToolResult> {
  const spec = await analyzeQuestion(args.question)
  if (isPicker(spec)) {
    return {
      data: {
        charted: false,
        reason: 'ambiguous question — no chart was rendered; the founder is picking one from a list',
        offered: spec.options.map(o => o.title),
        instruction: 'Do NOT describe any chart or data. Say you were not sure which one they meant and invite them to pick.',
      },
      block: { spec },
    }
  }
  return {
    data: {
      charted: spec.data.length > 0,
      chartId: spec.chartId, chart: spec.chart, title: spec.title,
      office: spec.office, provenance: spec.provenance, source: spec.source,
      points: spec.data.length,
      // The rows themselves, capped — the model needs them to actually TALK
      // about the numbers instead of just naming the chart type.
      rows: spec.data.slice(0, 24),
      note: spec.note,
      instruction: spec.note
        ? 'This chart has NO data. Say so plainly, quote the note, and do not invent numbers.'
        : `Provenance is '${spec.provenance}'. Never call a modeled/planned figure a measurement.`,
    },
    block: { spec },
  }
}

/** C5-B1 — render a registry chart by id, no question involved. Powers the
 * picker's click-through and the chart card's Refresh, through the same
 * executor path the model uses (one code path, one set of rules). */
async function runRenderChart(args: { chartId: string }): Promise<ToolResult> {
  const entry = chartById(args.chartId)
  if (!entry) return { data: { error: `unknown chart: ${args.chartId}` } }
  const spec = await buildChartSpec(entry)
  return {
    data: { charted: spec.data.length > 0, chartId: spec.chartId, title: spec.title, provenance: spec.provenance, points: spec.data.length, rows: spec.data.slice(0, 24), note: spec.note },
    block: { spec },
  }
}

async function runSearchVault(args: { query: string; k?: number }): Promise<ToolResult> {
  if (!cloudEnabled) return { data: { results: [], note: 'offline — memory search needs Supabase' } }
  const e = await embedTextViaGateway({ text: args.query })
  if (!e) return { data: { results: [], note: 'embedding unavailable' } }
  const { data, error } = await supabase.rpc('memory_search', { p_embedding: e.embedding, p_k: args.k ?? 6, p_max_data_class: 'confidential' })
  if (error) return { data: { results: [], error: error.message } }
  return { data: { results: (data || []).map((r: any) => ({ content: r.content, similarity: r.similarity, source: r.source })) }, costUsd: e.costUsd }
}

// consult_office — C6 (ADR-0007): offices as GROUNDED sub-agents, not just a
// persona. operations/treasury run the real agents.ts Sense→Compute→Match→
// Generate pipeline over live Supabase data; bridge/technology/legal have no
// grounded pipeline yet and honestly stay the C3 persona; roster answers from
// the real (static) org roster. External contract is unchanged from C3 —
// {office?, question} in, a delegation block out — only the depth changed.
const GROUNDED_OFFICES = new Set(['operations', 'treasury'])
const OFFICE_CHIEF: Record<string, string | null> = {
  bridge: 'ceo', operations: 'coo', technology: 'cto', treasury: 'cfo', legal: 'gc', roster: null,
}

// A confidential delegation can ONLY route to Tier 0 (governance.js), and
// Tier 0 in the browser means WebLLM — the standing "brittle" gap this
// session's memory already flagged: on a cold load it downloads a real model
// over the network, and in some environments that never resolves at all
// rather than failing cleanly. Without a bound, a hung Tier-0 load would
// hang the ENTIRE chat turn forever — worse than the honest degrade
// governedOfficeChat already has for a clean failure. 30s is generous enough
// for a genuine first-load download on a real machine while still giving the
// founder a real turn back if it's actually stuck.
const TIER0_TIMEOUT_MS = 30_000
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([p, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms))])
}

/** selectModel(dataClass)-gated chat, the shape a delegation's Generate step
 * needs. THE governance enforcement point (ADR-0007 Decision 3): at
 * dataClass:'confidential', governance.js's DATA_ALLOWED only permits
 * costClass 0 — selectModel CANNOT return an external candidate no matter
 * what the legacy task router would have picked, so "confidential facts stay
 * on Tier 0" is a property of the call, not a promise in a comment. No
 * capable model → provider:'mock' with empty text, the same honest-degrade
 * shape every other tool in this file already uses. */
async function governedOfficeChat(o: { task: string; messages: unknown[] }, dataClass: string, runId: string): Promise<{ text: string; provider: string; model?: string; costUsd?: number }> {
  const { model: picked, reason } = selectModel(intelligenceRegistry, { task: o.task, dataClass })
  if (!picked || !isRouteAllowed(picked, dataClass)) {
    console.warn('[consult_office]', o.task, dataClass, 'no capable model:', reason)
    return { text: '', provider: 'mock' }
  }
  const result = await withTimeout(ai.chat({ task: o.task, messages: o.messages, provider: picked.provider, model: picked.apiModel }), TIER0_TIMEOUT_MS)
  if (result === 'timeout') {
    console.warn('[consult_office]', o.task, dataClass, `timed out after ${TIER0_TIMEOUT_MS}ms waiting on`, picked.provider)
    await logAgentRun({
      runId, domain: 'llm', task: 'consult_office', dataClass,
      requestedCostClass: picked.costClass, actualCostClass: picked.costClass,
      requestedProvider: picked.provider, requestedModel: picked.apiModel,
      actualProvider: 'mock', actualModel: 'mock', costUsd: 0, status: 'failed',
      error: `timed out after ${TIER0_TIMEOUT_MS}ms waiting on ${picked.provider}`,
    })
    return { text: '', provider: 'mock' }
  }
  const out: any = result
  const silentlyMocked = out.provider === 'mock' && picked.provider !== 'mock'
  await logAgentRun({
    runId, domain: 'llm', task: 'consult_office', dataClass,
    requestedCostClass: picked.costClass, actualCostClass: out.tier ?? picked.costClass,
    requestedProvider: picked.provider, requestedModel: picked.apiModel,
    actualProvider: silentlyMocked ? 'mock' : (out.provider ?? picked.provider), actualModel: silentlyMocked ? 'mock' : (out.model ?? picked.apiModel),
    costUsd: out.costUsd ?? 0, latencyMs: 0, status: silentlyMocked ? 'failed' : 'succeeded',
    error: silentlyMocked ? `requested ${picked.provider} but adapter fell back to mock` : null,
  })
  if (silentlyMocked) return { text: '', provider: 'mock' }
  return { text: out.text || '', provider: out.provider, model: out.model, costUsd: out.costUsd ?? 0 }
}

// C5-B2 · office → chart-registry slice. Every office that owns numbers can now
// SHOW them, not just talk about them. This is deliberately additive: the text
// path (grounded pipeline / persona / roster) is untouched, and the chart is an
// extra block alongside it. Legal owns no metrics, so it maps to nothing and
// stays text-only rather than being handed someone else's chart.
const OFFICE_CHART_SLICE: Record<string, OfficeKey | null> = {
  bridge: 'portfolio', operations: 'operations', technology: 'technology',
  treasury: 'treasury', legal: null, roster: null,
}

/** Best chart for this office's question, or null. Scoped to the office's own
 * slice, so the CTO can never answer with the CFO's revenue model. Only returns
 * a chart that actually HAS rows — an empty chart under a delegation reads as a
 * broken answer, and the text already stands on its own. */
async function officeChart(office: string, question: string): Promise<Record<string, unknown> | null> {
  const slice = OFFICE_CHART_SLICE[office]
  if (!slice) return null
  const candidates = chartsForOffice(slice)
  const pick = pickChart(question)
  const entry = (pick.best && candidates.includes(pick.best))
    ? pick.best
    : pick.alternates.find(a => candidates.includes(a))
  if (!entry) return null
  const spec = await buildChartSpec(entry)
  if (!spec.data.length) return null
  return { spec }
}

async function runConsultOffice(args: { office?: string; question: string }): Promise<ToolResult> {
  const office = isOffice(args.office) ? args.office! : routeConcern(args.question)
  const meta = OFFICE_META[office as keyof typeof OFFICE_META]
  const runId = crypto.randomUUID()
  const chartBlock = await officeChart(office, args.question)
  const withChart = (r: ToolResult): ToolResult => (chartBlock
    ? { ...r, extraBlocks: [{ kind: 'chart', block: chartBlock }] }
    : r)

  // technology (CTO) + roster (CAPO) — grounded in INFRASTRUCTURE facts (live
  // probes + the run ledger), not the product-metric pipeline. officeSense.ts
  // owns the deterministic Sense; only Generate uses a model, dataClass
  // 'internal' (probe/ledger facts are operational, never confidential). Offline
  // degrades to the signals with no LLM call — same honesty as operations.
  if (office === 'technology' || office === 'roster') {
    const os = office === 'technology' ? await techSense() : await capoSense()
    const sigText = os.signals.map(s => `${s.tone === 'warn' ? '⚠️' : s.tone === 'ok' ? '✅' : '→'} ${s.text}`).join('\n')
    if (os.source === 'offline') {
      const text = `_(${os.role} · operational facts · offline)_\n\n${sigText}`
      const resp = delegationResponse({ office, text, ok: true })
      return withChart({ data: { ...resp.toolResult, provider: 'deterministic', model: null, grounded: false }, block: resp.block, costUsd: 0 })
    }
    const out = await governedOfficeChat(
      { task: 'brief', messages: agentMessages(os.role + ' Agent', os.facts + '\n\nsignals:\n' + sigText, args.question) },
      'internal', runId,
    )
    const text = out.provider === 'mock'
      ? `_(${os.role} · operational facts · model unavailable)_\n\n${sigText}`
      : `_(${os.role} · grounded · ${out.provider})_\n\n${out.text.trim()}`
    const resp = delegationResponse({ office, text, ok: true })
    return withChart({ data: { ...resp.toolResult, provider: out.provider, model: out.model, grounded: out.provider !== 'mock' }, block: resp.block, costUsd: out.costUsd ?? 0 })
  }

  if (!GROUNDED_OFFICES.has(office)) {
    // bridge/legal — no grounded pipeline yet (technology + roster now run the
    // officeSense infra path above; CTO/CAPO grounding shipped in batch G).
    // Honest persona, same shape C3 shipped, now
    // actually dataClass-governed at 'internal' (the old code called ai.chat
    // with zero dataClass awareness — a real, lower-stakes version of the
    // same latent gap the grounded path closes).
    const chiefId = OFFICE_CHIEF[office]
    const chiefTitle = (chiefId && AGENTS.find((a) => a.id === chiefId)?.role) || meta.label
    // C5-B2 — when this office HAS a matching live chart, its numbers go into
    // the prompt, so the persona reasons about real data instead of vibes. The
    // tag still says persona: one chart is not the grounded Sense→Compute
    // pipeline, and overclaiming here would be exactly the dishonesty
    // ADR-0007 Decision 4 exists to prevent.
    const chartFacts = chartBlock
      ? `\n\nLive figures you MAY cite (${(chartBlock.spec as any).title} — provenance: ${(chartBlock.spec as any).provenance}, source: ${(chartBlock.spec as any).source}):\n${JSON.stringify((chartBlock.spec as any).data.slice(0, 16))}\nThe founder can see this chart beside your answer. Cite only these numbers; invent none.`
      : ''
    const out = await governedOfficeChat({
      task: 'brief',
      messages: [
        { role: 'system', content: `You are the ${chiefTitle} of a small founder-run company (ArgantaLab + KinetikCircle). You own: ${meta.owns}. Answer as that office: concise, decisive, one paragraph max. No live data pipeline grounds this answer yet — this is judgment, not a report, and you should not imply otherwise.${chartFacts}` },
        { role: 'user', content: args.question },
      ],
    }, 'internal', runId)
    const tag = chartBlock ? `Persona · ${chiefTitle} · reading one live chart` : `Persona · ${chiefTitle} · no live data pipeline`
    const text = out.provider === 'mock' ? '' : `_(${tag})_\n\n${out.text.trim()}`
    const resp = delegationResponse({ office, text, ok: out.provider !== 'mock' })
    return withChart({ data: { ...resp.toolResult, provider: out.provider, model: out.model, grounded: false, chartShown: !!chartBlock }, block: resp.block, costUsd: out.costUsd ?? 0 })
  }

  // operations / treasury — the grounded path (ADR-0007 Decisions 2/3).
  const sensed = await agentSense()
  const computed = agentCompute(sensed)
  const signals = agentMatch(computed)
  let intent = routeIntent(args.question)
  if (intent === 'general') intent = office === 'treasury' ? 'economy' : 'brief'
  const role = INTENT_ROLE[intent] + ' Agent'

  if (sensed.source === 'offline') {
    // Nothing live to ground in — the honest deterministic message.
    // No confidential data is at risk, but there's also nothing real to
    // synthesize, so no LLM call is made at all.
    const text = '_(No live data connected)_\n\n' + agentGenerate(intent, computed, signals, sensed)
    const resp = delegationResponse({ office, text, ok: true })
    return withChart({ data: { ...resp.toolResult, provider: 'deterministic', model: null, grounded: false }, block: resp.block, costUsd: 0 })
  }

  // Real live data is in the room now — confidential (ADR-0003, same rule
  // the `analyze` tool already follows). governedOfficeChat's dataClass here
  // is where "confidential stays local" actually gets enforced.
  const task = intent === 'economy' || intent === 'monetization' ? 'analyze' : 'brief'
  const out = await governedOfficeChat(
    { task, messages: agentMessages(role, agentFacts(computed, signals, sensed), args.question) },
    'confidential', runId,
  )

  if (out.provider === 'mock') {
    // Tier 0 unreachable (the standing WebLLM-brittle gap) — degrade to the
    // deterministic Match signals (pure arithmetic, safe to show) rather
    // than fail silently OR reach for a reachable-but-external tier.
    const text = '_(Signals only · local model unavailable, confidential data was not sent externally)_\n\n' + agentGenerate(intent, computed, signals, sensed)
    const resp = delegationResponse({ office, text, ok: true })
    return withChart({ data: { ...resp.toolResult, provider: 'deterministic', model: null, grounded: false, degradedReason: 'tier0-unreachable' }, block: resp.block, costUsd: 0 })
  }

  const text = `_(Grounded · ${role} · ${out.provider} · live data · Tier 0)_\n\n` + out.text.trim()
  const resp = delegationResponse({ office, text, ok: true })
  return withChart({ data: { ...resp.toolResult, provider: out.provider, model: out.model, grounded: true, chartShown: !!chartBlock }, block: resp.block, costUsd: out.costUsd ?? 0 })
}

function titleFromBrief(brief: string): string {
  const first = (brief.split(/[—\-,.\n]/)[0] || 'Untitled').trim()
  return first.slice(0, 60) || 'Untitled'
}

// create_website / create_application — B2's tiered generation (Stage-0
// deterministic floor, Stage-1 AI upgrade if it passes @arganta/builder's
// validation gate), now persisted (B3) as a draft hq_artifact + version 1 so
// revise/validate/save/restore have something to reference. Reuses the
// 'website' block kind for both (C1's frozen BLOCK_KINDS has no separate
// 'application' kind; both are single-file HTML artifacts rendered the same
// way — see Single-File-Builder.md). Persistence is best-effort: if Supabase
// is unavailable the artifact is still returned+shown, just without an id —
// the generation itself never depends on persistence succeeding.
async function runCreateWebsite(args: { brief: string; websiteType?: string; brandKitId?: string }): Promise<ToolResult> {
  const g = await generateWebsite({ brief: args.brief, websiteType: args.websiteType })
  const artifactId = await createArtifact({ kind: 'website', title: titleFromBrief(args.brief), g, brandKitId: args.brandKitId })
  return {
    data: { ok: true, kind: 'website', artifactId, stage: g.stage, provider: g.provider, model: g.model, validation: { ok: g.validation.ok, errors: g.validation.errors, warnings: g.validation.warnings } },
    block: { assetId: artifactId, path: null, html: g.html },
    costUsd: g.costUsd,
  }
}

async function runCreateApplication(args: { brief: string; templateId?: string; useCircleSdk?: boolean; brandKitId?: string }): Promise<ToolResult> {
  const g = await generateApplication({ brief: args.brief, templateId: args.templateId, useCircleSdk: args.useCircleSdk })
  const artifactId = await createArtifact({ kind: 'application', title: titleFromBrief(args.brief), g, templateId: args.templateId, brandKitId: args.brandKitId })
  return {
    data: { ok: true, kind: 'application', artifactId, stage: g.stage, provider: g.provider, model: g.model, validation: { ok: g.validation.ok, errors: g.validation.errors, warnings: g.validation.warnings } },
    block: { assetId: artifactId, path: null, html: g.html },
    costUsd: g.costUsd,
  }
}

// GB-2 · create_game — same tiering + persistence as its siblings. The genre
// is classified from the brief when the model doesn't name one, and reported
// back so the founder (and Analytics/Discover) see how it was categorized.
// Reuses the 'website' block kind for the same C1-frozen reason as apps: a
// game is still a single-file HTML artifact, rendered identically.
async function runCreateGame(args: { brief: string; genre?: string; useCircleSdk?: boolean; brandKitId?: string }): Promise<ToolResult> {
  const genre = args.genre || classifyGameGenre(args.brief)
  const g = await generateGame({ brief: args.brief, genre, useCircleSdk: args.useCircleSdk })
  const artifactId = await createArtifact({ kind: 'game', title: titleFromBrief(args.brief), g, brandKitId: args.brandKitId })
  return {
    data: {
      ok: true, kind: 'game', genre, artifactId, stage: g.stage, provider: g.provider, model: g.model,
      validation: { ok: g.validation.ok, errors: g.validation.errors, warnings: g.validation.warnings },
      // Stage-0 is a real playable game, but it is NOT the bespoke game the
      // founder described — saying so is the difference between an honest
      // fallback and a silent bait-and-switch.
      note: g.stage === 0 ? 'AI generation was unavailable or failed validation — this is the deterministic playable arcade fallback, skinned to the genre, not a bespoke build of the brief. Tell the founder plainly.' : undefined,
    },
    block: { assetId: artifactId, path: null, html: g.html },
    costUsd: g.costUsd,
  }
}

// revise_artifact — fetches the artifact's current html, revises it (v1 =
// full-document revision), persists the result as a new immutable version,
// and updates the artifact's current pointer. Honest degrade: an unknown
// artifactId or an offline Supabase both fail explicitly, never silently.
async function runReviseArtifact(args: { artifactId: string; instruction: string }): Promise<ToolResult> {
  const artifact = await getArtifact(args.artifactId)
  if (!artifact) return { data: { error: `artifact not found: ${args.artifactId}` } }
  const g = await reviseArtifact({ currentHtml: artifact.html, instruction: args.instruction, kind: artifact.kind })
  if (g.stage === 0 && g.provider === 'unchanged') {
    return { data: { ok: false, artifactId: args.artifactId, note: 'revision unavailable — artifact left unchanged', validation: { ok: g.validation.ok, errors: g.validation.errors } } }
  }
  await saveVersion({ artifactId: args.artifactId, g, instruction: args.instruction })
  return {
    data: { ok: true, artifactId: args.artifactId, stage: g.stage, provider: g.provider, model: g.model, validation: { ok: g.validation.ok, errors: g.validation.errors, warnings: g.validation.warnings } },
    block: { assetId: args.artifactId, path: null, html: g.html },
    costUsd: g.costUsd,
  }
}

async function runValidateArtifact(args: { artifactId: string }): Promise<ToolResult> {
  const artifact = await getArtifact(args.artifactId)
  if (!artifact) return { data: { error: `artifact not found: ${args.artifactId}` } }
  const v = validateHtml(artifact.html, { kind: artifact.kind })
  return { data: { artifactId: args.artifactId, ok: v.ok, errors: v.errors, warnings: v.warnings } }
}

async function runSaveVersion(args: { artifactId: string }): Promise<ToolResult> {
  const versionId = await saveCurrentAsVersion(args.artifactId)
  if (!versionId) return { data: { error: `could not save a version for artifact: ${args.artifactId}` } }
  return { data: { ok: true, artifactId: args.artifactId, versionId } }
}

async function runRestoreVersion(args: { artifactId: string; versionNumber: number }): Promise<ToolResult> {
  const ok = await restoreVersion(args.artifactId, args.versionNumber)
  if (!ok) return { data: { error: `could not restore version ${args.versionNumber} for artifact: ${args.artifactId}` } }
  const artifact = await getArtifact(args.artifactId)
  return {
    data: { ok: true, artifactId: args.artifactId, versionNumber: args.versionNumber },
    block: artifact ? { assetId: args.artifactId, path: null, html: artifact.html } : undefined,
  }
}

// publish_artifact — the ONE sideEffect:true, autonomySafe:false builder
// tool (ADR-0005) — a headless mission can never reach this (autonomyGate,
// ADR-0004); on-demand chat (a human is present) can. Re-runs validateHtml
// on the exact HTML being published before calling the RPC (ADR-0006
// Decision 5) — publish-time is a second, independent check on top of
// whatever validation the version was originally saved with, and the
// public Worker re-checks a THIRD time at serve. Never publishes something
// that fails the gate, and tells the founder exactly which check failed.
async function runPublishArtifact(args: { artifactId: string; versionNumber?: number }): Promise<ToolResult> {
  const artifact = await getArtifact(args.artifactId)
  if (!artifact) return { data: { error: `artifact not found: ${args.artifactId}` } }

  let html = artifact.html
  let versionNumber = args.versionNumber ?? artifact.currentVersion
  if (args.versionNumber != null && args.versionNumber !== artifact.currentVersion) {
    const versions = await listVersions(args.artifactId)
    const target = versions.find((v) => v.versionNumber === args.versionNumber)
    if (!target) return { data: { error: `no such version ${args.versionNumber} for artifact: ${args.artifactId}` } }
    html = target.html
    versionNumber = target.versionNumber
  }

  const v = validateHtml(html, { kind: artifact.kind })
  if (!v.ok) {
    return { data: { ok: false, artifactId: args.artifactId, note: 'publish blocked — the artifact fails validation', errors: v.errors } }
  }

  const slug = await publishArtifact(args.artifactId, versionNumber)
  if (!slug) return { data: { error: `could not publish artifact: ${args.artifactId}` } }
  const url = publicArtifactUrl(artifact.kind, slug)
  return { data: { ok: true, artifactId: args.artifactId, versionNumber, url, slug } }
}

async function runCheckQuota(): Promise<ToolResult> {
  const q = await getNeuronQuota()
  return { data: q }
}

async function runCheckLedger(args: { days?: number }): Promise<ToolResult> {
  const session = getSessionRuns().slice(0, 20)
  if (!cloudEnabled) return { data: { session, note: 'offline — session runs only' } }
  const { data, error } = await supabase.rpc('agent_runs_capo', { p_days: args.days ?? 7 })
  if (error) return { data: { session, error: error.message } }
  return { data: { session, capo: (data as any[])?.[0] ?? null } }
}

const EXECUTORS: Record<string, (args: any) => Promise<ToolResult> | ToolResult> = {
  generate_image: runImage,
  generate_speech: runSpeech,
  make_website: runWebsite,
  make_deck: runDeck,
  make_brand: runBrand,
  analyze: runAnalyze,
  render_chart: runRenderChart,
  search_vault: runSearchVault,
  consult_office: runConsultOffice,
  check_quota: runCheckQuota,
  check_ledger: runCheckLedger,
  create_website: runCreateWebsite,
  create_application: runCreateApplication,
  create_game: runCreateGame,
  revise_artifact: runReviseArtifact,
  validate_artifact: runValidateArtifact,
  save_version: runSaveVersion,
  restore_version: runRestoreVersion,
  publish_artifact: runPublishArtifact,
}

// The subset of BUILDER_TOOL_SPECS actually wired to an executor above — the
// model is only ever offered tools it can succeed at (see index.ts). Grows
// automatically as B3 (versions/publish) wires more executors, no manual sync.
export const WIRED_BUILDER_SPECS = BUILDER_TOOL_SPECS.filter((t: any) => t.name in EXECUTORS)

// C5-B1 · render_chart is a Core-local tool (C1's TOOL_SPECS is frozen and has
// no entry for it), declared here in the SAME shape and registered through the
// same registerToolSpecs seam the builder tools already use — so the autonomy
// gate governs it exactly like a first-class tool rather than it sneaking past
// the spec lookup. Same dataClass as `analyze`: it reads the identical live
// metrics, so it must inherit the identical confidentiality ceiling.
export const CORE_EXTRA_SPECS = [
  {
    name: 'render_chart', title: 'Render a known chart', backing: 'analytics', costClass: 0, dataClass: 'confidential', sideEffect: false, autonomySafe: true,
    description: `Render one specific chart from the registry by id, grounded in LIVE data. Use this when you already know which chart is wanted; use analyze when interpreting a vague question. Valid ids: ${CHART_REGISTRY.map(c => c.id).join(', ')}.`,
    params: { type: 'object', properties: { chartId: { type: 'string' } }, required: ['chartId'] },
  },
]

/** The loop's `executeTool` contract. Unknown tool names are refused
 * explicitly rather than silently no-op'd. */
export async function coreExecuteTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const spec = toolByName(name) || builderToolByName(name) || CORE_EXTRA_SPECS.find(s => s.name === name)
  if (!spec) return { data: { error: `unknown tool: ${name}` } }
  const fn = EXECUTORS[name]
  if (!fn) return { data: { error: `no executor wired for: ${name}` } }
  return fn(args)
}
