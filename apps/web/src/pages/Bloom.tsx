import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Bloom page — embeds the LashiraBloom farm game INSIDE ArgantaLab, full screen
// below the TopBar (whose Bloom pill turns into "Home" while this tab is active,
// so no separate exit button is needed here). This replaces the old Kingdom
// Arena embed on the same shortcut; the arena code (pages/arena/*) stays on disk
// but is no longer routed to.
//
// Reuses the exact GameEmbed/postMessage pattern proven for Kinetik's KinFarm
// and Bloom Command: `?embed=argantalab` tells the game it's hosted; we post the
// host Google session down via `lashira-auth` once it announces
// `lashira-game-ready`. No `circle` param → the farm save is per-account (the
// game falls back to a per-profile save when no circle is supplied).
const GAME_URL = import.meta.env.VITE_LASHIRA_GAME_URL || 'https://lashirabloom-game.vercel.app'

function targetOrigin() {
  try { return new URL(GAME_URL).origin } catch { return '*' }
}

export default function Bloom() {
  const ref = useRef<HTMLIFrameElement>(null)
  const authedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')

  const src = `${GAME_URL}/?embed=argantalab`

  function post(force = false) {
    if (authedRef.current && !force) return
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session
      const msg = s?.access_token
        ? { type: 'lashira-auth', session: { access_token: s.access_token, refresh_token: s.refresh_token } }
        : { type: 'lashira-auth', signout: true }
      ref.current?.contentWindow?.postMessage(msg, targetOrigin())
    })
  }

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'lashira-game-ready' || e.data?.type === 'lashira-auth-request') post(true)
      if (e.data?.type === 'lashira-auth-applied') {
        authedRef.current = true
        setStatus('ready')
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    authedRef.current = false
    setStatus('loading')
    const timer = window.setInterval(post, 2500)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      authedRef.current = false
      post(true)
    })
    return () => {
      window.clearInterval(timer)
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, top: 49, background: '#000', zIndex: 40 }}>
      <iframe
        ref={ref}
        title="LashiraBloom"
        src={src}
        onLoad={() => {
          authedRef.current = false
          setStatus('loading')
          post(true)
        }}
        allow="fullscreen; gamepad"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#8B5CF6', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
