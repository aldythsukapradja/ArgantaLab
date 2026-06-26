// ============================================================
//  ARGANTALAB · ExploringNotice
//  "🤝 {name} is exploring {World} — Join" — shows circle-mates who are walking
//  an ArgantaLand right now (observes the shared presence channel WITHOUT
//  appearing itself). Tap → onJoin(worldKey) drops you into their world.
//  Used on Home and each world's Openworld lobby.
// ============================================================

import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import { observeCircle, type Peer } from '@lib/landPresence'
import AvatarSprite from './AvatarSprite'

const worldName = (key?: string) => WORLDS.find(w => w.key === key)?.name ?? key ?? 'a world'

export default function ExploringNotice({ onJoin }: { onJoin: (world: string) => void }) {
  const { activeCircleId, session } = useAppStore()
  const myId = session && session !== 'loading' ? session.user.id : null
  const [explorers, setExplorers] = useState<Peer[]>([])

  useEffect(() => {
    if (!activeCircleId || !myId) return
    return observeCircle(activeCircleId, myId, setExplorers)
  }, [activeCircleId, myId])

  if (explorers.length === 0) return null

  return (
    <div className="ex-list">
      {explorers.slice(0, 4).map(p => (
        <button key={p.id} className="ex-card" onClick={() => onJoin(p.world!)}>
          <span className="ex-av"><AvatarSprite size={38} outfit={p.outfit} mount={p.mount} /></span>
          <span className="ex-body"><b>🤝 {p.name} is exploring</b><small>{worldName(p.world)}</small></span>
          <span className="ex-join">Join →</span>
        </button>
      ))}
    </div>
  )
}
