// ============================================================
//  ARGANTALAB · KINQUEST · SHELL  (the game router)
//  Full-screen flow: starter select → walkable Seedling Town → battles,
//  building visits, and NPC chats. The town is the hub; battles/dialogs
//  render on top (pausing the town). Wins pay real ArgantaLab XP + diamonds.
// ============================================================

import { useMemo, useState, type ReactNode } from 'react'
import { useAppStore } from '@store/appStore'
import { earnDiamonds } from '@lib/wallet'
import { bumpQuest } from '@lib/quests'
import { pkey } from '@lib/player'
import { localDay } from '@lib/day'
import StarterSelect from './StarterSelect'
import KinQuestTown, { type ActionTarget } from './KinQuestTown'
import KinBattle, { type BattleResult } from './KinBattle'
import {
  loadSave, chooseStarter, rewardParty, addKin, beatKeeper,
  type KinQuestSave,
} from '@lib/kinquest/save'
import { combatantFromParty, makeWildEnemy, makeCombatant } from '@lib/kinquest/party'
import type { Combatant } from '@lib/kinquest/battle'
import { REGION_BY_ID, ELEMENT_META, tierForBond, evolvedName, evolvesAt } from '@/data/kinquest'
import { kinForWorld, kin as kinDef } from '@/data/openworld'

// The single starter town maps to Numeria — a maths Gym (Keeper Mira).
const TOWN_REGION = 'num'

interface BattleCfg { enemyTeam: Combatant[]; isKeeper: boolean; keeperName?: string }
interface Dialog { emoji: string; who: string; lines: string[]; actions?: { label: string; onClick: () => void }[] }
interface Celeb { title: string; sub: string; seal?: string }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

const BERRY_KEY = 'argantalab_kq_berry_v1'

