// GB-4 · The Forge's state engine — one artifact, one conversation, one canvas.
//
// DESIGN NOTE (deliberate deviation from the plan's "embed the Core agent
// loop"): the chat rail calls builder-core DIRECTLY rather than routing through
// @arganta/agent's tool-calling loop. In the Forge the intent is already known
// — an empty canvas means "build it", a loaded artifact means "revise it", and
// the kind is an explicit toggle, not something to infer. Asking a model to
// pick the tool would add a model dependency, a failure mode, and latency to a
// decision we can make deterministically. It would also make the builder
// unusable offline, where Stage-0 still produces a real artifact.
//
// Arganta Core keeps the agent loop — that's the right place for it, because
// there the intent genuinely is ambiguous. Both paths converge on the same
// hq_artifact rows via the same builder-core functions, which is what makes
// "Core builds it, Forge refines it" work at all.
import { useCallback, useEffect, useRef, useState } from 'react'
import { validateHtml, classifyArtifactKind, classifyGameGenre } from '@arganta/builder'
import { generateWebsite, generateApplication, generateGame, reviseArtifact, type ArtifactKind, type GenerateResult } from '../../builder-core/generate'
import { createArtifact, saveVersion, getArtifact, listVersions, type StoredVersion } from '../../builder-core/persist'
import type { ForgeSurface } from './forgeConfig'

export interface ForgeTurn {
  id: string
  role: 'user' | 'system'
  text: string
  /** Present on a system turn that produced a version — powers the version chip. */
  version?: number
  /** Stage-0 fallback / validation warnings the founder must see, never hidden. */
  tone?: 'ok' | 'warn' | 'error'
  pending?: boolean
}

export interface ForgeState {
  artifactId: string | null
  kind: ArtifactKind
  genre: string | null
  title: string
  html: string
  version: number
  stage: 0 | 1 | null
  provider: string | null
  validation: ReturnType<typeof validateHtml> | null
  /** False when Supabase is unavailable — the artifact is real and usable but
   * lives only in this tab. Surfaced, never silently swallowed. */
  persisted: boolean
}

const EMPTY: ForgeState = {
  artifactId: null, kind: 'application', genre: null, title: '', html: '',
  version: 0, stage: null, provider: null, validation: null, persisted: false,
}

function titleFromBrief(brief: string): string {
  const first = (brief.split(/[—\-,.\n]/)[0] || '').trim()
  return first.slice(0, 60) || 'Untitled'
}

