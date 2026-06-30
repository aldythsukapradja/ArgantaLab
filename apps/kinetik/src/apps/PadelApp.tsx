import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials, todayISO } from '@data/energy'
import { padel, type PadelSession, type PadelPlayer, type PadelBatch, type PadelMatch } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'
import { Sheet, Seg, ChoiceGrid, MemberPicker, StatTile, CountUp, BulkPaste, type PickMember } from './ui'
import { addCalendarEvent, shareToMoment, buildCard, shareOrDownload, download, detectNames, errMsg } from './integrations'
import { Racket, Bolt, PadelCourt } from './art'
import * as E from './padel/engine'

const ACCENT: [string, string] = ['#2F6BFF', '#54C7EC']
const TABS: AppTab[] = [{ key: 'setup', label: 'Setup', icon: 'gear' }, { key: 'players', label: 'Players', icon: 'users' }, { key: 'matches', label: 'Matches', icon: 'grid' }, { key: 'board', label: 'Board', icon: 'trophy' }]

type Pace = 'relaxed' | 'normal' | 'fast'

export default function PadelApp({ onClose }: { onClose: () => void }) {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const cid = circle?.id ?? ''
  const members = useMemo(() => people.filter(p => circle && circle.memberIds.includes(p.id)), [people, circle])

  const [session, setSession] = useState<PadelSession | null>(null)
  const [players, setPlayers] = useState<PadelPlayer[]>([])
  const [batches, setBatches] = useState<PadelBatch[]>([])
  const [matches, setMatches] = useState<PadelMatch[]>([])
  const [tab, setTab] = useState('setup')
  const [openMatch, setOpenMatch] = useState<string | null>(null)
  const [sheet, setSheet] = useState<null | 'courts' | 'more' | 'custom' | 'bulk' | 'result' | 'matchesImg' | 'photo'>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 1900) }, [])

  // ── load ──
  useEffect(() => {
    if (!cid) return
    let alive = true
    ;(async () => {
      try {
        const ss = await padel.sessions(cid)
        const s = ss[0] ?? await padel.createSession(cid, {})
        if (!alive) return
        setSession(s)
        const [pl, bs, ms] = await Promise.all([padel.players(s.id), padel.batches(s.id), padel.matches(s.id)])
        if (!alive) return
        setPlayers(pl); setBatches(bs); setMatches(ms)
      } catch (e) { flash(errMsg(e)) }
    })()
    return () => { alive = false }
  }, [cid, flash])

  const reloadPlayers = () => session && padel.players(session.id).then(setPlayers).catch(e => flash(errMsg(e)))
  const reloadMatches = async () => {
    if (!session) return
    try { const [bs, ms] = await Promise.all([padel.batches(session.id), padel.matches(session.id)]); setBatches(bs); setMatches(ms) }
    catch (e) { flash(errMsg(e)) }
  }
  const patch = (p: Partial<PadelSession>) => { if (!session) return; setSession({ ...session, ...p }); padel.updateSession(session.id, p).catch(e => flash(errMsg(e))) }

  // ── derived ──
  const nameOf = useCallback((id: string) => players.find(p => p.id === id)?.name ?? '?', [players])
  const ePlayers: E.EPlayer[] = useMemo(() => players.map(p => ({ id: p.id, name: p.name })), [players])
  const opts: E.EOptions = useMemo(() => ({
    points: session?.points ?? 24, pace: (session?.pace as Pace) ?? 'normal', duration: session?.duration ?? 90,
    americanoMode: (session?.americanoMode as 'duration' | 'official') ?? 'duration', selectedCourts: session?.selectedCourts ?? [1],
  }), [session])
  // engine batches (ordered, with scores) for history + leaderboard
  const eBatches: E.EBatch[] = useMemo(() => batches.map(b => ({
    matches: matches.filter(m => m.batchId === b.id).map(m => ({
      matchNo: m.matchNo, court: m.court, teamA: [m.teamA[0], m.teamA[1]] as [string, string], teamB: [m.teamB[0], m.teamB[1]] as [string, string], scoreA: m.scoreA, scoreB: m.scoreB,
    })),
  })), [batches, matches])
  const standings = useMemo(() => E.leaderboard(ePlayers, eBatches), [ePlayers, eBatches])
  const scored = matches.filter(E.matchScored).length
  const lastBatchComplete = batches.length === 0 || (() => {
    const last = batches[batches.length - 1]
    const ms = matches.filter(m => m.batchId === last.id)
    return ms.length > 0 && ms.every(E.matchScored)
  })()

  // ── generate ──
  const generateInitial = async () => {
    if (!session || players.length < 4) { flash('Add at least 4 players'); return }
    try {
      if (session.format === 'mexicano') {
        const ranked = batches.length
          ? standings.map(s => ePlayers.find(p => p.id === s.id)!).filter(Boolean)
          : (session.mexicanoFirst === 'shuffle' ? E.shuffle(ePlayers) : [...ePlayers].sort((a, b) => a.name.localeCompare(b.name)))
        const { matches: specs, sitouts } = E.generateMexicano(ranked, session.selectedCourts, eBatches)
        const batch = await padel.addBatch(cid, session.id, { number: batches.length + 1, kind: 'mexicano', label: 'Ranking round', sitouts })
        await padel.addMatches(cid, session.id, batch.id, specs)
      } else {
        const count = E.recommendedInitialMatches(players.length, opts)
        const specs = E.generateAmericano(ePlayers, count, session.selectedCourts, eBatches)
        if (!specs.length) { flash('Could not build a fair round for this count'); return }
        const batch = await padel.addBatch(cid, session.id, { number: batches.length + 1, kind: 'americano', label: 'Balanced cycle' })
        await padel.addMatches(cid, session.id, batch.id, specs)
      }
      await reloadMatches(); setTab('matches'); flash('Matches ready')
    } catch (e) { flash(errMsg(e)) }
  }

  const generateMore = async () => {
    if (!session) return
    try {
      if (session.format === 'mexicano') {
        if (!lastBatchComplete) { flash('Score the current round first'); return }
        const ranked = standings.map(s => ePlayers.find(p => p.id === s.id)!).filter(Boolean)
        const { matches: specs, sitouts } = E.generateMexicano(ranked, session.selectedCourts, eBatches)
        const batch = await padel.addBatch(cid, session.id, { number: batches.length + 1, kind: 'mexicano', label: 'Ranking round', sitouts })
        await padel.addMatches(cid, session.id, batch.id, specs)
      } else {
        const count = E.recommendedInitialMatches(players.length, opts)
        const specs = E.generateAmericano(ePlayers, count, session.selectedCourts, eBatches)
        if (!specs.length) { flash('Could not build more matches'); return }
        const batch = await padel.addBatch(cid, session.id, { number: batches.length + 1, kind: 'americano', label: 'Extra cycle' })
        await padel.addMatches(cid, session.id, batch.id, specs)
      }
      await reloadMatches(); flash('More matches added')
    } catch (e) { flash(errMsg(e)) }
  }

  const resetSession = async () => {
    if (!session || !confirm('Reset all matches and scores?')) return
    try { await padel.resetBatches(session.id); await reloadMatches(); flash('Session reset') } catch (e) { flash(errMsg(e)) }
  }

  // ── exports ──
  const drawResult = (ctx: CanvasRenderingContext2D, h: import('./integrations').CardHelpers) => {
    const f = h.font, champ = standings[0]
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = `900 44px ${f}`; ctx.fillText('KINETIK PADEL', 70, 96)
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `700 28px ${f}`
    ctx.fillText(`${session?.format === 'mexicano' ? 'Mexicano' : 'Americano'} · ${session?.points} pts · Court ${session?.selectedCourts.join(', ')}`, 70, 138)
    ctx.fillStyle = '#fff'; ctx.font = `900 ${h.fit(session?.eventName || circle?.name || 'Padel', 880, 76, 900)}px ${f}`
    ctx.fillText(session?.eventName || circle?.name || 'Padel night', 70, 240)
    // champion panel
    h.roundRect(70, 320, 940, 250, 48); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `800 26px ${f}`; ctx.fillText('CHAMPION', 110, 388)
    if (champ) {
      ctx.fillStyle = '#fff'; ctx.font = `900 ${h.fit(champ.name, 600, 70, 900)}px ${f}`; ctx.fillText(champ.name, 110, 476)
      ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = `700 28px ${f}`; ctx.fillText(`${champ.wins}-${champ.losses}-${champ.draws} · Diff ${champ.diff >= 0 ? '+' : ''}${champ.diff}`, 110, 528)
      ctx.fillStyle = '#bfefff'; ctx.font = `900 92px ${f}`; ctx.textAlign = 'right'; ctx.fillText(String(champ.points), 960, 492)
      ctx.font = `800 24px ${f}`; ctx.fillText('PTS', 960, 530); ctx.textAlign = 'left'
    } else { ctx.fillStyle = '#fff'; ctx.font = `900 54px ${f}`; ctx.fillText('No scores yet', 110, 470) }
    // toplist
    ctx.fillStyle = '#fff'; ctx.font = `900 44px ${f}`; ctx.fillText('Leaderboard', 70, 660)
    standings.slice(0, 7).forEach((p, i) => {
      const y = 720 + i * 76
      ctx.fillStyle = i === 0 ? 'rgba(191,239,255,.95)' : 'rgba(255,255,255,.13)'; h.roundRect(70, y - 44, 940, 60, 18); ctx.fill()
      ctx.fillStyle = i === 0 ? '#08111f' : '#fff'; ctx.font = `900 27px ${f}`; ctx.fillText(`${i + 1}.`, 96, y - 4)
      ctx.font = `850 30px ${f}`; ctx.fillText(p.name.length > 20 ? p.name.slice(0, 19) + '…' : p.name, 150, y - 4)
      ctx.font = `800 24px ${f}`; ctx.textAlign = 'right'; ctx.fillText(`${p.wins}-${p.losses}-${p.draws}`, 720, y - 4)
      ctx.fillText(`${p.diff >= 0 ? '+' : ''}${p.diff}`, 840, y - 4); ctx.font = `900 30px ${f}`; ctx.fillText(String(p.points), 970, y - 4); ctx.textAlign = 'left'
    })
    ctx.fillStyle = 'rgba(255,255,255,.66)'; ctx.font = `700 22px ${f}`; ctx.textAlign = 'right'; ctx.fillText('Generated by Kinetik', 1010, 1300); ctx.textAlign = 'left'
  }
  const drawMatches = (ctx: CanvasRenderingContext2D, h: import('./integrations').CardHelpers) => {
    const f = h.font
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `900 44px ${f}`; ctx.fillText('MATCHES', 70, 96)
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = `750 27px ${f}`; ctx.fillText(`${session?.format === 'mexicano' ? 'Mexicano' : 'Americano'} · ${players.length} players · ${scored}/${matches.length} scored`, 70, 138)
    ctx.fillStyle = '#fff'; ctx.font = `900 ${h.fit(session?.eventName || circle?.name || 'Padel', 880, 64, 900)}px ${f}`; ctx.fillText(session?.eventName || circle?.name || 'Padel', 70, 230)
    matches.slice(0, 12).forEach((m, i) => {
      const y = 320 + i * 76, sc = E.matchScored(m)
      ctx.fillStyle = sc ? 'rgba(191,239,255,.9)' : 'rgba(255,255,255,.12)'; h.roundRect(70, y - 44, 940, 60, 18); ctx.fill()
      ctx.fillStyle = sc ? '#08111f' : '#fff'; ctx.font = `900 24px ${f}`; ctx.fillText(`#${m.matchNo}`, 96, y - 4)
      ctx.font = `800 22px ${f}`; ctx.fillText(`C${m.court}`, 168, y - 4)
      ctx.font = `800 23px ${f}`; ctx.fillText(`${teamShort(m.teamA, nameOf)} vs ${teamShort(m.teamB, nameOf)}`, 240, y - 4)
      ctx.textAlign = 'right'; ctx.font = `900 26px ${f}`; ctx.fillText(sc ? `${m.scoreA}:${m.scoreB}` : 'Open', 980, y - 4); ctx.textAlign = 'left'
    })
    ctx.fillStyle = 'rgba(255,255,255,.66)'; ctx.font = `700 22px ${f}`; ctx.textAlign = 'right'; ctx.fillText('Generated by Kinetik', 1010, 1300); ctx.textAlign = 'left'
  }

  return (
    <AppShell accent={ACCENT} emoji="🎾" title="Matchday" subtitle={session?.eventName || circle?.name} onBack={onClose} tabs={TABS} tab={tab} onTab={setTab} toast={toast}>
      {/* ── SETUP ── */}
      {tab === 'setup' && session && (
        <>
          <div className="kap-apphero">
            <span className="kap-apphero-motif"><PadelCourt w={150} /></span>
            <div className="kap-apphero-ey">{session.format === 'mexicano' ? 'Mexicano ladder' : 'Americano rotation'}</div>
            <div className="kap-apphero-title">{session.eventName || 'New session'}</div>
            <div className="kap-apphero-sub">Fair rounds · live scoring · shareable result cards</div>
            <div className="kap-apphero-chips">
              <span className="kap-apphero-chip">{session.points} pts</span>
              <span className="kap-apphero-chip">{session.selectedCourts.length} court{session.selectedCourts.length === 1 ? '' : 's'}</span>
              <span className="kap-apphero-chip">{session.duration}m</span>
            </div>
          </div>

          <div className="kap-lbl">Event name</div>
          <input className="kap-field" placeholder="Friday Padel Night" value={session.eventName ?? ''} onChange={e => patch({ eventName: e.target.value })} maxLength={70} />

          <div className="kap-lbl">Format</div>
          <Seg value={session.format as 'americano' | 'mexicano'} onChange={f => { patch({ format: f }); flash(f === 'mexicano' ? 'Mexicano ladder' : 'Americano rotation') }}
            options={[{ k: 'americano', label: <><Racket /> Americano</> }, { k: 'mexicano', label: <><Bolt /> Mexicano</> }]} />

          <div className="kap-lbl">Points to win</div>
          <ChoiceGrid value={session.points} onChange={p => { if (p === -1) { setSheet('custom') } else patch({ points: p as number }) }}
            options={[{ k: 16, label: '16' }, { k: 21, label: '21' }, { k: 24, label: '24' }, { k: 32, label: '32' }, { k: -1, label: session.points && ![16, 21, 24, 32].includes(session.points) ? String(session.points) : 'Custom' }]} />

          <button className="kap-setrow" onClick={() => setSheet('courts')}>
            <div><b>Courts</b><span>{session.selectedCourts.map(n => 'Court ' + n).join(', ')}</span></div><span className="chev">›</span>
          </button>
          <button className="kap-setrow" onClick={() => setSheet('more')}>
            <div><b>More options</b><span>{session.duration} min · {cap(session.pace)} pace · {session.americanoMode === 'official' ? 'Official cycle' : 'Duration-based'}</span></div><span className="chev">›</span>
          </button>

          <button className="kap-btn primary block" style={{ marginTop: 20 }} onClick={() => setTab('players')}>Continue to players →</button>
          <button className="kap-btn block" style={{ marginTop: 10 }} onClick={async () => {
            try { await addCalendarEvent({ circleId: cid, title: `🎾 ${session.eventName || 'Padel'}`, date: todayISO(), start: '18:00', end: `${18 + Math.max(1, Math.round(session.duration / 60))}:00`.padStart(5, '0'), who: members.map(m => m.id) }); flash('Added to Calendar') }
            catch (e) { flash(errMsg(e)) }
          }}>📅 Add session to Calendar</button>
        </>
      )}

      {/* ── PLAYERS ── */}
      {tab === 'players' && session && (
        <>
          <div className="kap-sec"><h2>Players</h2><span className="kap-sec-sub">{players.length} in · {E.forecast(players.length, opts, session.format !== 'mexicano')}</span></div>
          {members.length > 0 && (
            <>
              <div className="kap-lbl">From {circle?.name}</div>
              <MemberPicker
                members={members.map(m => ({ id: m.id, name: m.name })) as PickMember[]}
                selected={players.filter(p => p.memberId).map(p => p.memberId!) }
                max={0}
                onToggle={async id => {
                  const existing = players.find(p => p.memberId === id)
                  try {
                    if (existing) await padel.delPlayer(existing.id)
                    else { const m = members.find(x => x.id === id)!; await padel.addPlayers(cid, session.id, [{ name: m.name, memberId: m.id }]) }
                    await padel.resetBatches(session.id); reloadPlayers(); reloadMatches()
                  } catch (e) { flash(errMsg(e)) }
                }}
              />
            </>
          )}
          <div className="kap-lbl">Roster</div>
          {players.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🎾</span><b>No players yet</b><p>Add at least four to generate fair matches.</p></div>}
          {players.map((p, i) => (
            <div key={p.id} className="kap-row">
              <span className="kap-av" style={{ background: ACCENT[0], width: 34, height: 34, fontSize: 12 }}>{initials(p.name)}</span>
              <span className="kap-row-main"><b>{p.name}</b><small>Player {i + 1}</small></span>
              <button onClick={async () => { try { await padel.delPlayer(p.id); await padel.resetBatches(session.id); reloadPlayers(); reloadMatches() } catch (e) { flash(errMsg(e)) } }} style={{ color: 'var(--faint)', fontSize: 18 }}>×</button>
            </div>
          ))}
          <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('bulk')}>＋ Add players</button>
          <button className="kap-btn primary block" style={{ marginTop: 12 }} disabled={players.length < 4} onClick={generateInitial}>Generate matches</button>
        </>
      )}

      {/* ── MATCHES ── */}
      {tab === 'matches' && session && (
        <>
          <div className="kap-sec"><h2>Matches</h2><span className="kap-sec-sub">{scored}/{matches.length} scored</span></div>
          {batches.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <button className="kap-btn primary" onClick={() => setSheet('matchesImg')}>Export image</button>
              <button className="kap-btn" onClick={() => setTab('board')}>Leaderboard</button>
            </div>
          )}
          {batches.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🗒️</span><b>No matches yet</b><p>Add players, then tap Generate matches.</p></div>}
          {batches.map(b => {
            const bms = matches.filter(m => m.batchId === b.id)
            const done = bms.length > 0 && bms.every(E.matchScored)
            const slots = new Set(session.selectedCourts).size
            const active = new Set<string>()
            // live = open match + first unscored up to court count
            if (openMatch && bms.some(m => m.id === openMatch)) active.add(openMatch)
            bms.filter(m => !E.matchScored(m)).forEach(m => { if (active.size < slots) active.add(m.id) })
            const live = bms.filter(m => active.has(m.id))
            const next = bms.filter(m => !active.has(m.id) && !E.matchScored(m))
            const completed = bms.filter(m => !active.has(m.id) && E.matchScored(m))
            return (
              <div key={b.id} style={{ marginBottom: 16 }}>
                <div className="kap-sec" style={{ margin: '4px 2px 6px' }}>
                  <h2 style={{ fontSize: 15 }}>{b.kind === 'mexicano' ? `Round #${b.number}` : `Batch #${b.number}`}</h2>
                  <span className={`kap-badge ${done ? 'done' : 'live'}`}>{done ? 'Complete' : 'In play'}</span>
                </div>
                {live.length > 0 && <div className="kap-section-lbl">Live now</div>}
                {live.map(m => <LiveMatch key={m.id} m={m} points={session.points} nameOf={nameOf} onSave={async (a, bb) => { try { await padel.saveScore(m.id, a, bb); setOpenMatch(null); reloadMatches(); flash('Score saved') } catch (e) { flash(errMsg(e)) } }} onClear={async () => { try { await padel.clearScore(m.id); reloadMatches() } catch (e) { flash(errMsg(e)) } }} />)}
                {next.length > 0 && <div className="kap-section-lbl">Up next</div>}
                {next.map(m => <CompactMatch key={m.id} m={m} nameOf={nameOf} onOpen={() => setOpenMatch(m.id)} />)}
                {completed.length > 0 && <div className="kap-section-lbl">Completed</div>}
                {completed.map(m => <CompactMatch key={m.id} m={m} nameOf={nameOf} onOpen={() => setOpenMatch(m.id)} />)}
              </div>
            )
          })}
          {batches.length > 0 && (
            <button className="kap-btn block" style={{ marginTop: 4 }} onClick={generateMore}>
              {session.format === 'mexicano' ? '＋ Generate next round' : '＋ Generate more matches'}
            </button>
          )}
        </>
      )}

      {/* ── BOARD ── */}
      {tab === 'board' && (
        <>
          <div className="kap-sec"><h2>Leaderboard</h2></div>
          {standings.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">📊</span><b>No scores yet</b><p>Save match scores to build the table.</p></div>}
          {standings[0] && standings[0].played > 0 && (
            <div className="kap-card kap-champ">
              <div className="kap-champ-ey">🏆 CHAMPION</div>
              <div className="kap-champ-name">{standings[0].name}</div>
              <div className="kap-champ-sub"><CountUp to={standings[0].points} /> pts · {standings[0].wins}W-{standings[0].losses}L · Diff {standings[0].diff >= 0 ? '+' : ''}{standings[0].diff}</div>
            </div>
          )}
          {standings.some(s => s.played > 0) && (
            <div className="kap-card kap-lb" style={{ marginTop: 10 }}>
              {standings.map((r, i) => (
                <div key={r.id} className={`kap-lb-row${i === 0 ? ' first' : ''}`}>
                  <span className="kap-lb-rank">{i + 1}</span>
                  <span className="kap-lb-name">{r.name}</span>
                  <span className="kap-lb-wl">{r.wins}-{r.losses}-{r.draws} · {r.diff >= 0 ? '+' : ''}{r.diff}</span>
                  <span className="kap-lb-pts">{r.points}</span>
                </div>
              ))}
            </div>
          )}
          {standings.some(s => s.played > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button className="kap-btn primary" onClick={() => setSheet('result')}>Results card</button>
              <button className="kap-btn" onClick={() => setSheet('photo')}>Group photo</button>
            </div>
          )}
          {batches.length > 0 && <button className="kap-btn block" style={{ marginTop: 12, color: 'var(--warn)' }} onClick={resetSession}>Reset session</button>}
        </>
      )}

      {/* ── SHEETS ── */}
      {sheet === 'courts' && session && (
        <CourtsSheet selected={session.selectedCourts} onClose={() => setSheet(null)} onSave={courts => { patch({ selectedCourts: courts, courts: courts.length }); padel.resetBatches(session.id).then(reloadMatches); setSheet(null) }} />
      )}
      {sheet === 'more' && session && (
        <Sheet title="More options" sub="Advanced controls — setup stays clean." onClose={() => setSheet(null)}>
          <div className="kap-lbl">Venue</div>
          <input className="kap-field" placeholder="Padel club or location" value={session.venue ?? ''} onChange={e => patch({ venue: e.target.value })} maxLength={70} />
          <div className="kap-lbl">Booking duration</div>
          <ChoiceGrid value={session.duration} onChange={d => patch({ duration: d as number })} options={[{ k: 60, label: '60m' }, { k: 90, label: '90m' }, { k: 120, label: '120m' }]} />
          <div className="kap-lbl">Match pace</div>
          <Seg value={session.pace as Pace} onChange={p => patch({ pace: p })} options={[{ k: 'relaxed', label: 'Relaxed' }, { k: 'normal', label: 'Normal' }, { k: 'fast', label: 'Fast' }]} />
          <div className="kap-lbl">Americano matches</div>
          <Seg value={session.americanoMode as 'duration' | 'official'} onChange={m => patch({ americanoMode: m })} options={[{ k: 'duration', label: 'Fill booking' }, { k: 'official', label: 'Official cycle' }]} />
          <div className="kap-lbl">Mexicano first round</div>
          <Seg value={session.mexicanoFirst as 'roster' | 'shuffle'} onChange={m => patch({ mexicanoFirst: m })} options={[{ k: 'roster', label: 'Roster order' }, { k: 'shuffle', label: 'Shuffle' }]} />
          <button className="kap-btn primary block" style={{ marginTop: 16 }} onClick={() => setSheet(null)}>Done</button>
        </Sheet>
      )}
      {sheet === 'custom' && session && (
        <CustomPointsSheet value={session.points} onClose={() => setSheet(null)} onSave={v => { patch({ points: v }); setSheet(null) }} />
      )}
      {sheet === 'bulk' && session && (
        <BulkSheet onClose={() => setSheet(null)} onImport={async raw => {
          const names = detectNames(raw).names.filter(n => !players.some(p => p.name.toLowerCase() === n.toLowerCase()))
          if (!names.length) { flash('No new names'); return }
          try { await padel.addPlayers(cid, session.id, names.map(n => ({ name: n }))); await padel.resetBatches(session.id); reloadPlayers(); reloadMatches(); setSheet(null); flash(`${names.length} added`) } catch (e) { flash(errMsg(e)) }
        }} />
      )}
      {sheet === 'result' && (
        <ExportSheet title="Results card" accent={ACCENT} draw={drawResult} filename="kinetik-padel-result.png"
          shareText={`${session?.eventName || 'Padel'} — ${standings[0]?.name ?? ''} wins!`} circleId={cid}
          onClose={() => setSheet(null)} flash={flash} />
      )}
      {sheet === 'matchesImg' && (
        <ExportSheet title="Matches image" accent={ACCENT} draw={drawMatches} filename="kinetik-padel-matches.png"
          shareText={`${session?.eventName || 'Padel'} matches`} circleId={cid}
          onClose={() => setSheet(null)} flash={flash} />
      )}
      {sheet === 'photo' && (
        <PhotoSheet accent={ACCENT} standings={standings} circleId={cid} title={session?.eventName || circle?.name || 'Padel'} onClose={() => setSheet(null)} flash={flash} />
      )}
    </AppShell>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const teamShort = (ids: string[], nameOf: (id: string) => string) => ids.map(id => nameOf(id).split(' ')[0]).join(' & ')

/* ── Match components ── */
function LiveMatch({ m, points, nameOf, onSave, onClear }: { m: PadelMatch; points: number; nameOf: (id: string) => string; onSave: (a: number, b: number) => void; onClear: () => void }) {
  const [a, setA] = useState(m.scoreA != null ? String(m.scoreA) : '')
  const [b, setB] = useState(m.scoreB != null ? String(m.scoreB) : '')
  const auto = (side: 'a' | 'b', v: string) => {
    const n = v === '' ? '' : String(Math.max(0, Math.min(points, parseInt(v, 10) || 0)))
    if (side === 'a') { setA(n); setB(n === '' ? '' : String(points - Number(n))) }
    else { setB(n); setA(n === '' ? '' : String(points - Number(n))) }
  }
  const save = () => { const na = Number(a), nb = Number(b); if (a === '' || b === '') return; if (na + nb !== points) return; onSave(na, nb) }
  return (
    <div className="kap-match">
      <div className="kap-match-top">
        <div className="kap-match-badges"><span className="kap-badge court">Court {m.court}</span><span className="kap-badge no">#{m.matchNo}</span></div>
        <div className="kap-match-act"><button className="kap-pill" onClick={onClear}>Clear</button><button className="kap-pill primary" onClick={save}>✓ Save</button></div>
      </div>
      <div className="kap-team-rail"><span className="kap-team-side">A</span><span className="kap-team-names">{teamShort(m.teamA, nameOf)}</span><input className="kap-score-in" inputMode="numeric" value={a} onChange={e => auto('a', e.target.value)} /></div>
      <div className="kap-team-rail"><span className="kap-team-side">B</span><span className="kap-team-names">{teamShort(m.teamB, nameOf)}</span><input className="kap-score-in" inputMode="numeric" value={b} onChange={e => auto('b', e.target.value)} /></div>
    </div>
  )
}

function CompactMatch({ m, nameOf, onOpen }: { m: PadelMatch; nameOf: (id: string) => string; onOpen: () => void }) {
  const sc = E.matchScored(m)
  return (
    <button className={`kap-mc${sc ? ' locked' : ''}`} onClick={onOpen}>
      <span className="kap-mc-no">#{m.matchNo}</span>
      <span className="kap-mc-teams">{teamShort(m.teamA, nameOf)} vs {teamShort(m.teamB, nameOf)}</span>
      <span className="kap-mc-score">{sc ? `${m.scoreA}-${m.scoreB}` : 'Open'}</span>
    </button>
  )
}

/* ── Sheets ── */
function CourtsSheet({ selected, onClose, onSave }: { selected: number[]; onClose: () => void; onSave: (c: number[]) => void }) {
  const [sel, setSel] = useState<number[]>(selected)
  const [max, setMax] = useState(Math.max(9, ...selected))
  const toggle = (n: number) => setSel(s => s.includes(n) ? (s.length > 1 ? s.filter(x => x !== n) : s) : [...s, n].sort((a, b) => a - b))
  return (
    <Sheet title="Select courts" sub="Pick exact court numbers, e.g. Court 2 and Court 7." onClose={onClose}>
      <div className="court-grid">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button key={n} className={`court-tile${sel.includes(n) ? ' on' : ''}`} onClick={() => toggle(n)} aria-pressed={sel.includes(n)}>
            <span className="court-tile-lbl">Court</span>
            <span className="court-tile-fig"><PadelCourt /></span>
            <span className="court-tile-no">{n}</span>
          </button>
        ))}
        <button className="court-tile add" onClick={() => setMax(m => m + 1)} aria-label="Add court">＋</button>
      </div>
      <button className="kap-btn primary block" style={{ marginTop: 16 }} onClick={() => onSave(sel)}>Save {sel.length} court{sel.length === 1 ? '' : 's'}</button>
    </Sheet>
  )
}