export default function KinQuestShell() {
  const stage = useAppStore(s => s.stageKey)
  const learnerName = useAppStore(s => s.learnerName)
  const addXp = useAppStore(s => s.addXp)
  const addToast = useAppStore(s => s.addToast)
  const closeKinQuest = useAppStore(s => s.closeKinQuest)

  const [save, setSave] = useState<KinQuestSave>(() => loadSave())
  const [started, setStarted] = useState(() => loadSave().started)
  const [battle, setBattle] = useState<BattleCfg | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [celebrate, setCelebrate] = useState<Celeb | null>(null)

  const region = REGION_BY_ID[TOWN_REGION]
  const party = useMemo(() => save.party.map(combatantFromParty), [save])
  const sealed = save.seals.includes(TOWN_REGION)

  // ── starter ──
  const onStarter = (render: string) => {
    setSave(chooseStarter(render))
    setStarted(true)
    addToast('Welcome to Seedling Town! 🌱', '⭐')
  }

  // ── build encounters ──
  const startWild = () => {
    // wild encounters are common/rare kin only — epics/legendaries are Keeper aces
    const all = kinForWorld(region.kinWorld)
    const roster = all.filter(k => k.rarity === 'common' || k.rarity === 'rare')
    const enemyDef = pick(roster.length ? roster : all)
    const render = enemyDef.id.replace('kin:', '')
    const lvl = ri(region.wildLevels[0], region.wildLevels[1])
    setBattle({ enemyTeam: [makeWildEnemy(render, lvl)], isKeeper: false })
    setDialog(null)
  }
  const startGym = () => {
    if (!region.keeper) return
    const team = region.keeper.team.map((r, i) => makeCombatant(r, region.wildLevels[0] + i * 2, 0, { asTier: true }))
    setBattle({ enemyTeam: team, isKeeper: true, keeperName: region.keeper.name })
    setDialog(null)
  }

  // ── building / NPC interactions ──
  const onAction = (t: ActionTarget) => {
    switch (t.id) {
      case 'center':
        setDialog({ emoji: '➕', who: 'Kin Center', lines: ['Nurse Fern: Welcome! Let me tend your kin…', 'Your whole party is fully rested and ready to go! ✨'] })
        break
      case 'market':
        onMarket()
        break
      case 'lab':
        setDialog({ emoji: '🔬', who: "Prof. Sage", lines: [
          `Ah, ${learnerName || 'traveler'}! Welcome to KinQuest.`,
          'Wade into the tall grass to meet wild kin — weaken one, then Befriend it to grow your party.',
          'When you feel ready, challenge the Gym Keeper. Answer her questions to power your attacks!',
        ] })
        break
      case 'gym':
        setDialog({ emoji: ELEMENT_META[region.keeper!.aceElement].icon, who: `Keeper ${region.keeper!.name}`, lines: [
          `${region.keeper!.title} · ${region.keeper!.subject}.`,
          sealed ? 'Back for a rematch? Show me your growth!' : `"${region.keeper!.blurb}"`,
        ], actions: [{ label: sealed ? '⚔ Rematch' : '⚔ Challenge!', onClick: startGym }] })
        break
      case 'house1':
        setDialog({ emoji: '🧑', who: 'Townsfolk', lines: ['A kin grows stronger the more you battle together — its Bond rises, and one day it EVOLVES!'] })
        break
      case 'house2':
        setDialog({ emoji: '👵', who: 'Grandma Willow', lines: ['Type matters, dear. Pattern beats Order, Order beats Truth… learn the wheel by playing and you\'ll hit for extra!'] })
        break
      case 'npc_guide':
        setDialog({ emoji: '🧒', who: 'Pip', lines: ['Hi! Try the tall grass over there 🌿 — that\'s where wild kin hide. Befriend one to fill your KinBook!'] })
        break
      case 'npc_elder':
        setDialog({ emoji: '🧓', who: 'Old Rowan', lines: [`Keeper ${region.keeper!.name} tests your ${region.keeper!.subject.toLowerCase()}. Answer true and her shields shatter!`] })
        break
    }
  }

  const onMarket = () => {
    const key = pkey(BERRY_KEY)
    let last = ''
    try { last = localStorage.getItem(key) || '' } catch { /* ignore */ }
    if (last === localDay()) {
      setDialog({ emoji: '🛒', who: 'Market', lines: ['Shopkeeper Bramble: You\'ve had your Bond Berry today — come back tomorrow! 🫐'] })
      return
    }
    setDialog({
      emoji: '🛒', who: 'Market',
      lines: ['Shopkeeper Bramble: A fresh Bond Berry, on the house! It deepens your lead kin\'s bond. 🫐'],
      actions: [{
        label: '🫐 Take Bond Berry (+10 bond)', onClick: () => {
          try { localStorage.setItem(key, localDay()) } catch { /* ignore */ }
          const s = rewardParty(10, 0)
          setSave(s)
          maybeEvolve(save.party[0], s.party[0])
          addToast('+10 bond · your kin feels closer!', '🫐')
          setDialog(null)
        },
      }],
    })
  }

  // shared evolution check after a bond gain
  const maybeEvolve = (before?: { render: string; bond: number }, after?: { render: string; bond: number }) => {
    if (!before || !after) return
    const bt = tierForBond(before.bond), at = tierForBond(after.bond)
    if (evolvesAt(before.render, bt, at)) {
      setCelebrate({ title: 'Evolution!', sub: `${evolvedName(before.render, bt)} evolved into ${evolvedName(after.render, at)}!` })
    }
  }

  // ── resolve a finished battle ──
  const onBattleEnd = (r: BattleResult) => {
    const wasKeeper = battle?.isKeeper
    setBattle(null)

    if (r.outcome === 'fled') return
    if (r.outcome === 'lose') { addToast('Your kin fainted! Rest at the Kin Center. 💫', '💫'); return }

    if (r.outcome === 'befriended' && r.befriendedRender) {
      const def = kinDef(`kin:${r.befriendedRender}`)
      setSave(addKin(r.befriendedRender, def?.world ?? region.kinWorld, r.enemyMaxLevel))
      earnDiamonds(8, 'openworld', `kinquest:befriend:${r.befriendedRender}`)
      addXp(12)
      setCelebrate({ title: 'New friend!', sub: `${def?.name ?? 'A kin'} joined your party! 💗`, seal: '🐾' })
      return
    }

    // a win
    if (wasKeeper && region.keeper) {
      const already = sealed
      setSave(beatKeeper(region.id))
      bumpQuest('boss')
      if (!already) {
        earnDiamonds(50, 'openworld', `kinquest:keeper:${region.id}`)
        addXp(60)
        setCelebrate({ title: `${region.keeper.name} defeated!`, sub: `You earned the ${region.name} Gym Seal! Your kin honour your victory.`, seal: region.seal })
      } else {
        earnDiamonds(12, 'openworld', `kinquest:rematch:${region.id}`)
        addXp(20)
        addToast(`${region.keeper.name} bested again!`, region.seal)
      }
      return
    }

    // wild win → grow the lead kin
    const lead = save.party[0]
    const s = rewardParty(6, Math.random() < 0.5 ? 1 : 0)
    setSave(s)
    earnDiamonds(6, 'openworld', `kinquest:wild:${region.id}`)
    addXp(15)
    if (lead && evolvesAt(lead.render, tierForBond(lead.bond), tierForBond(s.party[0].bond))) {
      maybeEvolve(lead, s.party[0])
    } else {
      addToast('+15 XP · your kin grew stronger!', '✨')
    }
  }

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
        <span className="kqt-hud-chip">🐾 {save.party.length}</span>
        <span className="kqt-hud-chip">{sealed ? region.seal : '⬜'} {sealed ? 1 : 0}/1 Seal</span>
      </div>

      {/* the walkable town — paused whenever a battle/dialog is on top */}
      <KinQuestTown
        paused={!!battle || !!dialog}
        gymElement={region.keeper!.aceElement}
        gymSealed={sealed}
        onAction={onAction}
        onEncounter={startWild}
      />

      {/* battle overlay */}
      {battle && (
        <div className="kqt-overlay">
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
      )}

      {/* dialogue box */}
      {dialog && !battle && (
        <Dialogue data={dialog} onClose={() => setDialog(null)} />
      )}

      {celebrate && <Celebration data={celebrate} name={learnerName} onClose={() => setCelebrate(null)} />}
    </div>
  )
}

// ── Pokémon-style dialogue box ──
function Dialogue({ data, onClose }: { data: Dialog; onClose: () => void }) {
  const [i, setI] = useState(0)
  const last = i >= data.lines.length - 1
  return (
    <div className="kqd-wrap" onClick={() => { if (!last) setI(i + 1) }}>
      <div className="kqd-box" onClick={e => e.stopPropagation()}>
        <div className="kqd-head"><span className="kqd-emoji">{data.emoji}</span><b>{data.who}</b></div>
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
