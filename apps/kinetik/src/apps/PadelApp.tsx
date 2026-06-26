import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials, todayISO } from '@data/energy'
import { padel, type PadelSession, type PadelPlayer, type PadelMatch } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'
import { CountUp } from './ui'

const ACCENT: [string, string] = ['#2F6BFF', '#54C7EC']
const TABS: AppTab[] = [{ key: 'setup', label: 'Setup' }, { key: 'players', label: 'Players' }, { key: 'matches', label: 'Matches' }, { key: 'board', label: 'Board' }]
const FORMATS = ['Americano', 'Mexicano', 'Fixed pairs']
const errMsg = (e: unknown) => (e && typeof e === 'object' ? String((e as any).message || JSON.stringify(e)) : String(e))

function generate(players: PadelPlayer[], courts: number): Omit<PadelMatch, 'id' | 'sessionId' | 'status'>[] {
  if (players.length < 4) return []
  const rounds = Math.max(3, players.length - 1)
  const out: Omit<PadelMatch, 'id' | 'sessionId' | 'status'>[] = []
  let no = 1
  for (let r = 0; r < rounds; r++) {
    const s = [...players].sort(() => Math.random() - 0.5)
    for (let c = 0; c < courts && c * 4 + 4 <= s.length; c++) {
      const g = s.slice(c * 4, c * 4 + 4)
      out.push({ court: c + 1, matchNo: no++, teamA: [g[0].id, g[1].id], teamB: [g[2].id, g[3].id], scoreA: null, scoreB: null })
    }
  }
  return out
}

