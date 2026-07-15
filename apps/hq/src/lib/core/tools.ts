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
import { analyze } from '../../surfaces/studios/analytics'
import { OFFICE_META, routeConcern, delegationResponse, isOffice } from '@arganta/agent'
import { BUILDER_TOOL_SPECS, builderToolByName, validateHtml } from '@arganta/builder'
import { generateWebsite, generateApplication, reviseArtifact } from '../../builder-core/generate'
import { createArtifact, saveVersion, saveCurrentAsVersion, restoreVersion, getArtifact, listVersions, publishArtifact, publicArtifactUrl } from '../../builder-core/persist'
import { agentSense, agentCompute, agentMatch, agentFacts, agentGenerate, routeIntent, INTENT_ROLE, AGENTS, TIER_META } from '../../data/agents'
import { agentMessages } from '@arganta/ai'

export interface ToolResult {
  data: unknown          // what the model reads back (JSON-stringified by the loop)
  block?: Record<string, unknown>  // makeBlock(kind, ...) input the caller renders, if any
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

function runAnalyze(args: { question: string }): ToolResult {
  const a = analyze(args.question)
  return { data: { chart: a.chart, title: a.title, source: a.source, points: a.data.length }, block: { spec: a } }
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

async function runConsultOffice(args: { office?: string; question: string }): Promise<ToolResult> {
  const office = isOffice(args.office) ? args.office! : routeConcern(args.question)
  const meta = OFFICE_META[office as keyof typeof OFFICE_META]
  const runId = crypto.randomUUID()

  // roster — the meta-office (ADR-0007 Decision 5): grounded in the real,
  // static org roster, not a live RPC and not a persona guess.
  if (office === 'roster') {
    const byTier = AGENTS.reduce<Record<string, number>>((m, a) => { m[a.tier] = (m[a.tier] || 0) + 1; return m }, {})
    const summary = '_(Org roster · static, not a live RPC)_\n\n' +
      `${AGENTS.length} agents across 6 tiers: ` +
      Object.entries(byTier).map(([t, k]) => `${TIER_META[t as keyof typeof TIER_META].label} (${k})`).join(', ') +
      '. Pipeline is deterministic-first — only the Generate step uses a model.'
    const resp = delegationResponse({ office, text: summary, ok: true })
    return { data: { ...resp.toolResult, provider: 'roster-metadata', model: null, grounded: true }, block: resp.block, costUsd: 0 }
  }

  if (!GROUNDED_OFFICES.has(office)) {
    // bridge/technology/legal — no grounded live-RPC pipeline exists yet
    // (ADR-0007 Decisions 1/5): honest persona, same shape C3 shipped, now
    // actually dataClass-governed at 'internal' (the old code called ai.chat
    // with zero dataClass awareness — a real, lower-stakes version of the
    // same latent gap the grounded path closes).
    const chiefId = OFFICE_CHIEF[office]
    const chiefTitle = (chiefId && AGENTS.find((a) => a.id === chiefId)?.role) || meta.label
    const out = await governedOfficeChat({
      task: 'brief',
      messages: [
        { role: 'system', content: `You are the ${chiefTitle} of a small founder-run company (ArgantaLab + KinetikCircle). You own: ${meta.owns}. Answer as that office: concise, decisive, one paragraph max. No live data pipeline grounds this answer yet — this is judgment, not a report, and you should not imply otherwise.` },
        { role: 'user', content: args.question },
      ],
    }, 'internal', runId)
    const text = out.provider === 'mock' ? '' : `_(Persona · ${chiefTitle} · no live data pipeline)_\n\n${out.text.trim()}`
    const resp = delegationResponse({ office, text, ok: out.provider !== 'mock' })
    return { data: { ...resp.toolResult, provider: out.provider, model: out.model, grounded: false }, block: resp.block, costUsd: out.costUsd ?? 0 }
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
    return { data: { ...resp.toolResult, provider: 'deterministic', model: null, grounded: false }, block: resp.block, costUsd: 0 }
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
    return { data: { ...resp.toolResult, provider: 'deterministic', model: null, grounded: false, degradedReason: 'tier0-unreachable' }, block: resp.block, costUsd: 0 }
  }

  const text = `_(Grounded · ${role} · ${out.provider} · live data · Tier 0)_\n\n` + out.text.trim()
  const resp = delegationResponse({ office, text, ok: true })
  return { data: { ...resp.toolResult, provider: out.provider, model: out.model, grounded: true }, block: resp.block, costUsd: out.costUsd ?? 0 }
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
  search_vault: runSearchVault,
  consult_office: runConsultOffice,
  check_quota: runCheckQuota,
  check_ledger: runCheckLedger,
  create_website: runCreateWebsite,
  create_application: runCreateApplication,
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

/** The loop's `executeTool` contract. Unknown tool names are refused
 * explicitly rather than silently no-op'd. */
export async function coreExecuteTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const spec = toolByName(name) || builderToolByName(name)
  if (!spec) return { data: { error: `unknown tool: ${name}` } }
  const fn = EXECUTORS[name]
  if (!fn) return { data: { error: `no executor wired for: ${name}` } }
  return fn(args)
}
