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
// child → parent
export interface ReadyMsg { t: 'arganta:ready'; v: 1; nonce: string }
export interface NavMsg { t: 'arganta:nav'; v: 1; nonce: string; scene: string }

export type InboundMsg = ReadyMsg | NavMsg
export type OutboundMsg = InitMsg | SessionMsg

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