export default function PadelApp({ onClose }: { onClose: () => void }) {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const addEvent = useDataStore(s => s.addEvent)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const cid = circle?.id ?? ''
  const members = useMemo(() => people.filter(p => circle && circle.memberIds.includes(p.id)), [people, circle])

  const [session, setSession] = useState<PadelSession | null>(null)
  const [players, setPlayers] = useState<PadelPlayer[]>([])
  const [matches, setMatches] = useState<PadelMatch[]>([])
  const [tab, setTab] = useState('setup')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1700) }

  useEffect(() => {
    if (!cid) return
    padel.sessions(cid).then(async ss => {
      let s = ss[0]
      if (!s) s = await padel.createSession(cid, {})
      setSession(s)
      padel.players(s.id).then(setPlayers).catch(() => {})
      padel.matches(s.id).then(setMatches).catch(() => {})
    }).catch(() => {})
  }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const reloadP = () => session && padel.players(session.id).then(setPlayers).catch(() => {})
  const reloadM = () => session && padel.matches(session.id).then(setMatches).catch(() => {})
  const patch = (p: Partial<PadelSession>) => { if (!session) return; const next = { ...session, ...p }; setSession(next); padel.updateSession(session.id, p).catch(() => {}) }

  const nameOf = (pid: string) => players.find(p => p.id === pid)?.name ?? '?'
  const board = useMemo(() => {
    const m = new Map<string, { name: string; w: number; l: number; t: number; sc: number; co: number }>()
    const ensure = (id: string) => { if (!m.has(id)) m.set(id, { name: nameOf(id), w: 0, l: 0, t: 0, sc: 0, co: 0 }); return m.get(id)! }
    for (const mt of matches) {
      if (mt.scoreA == null || mt.scoreB == null) continue
      const aWin = mt.scoreA > mt.scoreB, tie = mt.scoreA === mt.scoreB
      for (const id of mt.teamA) { const r = ensure(id); r.sc += mt.scoreA; r.co += mt.scoreB; tie ? r.t++ : aWin ? r.w++ : r.l++ }
      for (const id of mt.teamB) { const r = ensure(id); r.sc += mt.scoreB; r.co += mt.scoreA; tie ? r.t++ : aWin ? r.l++ : r.w++ }
    }
    return [...m.entries()].map(([id, r]) => ({ id, ...r, diff: r.sc - r.co, pts: r.sc })).sort((a, b) => b.pts - a.pts || b.diff - a.diff)
  }, [matches, players])

  const doGenerate = async () => { if (!session) return; await padel.replaceMatches(cid, session.id, generate(players, session.courts)).catch(e => flash(errMsg(e))); reloadM(); setTab('matches') }

  return (
    <AppShell accent={ACCENT} emoji="🎾" title="Padel Matchday" onBack={onClose} tabs={TABS} tab={tab} onTab={setTab} toast={toast}>
      {tab === 'setup' && session && (
        <>
          <div className="kap-sec"><h2>New session</h2></div>
          <div className="kap-lbl">Format</div>
          <div className="kap-chips" style={{ flexWrap: 'wrap' }}>{FORMATS.map(f => <button key={f} className={`kap-chip${session.format === f ? ' on' : ''}`} onClick={() => patch({ format: f })}>{f}</button>)}</div>
          <div className="kap-lbl">Points to win</div>
          <div className="kap-chips">{[16, 21, 24, 32].map(p => <button key={p} className={`kap-chip${session.points === p ? ' on' : ''}`} onClick={() => patch({ points: p })}>{p}</button>)}</div>
          <div className="kap-lbl">Courts</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="kap-btn" onClick={() => patch({ courts: Math.max(1, session.courts - 1) })}>−</button>
            <b style={{ fontSize: 22 }}>{session.courts}</b>
            <button className="kap-btn" onClick={() => patch({ courts: Math.min(6, session.courts + 1) })}>＋</button>
          </div>
          <button className="kap-btn primary block" style={{ marginTop: 20 }} onClick={() => setTab('players')}>Continue to players →</button>
          <button className="kap-btn block" style={{ marginTop: 10 }} onClick={async () => { await addEvent({ circleId: cid, title: '🎾 Padel Matchday', date: todayISO(), start: '18:00', end: '20:00', who: [] }).catch(() => {}); flash('Added to Calendar') }}>📅 Add session to Calendar</button>
        </>
      )}

      {tab === 'players' && session && (
        <>
          <div className="kap-sec"><h2>Players</h2><span className="kap-sec-sub">{players.length} in</span></div>
          {players.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🎾</span><b>No players yet</b><p>Add at least four to generate matches.</p></div>}
          {players.map(p => (
            <div key={p.id} className="kap-row" style={{ marginBottom: 8 }}>
              <span className="kap-av" style={{ background: ACCENT[0], width: 34, height: 34, fontSize: 12 }}>{initials(p.name)}</span>
              <span className="kap-row-main"><b>{p.name}</b></span>
              <button onClick={async () => { await padel.delPlayer(p.id).catch(() => {}); reloadP() }} style={{ color: 'var(--faint)' }}>×</button>
            </div>
          ))}
          {members.length > 0 && (
            <>
              <div className="kap-lbl">From {circle?.name}</div>
              <div className="kap-chips" style={{ flexWrap: 'wrap' }}>
                {members.filter(m => !players.some(p => p.memberId === m.id)).map(m => (
                  <button key={m.id} className="kap-chip" onClick={async () => { await padel.addPlayers(cid, session.id, [{ name: m.name, memberId: m.id }]).catch(() => {}); reloadP() }}>＋ {m.name.split(' ')[0]}</button>
                ))}
              </div>
            </>
          )}
          <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>＋ Add players</button>
          <button className="kap-btn primary block" style={{ marginTop: 12 }} disabled={players.length < 4} onClick={doGenerate}>Generate matches</button>
        </>
      )}

      {tab === 'matches' && session && (
        <>
          <div className="kap-sec"><h2>Matches</h2><span className="kap-sec-sub">{matches.length}</span></div>
          {matches.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🗒️</span><b>No matches yet</b><p>Add players and tap Generate matches.</p></div>}
          {matches.map(m => (
            <div key={m.id} className="kap-card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--faint)', fontWeight: 700, marginBottom: 8 }}><span>Court {m.court} · #{m.matchNo}</span><button onClick={() => setEditId(editId === m.id ? null : m.id)} style={{ color: ACCENT[0], fontWeight: 800 }}>{editId === m.id ? 'Done' : 'Edit'}</button></div>
              <MatchRow label="A" names={m.teamA.map(nameOf)} score={m.scoreA} />
              <MatchRow label="B" names={m.teamB.map(nameOf)} score={m.scoreB} />
              {editId === m.id && <ScoreEdit m={m} onSave={async (a, b) => { await padel.saveScore(m.id, a, b).catch(() => {}); setEditId(null); reloadM() }} />}
            </div>
          ))}
        </>
      )}

      {tab === 'board' && (
        <>
          <div className="kap-sec"><h2>Leaderboard</h2></div>
          {board.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">📊</span><b>No scores yet</b><p>Save match scores to build the table.</p></div>}
          {board[0] && (
            <div className="kap-card" style={{ textAlign: 'center', background: `linear-gradient(135deg,${ACCENT[0]},${ACCENT[1]})`, color: '#fff', border: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, letterSpacing: '.06em' }}>🏆 CHAMPION</div>
              <div style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>{board[0].name}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}><CountUp to={board[0].pts} /> points · {board[0].w}W-{board[0].l}L</div>
            </div>
          )}
          {board.length > 0 && (
            <div className="kap-card" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
              {board.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <b style={{ width: 18, color: 'var(--faint)' }}>{i + 1}</b>
                  <span className="kap-av" style={{ background: ACCENT[0] }}>{initials(r.name)}</span>
                  <b style={{ flex: 1, fontSize: 14 }}>{r.name}</b>
                  <small style={{ color: 'var(--faint)', fontSize: 11.5 }}>{r.w}-{r.l}-{r.t} · {r.diff > 0 ? '+' : ''}{r.diff}</small>
                  <b style={{ width: 36, textAlign: 'right' }}>{r.pts}</b>
                </div>
              ))}
            </div>
          )}
          {session && <button className="kap-btn block" style={{ marginTop: 14, color: 'var(--warn)' }} onClick={async () => { await padel.replaceMatches(cid, session.id, []).catch(() => {}); reloadM(); flash('Matches reset') }}>Reset matches</button>}
        </>
      )}

      {adding && session && <AddPlayers onClose={() => setAdding(false)} onSave={async names => { await padel.addPlayers(cid, session.id, names.map(n => ({ name: n }))).catch(() => {}); setAdding(false); reloadP() }} />}
    </AppShell>
  )
}

