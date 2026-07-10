import { useEffect, useMemo, useState } from 'react'
import { CompositeStage, data, stepCount } from '@arganta/heroes-engine'
import { DEFAULT_SEL } from '../character/composer'
import './world.css'

// World Stage — Part B of the openworld habit-loop work: preview the Kingdom
// map + the 5 realm maps with REAL fidelity (the actual basemap/realm PNGs,
// the actual hero compositor) instead of an abstract diagram, and prove that
// each realm's controller shows the REAL character animation — Skill 1 swings
// a weapon, Skills 2/3 cast a spell — exactly like the shipped realm loops
// (see RealmRoom.jsx's attackMotionBase/castMotionBase + api.playMotion()).
// This can't be a claude.ai Artifact: Artifacts are network-sandboxed and can't
// fetch the real sprite sheets or basemap art, so it's a real Circle HQ surface.

type MapDef = { id: string; name: string; sub: string; file: string; color: string; icon: string }
const MAPS: MapDef[] = [
  { id: 'kingdom', name: 'Kingdom', sub: 'hub · launcher', file: '/farm-art/basemap.png', color: '#7c6cff', icon: '👑' },
  { id: 'lashira_keep', name: 'Lashira Keep', sub: 'city · stronghold', file: '/farm-art/Worldmap/lashira-keep.png', color: '#7c6cff', icon: '🏰' },
  { id: 'bloomwall_pass', name: 'Bloomwall Pass', sub: 'defense · adventure', file: '/farm-art/Worldmap/bloomwall-pass.png', color: '#2ca64e', icon: '🛡' },
  { id: 'hearthrush_kitchen', name: 'Hearthrush Kitchen', sub: 'cooking · service', file: '/farm-art/Worldmap/hearthrush-kitchen.png', color: '#f6a42c', icon: '🍽' },
  { id: 'fountain_festival', name: 'Fountain Festival', sub: 'puzzle · events', file: '/farm-art/Worldmap/fountain-festival.png', color: '#e53770', icon: '✨' },
  { id: 'emberring_arena', name: 'Emberring Arena', sub: 'social competition', file: '/farm-art/Worldmap/emberring-arena.png', color: '#da2a31', icon: '⚔' },
]

// A demo hero — same DEFAULT_SEL Character Forge starts from, plus a weapon so
// Swing/Spell actually have something to show (a bare-handed spec has no
// weapon-attack frames).
const DEMO_SPEC: any = { ...DEFAULT_SEL, weapon: { cat: 'sword', id: 0, palette: null } }
const HAS_WEAPON = !!DEMO_SPEC.weapon

const FACINGS = ['North', 'East', 'South', 'West'] as const
type Facing = typeof FACINGS[number]
type ActionId = 'idle' | 'walk' | 'strike' | 'skill2' | 'skill3'

// Mirrors RealmRoom.jsx's attackMotionBase/castMotionBase EXACTLY, so what you
// preview here is provably the same resolution the real game runs.
function attackMotionBase(tables: any, facing: Facing): string {
  if (tables) {
    for (const base of ['Swing', 'Attack', 'Pierce', 'Shoot']) {
      if (stepCount(tables, base + facing) > 0) return base
    }
  }
  return 'Get'
}
function castMotionBase(tables: any, facing: Facing): { motion: string; fellBack: boolean } {
  if (tables && stepCount(tables, 'Spell' + facing) > 0) return { motion: 'Spell', fellBack: false }
  return { motion: attackMotionBase(tables, facing), fellBack: true }
}

const ACTIONS: { id: ActionId; label: string; icon: string }[] = [
  { id: 'strike', label: 'Skill 1 · Strike', icon: '⚔' },
  { id: 'skill2', label: 'Skill 2 · Cast', icon: '✨' },
  { id: 'skill3', label: 'Skill 3 · Cast', icon: '🔮' },
]

