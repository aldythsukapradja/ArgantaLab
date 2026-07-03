// ============================================================
//  ARGANTALAB · KINQUEST · SHELL  (the game router)
//  Full-screen flow: starter select → walkable maps (Seedling Town ↔ the
//  Verdant Path route) → battles, buildings, NPCs, trainers. The overworld
//  is the hub; battles/dialogs/sheets render on top (pausing it). v2 adds:
//  encounter flash transition, a Kin Center that REALLY heals a persistent
//  party, Party + KinBook sheets, route trainers with first-win rewards,
//  a bag of earned items, and an evolution cutscene. Wins still pay real
//  ArgantaLab XP + diamonds.
// ============================================================

import { useMemo, useState, type ReactNode } from 'react'
import { useAppStore } from '@store/appStore'
import { earnDiamonds } from '@lib/wallet'
import { bumpQuest } from '@lib/quests'
import { pkey } from '@lib/player'
import { localDay } from '@lib/day'
import KinSprite from '@components/openworld/KinSprite'
import StarterSelect from './StarterSelect'
import KinQuestTown, { TRAINERS, type ActionTarget } from './KinQuestTown'
import KinBattle, { type BattleResult } from './KinBattle'
import {
  loadSave, chooseStarter, addKin, beatKeeper, beatTrainer, openRegionPaths,
  setPartyHp, healParty, setLead, rewardKin, recordWin, markSeen, grantItem, consumeItem, setMap,
  type KinQuestSave,
} from '@lib/kinquest/save'
import { combatantFromParty, makeWildEnemy, makeCombatant, maxHpFor } from '@lib/kinquest/party'
import { xpToNext } from '@lib/kinquest/growth'
import { ITEMS } from '@lib/kinquest/items'
import type { Combatant } from '@lib/kinquest/battle'
import { REGION_BY_ID, ELEMENT_META, tierForBond, evolvedName, evolvesAt } from '@/data/kinquest'
import type { Region } from '@/data/kinquest'
import { kinForWorld, kin as kinDef } from '@/data/openworld'

// The starter chapter maps to Numeria — a maths Gym (Keeper Mira).
const TOWN_REGION = 'num'

interface BattleCfg { enemyTeam: Combatant[]; isKeeper: boolean; keeperName?: string; trainerId?: string }
interface Dialog { emoji: string; who: string; lines: string[]; actions?: { label: string; onClick: () => void }[] }
interface Celeb { title: string; sub: string; seal?: string }
interface Evolve { render: string; color: string; from: string; to: string }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

const FREEBIE_KEY = 'argantalab_kq_freebie_v1'

