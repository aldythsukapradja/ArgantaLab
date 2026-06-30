import { useEffect, useState, useMemo } from 'react'
import { useDataStore, personById } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials, colorFor } from '@data/energy'
import { travel, vault, type Trip, type Activity, type PackItem, type TripExpense, type VaultDoc } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'
import { Ring, CountUp, Skeleton, Sheet, MemberPicker } from './ui'
import { addCalendarEvent, addCalendarBlock, shareToMoment, errMsg } from './integrations'

const ACCENT: [string, string] = ['#0E9DC4', '#38BDF8']
const TABS: AppTab[] = [{ key: 'overview', label: 'Overview', icon: 'compass' }, { key: 'plan', label: 'Itinerary', icon: 'map' }, { key: 'pack', label: 'Packing', icon: 'suitcase' }, { key: 'budget', label: 'Budget', icon: 'wallet' }]
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

export default function TravelApp({ onClose }: { onClose: () => void }) {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
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
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([])
  const [sheet, setSheet] = useState<null | 'trip' | 'act' | 'pack' | 'exp'>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800) }

  const trip = trips?.find(t => t.id === openId) ?? null
  const allTrips = trips ?? []
  const upcoming = allTrips.filter(t => t.startDate && +new Date(t.startDate + 'T23:59') >= Date.now()).sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1))
  const feature = upcoming[0] ?? allTrips[0] ?? null
  const reloadTrips = () => travel.trips(cid).then(setTrips).catch(e => { setTrips([]); flash(errMsg(e)) })
  useEffect(() => { if (cid) { reloadTrips(); vault.docs(cid).then(setVaultDocs).catch(() => {}) } }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDetail = (id: string) => {
    travel.activities(id).then(setActs).catch(e => flash(errMsg(e)))
    travel.packItems(id).then(setPack).catch(e => flash(errMsg(e)))
    travel.expenses(id).then(setExp).catch(e => flash(errMsg(e)))
  }
  const openTrip = (id: string) => { setOpenId(id); setDtab('overview'); loadDetail(id) }

  const packPct = pack.length ? Math.round((pack.filter(p => p.checked).length / pack.length) * 100) : 0
  const spent = exp.reduce((s, e) => s + e.amount, 0)

  // Doc-check: identity/travel docs that expire on or before this trip ends.
  const riskyDocs = useMemo(() => {
    if (!trip?.endDate) return []
    return vaultDocs.filter(d => d.expiry && ['Identity', 'Travel'].includes(d.category) && d.expiry <= (trip.endDate as string))
  }, [vaultDocs, trip])

  const syncTrip = async (t: Trip) => {
    try {
      if (t.startDate && t.endDate) await addCalendarBlock({ circleId: cid, title: `✈️ ${t.title}`, date: t.startDate, endDate: t.endDate, who: t.travelers })
      else if (t.startDate) await addCalendarEvent({ circleId: cid, title: `✈️ ${t.title}`, date: t.startDate, start: '09:00', end: '11:00', who: t.travelers })
      flash('Trip blocked on Calendar')
    } catch (e) { flash(errMsg(e)) }
  }
  const syncActivities = async () => {
    if (!trip) return
    const dated = acts.filter(a => a.dayDate)
    if (!dated.length) { flash('No dated activities'); return }
    try {
      for (const a of dated) await addCalendarEvent({ circleId: cid, title: `${a.emoji} ${a.name}`, date: a.dayDate as string, start: a.atTime || '10:00', end: a.atTime || '11:00', who: trip.travelers })
      flash(`${dated.length} added to Calendar`)
    } catch (e) { flash(errMsg(e)) }
  }
  const shareTrip = async (t: Trip) => {
    try { await shareToMoment({ circleId: cid, body: `✈️ ${t.title}${t.destination ? ' — ' + t.destination : ''} · ${nightsOf(t.startDate, t.endDate)} nights`, tags: ['travel'] }); flash('Shared to Moments') }
    catch (e) { flash(errMsg(e)) }
  }

  const back = () => { if (openId) setOpenId(null); else onClose() }

  return (
    <AppShell accent={ACCENT} emoji="✈️" title="Travel Planner" subtitle={trip?.title} onBack={back} tabs={trip ? TABS : undefined} tab={dtab} onTab={setDtab} toast={toast}>
      {!trip ? (
        <>
          {trips === null && <><Skeleton h={150} /><Skeleton h={74} /><Skeleton h={74} /></>}

          {trips && trips.length === 0 && (
            <div className="trav-empty">
              <div className="trav-empty-orb">🌍</div>
              <h3>Where to next?</h3>
              <p>Plan your family's next adventure — itinerary, smart packing, budget, and a calendar block, all in one place.</p>
              <button className="kap-btn primary block" onClick={() => setSheet('trip')}>✈️ Plan your first trip</button>
            </div>
          )}

          {trips && trips.length > 0 && (
            <>
              {feature && (() => {
                const trav = feature.travelers.map(id => personById(id)).filter(Boolean)
                const isNext = upcoming.includes(feature)
                return (
                  <button className="trav-hero" onClick={() => openTrip(feature.id)} style={{ display: 'block', textAlign: 'left', width: '100%' }}>
                    <span className="trav-hero-glyph">{feature.emoji}</span>
                    <div className="trav-hero-ey">{isNext ? 'Next trip' : 'Latest trip'}</div>
                    <div className="trav-hero-title">{feature.destination || feature.title}</div>
                    <div className="trav-hero-sub">📅 {fmtDate(feature.startDate)} – {fmtDate(feature.endDate)} · {nightsOf(feature.startDate, feature.endDate)} nights</div>
                    <div className="trav-hero-foot">
                      <span className="trav-hero-chip">{countdown(feature)}</span>
                      {trav.length > 0 && <span className="trav-hero-avs">{trav.slice(0, 4).map((p, i) => <span key={i} className="kap-av" style={{ background: colorFor(p!.id), marginLeft: i ? -8 : 0 }}>{initials(p!.name)}</span>)}</span>}
                    </div>
                  </button>
                )
              })()}

              <div className="kap-sec"><h2>All trips</h2><span className="kap-sec-sub">{allTrips.length}</span></div>
              {allTrips.map(t => {
                const trav = t.travelers.map(id => personById(id)).filter(Boolean)
                const live = countdown(t) === 'Happening now'
                return (
                  <button key={t.id} className="trav-card" onClick={() => openTrip(t.id)}>
                    <span className="trav-card-em">{t.emoji}</span>
                    <span className="trav-card-main">
                      <b>{t.destination || t.title}</b>
                      <span className="trav-card-meta">📅 {fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {nightsOf(t.startDate, t.endDate)} nights</span>
                    </span>
                    <span className="trav-card-right">
                      <span className={`trav-card-cd${live ? ' live' : ''}`}>{countdown(t)}</span>
                      {trav.length > 0 && <span className="trav-card-avs">{trav.slice(0, 3).map((p, i) => <span key={i} className="kap-av" style={{ background: colorFor(p!.id), marginLeft: i ? -7 : 0 }}>{initials(p!.name)}</span>)}</span>}
                    </span>
                  </button>
                )
              })}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('trip')}>＋ New trip</button>
            </>
          )}
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
              {riskyDocs.length > 0 && (
                <div className="kap-alert warn" style={{ marginTop: 12 }}>🪪 {riskyDocs.map(d => d.name).join(', ')} expire{riskyDocs.length === 1 ? 's' : ''} before this trip — check Vault.</div>
              )}
              <div className="kap-stats" style={{ marginTop: 10 }}>
                <StatLite v={nightsOf(trip.startDate, trip.endDate)} l="Nights" />
                <StatLite v={<CountUp to={spent} fmt={n => Math.round(n).toLocaleString()} />} l="QAR spent" />
                <StatLite v={trip.travelers.length || 'All'} l="Travelers" />
              </div>
              <div className="kap-sec"><h2>Travelers</h2></div>
              {members.filter(m => trip.travelers.includes(m.id)).map(m => (
                <div key={m.id} className="kap-row"><span className="kap-av" style={{ background: colorFor(m.id), width: 36, height: 36, fontSize: 12 }}>{initials(m.name)}</span><span className="kap-row-main"><b>{m.name}</b></span></div>
              ))}
              {trip.travelers.length === 0 && <p style={{ fontSize: 13, color: 'var(--faint)', padding: '6px 2px' }}>Everyone in {circle?.name}.</p>}
              <button className="kap-btn primary block" style={{ marginTop: 14 }} onClick={() => syncTrip(trip)}>📅 Block trip on Calendar</button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <button className="kap-btn" onClick={syncActivities}>Sync activities</button>
                <button className="kap-btn ghost" onClick={() => shareTrip(trip)}>Share to Moments</button>
              </div>
              <button className="kap-btn block" style={{ marginTop: 10, color: 'var(--warn)' }} onClick={async () => { if (!confirm('Delete this trip?')) return; try { await travel.deleteTrip(trip.id); setOpenId(null); reloadTrips() } catch (e) { flash(errMsg(e)) } }}>Delete trip</button>
            </>
          )}

          {dtab === 'plan' && (
            <>
              <div className="kap-sec"><h2>Itinerary</h2><button className="kap-sec-sub" onClick={syncActivities}>→ Calendar</button></div>
              {acts.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🗺️</span><b>No activities yet</b><p>Add the first thing to do on this trip.</p></div>}
              {acts.map(a => (
                <div key={a.id} className="kap-row">
                  <span className="kap-row-em">{a.emoji}</span>
                  <span className="kap-row-main"><b>{a.name}</b><small>{[fmtDate(a.dayDate), a.atTime, a.note].filter(Boolean).join(' · ')}</small></span>
                  <button onClick={async () => { try { await travel.delActivity(a.id); loadDetail(trip.id) } catch (e) { flash(errMsg(e)) } }} style={{ color: 'var(--faint)', fontSize: 16 }}>×</button>
                </div>
              ))}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('act')}>＋ Add activity</button>
            </>
          )}

          {dtab === 'pack' && (
            <>
              <div className="kap-sec"><h2>Packing</h2><span className="kap-sec-sub">{packPct}%</span></div>
              <div className="kap-bar" style={{ marginBottom: 14 }}><i style={{ width: `${packPct}%` }} /></div>
              {pack.length === 0 && <button className="kap-btn primary block" onClick={async () => { try { await travel.addPack(cid, trip.id, SMART_PACK.map(n => ({ name: n }))); loadDetail(trip.id); flash('Smart list added') } catch (e) { flash(errMsg(e)) } }}>✨ Generate smart packing list</button>}
              {pack.map(it => (
                <button key={it.id} className={`kap-check${it.checked ? ' on' : ''}`} onClick={() => travel.togglePack(it.id, !it.checked).then(() => loadDetail(trip.id)).catch(e => flash(errMsg(e)))}>
                  <span className="kap-check-box">{it.checked ? '✓' : ''}</span>
                  <span className="kap-check-main"><b>{it.name}</b><small>{it.category}</small></span>
                </button>
              ))}
              {pack.length > 0 && <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('pack')}>＋ Add item</button>}
            </>
          )}

          {dtab === 'budget' && (
            <>
              <div className="kap-card"><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--faint)', fontSize: 13 }}>Spent</span><b style={{ fontSize: 20 }}>{money(spent)}</b></div></div>
              <div className="kap-sec"><h2>Expenses</h2></div>
              {exp.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">💸</span><b>No expenses yet</b><p>Log what you spend on this trip.</p></div>}
              {exp.map(e => (
                <div key={e.id} className="kap-row">
                  <span className="kap-row-em">{e.icon}</span>
                  <span className="kap-row-main"><b>{e.name || e.category}</b><small>{e.category}</small></span>
                  <span className="kap-row-right">{money(e.amount)}</span>
                  <button onClick={async () => { try { await travel.delExpense(e.id); loadDetail(trip.id) } catch (er) { flash(errMsg(er)) } }} style={{ color: 'var(--faint)', fontSize: 16 }}>×</button>
                </div>
              ))}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('exp')}>＋ Log expense</button>
            </>
          )}
        </>
      )}

      {sheet === 'trip' && <TripSheet members={members} onClose={() => setSheet(null)} onSave={async d => { try { const t = await travel.createTrip(cid, d); setSheet(null); await reloadTrips(); openTrip(t.id) } catch (e) { flash(errMsg(e)) } }} />}
      {sheet === 'act' && trip && <ActSheet onClose={() => setSheet(null)} onSave={async a => { try { await travel.addActivity(cid, trip.id, a); setSheet(null); loadDetail(trip.id) } catch (e) { flash(errMsg(e)) } }} />}
      {sheet === 'pack' && trip && <TextSheet title="Add packing item" placeholder="e.g. Sunscreen" onClose={() => setSheet(null)} onSave={async n => { try { await travel.addPack(cid, trip.id, [{ name: n }]); setSheet(null); loadDetail(trip.id) } catch (e) { flash(errMsg(e)) } }} />}
      {sheet === 'exp' && trip && <ExpSheet onClose={() => setSheet(null)} onSave={async e => { try { await travel.addExpense(cid, trip.id, e); setSheet(null); loadDetail(trip.id) } catch (er) { flash(errMsg(er)) } }} />}
    </AppShell>
  )
}