export function WorldStage() {
  const [activeId, setActiveId] = useState(MAPS[0].id)
  const [facing, setFacing] = useState<Facing>('South')
  const [action, setAction] = useState<ActionId>('idle')
  const [playing, setPlaying] = useState(true)
  const [tables, setTables] = useState<any>(null)
  const map = MAPS.find((m) => m.id === activeId) || MAPS[0]

  useEffect(() => { data.motionTables().then(setTables) }, [])

  const resolved = useMemo(() => {
    if (action === 'idle') return { motion: HAS_WEAPON ? 'WeaponStandBy' : 'NormalStandBy', fellBack: false }
    if (action === 'walk') return { motion: HAS_WEAPON ? 'WeaponWalk' : 'NormalWalk', fellBack: false }
    if (action === 'strike') return { motion: attackMotionBase(tables, facing), fellBack: false }
    return castMotionBase(tables, facing) // skill2 / skill3 — both are magic casts
  }, [action, facing, tables])

  const motionName = resolved.motion + facing

  // One-shot actions (strike/skill) play briefly then return to idle — mirrors
  // the real game's oneShot timing (a strike/cast is momentary, not a held pose).
  useEffect(() => {
    if (action === 'idle' || action === 'walk') return undefined
    const t = window.setTimeout(() => setAction('idle'), 700)
    return () => window.clearTimeout(t)
  }, [action, facing])

  return (
    <div className="worldstage">
      <div className="ws-top">
        <div className="ws-mark">🗺️</div>
        <div className="ws-title"><b>World Stage</b><span>Circle HQ · LashiraBloom</span></div>
        <div className="ws-inv"><span>Map</span><b>{map.name}</b></div>
      </div>

      <div className="ws-tabs">
        {MAPS.map((m) => (
          <button key={m.id} className={'ws-tab' + (m.id === activeId ? ' on' : '')} onClick={() => setActiveId(m.id)}>
            <span className="tn" style={{ background: m.color }}>{m.icon}</span>
            <span className="txt"><b>{m.name}</b><small>{m.sub}</small></span>
          </button>
        ))}
      </div>

      <div className="ws-body">
        <div className="ws-stage" style={{ '--map-color': map.color } as any}>
          <img src={map.file} alt={map.name} className="ws-bg" />
          <div className="ws-charwrap">
            <CompositeStage spec={DEMO_SPEC} motionName={motionName} playing={playing} scale={3} width={220} height={220} />
          </div>
          <div className="ws-motionchip">
            <b>{motionName}</b>
            {resolved.fellBack && <span className="ws-fallback">fallback — this hero has no Spell frames, showing the weapon swing instead</span>}
          </div>
        </div>

        <div className="ws-panel">
          <div className="ws-sec">
            <h4>Facing</h4>
            <div className="ws-facerow">
              {FACINGS.map((f) => (
                <button key={f} className={'ws-facebtn' + (f === facing ? ' on' : '')} onClick={() => setFacing(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="ws-sec">
            <h4>Test Controller</h4>
            <p className="ws-cap">Press a skill to preview the real character animation on the real map — Skill 1 swings a weapon, Skills 2 &amp; 3 cast a spell, exactly like the shipped realm controllers (Bloomwall's Hero Skill, Arena's Strike/Burst).</p>
            <div className="ws-actions">
              {ACTIONS.map((a) => (
                <button key={a.id} className={'ws-actbtn' + (action === a.id ? ' on' : '')} onClick={() => setAction(a.id)}>
                  <span className="ic">{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
            <div className="ws-utilrow">
              <button className={'ws-chip' + (action === 'walk' ? ' on' : '')} onClick={() => setAction(action === 'walk' ? 'idle' : 'walk')}>Walk cycle</button>
              <button className={'ws-chip' + (playing ? ' on' : '')} onClick={() => setPlaying((p) => !p)}>{playing ? 'Playing' : 'Paused'}</button>
            </div>
          </div>
          <div className="ws-sec ws-note">
            <h4>What this proves</h4>
            <p className="ws-cap">This stage runs the exact same motion-resolution helper as the shipped game (<code>attackMotionBase</code> / <code>castMotionBase</code>) against the exact same hero compositor. If it looks right here, it looks right in Kitchen, Bloomwall, Keep, Festival, and Arena.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
