// ── embedGuest — makes this app a well-behaved child when embedded in the Arganta
// landing (arganta:embed@1 protocol). COMPLETE NO-OP unless the URL carries an
// ?embed=<nonce> handshake, so normal standalone usage is untouched.
//
// Handshake: parent frames us with ?embed=<nonce> → we post arganta:ready(nonce) to
// the parent → parent replies arganta:init (mode/scene/frame) and, for an operator
// presentation, arganta:session (access/refresh tokens) which we apply so the app
// shows real data. We only accept messages carrying our nonce, and only apply a
// session from an allowlisted parent origin.
import { supabase } from './supabase'

const PARENT_ORIGINS = (
  (import.meta.env.VITE_EMBED_PARENTS as string | undefined) ??
  'https://landing-delta-flax.vercel.app,https://arganta.app,https://www.arganta.app'
).split(',').map(s => s.trim()).filter(Boolean)

// dev convenience: also trust localhost parents
const isDevParent = (o: string) => /^https?:\/\/localhost(:\d+)?$/.test(o)

export function initEmbedGuest(hooks?: { onScene?: (scene: string) => void; onCircle?: (circleId: string) => void }) {
  if (typeof window === 'undefined' || window.top === window.self) return
  const params = new URLSearchParams(window.location.search)
  const nonce = params.get('embed')
  if (!nonce) return

  document.documentElement.classList.add('is-embedded')

  window.addEventListener('message', async (e: MessageEvent) => {
    const m = e.data as { t?: string; nonce?: string; scene?: string; circleId?: string; access_token?: string; refresh_token?: string } | undefined
    if (!m || typeof m !== 'object' || m.nonce !== nonce) return
    const trusted = PARENT_ORIGINS.includes(e.origin) || isDevParent(e.origin)
    if (m.t === 'arganta:init') {
      if (m.scene && hooks?.onScene) hooks.onScene(m.scene)
    } else if (m.t === 'arganta:session') {
      if (!trusted || !m.access_token || !m.refresh_token) return
      // Parent owns refresh (autoRefreshToken is off here) — just apply whatever
      // fresh tokens it sends, on first mount and after every parent-side refresh.
      try { await supabase.auth.setSession({ access_token: m.access_token, refresh_token: m.refresh_token }) } catch { /* ignore */ }
    } else if (m.t === 'arganta:circle') {
      // One-way circle sync: the chat's selector drives which family we show.
      if (trusted && m.circleId && hooks?.onCircle) hooks.onCircle(m.circleId)
    } else if (m.t === 'arganta:signout') {
      // Parent signed out — tear our session down too (never leave a live iframe
      // holding a valid session behind a signed-out host).
      if (trusted) { try { await supabase.auth.signOut() } catch { /* ignore */ } }
    }
  })

  // announce readiness to whoever framed us (parent validates origin+nonce its side)
  try { window.parent.postMessage({ t: 'arganta:ready', v: 1, nonce }, '*') } catch { /* ignore */ }
}
