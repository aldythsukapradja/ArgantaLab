// KinetikCircle, opened inside Arganta Chat. A full-bleed iframe under the shared
// navbar; the parent hands its Supabase session to the child over the W1 bridge
// controller (shared login) and keeps the child's circle in lock-step with the
// chat's own selector (shared circle). A floating "← Back to chat" pill returns.
//
// This is the CONSUMER that proves the W1 auth lifecycle: the controller pushes a
// fresh session on the child's `ready` and again on every parent auth change, so
// the child (auto-refresh disabled) never races the single-use refresh token.
import { useEffect, useRef, useState } from 'react'
import { createEmbedController, type EmbedController } from '../embed/bridge'
import { EMBEDS } from '../embed/embeds'
import { supabase } from '../lib/supabase'

const KINETIK_URL = EMBEDS.kinetik
const KINETIK_ORIGIN = (() => { try { return new URL(KINETIK_URL).origin } catch { return '*' } })()

export function KinetikView({ circleId, onBack }: { circleId: string; onBack: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const ctrlRef = useRef<EmbedController | null>(null)
  const [ready, setReady] = useState(false)
  const [src, setSrc] = useState('')

  // one controller per mount — owns the handshake + session lifecycle
  useEffect(() => {
    const ctrl = createEmbedController({
      iframe: () => iframeRef.current,
      origin: KINETIK_ORIGIN,
      supabase,
      mode: 'operator',            // the parent is a real signed-in adult → live data
      frame: 'desktop',
      getCircleId: () => circleId || null,
      onReady: () => setReady(true),
    })
    ctrlRef.current = ctrl
    setSrc(ctrl.url(KINETIK_URL))
    return () => { ctrl.dispose(); ctrlRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the embedded circle in step with the chat's selector (one-way)
  useEffect(() => {
    if (ready && circleId) ctrlRef.current?.setCircle(circleId)
  }, [circleId, ready])

  return (
    <div className="ac-kin">
      {!ready && (
        <div className="ac-kin-load"><span className="ac-shimmer" /><span>Opening KinetikCircle…</span></div>
      )}
      <iframe
        ref={iframeRef}
        className="ac-kin-frame"
        src={src}
        title="KinetikCircle"
        allow="fullscreen; autoplay; clipboard-write"
      />
      <button className="ac-kin-back" onClick={onBack}>← Back to chat</button>
    </div>
  )
}