export function useForge(surface: ForgeSurface, defaultKind: ArtifactKind, openArtifactId: string | null) {
  const [state, setState] = useState<ForgeState>({ ...EMPTY, kind: defaultKind })
  const [turns, setTurns] = useState<ForgeTurn[]>([])
  const [busy, setBusy] = useState(false)
  const [versions, setVersions] = useState<StoredVersion[]>([])
  // A stale async generate must never overwrite a newer artifact — the founder
  // can switch artifacts (Core seam) while one is still generating.
  const runSeq = useRef(0)

  const pushTurn = (t: Omit<ForgeTurn, 'id'>) => {
    const id = crypto.randomUUID()
    setTurns((ts) => [...ts, { ...t, id }])
    return id
  }
  const resolveTurn = (id: string, patch: Partial<ForgeTurn>) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch, pending: false } : t)))

  const refreshVersions = useCallback(async (artifactId: string | null) => {
    if (!artifactId) { setVersions([]); return }
    setVersions(await listVersions(artifactId))
  }, [])

  // ── Core seam: an artifact id arrives from outside (Open in Builder) ──
  useEffect(() => {
    if (!openArtifactId || openArtifactId === state.artifactId) return
    const seq = ++runSeq.current
    let cancelled = false
    ;(async () => {
      setBusy(true)
      const a = await getArtifact(openArtifactId)
      if (cancelled || seq !== runSeq.current) return
      if (!a) {
        pushTurn({ role: 'system', text: `Could not open that artifact — it may have been removed, or Supabase is unreachable.`, tone: 'error' })
        setBusy(false)
        return
      }
      setState({
        artifactId: a.id, kind: a.kind, genre: a.kind === 'game' ? classifyGameGenre(a.title) : null,
        title: a.title, html: a.html, version: a.currentVersion, stage: null,
        provider: null, validation: validateHtml(a.html, { kind: a.kind }), persisted: true,
      })
      setTurns([{ id: crypto.randomUUID(), role: 'system', text: `Opened "${a.title}" from Arganta Core — v${a.currentVersion}. Tell me what to change.`, tone: 'ok' }])
      await refreshVersions(a.id)
      setBusy(false)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openArtifactId])

  /** First message on an empty canvas → build. Deterministic routing: the
   * surface decides game vs not, the mode toggle decides app vs website, and
   * the classifier only breaks a tie the founder didn't. */
  const build = useCallback(async (brief: string, opts: { kind?: ArtifactKind; genre?: string; templateId?: string } = {}) => {
    const seq = ++runSeq.current
    setBusy(true)
    pushTurn({ role: 'user', text: brief })
    const pendingId = pushTurn({ role: 'system', text: 'Building…', pending: true })

    const kind: ArtifactKind = surface === 'game'
      ? 'game'
      : (opts.kind ?? (classifyArtifactKind(brief).kind === 'game' ? 'application' : classifyArtifactKind(brief).kind))
    const genre = kind === 'game' ? (opts.genre || classifyGameGenre(brief)) : null

    let g: GenerateResult
    if (kind === 'game') g = await generateGame({ brief, genre: genre!, useCircleSdk: true })
    else if (kind === 'website') g = await generateWebsite({ brief })
    else g = await generateApplication({ brief, templateId: opts.templateId, useCircleSdk: true })

    if (seq !== runSeq.current) return   // superseded — drop it silently
    const title = titleFromBrief(brief)
    const artifactId = await createArtifact({ kind, title, g, templateId: opts.templateId })
    if (seq !== runSeq.current) return

    setState({
      artifactId, kind, genre, title, html: g.html, version: 1,
      stage: g.stage, provider: g.provider, validation: g.validation, persisted: !!artifactId,
    })
    resolveTurn(pendingId, {
      text: g.stage === 0
        ? `Built with the deterministic ${kind === 'game' ? 'playable arcade' : 'starter'} engine — AI generation wasn't reachable, so this is a real working ${kind} but not a bespoke build of your brief. Try again, or refine it below.`
        : `Built your ${kind}. v1 is on the canvas — tell me what to change.`,
      tone: g.stage === 0 ? 'warn' : 'ok',
      version: 1,
    })
    if (!artifactId) pushTurn({ role: 'system', text: 'Heads up: this artifact is not saved — Supabase is unreachable, so it lives only in this tab. Versions and publishing need a connection.', tone: 'warn' })
    await refreshVersions(artifactId)
    setBusy(false)
  }, [surface, refreshVersions])

  /** Every subsequent message → revise the open artifact. */
  const revise = useCallback(async (instruction: string) => {
    if (!state.html) return
    const seq = ++runSeq.current
    setBusy(true)
    pushTurn({ role: 'user', text: instruction })
    const pendingId = pushTurn({ role: 'system', text: 'Revising…', pending: true })

    const g = await reviseArtifact({ currentHtml: state.html, instruction, kind: state.kind })
    if (seq !== runSeq.current) return

    if (g.provider === 'unchanged') {
      resolveTurn(pendingId, {
        text: 'Revision unavailable — no live model was reachable, so I left your artifact exactly as it was rather than breaking it. Nothing changed.',
        tone: 'error',
      })
      setBusy(false)
      return
    }

    const nextVersion = state.version + 1
    if (state.artifactId) await saveVersion({ artifactId: state.artifactId, g, instruction })
    if (seq !== runSeq.current) return

    setState((s) => ({ ...s, html: g.html, version: nextVersion, stage: g.stage, provider: g.provider, validation: g.validation }))
    resolveTurn(pendingId, { text: `Done — v${nextVersion} is on the canvas.`, tone: 'ok', version: nextVersion })
    await refreshVersions(state.artifactId)
    setBusy(false)
  }, [state.html, state.kind, state.version, state.artifactId, refreshVersions])

  /** The one entry point the composer calls — build or revise, never both. */
  const send = useCallback((text: string, opts?: { kind?: ArtifactKind; genre?: string; templateId?: string }) => {
    const t = text.trim()
    if (!t || busy) return
    return state.html ? revise(t) : build(t, opts)
  }, [busy, state.html, build, revise])

  /** A hand edit in the code pane. Local until checkpointed — mirrors what a
   * code editor does, and keeps version history meaningful (one version per
   * deliberate save, not one per keystroke). */
  const setHtml = useCallback((html: string) => {
    setState((s) => ({ ...s, html, validation: validateHtml(html, { kind: s.kind }) }))
  }, [])

  const checkpoint = useCallback(async () => {
    if (!state.artifactId || !state.html) return false
    const g: GenerateResult = {
      html: state.html, kind: state.kind, stage: 0, provider: 'hand-edit', model: null,
      costUsd: 0, validation: validateHtml(state.html, { kind: state.kind }), runId: crypto.randomUUID(),
    }
    const id = await saveVersion({ artifactId: state.artifactId, g, instruction: 'Hand-edited in the Forge code pane' })
    if (!id) return false
    setState((s) => ({ ...s, version: s.version + 1 }))
    pushTurn({ role: 'system', text: `Saved your hand edit as v${state.version + 1}.`, tone: 'ok', version: state.version + 1 })
    await refreshVersions(state.artifactId)
    return true
  }, [state.artifactId, state.html, state.kind, state.version, refreshVersions])

  /** Load a previous version's HTML onto the canvas (restore_version RPC flips
   * the pointer server-side; this reflects it locally). */
  const applyVersion = useCallback((v: StoredVersion) => {
    setState((s) => ({ ...s, html: v.html, version: v.versionNumber, validation: validateHtml(v.html, { kind: s.kind }) }))
    pushTurn({ role: 'system', text: `Restored v${v.versionNumber}.`, tone: 'ok', version: v.versionNumber })
  }, [])

  const reset = useCallback((kind: ArtifactKind) => {
    ++runSeq.current
    setState({ ...EMPTY, kind })
    setTurns([])
    setVersions([])
    setBusy(false)
  }, [])

  return { state, setState, turns, busy, versions, send, build, revise, setHtml, checkpoint, applyVersion, reset, refreshVersions }
}
