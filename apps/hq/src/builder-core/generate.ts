// B2 · Single-File Builder generation — Stage-0 deterministic → Stage-1 AI,
// validated, honest fallback. The tiered-generation discipline from
// Single-File-Builder.md: the deterministic engine is ALWAYS the instant,
// authoritative baseline; AI only upgrades it when it genuinely passes the
// @arganta/builder validation gate (validate.js) — an artifact is never
// accepted because the model claims it's complete.
//
// Uses task:'copy' (an existing, frozen @arganta/ai task class — same one
// content-intelligence.ts's askWebsiteCopy already uses for website content)
// rather than inventing a new task policy; dataClass:'public' matches that
// same precedent (marketing/app copy about the product is not sensitive).
import { selectModel, isRouteAllowed } from '@arganta/ai'
import { buildGenerationPrompt, validateHtml, selectComponents } from '@arganta/builder'
import { ai, logAgentRun, intelligenceRegistry } from '../lib/ai'
import { makeBrand, makeWebsite } from '../surfaces/studios/engines'
import { makeAppShell } from './appShell'

// B4a's portable blocks don't exist yet — an empty registry is honest and
// forward-compatible: once B4b wires a real one in, selectComponents() here
// starts returning real hints with zero changes to this file.
const COMPONENT_REGISTRY: any[] = []

export interface GenerateResult {
  html: string
  kind: 'application' | 'website'
  stage: 0 | 1
  provider: string
  model: string | null
  costUsd: number
  validation: ReturnType<typeof validateHtml>
  runId: string
}

/**
 * Generate a website: brief → HTML. Always returns something usable — Stage-0
 * deterministic is the floor, Stage-1 AI only replaces it if validation passes.
 */
export async function generateWebsite(o: { brief: string; websiteType?: string }): Promise<GenerateResult> {
  const runId = crypto.randomUUID()
  const brand = makeBrand(o.brief)
  const stage0Html = makeWebsite(o.brief, brand)
  const stage0Validation = validateHtml(stage0Html, { kind: 'website' })

  const ai1 = await generateViaAi({ kind: 'website', brief: o.brief, runId, task: 'build_website' })
  if (ai1 && ai1.validation.ok) {
    return { html: ai1.html, kind: 'website', stage: 1, provider: ai1.provider, model: ai1.model, costUsd: ai1.costUsd, validation: ai1.validation, runId }
  }
  // honest downgrade — AI unavailable OR failed validation; the deterministic
  // baseline is never invalid by construction (same engine as Media Center).
  return { html: stage0Html, kind: 'website', stage: 0, provider: 'deterministic-website', model: null, costUsd: 0, validation: stage0Validation, runId }
}

/**
 * Generate an application: brief → HTML. Same tiering as generateWebsite,
 * Stage-0 floor is the generic CRUD shell (appShell.ts) rather than makeWebsite.
 */
export async function generateApplication(o: { brief: string; templateId?: string; useCircleSdk?: boolean }): Promise<GenerateResult> {
  const runId = crypto.randomUUID()
  const brand = makeBrand(o.brief)
  const stage0Html = makeAppShell(o.brief, brand)
  const stage0Validation = validateHtml(stage0Html, { kind: 'application' })

  const ai1 = await generateViaAi({ kind: 'application', brief: o.brief, useCircleSdk: o.useCircleSdk, runId, task: 'build_application' })
  if (ai1 && ai1.validation.ok) {
    return { html: ai1.html, kind: 'application', stage: 1, provider: ai1.provider, model: ai1.model, costUsd: ai1.costUsd, validation: ai1.validation, runId }
  }
  return { html: stage0Html, kind: 'application', stage: 0, provider: 'deterministic-app-shell', model: null, costUsd: 0, validation: stage0Validation, runId }
}

/**
 * Revise an existing artifact's HTML with a natural-language instruction.
 * v1 = full-document revision (returns the complete updated HTML), per the
 * strategy doc's explicit v1 scope — patch-based editing is later. Falls back
 * to returning the UNCHANGED current HTML (never a broken/invalid revision)
 * when AI is unavailable or the revision fails validation.
 */
export async function reviseArtifact(o: { currentHtml: string; instruction: string; kind: 'application' | 'website' }): Promise<GenerateResult> {
  const runId = crypto.randomUUID()
  const currentValidation = validateHtml(o.currentHtml, { kind: o.kind })
  const ai1 = await generateViaAi({ kind: o.kind, brief: o.instruction, currentHtml: o.currentHtml, instruction: o.instruction, runId, task: 'revise_artifact' })
  if (ai1 && ai1.validation.ok) {
    return { html: ai1.html, kind: o.kind, stage: 1, provider: ai1.provider, model: ai1.model, costUsd: ai1.costUsd, validation: ai1.validation, runId }
  }
  return { html: o.currentHtml, kind: o.kind, stage: 0, provider: 'unchanged', model: null, costUsd: 0, validation: currentValidation, runId }
}

// ── shared AI-tier call ─────────────────────────────────────────────────────
async function generateViaAi(o: {
  kind: 'application' | 'website'; brief: string; websiteType?: string; useCircleSdk?: boolean
  currentHtml?: string; instruction?: string; runId: string; task: string
}): Promise<{ html: string; validation: ReturnType<typeof validateHtml>; provider: string; model: string; costUsd: number } | null> {
  const dataClass = 'public'
  const { model: picked, reason } = selectModel(intelligenceRegistry, { task: 'copy', dataClass })
  if (!picked || !isRouteAllowed(picked, dataClass)) {
    console.warn('[builder-core generate]', o.task, 'no capable model:', reason)
    return null
  }

  const componentHints = selectComponents(COMPONENT_REGISTRY, { brief: o.brief, kind: o.kind }).map((c: any) => `${c.name} (${c.category}): ${c.description}`)
  const messages = buildGenerationPrompt({
    kind: o.kind, brief: o.brief, componentHints,
    useCircleSdk: o.useCircleSdk, currentHtml: o.currentHtml, instruction: o.instruction,
  })

  const t0 = performance.now()
  const out = await ai.chat({ task: 'copy', messages, provider: picked.provider, model: picked.apiModel })
  const latencyMs = Math.round(performance.now() - t0)
  const silentlyMocked = out.provider === 'mock' && picked.provider !== 'mock'

  logAgentRun({
    runId: o.runId, domain: 'llm', task: o.task, dataClass,
    requestedCostClass: picked.costClass, actualCostClass: out.tier ?? picked.costClass,
    requestedProvider: picked.provider, requestedModel: picked.apiModel,
    actualProvider: silentlyMocked ? 'mock' : (out.provider ?? picked.provider), actualModel: silentlyMocked ? 'mock' : (out.model ?? picked.apiModel),
    costUsd: out.costUsd ?? 0, latencyMs, status: silentlyMocked ? 'failed' : 'succeeded',
    error: silentlyMocked ? `requested ${picked.provider} but adapter fell back to mock` : null,
  })
  if (silentlyMocked || !out.text) return null

  const html = stripFences(out.text)
  const validation = validateHtml(html, { kind: o.kind })
  return { html, validation, provider: out.provider, model: out.model, costUsd: out.costUsd ?? 0 }
}

/** Defensive: the contract says "no markdown fences", but models sometimes
 * wrap anyway — strip a leading/trailing ```html fence if present rather than
 * letting a purely-cosmetic wrapper fail validation. */
function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:html)?\s*\n([\s\S]*?)\n?```$/i)
  return fenced ? fenced[1].trim() : trimmed
}