function MatchRow({ label, names, score }: { label: string; names: string[]; score: number | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <span className="kap-av" style={{ background: 'var(--bg2)', color: 'var(--ink)' }}>{label}</span>
      <b style={{ flex: 1, fontSize: 14 }}>{names.join(' & ')}</b>
      <b style={{ fontSize: 18, minWidth: 26, textAlign: 'right' }}>{score ?? '–'}</b>
    </div>
  )
}

function ScoreEdit({ m, onSave }: { m: PadelMatch; onSave: (a: number, b: number) => void }) {
  const [a, setA] = useState(String(m.scoreA ?? '')); const [b, setB] = useState(String(m.scoreB ?? ''))
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input className="kap-field" inputMode="numeric" placeholder="A" value={a} onChange={e => setA(e.target.value)} />
      <input className="kap-field" inputMode="numeric" placeholder="B" value={b} onChange={e => setB(e.target.value)} />
      <button className="kap-btn primary" onClick={() => onSave(Number(a) || 0, Number(b) || 0)}>Save</button>
    </div>
  )
}

function AddPlayers({ onClose, onSave }: { onClose: () => void; onSave: (names: string[]) => void }) {
  const [v, setV] = useState('')
  const names = v.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
  return (
    <div className="kap-scrim" onClick={onClose}>
      <div className="kap-sheet" onClick={e => e.stopPropagation()}>
        <div className="kap-grip" /><h3>Add players</h3>
        <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 10 }}>Separate names with commas or new lines.</p>
        <textarea className="kap-field" rows={4} placeholder="Aldyth, Kinara, Baginda, Keyla" value={v} onChange={e => setV(e.target.value)} autoFocus />
        <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!names.length} onClick={() => onSave(names)}>Add {names.length || ''} player{names.length === 1 ? '' : 's'}</button>
      </div>
    </div>
  )
}
