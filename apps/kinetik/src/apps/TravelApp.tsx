import { useEffect, useState, useMemo } from 'react'
import { useDataStore, personById } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials, colorFor } from '@data/energy'
import { travel, type Trip, type Activity, type PackItem, type TripExpense } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'
import { Ring, CountUp, Skeleton } from './ui'

const ACCENT: [string, string] = ['#0E9DC4', '#38BDF8']
const TABS: AppTab[] = [{ key: 'overview', label: 'Overview' }, { key: 'plan', label: 'Itinerary' }, { key: 'pack', label: 'Packing' }, { key: 'budget', label: 'Budget' }]
const money = (n: number) => `QAR ${Math.round(n).toLocaleString()}`
const fmtDate = (iso?: string | null) => iso ? new Date(iso + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'
const nightsOf = (a?: string | null, b?: string | null) => (a && b) ? Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 864e5)) : 0
function countdown(t: Trip): string {
  if (!t.startDate) return 'Trip'
  const d = Math.ceil((+new Date(t.startDate + 'T00:00') - Date.now()) / 864e5)
  if (d > 1) return `In ${d} days`
  if (d === 1) return 'Tomorrow'
  if (t.endDate && +new Date(t.endDate + 'T23:59') >= Date.now()) return 'Happening now'
  return 'Trip complete'
}
const SMART_PACK = ['Passport / IDs', 'Chargers', 'Toiletries', 'Medication', 'Clothes', 'Shoes', 'Sunglasses', 'Travel docs', 'Adapter', 'Snacks']
const errMsg = (e: unknown) => (e && typeof e === 'object' ? String((e as any).message || (e as any).details || JSON.stringify(e)) : String(e))

