import { useRef } from 'react'
import { gsap } from 'gsap'
import { useAppStore } from '@store/appStore'
import { PEOPLE, CIRCLES, ENERGY, personById, initials, firstName, type Moment, type EnergyKey } from '@data/seed'
import { IconHeart, IconComment, IconTag, IconPhoto, IconPlus, IconDiamond, IconHistory } from '@components/Icons'

export default function Moments() {
  const { moments, activeCircleId, heart } = useAppStore()
  const circle = CIRCLES.find(c => c.id === activeCircleId) ?? CIRCLES[0]
  const members = PEOPLE.filter(p => circle.memberIds.includes(p.id))
  const feed = moments.filter(m => m.circleId === activeCircleId).sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="fade-in">
      <p className="mom-private">{circle.name} · private to your circle</p>

      <div className="stories">
        <button className="story add"><span className="story-av dashed"><IconPlus width={18} height={18} /></span><small>Add</small></button>
        {members.map(p => (
          <button key={p.id} className="story"><span className="story-av" style={{ background: p.color, outline: `2px solid ${p.color}` }}>{initials(p.name)}</span><small>{p.name}</small></button>
        ))}
      </div>

      {feed.map(m => <MomentCard key={m.id} m={m} onHeart={() => heart(m.id)} />)}

      <div className="mom-ago"><IconHistory width={13} height={13} /> A year ago · Keyla's first day of school</div>
    </div>
  )
}

function MomentCard({ m, onHeart }: { m: Moment; onHeart: () => void }) {
  const author = personById(m.authorId)
  const burst = useRef<HTMLDivElement | null>(null)

  const tapHeart = () => {
    onHeart()
    const host = burst.current
    if (!host) return
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span')
      s.className = 'spark'
      host.appendChild(s)
      const ang = Math.random() * Math.PI * 2, dist = 18 + Math.random() * 26
      gsap.fromTo(s, { x: 0, y: 0, scale: 1, opacity: 1 },
        { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, scale: 0, opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => s.remove() })
    }
  }

  if (m.kind === 'kudos') {
    return (
      <div className="card kudos">
        <span className="kudos-ic" style={{ background: `color-mix(in srgb, ${ENERGY[m.rewardEnergy ?? 'mind']} 18%, transparent)`, color: ENERGY[m.rewardEnergy ?? 'mind'] }}><IconDiamond width={19} height={19} /></span>
        <div className="kudos-main"><b>{m.text}</b><small>Shared by {firstName(m.authorId)}</small></div>
        <span className="kudos-badge">+5</span>
      </div>
    )
  }

  return (
    <div className="card moment">
      <div className="moment-head">
        <span className="m-av" style={{ background: author?.color }}>{initials(author?.name ?? '?')}</span>
        <div className="m-id"><b>{author?.name}</b><small>{rel(m.createdAt)}</small></div>
      </div>
      <div className="moment-photo" style={{ background: photoWash(m.tone) }}><IconPhoto width={32} height={32} /></div>
      <div className="moment-body">
        <div className="moment-text">{m.text}</div>
        <div className="moment-acts">
          <button className="m-act heart" onClick={tapHeart} style={{ position: 'relative' }}>
            <span className="burst" ref={burst} />
            <IconHeart width={17} height={17} /> {m.hearts}
          </button>
          <span className="m-act"><IconComment width={17} height={17} /> {m.comments}</span>
          {m.tag && <span className="m-act tag"><IconTag width={15} height={15} /> {m.tag}</span>}
        </div>
      </div>
    </div>
  )
}

const photoWash = (tone?: EnergyKey) => {
  const c = ENERGY[tone ?? 'memory']
  return `linear-gradient(135deg, color-mix(in srgb, ${c} 30%, var(--card-2)), color-mix(in srgb, ${c} 14%, var(--card-2)))`
}
function rel(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  const d = Math.floor(s / 86400)
  return d === 1 ? 'yesterday' : d + ' days ago'
}