function CustomPointsSheet({ value, onClose, onSave }: { value: number; onClose: () => void; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value))
  return (
    <Sheet title="Custom points" sub="Set the agreed match total." onClose={onClose}>
      <div className="kap-lbl">Match points</div>
      <input className="kap-field" inputMode="numeric" value={v} onChange={e => setV(e.target.value)} placeholder="24" autoFocus />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} onClick={() => { const n = Math.max(4, Math.min(80, parseInt(v, 10) || 24)); onSave(n) }}>Use custom points</button>
    </Sheet>
  )
}

function BulkSheet({ onClose, onImport }: { onClose: () => void; onImport: (raw: string) => void }) {
  const [v, setV] = useState('')
  return (
    <Sheet title="Add players" sub="Comma, line break, or space — auto-detected." onClose={onClose}>
      <BulkPaste value={v} onChange={setV} />
      <button className="kap-btn primary block" style={{ marginTop: 14 }} disabled={!v.trim()} onClick={() => onImport(v)}>Import players</button>
    </Sheet>
  )
}

function ExportSheet({ title, accent, draw, filename, shareText, circleId, onClose, flash }: {
  title: string; accent: [string, string]; draw: (ctx: CanvasRenderingContext2D, h: import('./integrations').CardHelpers) => void
  filename: string; shareText: string; circleId: string; onClose: () => void; flash: (m: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  useEffect(() => {
    let alive = true
    buildCard(accent, draw).then(b => { if (!alive) return; setBlob(b); setUrl(URL.createObjectURL(b)) }).catch(e => flash(errMsg(e)))
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet title={title} sub="Download, share, or post to Moments." onClose={onClose}>
      {url ? <img className="kap-export-img" src={url} alt={title} /> : <div className="kap-skel" style={{ height: 280 }} />}
      <div style={{ display: 'grid', gap: 8 }}>
        <button className="kap-btn primary block" disabled={!blob} onClick={async () => { if (blob) { await shareOrDownload(blob, filename, shareText); } }}>Share image</button>
        <button className="kap-btn block" disabled={!blob} onClick={() => blob && download(blob, filename)}>Download</button>
        <button className="kap-btn ghost block" disabled={!blob} onClick={async () => { try { await shareToMoment({ circleId, body: shareText, blob, filename }); flash('Posted to Moments'); onClose() } catch (e) { flash(errMsg(e)) } }}>Post to Moments</button>
      </div>
    </Sheet>
  )
}

function PhotoSheet({ accent, standings, circleId, title, onClose, flash }: { accent: [string, string]; standings: E.EStanding[]; circleId: string; title: string; onClose: () => void; flash: (m: string) => void }) {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)

  const render = useCallback(async () => {
    const b = await buildCard(accent, (ctx, h) => {
      const f = h.font
      if (photo) { const r = Math.max(h.W / photo.width, h.H / photo.height); const w = photo.width * r, ht = photo.height * r; ctx.drawImage(photo, (h.W - w) / 2, (h.H - ht) / 2, w, ht) }
      const g = ctx.createLinearGradient(0, 0, 0, h.H); g.addColorStop(0, 'rgba(8,17,31,.25)'); g.addColorStop(.5, 'rgba(8,17,31,.06)'); g.addColorStop(1, 'rgba(8,17,31,.9)'); ctx.fillStyle = g; ctx.fillRect(0, 0, h.W, h.H)
      ctx.fillStyle = '#fff'; ctx.font = `900 ${h.fit(title, 880, 60, 900)}px ${f}`; ctx.fillText(title, 60, 200)
      const py = 800; h.roundRect(50, py, 980, 420, 44); ctx.fillStyle = 'rgba(7,17,31,.6)'; ctx.fill()
      ctx.fillStyle = '#bfefff'; ctx.font = `900 30px ${f}`; ctx.fillText('TOP 3', 92, py + 64)
      standings.slice(0, 3).forEach((p, i) => {
        const y = py + 140 + i * 92
        ctx.fillStyle = i === 0 ? 'rgba(191,239,255,.94)' : 'rgba(255,255,255,.12)'; h.roundRect(86, y - 48, 900, 70, 22); ctx.fill()
        ctx.fillStyle = i === 0 ? '#07111f' : '#fff'; ctx.font = `900 34px ${f}`; ctx.fillText(`${i + 1}. ${p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name}`, 116, y - 2)
        ctx.textAlign = 'right'; ctx.font = `900 34px ${f}`; ctx.fillText(String(p.points), 965, y - 2); ctx.textAlign = 'left'
      })
    })
    setBlob(b); setUrl(u => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b) })
  }, [photo, accent, standings, title])

  useEffect(() => { render() }, [render])

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const img = new Image(); const u = URL.createObjectURL(file)
    img.onload = () => { setPhoto(img); URL.revokeObjectURL(u) }; img.src = u
  }
  return (
    <Sheet title="Group photo" sub="Pick a photo — we overlay the Top 3." onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <label className="kap-btn primary" style={{ cursor: 'pointer' }}>Choose photo<input type="file" accept="image/*" hidden onChange={pick} /></label>
        <label className="kap-btn" style={{ cursor: 'pointer' }}>Take photo<input type="file" accept="image/*" capture="environment" hidden onChange={pick} /></label>
      </div>
      {url ? <img className="kap-export-img" src={url} alt="Group" /> : <div className="kap-skel" style={{ height: 280 }} />}
      <div style={{ display: 'grid', gap: 8 }}>
        <button className="kap-btn primary block" disabled={!blob} onClick={async () => { if (blob) await shareOrDownload(blob, 'kinetik-padel-photo.png', title) }}>Share image</button>
        <button className="kap-btn ghost block" disabled={!blob} onClick={async () => { try { await shareToMoment({ circleId, body: title, blob }); flash('Posted to Moments'); onClose() } catch (e) { flash(errMsg(e)) } }}>Post to Moments</button>
      </div>
    </Sheet>
  )
}