export default function TravelApp({ onClose }: { onClose: () => void }) {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const addEvent = useDataStore(s => s.addEvent)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const cid = circle?.id ?? ''
  const members = useMemo(() => people.filter(p => circle && circle.memberIds.includes(p.id)), [people, circle])

  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dtab, setDtab] = useState('overview')
  const [acts, setActs] = useState<Activity[]>([])
  const [pack, setPack] = useState<PackItem[]>([])
  const [exp, setExp] = useState<TripExpense[]>([])
  const [sheet, setSheet] = useState<null | 'trip' | 'act' | 'pack' | 'exp'>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800) }

  const trip = trips?.find(t => t.id === openId) ?? null
  const reloadTrips = () => travel.trips(cid).then(setTrips).catch(() => setTrips([]))
  useEffect(() => { if (cid) reloadTrips() }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDetail = (id: string) => {
    travel.activities(id).then(setActs).catch(() => setActs([]))
    travel.packItems(id).then(setPack).catch(() => setPack([]))
    travel.expenses(id).then(setExp).catch(() => setExp([]))
  }
  const openTrip = (id: string) => { setOpenId(id); setDtab('overview'); loadDetail(id) }

  const packPct = pack.length ? Math.round((pack.filter(p => p.checked).length / pack.length) * 100) : 0
  const spent = exp.reduce((s, e) => s + e.amount, 0)

  const syncCalendar = async (t: Trip) => {
    try {
      const who = t.travelers
      if (t.startDate) await addEvent({ circleId: cid, title: `✈️ Depart — ${t.destination || t.title}`, date: t.startDate, start: '09:00', end: '11:00', who })
      if (t.endDate) await addEvent({ circleId: cid, title: `🛬 Return — ${t.destination || t.title}`, date: t.endDate, start: '18:00', end: '20:00', who })
      flash('Synced to Calendar')
    } catch (e) { flash(errMsg(e)) }
  }

  const back = () => { if (openId) setOpenId(null); else onClose() }

  return (
    <AppShell accent={ACCENT} emoji="✈️" title="Travel Planner" onBack={back}
      tabs={trip ? TABS : undefined} tab={dtab} onTab={setDtab} toast={toast}>

      {!trip ? (
        <>
          <div className="kap-sec"><h2>Your trips</h2><span className="kap-sec-sub">{trips?.length ?? 0} planned</span></div>
          {trips === null && <><Skeleton h={70} /><Skeleton h={70} /></>}
          {trips && trips.length === 0 && (
            <div className="kap-empty"><span className="kap-empty-ic">✈️</span><b>No trips yet</b><p>Tap New to start planning your next adventure.</p></div>
          )}
          {trips?.map(t => {
            const trav = t.travelers.map(id => personById(id)).filter(Boolean)
            return (
              <button key={t.id} className="kap-row" onClick={() => openTrip(t.id)} style={{ marginBottom: 8 }}>
                <span className="kap-row-em">{t.emoji}</span>
                <span className="kap-row-main">
                  <b>{t.title}</b>
                  <small>📅 {fmtDate(t.startDate)} – {fmtDate(t.endDate)} · 👥 {t.travelers.length || 'everyone'}</small>
                </span>
                <span className="kap-row-right">{t.status}</span>
                <span style={{ display: 'flex' }}>{trav.slice(0, 3).map((p, i) => <span key={i} className="kap-av" style={{ background: colorFor(p!.id), marginLeft: i ? -8 : 0, border: '2px solid #fff' }}>{initials(p!.name)}</span>)}</span>
              </button>
            )
          })}
          <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('trip')}>＋ New trip</button>
        </>
      ) : (
        <>
          {dtab === 'overview' && (
            <>
              <div className="kap-hero">
                <Ring pct={packPct} value={<CountUp to={packPct} fmt={n => `${Math.round(n)}%`} />} label="packed" />
                <div className="kap-hero-main">
                  <div className="kap-hero-ey">{countdown(trip)}</div>
                  <div className="kap-hero-big">{trip.destination || trip.title}</div>
                  <div className="kap-hero-sub">📅 {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)} · {nightsOf(trip.startDate, trip.endDate)} nights</div>
                </div>
              </div>
              <div className="kap-stats" style={{ marginTop: 10 }}>
                <div className="kap-stat"><b>{nightsOf(trip.startDate, trip.endDate)}</b><span>Nights</span></div>
                <div className="kap-stat"><b><CountUp to={spent} fmt={n => Math.round(n).toLocaleString()} /></b><span>QAR spent</span></div>
                <div className="kap-stat"><b>{trip.travelers.length || 'All'}</b><span>Travelers</span></div>
              </div>
              <div className="kap-sec"><h2>Travelers</h2></div>
              {members.filter(m => trip.travelers.includes(m.id)).map(m => (
                <div key={m.id} className="kap-row" style={{ marginBottom: 8 }}>
                  <span className="kap-av" style={{ background: colorFor(m.id), width: 36, height: 36, fontSize: 12 }}>{initials(m.name)}</span>
                  <span className="kap-row-main"><b>{m.name}</b></span>
                </div>
              ))}
              {trip.travelers.length === 0 && <p style={{ fontSize: 13, color: 'var(--faint)', padding: '6px 2px' }}>Everyone in {circle?.name}.</p>}
              <button className="kap-btn primary block" style={{ marginTop: 14 }} onClick={() => syncCalendar(trip)}>📅 Sync departure &amp; return to Calendar</button>
              <button className="kap-btn block" style={{ marginTop: 10, color: 'var(--warn)' }} onClick={async () => { await travel.deleteTrip(trip.id).catch(() => {}); setOpenId(null); reloadTrips() }}>Delete trip</button>
            </>
          )}

          {dtab === 'plan' && (
            <>
              <div className="kap-sec"><h2>Itinerary</h2></div>
              {acts.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🗺️</span><b>No activities yet</b><p>Add the first thing to do on this trip.</p></div>}
              {acts.map(a => (
                <div key={a.id} className="kap-row" style={{ marginBottom: 8 }}>
                  <span className="kap-row-em">{a.emoji}</span>
                  <span className="kap-row-main"><b>{a.name}</b><small>{[fmtDate(a.dayDate), a.atTime, a.note].filter(Boolean).join(' · ')}</small></span>
                  <button onClick={async () => { await travel.delActivity(a.id).catch(() => {}); loadDetail(trip.id) }} style={{ color: 'var(--faint)' }}>×</button>
                </div>
              ))}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('act')}>＋ Add activity</button>
            </>
          )}

          {dtab === 'pack' && (
            <>
              <div className="kap-sec"><h2>Packing</h2><span className="kap-sec-sub">{packPct}%</span></div>
              <div className="kap-bar" style={{ marginBottom: 14 }}><i style={{ width: `${packPct}%` }} /></div>
              {pack.length === 0 && (
                <button className="kap-btn primary block" onClick={async () => { await travel.addPack(cid, trip.id, SMART_PACK.map(n => ({ name: n }))).catch(() => {}); loadDetail(trip.id); flash('Smart list added') }}>✨ Generate smart packing list</button>
              )}
              {pack.map(it => (
                <button key={it.id} className="kap-row" style={{ marginBottom: 8, opacity: it.checked ? 0.55 : 1 }} onClick={() => travel.togglePack(it.id, !it.checked).then(() => loadDetail(trip.id)).catch(() => {})}>
                  <span className="kap-av" style={{ background: it.checked ? 'var(--c0)' : 'var(--bg2)', color: it.checked ? '#fff' : 'var(--faint)', width: 26, height: 26 }}>{it.checked ? '✓' : ''}</span>
                  <span className="kap-row-main"><b style={{ textDecoration: it.checked ? 'line-through' : 'none' }}>{it.name}</b><small>{it.category}</small></span>
                </button>
              ))}
              {pack.length > 0 && <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('pack')}>＋ Add item</button>}
            </>
          )}

          {dtab === 'budget' && (
            <>
              <div className="kap-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--faint)', fontSize: 13 }}>Spent</span><b style={{ fontSize: 20 }}>{money(spent)}</b></div>
              </div>
              <div className="kap-sec"><h2>Expenses</h2></div>
              {exp.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">💸</span><b>No expenses yet</b><p>Log what you spend on this trip.</p></div>}
              {exp.map(e => (
                <div key={e.id} className="kap-row" style={{ marginBottom: 8 }}>
                  <span className="kap-row-em">{e.icon}</span>
                  <span className="kap-row-main"><b>{e.name || e.category}</b><small>{e.category}</small></span>
                  <span className="kap-row-right">{money(e.amount)}</span>
                </div>
              ))}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('exp')}>＋ Log expense</button>
            </>
          )}
        </>
      )}

      {sheet === 'trip' && <TripSheet members={members} onClose={() => setSheet(null)} onSave={async d => { const t = await travel.createTrip(cid, d).catch(() => null); setSheet(null); if (t) { await reloadTrips(); openTrip(t.id) } }} />}
      {sheet === 'act' && trip && <ActSheet onClose={() => setSheet(null)} onSave={async a => { await travel.addActivity(cid, trip.id, a).catch(() => {}); setSheet(null); loadDetail(trip.id) }} />}
      {sheet === 'pack' && trip && <TextSheet title="Add packing item" placeholder="e.g. Sunscreen" onClose={() => setSheet(null)} onSave={async n => { await travel.addPack(cid, trip.id, [{ name: n }]).catch(() => {}); setSheet(null); loadDetail(trip.id) }} />}
      {sheet === 'exp' && trip && <ExpSheet onClose={() => setSheet(null)} onSave={async e => { await travel.addExpense(cid, trip.id, e).catch(() => {}); setSheet(null); loadDetail(trip.id) }} />}
    </AppShell>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="kap-scrim" onClick={onClose}>
      <div className="kap-sheet" onClick={e => e.stopPropagation()}>
        <div className="kap-grip" /><h3>{title}</h3>{children}
      </div>
    </div>
  )
}

