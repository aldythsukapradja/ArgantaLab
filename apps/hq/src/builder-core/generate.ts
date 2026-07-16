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
import { buildGenerationPrompt, validateHtml, selectComponents, PORTABLE_REGISTRY, classifyGameGenre } from '@arganta/builder'
import { ai, logAgentRun, intelligenceRegistry } from '../lib/ai'
import { makeBrand, makeWebsite } from '../surfaces/studios/engines'
import { makeAppShell } from './appShell'
import { makeGameShell } from './gameShell'

// BR-0 — B4b's generated registry is now the real one selectComponents() picks
// from, so generation gets concrete block hints instead of nothing.
const COMPONENT_REGISTRY: any[] = PORTABLE_REGISTRY as any[]

// The models THIS file can actually reach.
//
// intelligenceRegistry is built with `webllm: true` because it's shared with
// intelligence.ask(), whose own runtime (intelligenceLLM) really does configure
// web-llm. But we don't call through that runtime — we call `ai.chat`, and the
// `ai` facade is created with `const WEBLLM = null` (lib/ai.ts), i.e. no browser
// tier at all. Selecting a browser model here therefore meant ai.chat() silently
// fell through to `mock`, generateViaAi caught the silent mock and returned null,
// and EVERY Stage-1 build quietly degraded to the Stage-0 template — even on a
// machine with a live edge proxy and real Gemini/Groq/Claude behind it. Since
// 'copy' bands at [0,2] and browser models are costClass 0, the cheapest-capable
// rule picked one every single time, so Stage-1 could never once fire.
//
// Excluding them (rather than enabling web-llm) is the right call: the browser
// tier's first call downloads ~1.6GB, which lib/ai.ts explicitly says must never
// happen silently behind a founder's click.
const CALLABLE_REGISTRY = (intelligenceRegistry as any[]).filter((m) => m.execution !== 'browser')

export type ArtifactKind = 'application' | 'website' | 'game'

export interface GenerateResult {
  html: string
  kind: ArtifactKind
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
 * GB-2 · Generate a game: brief → HTML. Identical tiering to its siblings —
 * Stage-0 is a real playable arcade game (gameShell.ts), Stage-1 AI only
 * replaces it if it passes the kind:'game' validation gate. The genre is
 * classified from the brief when the caller doesn't name one, and is passed to
 * BOTH stages (it skins Stage-0 and briefs Stage-1).
 *
 * useCircleSdk defaults TRUE for games, unlike apps: a game without a score
 * submission is a dead end in the Kinetik catalogue, which is where games go.
 */
export async function generateGame(o: { brief: string; genre?: string; useCircleSdk?: boolean }): Promise<GenerateResult> {
  const runId = crypto.randomUUID()
  const genre = o.genre || classifyGameGenre(o.brief)
  const brand = makeBrand(o.brief)
  const stage0Html = makeGameShell(o.brief, genre, brand)
  const stage0Validation = validateHtml(stage0Html, { kind: 'game' })

  const ai1 = await generateViaAi({ kind: 'game', brief: o.brief, genre, useCircleSdk: o.useCircleSdk ?? true, runId, task: 'build_game' })
  if (ai1 && ai1.validation.ok && isActuallyPlayable(ai1.validation)) {
    return { html: ai1.html, kind: 'game', stage: 1, provider: ai1.provider, model: ai1.model, costUsd: ai1.costUsd, validation: ai1.validation, runId }
  }
  return { html: stage0Html, kind: 'game', stage: 0, provider: 'deterministic-game-shell', model: null, costUsd: 0, validation: stage0Validation, runId }
}

/**
 * Would this pass as a game at all? Distinct from validateHtml's `ok`, and
 * deliberately so.
 *
 * The kind:'game' playability checks are WARN-level in the gate, because that
 * gate decides what is safe to serve publicly — it polices safety, not fun, and
 * it must not refuse to publish a game the founder likes. But the tiering
 * decision here is a different question: is Stage-1's output *better than the
 * Stage-0 game we already have in hand*? A document with no play surface and no
 * loop is not a game, and swapping a real playable arcade game for it because
 * "no ERRORS were raised" would be the exact bait-and-switch the tiered design
 * exists to prevent. When the model doesn't deliver a game, the honest floor wins.
 *
 * Only the three STRUCTURAL checks gate acceptance. Missing touch input or a
 * restart path is a flaw the founder can see (and ask the chat to fix) on top of
 * a real game; missing a canvas and a loop means there's no game to fix.
 */
const PLAYABILITY_REQUIRED = ['game-has-surface', 'game-has-loop', 'game-has-input']
function isActuallyPlayable(v: ReturnType<typeof validateHtml>): boolean {
  return !v.warnings.some((w: { id: string }) => PLAYABILITY_REQUIRED.includes(w.id))
}

/**
 * Revise an existing artifact's HTML with a natural-language instruction.
 * v1 = full-document revision (returns the complete updated HTML), per the
 * strategy doc's explicit v1 scope — patch-based editing is later. Falls back
 * to returning the UNCHANGED current HTML (never a broken/invalid revision)
 * when AI is unavailable or the revision fails validation.
 */
export async function reviseArtifact(o: { currentHtml: string; instruction: string; kind: ArtifactKind }): Promise<GenerateResult> {
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
  kind: ArtifactKind; brief: string; websiteType?: string; genre?: string; useCircleSdk?: boolean
  currentHtml?: string; instruction?: string; runId: string; task: string
}): Promise<{ html: string; validation: ReturnType<typeof validateHtml>; provider: string; model: string; costUsd: number } | null> {
  const dataClass = 'public'
  const { model: picked, reason } = selectModel(CALLABLE_REGISTRY, { task: 'copy', dataClass })
  if (!picked || !isRouteAllowed(picked, dataClass)) {
    console.warn('[builder-core generate]', o.task, 'no capable model:', reason)
    return null
  }

  // Blocks are page furniture — selectComponents has nothing useful to say about
  // a canvas game, and buildGenerationPrompt drops game hints anyway. Skip the work.
  const componentHints = o.kind === 'game' ? [] :
    selectComponents(COMPONENT_REGISTRY, { brief: o.brief, kind: o.kind }).map((c: any) => `${c.name} (${c.category}): ${c.description}`)
  const messages = buildGenerationPrompt({
    kind: o.kind, brief: o.brief, genre: o.genre, componentHints,
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
