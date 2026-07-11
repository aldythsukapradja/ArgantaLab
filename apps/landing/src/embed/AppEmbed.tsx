import { useEffect, useRef, useState } from 'react'
import { DeviceFrame } from './DeviceFrame'
import { EMBEDS, EMBED_LABEL, PUBLIC_LIVE, type EmbedApp } from './embeds'
import { frameUrl, listen, newNonce, post, type Frame, type Mode } from './bridge'
import { supabase } from '../lib/supabase'

// ── AppEmbed — the real app in a device frame. Poster-first: a static preview +
// "▶ Go live" until the visitor opts in (saves bundle, battery, and — for the
// non-guest apps — respects the operator-only rule). Mounts the iframe lazily;
// unmounts when it leaves. Phone/desktop toggle on every embed. When live and in
// operator mode, hands the Supabase session to the child over the bridge so the
// real app shows real data.

export function AppEmbed({
  app, scene, poster, defaultFrame = 'phone', operator = false, active = true,
}: {
  app: EmbedApp
  scene?: string
  poster?: string          // image url or CSS background for the static preview
  defaultFrame?: Frame
  operator?: boolean       // true when the founder is signed in as operator
  active?: boolean         // is the hosting slide/card currently on screen?
}) {
  const [frame, setFrame] = useState<Frame>(defaultFrame)
  const [live, setLive] = useState(false)
  const [ready, setReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const nonceRef = useRef<string>('')

  const canPublicLive = PUBLIC_LIVE[app]
  const mode: Mode = operator ? 'operator' : 'demo'
  // an unauthenticated visitor can only go live on guest-path apps (lashira)
  const mayGoLive = operator || canPublicLive

  // never keep an iframe mounted once its slide leaves
  useEffect(() => { if (!active) { setLive(false); setReady(false) } }, [active])

  // bridge: validate handshake, then push init (+ session if operator)
  useEffect(() => {
    if (!live) return
    const nonce = nonceRef.current
    const origin = (() => { try { return new URL(EMBEDS[app]).origin } catch { return '*' } })()
    const off = listen(nonce, {
      onReady: async () => {
        setReady(true)
        const win = iframeRef.current?.contentWindow ?? null
        post(win, origin, { t: 'arganta:init', v: 1, nonce, mode, scene, frame })
        if (operator) {
          const { data } = await supabase.auth.getSession()
          const s = data.session
          if (s) post(win, origin, { t: 'arganta:session', v: 1, nonce, access_token: s.access_token, refresh_token: s.refresh_token })
        }
      },
    })
    return off
  }, [live, app, mode, scene, frame, operator])

  const goLive = () => { nonceRef.current = newNonce(); setLive(true) }

  const src = live ? frameUrl(EMBEDS[app], nonceRef.current, scene) : ''

  return (
    <div className="aembed" data-frame={frame}>
      <div className="aembed-frame">
        <DeviceFrame frame={frame} label={live ? EMBED_LABEL[app] : undefined}>
          {live ? (
            <iframe
              ref={iframeRef}
              className="aembed-iframe"
              src={src}
              title={EMBED_LABEL[app]}
              loading="lazy"
              allow="fullscreen; autoplay; gamepad"
            />
          ) : (
            <button className="aembed-poster" onClick={mayGoLive ? goLive : undefined} disabled={!mayGoLive}
              style={poster ? { backgroundImage: `url(${poster})` } : undefined}>
              <span className="aembed-poster-lbl">{EMBED_LABEL[app]}</span>
              {mayGoLive
                ? <span className="aembed-go">▶ Go live</span>
                : <span className="aembed-locked">🔒 Operator preview</span>}
            </button>
          )}
        </DeviceFrame>
      </div>
      <div className="aembed-ctrl">
        <button className={`aembed-chip${frame === 'phone' ? ' on' : ''}`} onClick={() => setFrame('phone')} aria-label="Phone">📱</button>
        <button className={`aembed-chip${frame === 'desktop' ? ' on' : ''}`} onClick={() => setFrame('desktop')} aria-label="Desktop">🖥</button>
        {live && <button className="aembed-chip" onClick={() => { setLive(false); setReady(false) }} aria-label="Stop">◼ poster</button>}
        {live && !ready && <span className="aembed-loading">connecting…</span>}
      </div>
    </div>
  )
}
