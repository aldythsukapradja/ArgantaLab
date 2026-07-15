// C3 · Arganta Core tool executor — the REAL implementation behind every
// name in @arganta/agent's TOOL_SPECS (C1, frozen). Each function returns a
// plain object the model reads back as a tool result AND (for media kinds)
// enough info for the caller to build a thread.js block. Never throws —
// loop.js already catches/records a thrown executor, but each tool degrades
// honestly on its own path too (never fabricates a result).
import { toolByName } from '@arganta/agent'
import { ai, logAgentRun, getSessionRuns } from '../ai'
import { supabase, cloudEnabled } from '../supabase'
import { generateImageViaGateway, generateSpeechViaGateway, embedTextViaGateway, getNeuronQuota } from '../mediaGateway'
import { saveMediaAsset } from '../mediaAssets'
import { makeWebsite, makeDeck, makeBrand } from '../../surfaces/studios/engines'
import { analyze } from '../../surfaces/studios/analytics'
import { OFFICE_META, routeConcern, delegationResponse, isOffice } from '@arganta/agent'
import { BUILDER_TOOL_SPECS, builderToolByName, validateHtml } from '@arganta/builder'
import { generateWebsite, generateApplication, reviseArtifact } from '../../builder-core/generate'
import { createArtifact, saveVersion, saveCurrentAsVersion, restoreVersion, getArtifact, listVersions, publishArtifact, publicArtifactUrl } from '../../builder-core/persist'

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

// consult_office — a lightweight, honest v1: frame the office's ownership as a
// system prompt and ask at the Sponsored floor. NOT the 25-agent live-RPC
// roster (apps/hq/src/data/agents.ts) — reconciling the two office taxonomies
// (OfficeId vs Tier) is C6's job; this tool's external contract doesn't change
// when C6 deepens it.
async function runConsultOffice(args: { office?: string; question: string }): Promise<ToolResult> {
  const office = isOffice(args.office) ? args.office! : routeConcern(args.question)
  const meta = OFFICE_META[office as keyof typeof OFFICE_META]
  const runId = crypto.randomUUID()
  const out = await ai.chat({
    task: 'brief',
    messages: [
      { role: 'system', content: `You are the head of ${meta.label} at a small founder-run company. You own: ${meta.owns}. Answer as that office: concise, decisive, one paragraph max.` },
      { role: 'user', content: args.question },
    ],
  })
  const silentlyMocked = out.provider === 'mock'
  await logAgentRun({ runId, domain: 'llm', task: 'consult_office', dataClass: 'internal', requestedCostClass: 0, actualCostClass: out.tier ?? 0, requestedProvider: null, requestedModel: null, actualProvider: silentlyMocked ? 'mock' : out.provider, actualModel: silentlyMocked ? 'mock' : out.model, costUsd: out.costUsd ?? 0, status: silentlyMocked ? 'failed' : 'succeeded' })
  const resp = delegationResponse({ office, text: silentlyMocked ? '' : out.text, ok: !silentlyMocked })
  return { data: resp.toolResult, block: resp.block, costUsd: out.costUsd ?? 0 }
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
