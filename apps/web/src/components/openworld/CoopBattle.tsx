// ============================================================
//  ARGANTALAB · OPENWORLD · CoopBattle  (REAL multi-device co-op)
//  Two kids in the same circle, on two devices, fight ONE shared kin. The enemy
//  lives in a coop_session row on the server; every hit calls a security-definer
//  RPC that COMPUTES the damage (the client never sends a forgeable number).
//  Supabase Realtime pushes the shared state to both devices, so a teammate's
//  hit (and their hearts) update live here. Questions come from the SAME world
//  drills as solo play, so co-op is still real practice.
// ============================================================

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { World, Item } from '@/data/learn'
import type { DrillItem } from '@/data/drills'
import { DRILLS_BY_WORLD } from '@/data/drills'
import { useAppStore } from '@store/appStore'
import { logLearnEvent } from '@lib/analytics'
import { recordAttempt } from '@lib/adaptive'
import { bumpQuest } from '@lib/quests'
import { earnDiamonds } from '@lib/wallet'
import { markSectionToday } from '@lib/sectionDaily'
import { renderItem } from '@components/learn2/interactions'
import { KIN, kin as kinDef } from '@/data/openworld'
import { coopCreate, coopJoin, coopAct, coopOpen, coopState, subscribeCoop, type CoopState, type CoopOpen } from '@lib/coop'
import { myCircles } from '@lib/cloudAuth'
import { myMounts } from '@lib/mounts'
import { joinPresence, type Peer, type LandCtrl } from '@lib/landPresence'
import KinSprite from './KinSprite'
import AvatarSprite from './AvatarSprite'

const COOP_HP_MULT = 1.4   // a beefier shared foe — you've got backup

function buildQueue(worldKey: string): DrillItem[] {
  const items = (DRILLS_BY_WORLD[worldKey] ?? []).flatMap(d => d.gen()).filter(it => it.type === 'mcq' || it.type === 'type')
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[items[i], items[j]] = [items[j], items[i]] }
  return items
}

class ItemBoundary extends Component<{ children: ReactNode; onSkip: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.warn('[coop] question render failed:', e) }
  render() { return this.state.failed ? <button className="le-check" onClick={this.props.onSkip}>Skip →</button> : this.props.children }
}

