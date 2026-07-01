// ============================================================
//  ARGANTALAB · KINQUEST · STARTER SELECT
//  First-run screen: pick one of three first-partner kin. Choosing seeds the
//  party and starts the quest. Art comes from KinSprite (the swappable seam).
// ============================================================

import { useState } from 'react'
import KinSprite from '@components/openworld/KinSprite'
import { STARTERS } from '@/data/kinquest'
import { ELEMENT_META } from '@/data/kinquest'
import { kin as kinDef } from '@/data/openworld'
import type { Element } from '@/data/openworld'

export default function StarterSelect({ onChoose }: { onChoose: (render: string) => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const chosen = STARTERS.find(s => s.render === sel)

  return (
    <div className="kq-starter">
      <div className="kq-starter-head">
        <span className="kq-star-badge"><span className="kq-star-ic">⭐</span> Star by ArgantaLab</span>
        <h1 className="kq-title">Choose your first kin</h1>
        <p className="kq-sub">Your partner for the whole quest. Pick the one that feels like you.</p>
      </div>

      <div className="kq-starter-row">
        {STARTERS.map(s => {
          const def = kinDef(`kin:${s.render}`)
          const el = (def?.element ?? 'pattern') as Element
          const meta = ELEMENT_META[el]
          const on = sel === s.render
          return (
            <button key={s.render} className={`kq-starter-card${on ? ' on' : ''}`}
              style={{ ['--kc' as string]: def?.color ?? '#8b5cf6' }}
              onClick={() => setSel(s.render)}>
              <div className="kq-starter-orb"><KinSprite render={s.render} color={def?.color} size={92} bob={on} /></div>
              <b className="kq-starter-name">{def?.name}</b>
              <span className="kq-starter-el" style={{ color: meta.color }}>{meta.icon} {meta.label}</span>
              <span className="kq-starter-style">{s.style}</span>
              <p className="kq-starter-tag">{s.tagline}</p>
            </button>
          )
        })}
      </div>

      <button className="btn btn-primary kq-starter-go" disabled={!chosen}
        onClick={() => chosen && onChoose(chosen.render)}>
        {chosen ? `Begin with ${kinDef(`kin:${chosen.render}`)?.name} →` : 'Pick a kin to begin'}
      </button>
    </div>
  )
}
