// ============================================================
//  ARGANTALAB · CheerSquad
//  A little cheering crew at the bottom of the play screen — the kid's avatar on
//  its mount + a few of the kin they've befriended, all bobbing along to root
//  them on. Pass `cheering` (e.g. on a correct answer) for a celebratory hop.
//  Reuses AvatarSprite (cosmetics + mount) + KinSprite + the Nexus roster, so it
//  costs the kid nothing extra to author — it grows as they befriend more kin.
// ============================================================

import { useEffect, useState } from 'react'
import { nexusRoster, type KinInstance } from '@lib/nexus'
import { myMounts } from '@lib/mounts'
import AvatarSprite from './AvatarSprite'
import KinSprite from './KinSprite'

export default function CheerSquad({ cheering = false }: { cheering?: boolean }) {
  const [kins, setKins] = useState<KinInstance[]>([])
  const [mount, setMount] = useState<string | undefined>(undefined)

  useEffect(() => {
    nexusRoster().then(r => setKins(r.slice(0, 5)))
    myMounts().then(m => setMount(m.equipped ?? undefined))
  }, [])

  return (
    <div className={`cheer${cheering ? ' on' : ''}`} aria-hidden>
      <div className="cheer-av"><AvatarSprite size={66} mount={mount} mood={cheering ? 'happy' : 'idle'} /></div>
      {kins.map((k, i) => (
        <div key={k.id} className="cheer-kin" style={{ animationDelay: `${i * 0.12}s` }}>
          <KinSprite kin={k.kin_key} size={42} />
        </div>
      ))}
    </div>
  )
}