export default function CoopBattle({ world, joinSessionId, onExit }: { world: World; joinSessionId?: string; onExit: () => void }) {
  const { activeCircleId, session, addToast, learnerName, resolvedOutfit } = useAppStore()
  const myId = session && session !== 'loading' ? session.user.id : null

  // My equipped mount + my teammates' avatars (shared live via session presence)
  // so both heroes show their cosmetics + mount in the same battle frame.
  const [myMount, setMyMount] = useState<string | undefined>(undefined)
  const [mates, setMates] = useState<Peer[]>([])
  useEffect(() => { myMounts().then(m => setMyMount(m.equipped ?? undefined)) }, [])
  const presCtrl = useRef<LandCtrl | null>(null)

  // Resolve which circle we co-op in: the active one, else the kid's first.
  const [circle, setCircle] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    myCircles().then(cs => { const p = cs.find(c => c.id === activeCircleId) ?? cs[0]; if (p) setCircle({ id: p.id, name: p.name }) })
  }, [activeCircleId])

  const [st, setSt] = useState<CoopState | null>(null)
  const [open, setOpen] = useState<CoopOpen[]>([])

  // Came in from a Home invite → jump straight into that battle.
  useEffect(() => {
    if (joinSessionId && !st) coopJoin(joinSessionId).then(s => { if (s) setSt(s); else addToast('That battle has ended', 'ℹ️') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinSessionId])
  const [queue, setQueue] = useState<DrillItem[]>(() => buildQueue(world.key))
  const [qIdx, setQIdx] = useState(0)
  const [awaitMove, setAwaitMove] = useState(false)   // answered right → pick a move
  const shownAt = useRef(Date.now())
  const rewarded = useRef(false)

  // Wild kin you can host a co-op fight against.
  const wildKin = useMemo(() => KIN.filter(k => k.world === world.key.toLowerCase()), [world.key])

  // Open battles to join in this circle (auto-refresh so a friend's new battle
  // shows up without re-opening the page).
  useEffect(() => {
    if (!circle) return
    coopOpen(circle.id).then(setOpen)
    const t = setInterval(() => coopOpen(circle.id).then(setOpen), 4000)
    return () => clearInterval(t)
  }, [circle])

  // Live-stream the shared state once we're in a session.
  useEffect(() => {
    if (!st?.id) return
    const unsub = subscribeCoop(st.id, () => { coopState(st.id).then(s => { if (s) setSt(s) }) })
    return unsub
  }, [st?.id])

  // Session presence: share my avatar + mount so teammates render as themselves.
  useEffect(() => {
    if (!st?.id || !myId) return
    const me: Peer = { id: myId, name: learnerName, outfit: resolvedOutfit(), mount: myMount }
    const c = joinPresence(`coopv:${st.id}`, me, setMates)
    presCtrl.current = c
    return () => { c.leave(); presCtrl.current = null; setMates([]) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.id, myId])
  useEffect(() => { presCtrl.current?.update({ mount: myMount }) }, [myMount])

  const cosmeticsFor = (id: string): Pick<Peer, 'outfit' | 'mount'> =>
    id === myId ? { outfit: resolvedOutfit(), mount: myMount } : (mates.find(p => p.id === id) ?? {})

  // Host waiting alone → auto-cancel after 2 min (matches the invite TTL). Clears
  // the moment a friend joins (members.length jumps → effect re-runs, no timer).
  const stRef = useRef(st); stRef.current = st
  useEffect(() => {
    if (!st || st.host_id !== myId || st.status !== 'open' || st.members.length >= 2) return
    const t = setTimeout(() => {
      const cur = stRef.current
      if (cur && cur.status === 'open' && cur.members.length < 2) { addToast('No one joined — try again later', '⌛'); onExit() }
    }, 120000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.id, st?.status, st?.members.length, myId])

  // Reward both players once, when the shared enemy falls.
  useEffect(() => {
    if (st?.status === 'won' && !rewarded.current) {
      rewarded.current = true
      const def = kinDef(st.kin_key)
      const tier = def ? ({ common: 1, rare: 2, epic: 3, legendary: 4 }[def.rarity] ?? 1) : 1
      earnDiamonds(10 + tier * 4, 'coop', `coop:${st.kin_key}`)
      bumpQuest('boss'); markSectionToday(world.key, 'openworld')
    }
  }, [st?.status, st?.kin_key, world.key])

  const item = queue[qIdx]
  const drawNext = () => {
    if (qIdx + 1 >= queue.length) { const fresh = buildQueue(world.key); setQueue(fresh); setQIdx(0) }
    else setQIdx(qIdx + 1)
    shownAt.current = Date.now()
  }

  const host = async (kinId: string) => {
    if (!circle) { addToast('Make a circle in your Profile first to play co-op', '👥'); return }
    const def = kinDef(kinId); if (!def) return
    const hp = Math.round(def.baseHp * COOP_HP_MULT)
    const shield = def.gimmick === 'shield3' ? 18 : 0
    const s = await coopCreate(circle.id, kinId, world.key, hp, shield)
    if (s) setSt(s); else addToast('Could not start — run migration_coop.sql in Supabase', '⚠️')
  }
  const join = async (sid: string) => { const s = await coopJoin(sid); if (s) setSt(s); else addToast('Could not join', '⚠️') }

  // Answer → log telemetry. Correct opens the move menu; wrong sends a hit to the
  // server (it decrements MY hearts). The server owns all the numbers.
  const onAnswer = async (correct: boolean) => {
    if (!st || !item) return
    recordAttempt(world.key, item.skill, correct)
    logLearnEvent(item as Item, correct, Date.now() - shownAt.current)
    if (correct) { setAwaitMove(true) }
    else { const s = await coopAct(st.id, 'strike', false); if (s) setSt(s); drawNext() }
  }
  const move = async (m: 'strike' | 'break') => {
    if (!st) return
    setAwaitMove(false)
    const s = await coopAct(st.id, m, true); if (s) setSt(s)
    drawNext()
  }

  // ── LOBBY ─────────────────────────────────────────────
  if (!st) {
    return (
      <div className="le-world">
        <div className="cb-head"><button className="le-check ghost" onClick={onExit}>← Back</button><h3 style={{ color: world.color }}>🤝 {world.name} Co-op</h3></div>

        {/* how it works — co-op is a 2-device thing */}
        <div className="cb-how">
          <b>👫 Co-op is for two devices.</b>
          <span>Pick a foe below to <b>host</b> a battle{circle ? <> in <b>{circle.name}</b></> : null}. Then your friend opens Co-op on <b>their</b> device and taps <b>Join</b> — you’ll fight the same kin together, live.</span>
        </div>

        {!circle && <p className="ig-kc">You need a circle to team up. Make or join one in your <b>Profile</b>, then come back.</p>}

        <div className="section-label">Join a friend’s battle {circle && <span style={{ fontWeight: 400, color: 'var(--t2)', fontSize: 12 }}>· in {circle.name}</span>}</div>
        {open.length > 0 ? (
          <div className="cb-openlist">
            {open.map(o => (
              <button key={o.id} className="cb-openrow" onClick={() => join(o.id)}>
                <KinSprite kin={o.kin_key} size={40} />
                <div><b>{kinDef(o.kin_key)?.name ?? 'Kin'}</b><small>hosted by {o.host} · {o.members} in</small></div>
                <span className="cb-join">Join →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="ig-kc" style={{ margin: '0 0 8px' }}>No open battles yet — host one below, or wait for a friend to host.</p>
        )}

        <div className="section-label">Host a battle <span style={{ fontWeight: 400, color: 'var(--t2)', fontSize: 12 }}>· pick the foe you’ll fight together</span></div>
        <div className="ow-lobby">
          {wildKin.map(k => (
            <button key={k.id} className="ow-kincard" style={{ borderColor: `${k.color}44` }} onClick={() => host(k.id)} disabled={!circle}>
              <span className="ow-kincard-art"><KinSprite kin={k.id} size={64} /></span>
              <div className="ow-kincard-body"><b>{k.name}</b><small>{k.rarity} · a tougher shared foe</small></div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const hpFrac = st.enemy_hp / st.enemy_max_hp
  const def = kinDef(st.kin_key)

  // ── OVER ──────────────────────────────────────────────
  if (st.status !== 'open') {
    const won = st.status === 'won'
    return (
      <div className="le-world cb-over">
        <h2>{won ? '🎉 Victory together!' : '💛 Out of hearts'}</h2>
        <KinSprite kin={st.kin_key} size={120} />
        <p>{won ? 'Your team weakened the kin — great teamwork!' : 'Regroup and try again with your buddy.'}</p>
        <button className="btn btn-primary" onClick={onExit}>Back to KinWorld</button>
      </div>
    )
  }

  // ── BATTLE ────────────────────────────────────────────
  return (
    <div className="le-world cb-battle">
      <div className="cb-head"><button className="le-check ghost" onClick={onExit}>← Leave</button><b style={{ color: world.color }}>🤝 Co-op battle</b></div>

      {/* the shared arena: the foe up top, both heroes (their avatar + mount) below */}
      <div className="cb-arena" style={{ ['--wc' as string]: world.color }}>
        <div className="cb-foe">
          <KinSprite kin={st.kin_key} size={120} bob />
          <div className="cb-foe-bar">
            <div className="ow-hp"><i style={{ width: `${Math.max(0, hpFrac) * 100}%`, background: def?.color ?? '#888' }} /></div>
            {st.enemy_shield > 0 && <span className="cb-shield">🛡️ {st.enemy_shield}</span>}
            <small className="cb-foe-num">{def?.name ?? 'Foe'} · {Math.ceil(st.enemy_hp)}/{st.enemy_max_hp}</small>
          </div>
        </div>

        <div className="cb-party">
          {st.members.map(m => {
            const cos = cosmeticsFor(m.person_id)
            const me = m.person_id === myId
            return (
              <div key={m.person_id} className={`cb-hero${me ? ' me' : ''}`}>
                <AvatarSprite mood="happy" size={88} mount={cos.mount} outfit={cos.outfit} />
                <b>{me ? 'You' : (m.display_name ?? 'Buddy')}</b>
                <span className="cb-hearts">{Array.from({ length: 5 }, (_, i) => <span key={i}>{i < m.hearts ? '❤️' : '🤍'}</span>)}</span>
              </div>
            )
          })}
          {st.members.length < 2 && (
            <div className="cb-hero waiting"><div className="cb-slot">+</div><b>Waiting…</b><small>for a friend</small></div>
          )}
        </div>
      </div>

      {/* question / move menu */}
      {!awaitMove && item && (
        <div className="ow-q cb-q">
          <div className="le-prompt">{item.prompt}</div>
          <div key={item.id} className="le-render"><ItemBoundary onSkip={() => onAnswer(false)}>{renderItem(item as Item, onAnswer)}</ItemBoundary></div>
        </div>
      )}
      {awaitMove && (
        <div className="cb-moves">
          <p className="ow-note">Nice! Land your hit:</p>
          <div className="cb-moves-row">
            <button className="cb-move strike" onClick={() => move('strike')}>⚡ Strike</button>
            {st.enemy_shield > 0 && <button className="cb-move brk" onClick={() => move('break')}>💥 Weakness Break</button>}
          </div>
        </div>
      )}
    </div>
  )
}
