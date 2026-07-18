// ── BRIDGE — the postMessage protocol between the landing (parent) and an embedded
// app (child). Versioned `arganta:embed@1`. Security model: the parent appends a
// one-time nonce to the iframe URL; the child echoes it in `ready`; the parent
// only accepts messages whose origin is in EMBED_ORIGINS AND whose nonce matches
// the frame it sent. Operator sessions are handed over explicitly (never for a
// public visitor, never to an unlisted origin).
import { isEmbedOrigin } from './embeds'

export const PROTOCOL = 'arganta:embed@1'
export type Frame = 'phone' | 'desktop'
export type Mode = 'demo' | 'operator'

// parent → child
export interface InitMsg { t: 'arganta:init'; v: 1; nonce: string; mode: Mode; scene?: string; frame: Frame }
export interface SessionMsg { t: 'arganta:session'; v: 1; nonce: string; access_token: string; refresh_token: string }
// v2 — Arganta Chat host: keep the embedded circle in sync with the chat's own
// circle selector, and tear the child's session down when the parent signs out.
export interface CircleMsg { t: 'arganta:circle'; v: 1; nonce: string; circleId: string }
export interface SignoutMsg { t: 'arganta:signout'; v: 1; nonce: string }
// child → parent
export interface ReadyMsg { t: 'arganta:ready'; v: 1; nonce: string }
export interface NavMsg { t: 'arganta:nav'; v: 1; nonce: string; scene: string }

export type InboundMsg = ReadyMsg | NavMsg
export type OutboundMsg = InitMsg | SessionMsg | CircleMsg | SignoutMsg

export const newNonce = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// Append the handshake nonce to a URL (parent side). Scene is a hint the child
// may honor to open at a specific screen.
export function frameUrl(base: string, nonce: string, scene?: string): string {
  const u = new URL(base)
  u.searchParams.set('embed', nonce)
  if (scene) u.searchParams.set('scene', scene)
  return u.toString()
}

// A validated listener the parent installs while a frame is mounted. Only fires
// `onReady` / `onNav` for messages from a known embed origin carrying our nonce.
export function listen(nonce: string, handlers: { onReady?: () => void; onNav?: (scene: string) => void }): () => void {
  const fn = (e: MessageEvent) => {
    if (!isEmbedOrigin(e.origin)) return
    const m = e.data as InboundMsg | undefined
    if (!m || typeof m !== 'object' || m.nonce !== nonce) return
    if (m.t === 'arganta:ready') handlers.onReady?.()
    else if (m.t === 'arganta:nav') handlers.onNav?.(m.scene)
  }
  window.addEventListener('message', fn)
  return () => window.removeEventListener('message', fn)
}

// Post a typed message into an iframe's contentWindow at a specific origin.
export function post(win: Window | null, origin: string, msg: OutboundMsg) {
  if (!win) return
  win.postMessage(msg, origin)
}

// ── W1: parent-side session lifecycle controller ────────────────────────────
// The one place that owns the tricky part (K1 battle-test B1): parent and the
// embedded child are two Supabase clients that would otherwise both auto-refresh
// the SAME single-use refresh token and race each other into a revoked session.
//
// The contract: the CHILD disables its own auto-refresh in embed mode, and the
// PARENT becomes the sole refresher — re-pushing a fresh session to the child on
// every handshake (mount/remount) AND whenever its own auth state changes (i.e.
// right after it refreshes the token). So the child always holds current tokens
// and never refreshes a stale one. This controller encapsulates that so the
// (Sonnet) UI layer just wires an iframe ref and a circle getter.

// Minimal shape we need from a Supabase client — avoids a hard type import.
interface SessionSource {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string; refresh_token: string } | null } }>
    onAuthStateChange(cb: () => void): { data: { subscription: { unsubscribe(): void } } }
  }
}

export interface EmbedController {
  nonce: string
  /** The iframe src to use (base embed URL + handshake nonce + optional scene). */
  url(base: string): string
  /** Push a circle change to the child (one-way: chat selector → embedded app). */
  setCircle(circleId: string): void
  /** Tell the child to sign out (call before the parent signs itself out). */
  signout(): void
  /** Stop listening + unsubscribe from auth changes. Call on unmount. */
  dispose(): void
}

export function createEmbedController(opts: {
  iframe: () => HTMLIFrameElement | null
  origin: string
  supabase: SessionSource
  mode?: Mode
  frame?: Frame
  scene?: string
  getCircleId?: () => string | null
  onReady?: () => void
}): EmbedController {
  const nonce = newNonce()
  const win = () => opts.iframe()?.contentWindow ?? null
  let authSub: { unsubscribe(): void } | null = null

  const pushSession = async () => {
    const { data } = await opts.supabase.auth.getSession()
    const s = data.session
    if (s) post(win(), opts.origin, { t: 'arganta:session', v: 1, nonce, access_token: s.access_token, refresh_token: s.refresh_token })
  }

  const off = listen(nonce, {
    onReady: async () => {
      post(win(), opts.origin, { t: 'arganta:init', v: 1, nonce, mode: opts.mode ?? 'operator', scene: opts.scene, frame: opts.frame ?? 'phone' })
      await pushSession()
      const cid = opts.getCircleId?.()
      if (cid) post(win(), opts.origin, { t: 'arganta:circle', v: 1, nonce, circleId: cid })
      // parent owns refresh: re-push whenever our own session changes (incl. after
      // an auto-refresh), so the child's disabled-refresh client stays current.
      if (!authSub) authSub = opts.supabase.auth.onAuthStateChange(() => { void pushSession() }).data.subscription
      opts.onReady?.()
    },
  })

  return {
    nonce,
    url: (base) => frameUrl(base, nonce, opts.scene),
    setCircle: (circleId) => post(win(), opts.origin, { t: 'arganta:circle', v: 1, nonce, circleId }),
    signout: () => post(win(), opts.origin, { t: 'arganta:signout', v: 1, nonce }),
    dispose: () => { off(); authSub?.unsubscribe(); authSub = null },
  }
}
