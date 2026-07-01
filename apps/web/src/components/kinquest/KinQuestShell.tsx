// ============================================================
//  ARGANTALAB · KINQUEST · SHELL  (the game router)
//  Ties the whole quest together: starter select → world map → region
//  screen → battle, and back. Owns the save file, builds combatants for
//  each fight, and pays out REAL ArgantaLab XP + diamonds on wins/Keepers.
// ============================================================

import { useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { earnDiamonds } from '@lib/wallet'
import { bumpQuest } from '@lib/quests'
import KinSprite from '@components/openworld/KinSprite'
import KinQuestWorldMap from './KinQuestWorldMap'
import StarterSelect from './StarterSelect'
import KinBattle, { type BattleResult } from './KinBattle'
import {
  loadSave, chooseStarter, setRegion, rewardParty, addKin, beatKeeper, openRegionPaths, resetSave,
  type KinQuestSave,
} from '@lib/kinquest/save'
import { combatantFromParty, makeWildEnemy, makeCombatant } from '@lib/kinquest/party'
import type { Combatant } from '@lib/kinquest/battle'
import { region as regionOf, REGION_BY_ID, ELEMENT_META, tierForBond, evolvedName, evolvesAt } from '@/data/kinquest'
import type { Region } from '@/data/kinquest'
import { KIN, kinForWorld, kin as kinDef } from '@/data/openworld'

type View = 'starter' | 'map' | 'region' | 'battle'
interface BattleCfg { enemyTeam: Combatant[]; isKeeper: boolean; keeperName?: string }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

export default function KinQuestShell() {
  const stage = useAppStore(s => s.stageKey)
  const learnerName = useAppStore(s => s.learnerName)
  const addXp = useAppStore(s => s.addXp)
  const addToast = useAppStore(s => s.addToast)

  const [save, setSave] = useState<KinQuestSave>(() => loadSave())
  const [view, setView] = useState<View>(() => (loadSave().started ? 'map' : 'starter'))
  const [regionId, setRegionId] = useState<string>(() => loadSave().currentRegion || 'cove')
  const [battle, setBattle] = useState<BattleCfg | null>(null)
  const [celebrate, setCelebrate] = useState<{ title: string; sub: string; seal?: string } | null>(null)

  const region = regionOf(regionId) ?? REGION_BY_ID.cove
  const party = useMemo(() => save.party.map(combatantFromParty), [save])

  // ── starter ──
  const onStarter = (render: string) => {
    const s = chooseStarter(render)
    setSave(s); setView('map')
    addToast('Your quest begins! 🌱', '⭐')
  }

  // ── map → region ──
  const onSelectRegion = (id: string) => {
    if (!save.unlocked.includes(id)) return
    const s = setRegion(id)
    setSave(s); setRegionId(id); setView('region')
  }

  // ── build wild encounter ──
  const startWild = () => {
    const roster = region.kinWorld === 'mix' ? KIN : kinForWorld(region.kinWorld)
    const enemyDef = pick(roster)
    const render = enemyDef.id.replace('kin:', '')
    const lvl = ri(region.wildLevels[0], region.wildLevels[1])
    setBattle({ enemyTeam: [makeWildEnemy(render, lvl)], isKeeper: false })
    setView('battle')
  }

  // ── build Keeper battle ──
  const startKeeper = () => {
    if (!region.keeper) return
    const team = region.keeper.team.map((render, i) =>
      makeCombatant(render, region.wildLevels[0] + i * 2, 0, { asTier: true }))
    setBattle({ enemyTeam: team, isKeeper: true, keeperName: region.keeper.name })
    setView('battle')
  }

  // ── resolve a finished battle ──
  const onBattleEnd = (r: BattleResult) => {
    const isKeeper = battle?.isKeeper
    setBattle(null); setView('region')

    if (r.outcome === 'fled') return

    if (r.outcome === 'lose') {
      addToast('Your kin fainted! Rest and try again.', '💫')
      return
    }

    if (r.outcome === 'befriended' && r.befriendedRender) {
      const def = kinDef(`kin:${r.befriendedRender}`)
      const s = addKin(r.befriendedRender, def?.world ?? region.kinWorld, r.enemyMaxLevel)
      setSave(s)
      earnDiamonds(8, 'openworld', `kinquest:befriend:${r.befriendedRender}`)
      addXp(12)
      addToast(`${def?.name ?? 'A kin'} joined your party! 💗`, '🐾')
      return
    }

    // a win (wild defeat or Keeper)
    if (isKeeper && region.keeper) {
      const already = save.seals.includes(region.id)
      const s = beatKeeper(region.id)
      setSave(s)
      bumpQuest('boss')
      if (!already) {
        earnDiamonds(40, 'openworld', `kinquest:keeper:${region.id}`)
        addXp(60)
        setCelebrate({
          title: `${region.keeper.name} defeated!`,
          sub: `You earned the ${region.name} Seal. New lands await on the map.`,
          seal: region.seal,
        })
      } else {
        earnDiamonds(10, 'openworld', `kinquest:keeper-rematch:${region.id}`)
        addXp(20)
        addToast(`${region.keeper.name} bested again!`, region.seal)
      }
      return
    }

    // wild win → grow the lead kin (bond + occasional evolution moment)
    const lead = save.party[0]
    const beforeTier = lead ? tierForBond(lead.bond) : 0
    let s = rewardParty(6, Math.random() < 0.5 ? 1 : 0)
    const afterLead = s.party[0]
    const afterTier = afterLead ? tierForBond(afterLead.bond) : 0
    earnDiamonds(6, 'openworld', `kinquest:wild:${region.id}`)
    addXp(15)

    // A Keeper-less region (the tutorial cove) opens its paths once you win here.
    let openedMsg = ''
    if (!region.keeper) {
      const { save: s2, opened } = openRegionPaths(region.id)
      s = s2
      if (opened.length) openedMsg = `New paths opened: ${opened.map(id => REGION_BY_ID[id]?.name ?? id).join(' & ')}!`
    }
    setSave(s)

    if (lead && evolvesAt(lead.render, beforeTier, afterTier)) {
      setCelebrate({
        title: 'Evolution!',
        sub: `${evolvedName(lead.render, beforeTier)} evolved into ${evolvedName(lead.render, afterTier)}!`,
      })
    } else if (openedMsg) {
      setCelebrate({ title: 'The map opens!', sub: openedMsg, seal: '🗺️' })
    } else {
      addToast('+15 XP · your kin grew stronger!', '✨')
    }
  }

  // ══════════════ RENDER ══════════════
  if (view === 'starter') {
    return <div className="screen kq-page"><StarterSelect onChoose={onStarter} /></div>
  }

  if (view === 'battle' && battle) {
    return (
      <div className="screen kq-page kq-battle-page">
        <KinBattle
          region={region}
          stage={stage}
          playerParty={party}
          enemyTeam={battle.enemyTeam}
          isKeeper={battle.isKeeper}
          keeperName={battle.keeperName}
          onEnd={onBattleEnd}
        />
      </div>
    )
  }

  if (view === 'region') {
    return (
      <div className="screen kq-page kq-region-page" style={{ ['--rc' as string]: region.color }}>
        <RegionScreen
          region={region}
          party={party}
          sealed={save.seals.includes(region.id)}
          onWild={startWild}
          onKeeper={startKeeper}
          onBack={() => setView('map')}
        />
        {celebrate && <Celebration data={celebrate} name={learnerName} onClose={() => setCelebrate(null)} />}
      </div>
    )
  }

  // map
  return (
    <div className="screen kq-page">
      <div className="kq-star-badge"><span className="kq-star-ic">⭐</span> Star by ArgantaLab</div>
      <div className="kq-head">
        <h1 className="kq-title">KinQuest</h1>
        <p className="kq-sub">{save.seals.length}/7 Seals · {save.party.length} kin · tap a region</p>
      </div>
      <div className="kq-map-wrap">
        <KinQuestWorldMap onSelect={onSelectRegion} currentRegion={save.currentRegion} unlockedIds={save.unlocked} />
      </div>
      <div className="kq-hint">Tap an unlocked region to explore, battle, and challenge its Keeper</div>
      {celebrate && <Celebration data={celebrate} name={learnerName} onClose={() => setCelebrate(null)} />}
    </div>
  )
}

// ── Region screen: party, wild encounters, Keeper challenge ──
function RegionScreen({ region, party, sealed, onWild, onKeeper, onBack }: {
  region: Region
  party: Combatant[]
  sealed: boolean
  onWild: () => void
  onKeeper: () => void
  onBack: () => void
}) {
  const keeper = region.keeper
  return (
    <div className="kq-region">
      <div className="kq-region-top">
        <button className="kq-back" onClick={onBack}>← Map</button>
        <div className="kq-region-title"><span>{region.icon}</span><b>{region.name}</b></div>
        {sealed && <span className="kq-sealed">{region.seal} Seal</span>}
      </div>

      <p className="kq-region-intro">{region.intro}</p>

      {/* party strip */}
      <div className="kq-party">
        {party.map((k, i) => (
          <div key={i} className="kq-party-kin" style={{ ['--kc' as string]: k.color }}>
            <KinSprite render={k.renderKey} color={k.color} size={44} bob={i === 0} />
            <b>{k.name}</b>
            <small>Lv{k.level}</small>
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="kq-region-acts">
        <button className="kq-bigbtn kq-bigbtn-wild" onClick={onWild}>
          <span className="kq-bigbtn-ic">🌿</span>
          <b>Find wild kin</b>
          <small>Battle & befriend · Lv{region.wildLevels[0]}–{region.wildLevels[1]}</small>
        </button>

        {keeper && (
          <button className={`kq-bigbtn kq-bigbtn-keeper${sealed ? ' done' : ''}`} onClick={onKeeper}>
            <span className="kq-bigbtn-ic" style={{ color: ELEMENT_META[keeper.aceElement].color }}>
              {ELEMENT_META[keeper.aceElement].icon}
            </span>
            <b>{sealed ? `Rematch ${keeper.name}` : `Challenge ${keeper.name}`}</b>
            <small>{keeper.title} · {keeper.subject}</small>
          </button>
        )}
      </div>

      {keeper && <p className="kq-keeper-blurb">“{keeper.blurb}”</p>}
    </div>
  )
}

// ── shared celebration overlay ──
function Celebration({ data, name, onClose }: {
  data: { title: string; sub: string; seal?: string }
  name?: string
  onClose: () => void
}) {
  return (
    <div className="kqc-wrap" onClick={onClose}>
      <div className="kqc-card" onClick={e => e.stopPropagation()}>
        <div className="kqc-confetti" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} style={{
              left: `${(i * 61) % 100}%`,
              background: ['#ffd700', '#37a8c4', '#7a4fd0', '#ec4899', '#5ec257'][i % 5],
              animationDelay: `${(i % 5) * 0.12}s`,
            }} />
          ))}
        </div>
        {data.seal && <div className="kqc-seal">{data.seal}</div>}
        <h2 className="kqc-title">{data.title}</h2>
        <p className="kqc-sub">{data.sub}</p>
        <button className="btn btn-primary kqc-btn" onClick={onClose}>
          {name ? `Onward, ${name}! →` : 'Onward! →'}
        </button>
      </div>
    </div>
  )
}