export default function KinQuestShell() {
  const stage = useAppStore(s => s.stageKey)
  const learnerName = useAppStore(s => s.learnerName)
  const addXp = useAppStore(s => s.addXp)
  const addToast = useAppStore(s => s.addToast)
  const closeKinQuest = useAppStore(s => s.closeKinQuest)

  const [save, setSave] = useState<KinQuestSave>(() => loadSave())
  const [started, setStarted] = useState(() => loadSave().started)
  const [mapId, setMapId] = useState(() => loadSave().currentMap || 'town')
  const [spawn, setSpawn] = useState<{ c: number; r: number } | undefined>(undefined)
  const [battle, setBattle] = useState<BattleCfg | null>(null)
  const [flash, setFlash] = useState(false)
  const [healFx, setHealFx] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [sheet, setSheet] = useState<'none' | 'party' | 'kinbook'>('none')
  const [evolve, setEvolve] = useState<Evolve | null>(null)
  const [celebrate, setCelebrate] = useState<Celeb | null>(null)

  const region = REGION_BY_ID[TOWN_REGION]
  const party = useMemo(() => save.party.map(combatantFromParty), [save])
  const partyGrowth = useMemo(() => save.party.map(k => ({ level: k.level, xp: k.xp ?? 0 })), [save])
  const sealed = save.seals.includes(TOWN_REGION)
  const allFainted = party.length > 0 && party.every(k => k.hp <= 0)

  // ── starter ──
  const onStarter = (render: string) => {
    setSave(chooseStarter(render))
    setStarted(true)
    addToast('Welcome to Seedling Town! 🌱', '⭐')
  }

  // ── encounter builders (behind the flash transition) ──
  const launchBattle = (cfg: BattleCfg) => {
    if (allFainted) { addToast('Your kin need rest — visit the Kin Center! 💫', '➕'); return }
    setDialog(null)
    setFlash(true)
    setTimeout(() => { setBattle(cfg); setFlash(false) }, 680)
  }

  const startWild = () => {
    const all = kinForWorld(region.kinWorld)
    const roster = mapId === 'route'
      ? all.filter(k => k.rarity === 'common' || k.rarity === 'rare')
      : all.filter(k => k.rarity === 'common')
    const enemyDef = pick(roster.length ? roster : all)
    const render = enemyDef.id.replace('kin:', '')
    const lvl = mapId === 'route' ? ri(5, 8) : ri(3, 5)
    setSave(markSeen([render]))
    launchBattle({ enemyTeam: [makeWildEnemy(render, lvl)], isKeeper: false })
  }
  const startGym = () => {
    if (!region.keeper) return
    const team = region.keeper.team.map((r, i) => makeCombatant(r, region.wildLevels[0] + i * 2, 0, { asTier: true }))
    setSave(markSeen(region.keeper.team))
    launchBattle({ enemyTeam: team, isKeeper: true, keeperName: region.keeper.name })
  }
  const startTrainer = (id: string) => {
    const td = TRAINERS[id]
    if (!td) return
    const team = td.team.map(([r, lvl]) => makeCombatant(r, lvl, 0, { asTier: true }))
    setSave(markSeen(td.team.map(([r]) => r)))
    launchBattle({ enemyTeam: team, isKeeper: true, keeperName: td.name, trainerId: id })
  }

  // ── building / NPC / exit interactions ──
  const onAction = (t: ActionTarget) => {
    if (t.kind === 'exit') { onExit(t.id); return }
    if (t.kind === 'trainer') { onTrainerTalk(t.id); return }
    switch (t.id) {
      case 'center': onKinCenter(); break
      case 'market': onMarket(); break
      case 'lab':
        setDialog({ emoji: '🔬', who: 'Prof. Sage', lines: [
          `Ah, ${learnerName || 'traveler'}! How goes the quest?`,
          'Wild kin hide in the tall grass — weaken one, then Befriend it. Your KinBook 📖 remembers every kin you meet.',
          'The Verdant Path north of town has stronger kin and challengers. Rest your party at the Kin Center before you go!',
        ] })
        break
      case 'gym':
        setDialog({ emoji: ELEMENT_META[region.keeper!.aceElement].icon, who: `Keeper ${region.keeper!.name}`, lines: [
          `${region.keeper!.title} · ${region.keeper!.subject}.`,
          sealed ? 'Back for a rematch? Show me your growth!' : `"${region.keeper!.blurb}"`,
        ], actions: [{ label: sealed ? '⚔ Rematch' : '⚔ Challenge!', onClick: startGym }] })
        break
      case 'house1':
        setDialog({ emoji: '🧑', who: 'Townsfolk', lines: ['A kin grows stronger the more you battle together — watch its XP bar fill, and one day it EVOLVES!'] })
        break
      case 'house2':
        setDialog({ emoji: '👵', who: 'Grandma Willow', lines: ['Type matters, dear. Pattern beats Order, Order beats Truth… learn the wheel by playing and you\'ll hit for extra!'] })
        break
      case 'npc_guide':
        setDialog({ emoji: '🧒', who: 'Pip', lines: ['Hi! The tall grass 🌿 hides wild kin. And I saw TWO challengers up on the Verdant Path — they battle anyone who gets close!'] })
        break
      case 'npc_elder':
        setDialog({ emoji: '🧓', who: 'Old Rowan', lines: [`Keeper ${region.keeper!.name} tests your ${region.keeper!.subject.toLowerCase()}. Answer true and her shields shatter!`] })
        break
    }
  }

  const onExit = (id: string) => {
    if (id === 'exit_route') {
      setSave(setMap('route')); setMapId('route'); setSpawn({ c: 13, r: 40 })
      addToast('🌿 The Verdant Path — wild kin ahead!', '🌿')
    } else if (id === 'exit_town') {
      setSave(setMap('town')); setMapId('town'); setSpawn({ c: 26, r: 3 })
      addToast('🏘 Back in Seedling Town', '🏘')
    } else if (id === 'gate_north') {
      setDialog({ emoji: '🚧', who: 'North Gate', lines: [
        sealed ? 'The road to Wordveil is being cleared — a new region opens soon! ✨'
               : `The gate is sealed. Beat Keeper ${region.keeper!.name} at the Gym to earn passage!`,
      ] })
    }
  }

  const onTrainerTalk = (id: string) => {
    const td = TRAINERS[id]
    if (!td) return
    const beaten = save.trainersBeaten.includes(id)
    setDialog({
      emoji: td.emoji, who: td.name,
      lines: [beaten ? td.beaten : td.intro],
      actions: [{ label: beaten ? '⚔ Rematch' : '⚔ Battle!', onClick: () => startTrainer(id) }],
    })
  }

  const onKinCenter = () => {
    const hurt = save.party.some(k => {
      const max = maxHpFor(k.render, k.level, tierForBond(k.bond))
      return k.hp != null && k.hp < max
    })
    if (!hurt) {
      setDialog({ emoji: '➕', who: 'Kin Center', lines: ['Nurse Fern: Your kin look bright-eyed and rested already! Come back after a big adventure. ✨'] })
      return
    }
    setDialog(null)
    setHealFx(true)
    setTimeout(() => {
      const { save: s } = healParty()
      setSave(s)
      setHealFx(false)
      addToast('Your kin are fully rested! ✨', '💖')
    }, 1500)
  }

  const onMarket = () => {
    const key = pkey(FREEBIE_KEY)
    let last = ''
    try { last = localStorage.getItem(key) || '' } catch { /* ignore */ }
    if (last === localDay()) {
      setDialog({ emoji: '🛒', who: 'Market', lines: ['Shopkeeper Bramble: You\'ve had today\'s freebie — come back tomorrow! 🌅'] })
      return
    }
    setDialog({
      emoji: '🛒', who: 'Market',
      lines: ['Shopkeeper Bramble: Fresh from the grove — a Berry Juice and a Bond Berry, on the house! 🎁'],
      actions: [{
        label: '🎁 Take today\'s freebie', onClick: () => {
          try { localStorage.setItem(key, localDay()) } catch { /* ignore */ }
          grantItem('potion', 1)
          setSave(grantItem('berry', 1))
          addToast('+1 🧃 Berry Juice · +1 🫐 Bond Berry', '🎁')
          setDialog(null)
        },
      }],
    })
  }

  // ── resolve a finished battle ──
  const onBattleEnd = (r: BattleResult) => {
    const cfg = battle
    setBattle(null)

    // 1 · damage always persists (Pokémon rules: fled or lost, you keep the bruises)
    let s = setPartyHp(r.partyHp)

    // 2 · kin XP + bond for wins/befriends; check for an evolution moment
    let evolved: Evolve | null = null
    if (r.outcome === 'win' || r.outcome === 'befriended') {
      const lastIdx = r.xpEvents.length ? r.xpEvents[r.xpEvents.length - 1].idx : 0
      for (let i = 0; i < r.xpEvents.length; i++) {
        const ev = r.xpEvents[i]
        const kin = s.party[ev.idx]
        const beforeTier = kin ? tierForBond(kin.bond) : 0
        const bond = ev.idx === lastIdx && i === r.xpEvents.length - 1 ? 6 : 0
        const out = rewardKin(ev.idx, ev.gained, bond)
        s = out.save
        const after = s.party[ev.idx]
        if (after && evolvesAt(after.render, beforeTier, tierForBond(after.bond))) {
          const def = kinDef(`kin:${after.render}`)
          evolved = {
            render: after.render, color: def?.color ?? '#8b5cf6',
            from: evolvedName(after.render, beforeTier), to: evolvedName(after.render, tierForBond(after.bond)),
          }
        }
      }
    }
    setSave(s)

    if (r.outcome === 'fled') return
    if (r.outcome === 'lose') { addToast('Your kin fainted! Rest at the Kin Center. 💫', '💫'); return }

    if (r.outcome === 'befriended' && r.befriendedRender) {
      const def = kinDef(`kin:${r.befriendedRender}`)
      setSave(addKin(r.befriendedRender, def?.world ?? region.kinWorld, r.enemyMaxLevel))
      recordWin()
      earnDiamonds(8, 'openworld', `kinquest:befriend:${r.befriendedRender}`)
      addXp(12)
      setCelebrate({ title: 'New friend!', sub: `${def?.name ?? 'A kin'} joined your party! 💗`, seal: '🐾' })
      return
    }

    // a win
    recordWin()
    if (cfg?.trainerId) {
      const td = TRAINERS[cfg.trainerId]
      const first = !save.trainersBeaten.includes(cfg.trainerId)
      setSave(beatTrainer(cfg.trainerId))
      bumpQuest('boss')
      if (first && td) {
        setSave(grantItem(td.rewardItem, 1))
        earnDiamonds(td.diamonds, 'openworld', `kinquest:trainer:${td.id}`)
        addXp(25)
        setCelebrate({ title: `${td.name} defeated!`, sub: `You won ${td.diamonds} 💎 and a ${ITEMS.find(i => i.id === td.rewardItem)?.name ?? 'prize'}!`, seal: '🎖' })
      } else {
        addXp(10)
        addToast(`${td?.name ?? 'The challenger'} bested again!`, '🎖')
      }
    } else if (cfg?.isKeeper && region.keeper) {
      const already = sealed
      setSave(beatKeeper(region.id))
      bumpQuest('boss')
      if (!already) {
        setSave(grantItem('potion', 1))
        earnDiamonds(50, 'openworld', `kinquest:keeper:${region.id}`)
        addXp(60)
        setCelebrate({ title: `${region.keeper.name} defeated!`, sub: `You earned the ${region.name} Gym Seal — the North Gate stirs…`, seal: region.seal })
      } else {
        earnDiamonds(12, 'openworld', `kinquest:rematch:${region.id}`)
        addXp(20)
        addToast(`${region.keeper.name} bested again!`, region.seal)
      }
    } else {
      // wild win
      earnDiamonds(6, 'openworld', `kinquest:wild:${region.id}`)
      addXp(15)
      const { opened } = !region.keeper ? openRegionPaths(region.id) : { opened: [] as string[] }
      if (opened.length) setCelebrate({ title: 'The map opens!', sub: `New paths opened: ${opened.join(' & ')}!`, seal: '🗺️' })
    }

    if (evolved) setEvolve(evolved)
  }

  const overlayUp = !!battle || !!dialog || flash || healFx || sheet !== 'none' || !!evolve || !!celebrate
  const closeBtn = <button className="kq-close" onClick={closeKinQuest} aria-label="Close KinQuest">✕</button>

  // ══════════════ RENDER ══════════════
  if (!started) {
    return <div className="screen kq-page">{closeBtn}<StarterSelect onChoose={onStarter} /></div>
  }

  return (
    <div className="screen kq-page kq-town-page">
      {closeBtn}

      {/* HUD */}
      <div className="kqt-hud">
        <button className="kqt-hud-chip" onClick={() => setSheet('party')}>🐾 Party</button>
        <button className="kqt-hud-chip" onClick={() => setSheet('kinbook')}>📖 KinBook</button>
        <span className="kqt-hud-chip dim">{sealed ? `${region.seal} 1/1` : '⬜ 0/1'}</span>
        {allFainted && <span className="kqt-hud-chip warn">💫 Rest needed!</span>}
      </div>

      {/* the walkable overworld — paused whenever anything is on top */}
      <KinQuestTown
        key={mapId}
        map={mapId}
        spawn={spawn}
        paused={overlayUp}
        gymElement={region.keeper!.aceElement}
        gymSealed={sealed}
        trainersBeaten={save.trainersBeaten}
        onAction={onAction}
        onEncounter={startWild}
      />

      {/* encounter flash transition */}
      {flash && <div className="kq-flash" aria-hidden><i /><i /><i /></div>}

      {/* Kin Center heal effect */}
      {healFx && (
        <div className="kq-heal" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <span key={i} style={{ left: `${12 + (i * 61) % 76}%`, animationDelay: `${(i % 4) * 0.16}s` }}>💖</span>)}
          <b>Resting your kin…</b>
        </div>
      )}

      {/* battle overlay */}
      {battle && (
        <div className="kqt-overlay">
          <KinBattle
            region={region}
            stage={stage}
            playerParty={party}
            partyGrowth={partyGrowth}
            enemyTeam={battle.enemyTeam}
            isKeeper={battle.isKeeper}
            keeperName={battle.keeperName}
            bag={save.bag}
            onUseItem={(id) => { const ok = consumeItem(id); if (ok) setSave(loadSave()); return ok }}
            onEnd={onBattleEnd}
          />
        </div>
      )}

      {/* dialogue box */}
      {dialog && !battle && <Dialogue data={dialog} onClose={() => setDialog(null)} />}

      {/* party / kinbook sheets */}
      {sheet === 'party' && <PartySheet save={save} onLead={i => setSave(setLead(i))} onClose={() => setSheet('none')} />}
      {sheet === 'kinbook' && <KinBook save={save} onClose={() => setSheet('none')} />}

      {/* evolution cutscene */}
      {evolve && <EvolveScene data={evolve} onClose={() => setEvolve(null)} />}

      {celebrate && <Celebration data={celebrate} name={learnerName} onClose={() => setCelebrate(null)} />}
    </div>
  )
}

