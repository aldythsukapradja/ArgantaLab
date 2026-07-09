import { useEffect, useState } from 'react'
import { CompositeStage } from '@arganta/heroes-engine'
import { loadRoster, getCharacter, type RosterEntry } from './heroData'
import { PATHS } from './composer'

// Character Select — the welcome / pick-your-hero screen. Built here as the design
// SOURCE: LashiraBloom mirrors this layout + feel 1:1 for its own welcome. Shows the
// REAL roster with live composited mini-avatars (same engine as the Lab), so what an
// operator forges is exactly what a player sees when picking their hero.

function MiniAvatar({ spec }: { spec: any }) {
  if (!spec) return <div className="f-slotcard-empty">no hero yet</div>
  return <CompositeStage spec={spec} motionName="NormalStandBySouth" playing scale={2} speed={1} width={132} height={150} />
}

export function CharacterSelect() {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [specs, setSpecs] = useState<Record<string, any>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    ;(async () => {
      const { entries } = await loadRoster()
      if (!live) return
      setRoster(entries)
      if (entries.length) setSelectedId(entries[0].profileId)
      setLoading(false)
      // fetch each hero's spec for the mini preview (small family-sized rosters — fine eagerly)
      for (const u of entries) {
        if (!u.hasHero) continue
        const c = await getCharacter(u.profileId)
        if (live && c?.spec) setSpecs(s => ({ ...s, [u.profileId]: c.spec }))
      }
    })()
    return () => { live = false }
  }, [])

  const selected = roster.find(r => r.profileId === selectedId) || null
  const path = (selected?.pathId || 'warrior')
  const pathLabel = PATHS.find(p => p.toLowerCase() === path.toLowerCase()) || 'Warrior'

  return (
    <div className="f-select">
      <div className="f-select-hero">
        <span className="f-select-eyebrow">Welcome to the realm</span>
        <h2>Choose your hero</h2>
        <p>The character forged in the Lab walks every ArgantaLab world — the arena, and the farm.</p>
        {selected && (
          <button className="f-select-cta" disabled={!selected.hasHero}>
            {selected.hasHero ? `Enter as ${selected.displayName || selected.name}` : 'Build a hero in the Lab first'}
          </button>
        )}
        {selected?.hasHero && <div className="f-select-meta">{pathLabel} · {selected.accountType || 'user'}{selected.level ? ` · Level ${selected.level}` : ''}</div>}
      </div>

      <div className="f-select-roster">
        {loading && <div className="f-empty">Loading roster…</div>}
        {!loading && roster.length === 0 && <div className="f-empty">Sign in to see the roster.</div>}
        {roster.map(u => (
          <button key={u.profileId} className={'f-slotcard' + (u.profileId === selectedId ? ' on' : '') + (!u.hasHero ? ' empty' : '')}
            onClick={() => setSelectedId(u.profileId)}>
            <div className="f-slotcard-pic">
              <MiniAvatar spec={specs[u.profileId]} />
            </div>
            <div className="f-slotcard-meta">
              <b>{u.displayName || u.name}</b>
              <span>{u.hasHero ? `${(u.pathId || 'warrior')} · L${u.level ?? 1}` : 'no hero yet'}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