function StatLite({ v, l }: { v: React.ReactNode; l: string }) { return <div className="kap-stat"><b>{v}</b><span>{l}</span></div> }

function TripSheet({ members, onClose, onSave }: { members: { id: string; name: string }[]; onClose: () => void; onSave: (d: Partial<Trip>) => void }) {
  const [title, setTitle] = useState(''); const [dest, setDest] = useState(''); const [s, setS] = useState(''); const [e, setE] = useState(''); const [emoji, setEmoji] = useState('✈️'); const [who, setWho] = useState<string[]>([])
  const EMO = ['✈️', '🏝️', '⛰️', '🏙️', '🎡', '🚗']
  return (
    <Sheet title="New trip" onClose={onClose}>
      <div className="kap-choices" style={{ marginBottom: 12 }}>{EMO.map(x => <button key={x} className={`kap-choice${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>)}</div>
      <input className="kap-field" placeholder="Trip name" value={title} onChange={ev => setTitle(ev.target.value)} autoFocus />
      <div className="kap-lbl">Destination</div>
      <input className="kap-field" placeholder="e.g. Bali" value={dest} onChange={ev => setDest(ev.target.value)} />
      <div className="kap-lbl">Dates</div>
      <div style={{ display: 'flex', gap: 8 }}><input className="kap-field" type="date" value={s} onChange={ev => { setS(ev.target.value); if (e < ev.target.value) setE(ev.target.value) }} /><input className="kap-field" type="date" value={e} min={s} onChange={ev => setE(ev.target.value)} /></div>
      <div className="kap-lbl">Travelers</div>
      <MemberPicker members={members} selected={who} max={0} onToggle={id => setWho(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id])} />
      <button className="kap-btn primary block" style={{ marginTop: 18 }} disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), destination: dest.trim() || null, startDate: s || null, endDate: e || null, emoji, travelers: who })}>Create trip</button>
    </Sheet>
  )
}

function ActSheet({ onClose, onSave }: { onClose: () => void; onSave: (a: Partial<Activity>) => void }) {
  const [name, setName] = useState(''); const [day, setDay] = useState(''); const [time, setTime] = useState(''); const [emoji, setEmoji] = useState('📍'); const [note, setNote] = useState('')
  const EMO = ['📍', '🍽️', '🏖️', '🎟️', '🚕', '🛍️', '🏛️']
  return (
    <Sheet title="Add activity" onClose={onClose}>
      <div className="kap-choices" style={{ marginBottom: 12 }}>{EMO.map(x => <button key={x} className={`kap-choice${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>)}</div>
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
      <div className="kap-choices">{CATS.map(([c, ic]) => <button key={c} className={`kap-choice${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(ic) }}>{ic} {c}</button>)}</div>
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