function TripSheet({ members, onClose, onSave }: { members: { id: string; name: string }[]; onClose: () => void; onSave: (d: Partial<Trip>) => void }) {
  const [title, setTitle] = useState(''); const [dest, setDest] = useState(''); const [s, setS] = useState(''); const [e, setE] = useState(''); const [emoji, setEmoji] = useState('✈️'); const [who, setWho] = useState<string[]>([])
  const EMO = ['✈️', '🏝️', '⛰️', '🏙️', '🎡', '🚗']
  return (
    <Sheet title="New trip" onClose={onClose}>
      <div className="kap-chips" style={{ margin: '6px 0 12px' }}>{EMO.map(x => <button key={x} className={`kap-chip${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>)}</div>
      <input className="kap-field" placeholder="Trip name" value={title} onChange={ev => setTitle(ev.target.value)} autoFocus />
      <div className="kap-lbl">Destination</div>
      <input className="kap-field" placeholder="e.g. Bali" value={dest} onChange={ev => setDest(ev.target.value)} />
      <div className="kap-lbl">Dates</div>
      <div style={{ display: 'flex', gap: 8 }}><input className="kap-field" type="date" value={s} onChange={ev => setS(ev.target.value)} /><input className="kap-field" type="date" value={e} onChange={ev => setE(ev.target.value)} /></div>
      <div className="kap-lbl">Travelers</div>
      <div className="kap-chips" style={{ flexWrap: 'wrap' }}>{members.map(m => <button key={m.id} className={`kap-chip${who.includes(m.id) ? ' on' : ''}`} onClick={() => setWho(w => w.includes(m.id) ? w.filter(x => x !== m.id) : [...w, m.id])}>{m.name.split(' ')[0]}</button>)}</div>
      <button className="kap-btn primary block" style={{ marginTop: 18 }} disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), destination: dest.trim() || null, startDate: s || null, endDate: e || null, emoji, travelers: who })}>Create trip</button>
    </Sheet>
  )
}

function ActSheet({ onClose, onSave }: { onClose: () => void; onSave: (a: Partial<Activity>) => void }) {
  const [name, setName] = useState(''); const [day, setDay] = useState(''); const [time, setTime] = useState(''); const [emoji, setEmoji] = useState('📍'); const [note, setNote] = useState('')
  const EMO = ['📍', '🍽️', '🏖️', '🎟️', '🚕', '🛍️', '🏛️']
  return (
    <Sheet title="Add activity" onClose={onClose}>
      <div className="kap-chips" style={{ margin: '6px 0 12px' }}>{EMO.map(x => <button key={x} className={`kap-chip${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>)}</div>
      <input className="kap-field" placeholder="What's the plan?" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input className="kap-field" type="date" value={day} onChange={e => setDay(e.target.value)} /><input className="kap-field" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
      <input className="kap-field" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 10 }} />
      <button className="kap-btn primary block" style={{ marginTop: 18 }} disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), dayDate: day || null, atTime: time || null, emoji, note: note.trim() || null })}>Add activity</button>
    </Sheet>
  )
}

