// C5-B4 · A tiny pub/sub so an ArtifactCard (rendered 3 levels down, inside a
// persisted message) can open the preview pane owned by ArgantaCore.
//
// Why not props: the path is ArgantaCore → Conversation → Message →
// ArtifactCard, and every one of those is also mounted from other places
// (panel/fullscreen/embed). Threading an optional callback through all four,
// in every mount mode, to serve one button is more coupling than the feature is
// worth. Why not context: same reach, but it forces a provider around every
// mount site, including the embed contract's. This is one module-level channel
// with an explicit contract, and it stays inside surfaces/core.

export type PreviewTarget =
  /** A generated single-file artifact: HTML we already hold in the block. */
  | { kind: 'artifact'; title: string; html: string; artifactId: string | null }
  /** Any URL — a deployed app, a game, a staging site, docs. */
  | { kind: 'url'; title: string; url: string }

type Listener = (t: PreviewTarget) => void
const listeners = new Set<Listener>()

export function openPreview(target: PreviewTarget) {
  listeners.forEach(l => l(target))
}

export function subscribePreview(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Normalize what a founder types into a URL bar ("localhost:5185",
 * "arganta.app") into something an iframe can actually load. Returns null when
 * it can't be made into an http(s) URL — we never guess a scheme onto something
 * that isn't a URL, and never pass javascript:/data: through to the frame. */
export function normalizeUrl(raw: string): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  const withScheme = /^https?:\/\//i.test(s) ? s : `http://${s}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname) return null
    return u.href
  } catch { return null }
}