// ── Pokémon-style dialogue box ──
// Speaker portraits (PixelLab pixel art) keyed by display name — falls back to
// the emoji when a speaker has no portrait yet (e.g. future regions' Keepers).
const NPC_DIR = '/assets/kinquest/npcs'
const PORTRAITS: Record<string, string> = {
  'Prof. Sage': `${NPC_DIR}/sage.png`, 'Pip': `${NPC_DIR}/pip.png`, 'Old Rowan': `${NPC_DIR}/rowan.png`,
  'Grandma Willow': `${NPC_DIR}/willow.png`, 'Townsfolk': `${NPC_DIR}/townsfolk.png`,
  'Bug Kid Milo': `${NPC_DIR}/milo.png`, 'Scout Vera': `${NPC_DIR}/vera.png`,
  'Kin Center': `${NPC_DIR}/fern.png`, 'Market': `${NPC_DIR}/bramble.png`, 'Keeper Mira': `${NPC_DIR}/mira.png`,
}
function Dialogue({ data, onClose }: { data: Dialog; onClose: () => void }) {
  const [i, setI] = useState(0)
  const last = i >= data.lines.length - 1
  const portrait = PORTRAITS[data.who]
  return (
    <div className="kqd-wrap" onClick={() => { if (!last) setI(i + 1) }}>
      <div className="kqd-box" onClick={e => e.stopPropagation()}>
        <div className="kqd-head">
          {portrait ? <img className="kqd-portrait" src={portrait} alt="" /> : <span className="kqd-emoji">{data.emoji}</span>}
          <b>{data.who}</b>
        </div>
        <p className="kqd-line">{data.lines[i]}</p>
        <div className="kqd-foot">
          {!last ? (
            <button className="kqd-next" onClick={() => setI(i + 1)}>Next ▸</button>
          ) : data.actions?.length ? (
            <div className="kqd-actions">
              {data.actions.map((a, k) => <button key={k} className="btn btn-primary kqd-act" onClick={a.onClick}>{a.label}</button>)}
              <button className="kqd-close" onClick={onClose}>Close</button>
            </div>
          ) : (
            <button className="kqd-next" onClick={onClose}>Got it ✓</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Party sheet: hp/xp/bond per kin, set the lead ──
function PartySheet({ save, onLead, onClose }: { save: KinQuestSave; onLead: (i: number) => void; onClose: () => void }) {
  return (
    <div className="kqs-wrap" onClick={onClose}>
      <div className="kqs-panel" onClick={e => e.stopPropagation()}>
        <div className="kqs-head"><b>🐾 Your party</b><button className="kqs-x" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="kqs-list">
          {save.party.map((k, i) => {
            const tier = tierForBond(k.bond)
            const max = maxHpFor(k.render, k.level, tier)
            const hp = Math.min(k.hp ?? max, max)
            const def = kinDef(`kin:${k.render}`)
            const hpPct = Math.round((hp / max) * 100)
            const hue = hpPct > 50 ? '#3de08a' : hpPct > 22 ? '#ffc24b' : '#ff5d5d'
            return (
              <div key={i} className={`kqs-kin${i === 0 ? ' lead' : ''}${hp <= 0 ? ' out' : ''}`}>
                <span className="kqs-art"><KinSprite render={k.render} color={def?.color} size={52} bob={i === 0 && hp > 0} /></span>
                <div className="kqs-meta">
                  <div className="kqs-name"><b>{evolvedName(k.render, tier)}</b><small>Lv{k.level}{tier > 0 ? ` · ${'★'.repeat(tier)}` : ''}{i === 0 ? ' · lead' : ''}</small></div>
                  <div className="kqs-bar"><i style={{ width: `${hpPct}%`, background: hue }} /></div>
                  <div className="kqs-sub">
                    <span>{hp <= 0 ? '💫 fainted' : `${hp}/${max} HP`}</span>
                    <span className="kqs-xp"><i style={{ width: `${Math.min(100, Math.round(((k.xp ?? 0) / xpToNext(k.level)) * 100))}%` }} /></span>
                    <span>💗 {k.bond}</span>
                  </div>
                </div>
                {i > 0 && hp > 0 && <button className="kqs-lead" onClick={() => onLead(i)}>Lead</button>}
              </div>
            )
          })}
        </div>
        <div className="kqs-bag">
          {ITEMS.map(it => <span key={it.id} className="kqs-item">{it.emoji} ×{save.bag[it.id] ?? 0}</span>)}
        </div>
      </div>
    </div>
  )
}

// ── KinBook: caught in colour · seen as silhouettes · unknown as ??? ──
function KinBook({ save, onClose }: { save: KinQuestSave; onClose: () => void }) {
  const roster = kinForWorld(TOWN_REGION)
  const caught = new Set(save.party.map(k => k.render))
  const seen = new Set(save.seen)
  const n = roster.filter(k => caught.has(k.id.replace('kin:', ''))).length
  return (
    <div className="kqs-wrap" onClick={onClose}>
      <div className="kqs-panel" onClick={e => e.stopPropagation()}>
        <div className="kqs-head"><b>📖 KinBook · Numeria</b><span className="kqs-count">{n}/{roster.length}</span><button className="kqs-x" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="kqbk-grid">
          {roster.map((k, i) => {
            const render = k.id.replace('kin:', '')
            const isCaught = caught.has(render)
            const isSeen = seen.has(render)
            return (
              <div key={k.id} className={`kqbk-cell${isCaught ? ' caught' : isSeen ? ' seen' : ''}`}>
                <span className="kqbk-no">#{String(i + 1).padStart(2, '0')}</span>
                {isCaught || isSeen ? (
                  <span className={`kqbk-art${isSeen && !isCaught ? ' sil' : ''}`}><KinSprite render={render} color={k.color} size={54} /></span>
                ) : (
                  <span className="kqbk-unknown">?</span>
                )}
                <small>{isCaught ? k.name : isSeen ? '???' : '· · ·'}</small>
              </div>
            )
          })}
        </div>
        <p className="kqs-note">Weaken a wild kin, then Befriend it to fill your KinBook!</p>
      </div>
    </div>
  )
}

// ── evolution cutscene: silhouette pulse → flash → reveal ──
function EvolveScene({ data, onClose }: { data: Evolve; onClose: () => void }) {
  const [phase, setPhase] = useState<'charge' | 'reveal'>('charge')
  useState(() => { setTimeout(() => setPhase('reveal'), 2100) })
  return (
    <div className="kqe-wrap">
      <div className="kqe-stage">
        <span className={`kqe-art ${phase}`}><KinSprite render={data.render} color={data.color} size={128} /></span>
        {phase === 'charge'
          ? <p className="kqe-text">What…? {data.from} is changing!</p>
          : (
            <>
              <h2 className="kqe-title">✨ {data.from} evolved into {data.to}!</h2>
              <button className="btn btn-primary kqe-btn" onClick={onClose}>Amazing! →</button>
            </>
          )}
      </div>
    </div>
  )
}

// ── shared celebration overlay ──
function Celebration({ data, name, onClose }: { data: Celeb; name?: string; onClose: () => void }): ReactNode {
  return (
    <div className="kqc-wrap" onClick={onClose}>
      <div className="kqc-card" onClick={e => e.stopPropagation()}>
        <div className="kqc-confetti" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 61) % 100}%`, background: ['#ffd700', '#37a8c4', '#7a4fd0', '#ec4899', '#5ec257'][i % 5], animationDelay: `${(i % 5) * 0.12}s` }} />
          ))}
        </div>
        {data.seal && <div className="kqc-seal">{data.seal}</div>}
        <h2 className="kqc-title">{data.title}</h2>
        <p className="kqc-sub">{data.sub}</p>
        <button className="btn btn-primary kqc-btn" onClick={onClose}>{name ? `Onward, ${name}! →` : 'Onward! →'}</button>
      </div>
    </div>
  )
}