function ExpSheet({ onClose, onSave }: { onClose: () => void; onSave: (e: Partial<TripExpense>) => void }) {
  const [name, setName] = useState(''); const [amt, setAmt] = useState(''); const [cat, setCat] = useState('Other'); const [icon, setIcon] = useState('💸')
  const CATS: [string, string][] = [['Flights', '✈️'], ['Stay', '🏨'], ['Food', '🍽️'], ['Activities', '🎟️'], ['Other', '💸']]
  return (
    <Sheet title="Log expense" onClose={onClose}>
      <input className="kap-field" placeholder="What for?" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <input className="kap-field" placeholder="Amount (QAR)" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} style={{ marginTop: 10 }} />
      <div className="kap-lbl">Category</div>
      <div className="kap-chips" style={{ flexWrap: 'wrap' }}>{CATS.map(([c, ic]) => <button key={c} className={`kap-chip${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(ic) }}>{ic} {c}</button>)}</div>
      <button className="kap-btn primary block" style={{ marginTop: 18 }} disabled={!amt} onClick={() => onSave({ name: name.trim() || null, amount: Number(amt) || 0, category: cat, icon })}>Log expense</button>
    </Sheet>
  )
}

function TextSheet({ title, placeholder, onClose, onSave }: { title: string; placeholder: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <Sheet title={title} onClose={onClose}>
      <input className="kap-field" placeholder={placeholder} value={v} onChange={e => setV(e.target.value)} autoFocus />
      <button className="kap-btn primary block" style={{ marginTop: 18 }} disabled={!v.trim()} onClick={() => onSave(v.trim())}>Add</button>
    </Sheet>
  )
}
