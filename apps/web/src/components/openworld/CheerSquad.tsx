// ============================================================
//  ARGANTALAB · CheerSquad
//  A cheering crew in the top-left of the play screen — the kid's avatar on its
//  mount + a few of the kin they've befriended, with a speech-bubble shout-out
//  ("Good job!" on a correct answer, encouragement otherwise). Bobs along, and
//  hops on a correct answer (`cheering`). Reuses AvatarSprite (cosmetics + mount)
//  + KinSprite + the Nexus roster, so it grows as the kid befriends more kin.
// ============================================================

import { useEffect, useState } from 'react'
import { nexusRoster, type KinInstance } from '@lib/nexus'
import { myMounts } from '@lib/mounts'
import AvatarSprite from './AvatarSprite'
import KinSprite from './KinSprite'

const PRAISE = ['Good job! 🎉', 'Nice one!', 'Way to go!', 'Brilliant!', 'You rock!', 'So smart!', 'Yes! 💪']
const IDLE = ['You’ve got this!', 'Keep going!', 'Think it through!', 'You’re doing great!', 'Take your time!']
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]

export default function CheerSquad({ cheering = false }: { cheering?: boolean }) {
  const [kins, setKins] = useState<KinInstance[]>([])
  const [mount, setMount] = useState<string | undefined>(undefined)
  const [msg, setMsg] = useState(IDLE[0])

  useEffect(() => {
    nexusRoster().then(r => setKins(r.slice(0, 4)))
    myMounts().then(m => setMount(m.equipped ?? undefined))
  }, [])

  useEffect(() => { setMsg(cheering ? pick(PRAISE) : pick(IDLE)) }, [cheering])

  return (
    <div className={`cheer${cheering ? ' on' : ''}`}>
      <div className="cheer-bubble">{msg}</div>
      <div className="cheer-row">
        <div className="cheer-av"><AvatarSprite size={92} mount={mount} mood={cheering ? 'happy' : 'idle'} /></div>
        {kins.map((k, i) => (
          <div key={k.id} className="cheer-kin" style={{ animationDelay: `${i * 0.12}s` }}>
            <KinSprite kin={k.kin_key} size={56} />
          </div>
        ))}
      </div>
    </div>
  )
}
