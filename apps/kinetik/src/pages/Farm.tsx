import { useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase'
import { useUiStore } from '@store/uiStore'

// Embeds LashiraBloom's farm, reusing the exact GameEmbed/postMessage pattern
// already proven for Bloom Command: `?embed=kinetik` tells the game it's
// hosted, we post our Google session down via `lashira-auth` once it announces
// `lashira-game-ready`. `&circle=<activeCircleId>` ties the farm save to this
// circle (FarmLogic reads it and keys the save by circle, not by account) —
// every member of the circle who opens KinFarm shares one farm.
const GAME_URL = import.meta.env.VITE_LASHIRA_GAME_URL || 'http://localhost:5185'

export default function Farm() {
  const ref = useRef<HTMLIFrameElement>(null)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')

  const src = `${GAME_URL}/?embed=kinetik&circle=${encodeURIComponent(activeCircleId || '')}`

  function post() {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session
      const msg = s?.access_token
        ? { type: 'lashira-auth', session: { access_token: s.access_token, refresh_token: s.refresh_token } }
        : { type: 'lashira-auth', signout: true }
      ref.current?.contentWindow?.postMessage(msg, '*')
    })
  }

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'lashira-game-ready') { post(); setStatus('ready') }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [activeCircleId])

  return (
    <div className="farm-embed">
      <iframe
        ref={ref}
        key={activeCircleId}
        title="KinFarm"
        src={src}
        onLoad={post}
        allow="fullscreen; gamepad"
      />
      {status === 'loading' && <div className="farm-embed-loading"><span className="boot-orb" /></div>}
    </div>
  )
}
