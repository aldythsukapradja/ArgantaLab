import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials, colorFor } from '@data/energy'
import { vault, type VaultDoc, type VaultBudget, type VaultExpense, type VaultSub, type VaultField } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'
import { Ring, CountUp, Sheet, Seg, MemberPicker } from './ui'
import { addCalendarEvent, errMsg } from './integrations'

const ACCENT: [string, string] = ['#0E9D6B', '#34D399']
const TABS: AppTab[] = [{ key: 'docs', label: 'Vault', icon: 'shield' }, { key: 'money', label: 'Finance', icon: 'wallet' }, { key: 'family', label: 'Family', icon: 'users' }]
const DOC_CATS: [string, string][] = [['Identity', '🪪'], ['Residence', '🏠'], ['Medical', '🏥'], ['Legal', '⚖️'], ['Financial', '💰'], ['Travel', '✈️'], ['Education', '🎓'], ['Other', '📁']]
const EXP_CATS: [string, string][] = [['Groceries', '🛒'], ['Dining', '🍽️'], ['Transport', '⛽'], ['Utilities', '💡'], ['Kids', '🧒'], ['Health', '🏥'], ['Shopping', '🛍️'], ['Other', '🧾']]
const SUB_CATS: [string, string][] = [['Streaming', '🎬'], ['Music', '🎵'], ['Software', '💻'], ['Cloud', '☁️'], ['Fitness', '💪'], ['Other', '📦']]
const money = (n: number) => `QAR ${Math.round(n).toLocaleString()}`
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
const daysTo = (iso: string | null) => iso ? Math.round((+new Date(iso) - Date.now()) / 864e5) : null
const expClass = (iso: string | null) => { const d = daysTo(iso); if (iso == null || d == null) return 'none'; if (d < 0) return 'danger'; if (d <= 90) return 'warn'; return 'ok' }
const expLabel = (iso: string | null) => { const d = daysTo(iso); if (iso == null || d == null) return 'No expiry'; if (d < 0) return 'Expired'; if (d <= 30) return `${d}d left`; return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) }
type Money = 'overview' | 'budget' | 'expenses' | 'subs'

export default function VaultApp({ onClose }: { onClose: () => void }) {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const cid = circle?.id ?? ''
  const members = useMemo(() => people.filter(p => circle && circle.memberIds.includes(p.id)), [people, circle])

  const [tab, setTab] = useState('docs')
  const [mtab, setMtab] = useState<Money>('overview')
  const [docs, setDocs] = useState<VaultDoc[]>([])
  const [budgets, setBudgets] = useState<VaultBudget[]>([])
  const [expenses, setExpenses] = useState<VaultExpense[]>([])
  const [subs, setSubs] = useState<VaultSub[]>([])
  const [cat, setCat] = useState<string | null>(null)
  const [openDoc, setOpenDoc] = useState<VaultDoc | null>(null)
  const [sheet, setSheet] = useState<null | 'doc' | 'budget' | 'expense' | 'sub'>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1900) }

  const reloadD = () => vault.docs(cid).then(setDocs).catch(e => flash(errMsg(e)))
  const reloadB = () => vault.budgets(cid).then(setBudgets).catch(e => flash(errMsg(e)))
  const reloadE = () => vault.expenses(cid).then(setExpenses).catch(e => flash(errMsg(e)))
  const reloadSub = () => vault.subs(cid).then(setSubs).catch(e => flash(errMsg(e)))
  useEffect(() => { if (cid) { reloadD(); reloadB(); reloadE(); reloadSub() } }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (id: string | null) => id ? (members.find(m => m.id === id)?.name ?? 'Member') : null
  const shownDocs = cat ? docs.filter(d => d.category === cat) : [...docs].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 6)
  const expired = docs.filter(d => daysTo(d.expiry) != null && (daysTo(d.expiry) as number) < 0).length
  const soon = docs.filter(d => { const t = daysTo(d.expiry); return t != null && t >= 0 && t <= 90 }).length

  const mStart = monthStart()
  const monthExp = expenses.filter(e => e.spentAt >= mStart)
  const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0)
  const subTotal = subs.reduce((s, x) => s + x.amount, 0)
  const totalBudget = budgets.reduce((s, b) => s + b.monthly, 0)
  const budgetPct = totalBudget ? Math.min(100, Math.round(monthTotal / totalBudget * 100)) : (monthTotal ? 100 : 0)
  const topCats = useMemo(() => {
    const m = new Map<string, { icon: string; amt: number }>()
    for (const e of monthExp) { const r = m.get(e.category) ?? { icon: e.icon, amt: 0 }; r.amt += e.amount; m.set(e.category, r) }
    return [...m.entries()].map(([c, r]) => ({ cat: c, ...r })).sort((a, b) => b.amt - a.amt).slice(0, 3)
  }, [expenses]) // eslint-disable-line react-hooks/exhaustive-deps

  const remindExpiry = async (d: VaultDoc) => {
    if (!d.expiry) return
    try { await addCalendarEvent({ circleId: cid, title: `🔔 ${d.name} expires`, date: d.expiry, start: '09:00', end: '09:30', who: [] }); flash('Reminder added to Calendar') }
    catch (e) { flash(errMsg(e)) }
  }

  return (
    <AppShell accent={ACCENT} emoji="🔐" title="Family Vault" onBack={() => openDoc ? setOpenDoc(null) : onClose()} tabs={openDoc ? undefined : TABS} tab={tab} onTab={t => { setOpenDoc(null); setCat(null); setTab(t) }} toast={toast}>
      {openDoc ? (
        <>
          <div className="kap-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className="kap-row-em" style={{ fontSize: 24 }}>{openDoc.icon}</span>
              <div><div style={{ fontSize: 18, fontWeight: 800 }}>{openDoc.name}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{openDoc.category}</div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}><span style={{ color: 'var(--faint)', fontSize: 13 }}>Expiry</span><span className={`kap-exp ${expClass(openDoc.expiry)}`}>{expLabel(openDoc.expiry)}</span></div>
            {openDoc.fields.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}><span style={{ color: 'var(--faint)', fontSize: 13 }}>{f.k}</span><b style={{ fontSize: 13.5 }}>{f.v}</b></div>
            ))}
          </div>
          {openDoc.expiry && <button className="kap-btn block" style={{ marginTop: 12 }} onClick={() => remindExpiry(openDoc)}>🔔 Add expiry reminder to Calendar</button>}
          <button className="kap-btn block" style={{ marginTop: 10, color: 'var(--warn)' }} onClick={async () => { try { await vault.delDoc(openDoc.id); setOpenDoc(null); reloadD() } catch (e) { flash(errMsg(e)) } }}>Delete document</button>
        </>
      ) : tab === 'docs' ? (
        <>
          {expired > 0 && <div className="kap-alert danger">⚠️ {expired} document{expired === 1 ? '' : 's'} expired — check Identity & Travel.</div>}
          {soon > 0 && <div className="kap-alert warn">📅 {soon} document{soon === 1 ? '' : 's'} expiring within 90 days.</div>}

          <div className="kap-sec" style={{ marginTop: 8 }}><h2>{cat ?? 'Categories'}</h2>{cat ? <button className="kap-sec-sub" onClick={() => setCat(null)}>← All</button> : <button className="kap-sec-sub" onClick={() => setSheet('doc')}>+ Add</button>}</div>
          {!cat && (
            <div className="kap-cats">
              {DOC_CATS.map(([c, ic]) => { const n = docs.filter(d => d.category === c).length; const hasExp = docs.some(d => d.category === c && daysTo(d.expiry) != null && (daysTo(d.expiry) as number) < 0); return (
                <button key={c} className="kap-cat" onClick={() => setCat(c)}>
                  <span className="kap-cat-ic">{ic}{hasExp ? <sup style={{ fontSize: 9 }}>⚠️</sup> : ''}</span>
                  <span className="kap-cat-name">{c}</span>
                  <span className="kap-cat-count">{n} doc{n === 1 ? '' : 's'}</span>
                </button>
              ) })}
            </div>
          )}

          <div className="kap-sec"><h2>{cat ? `${cat} documents` : 'Recently added'}</h2><span className="kap-sec-sub">{shownDocs.length}</span></div>
          {shownDocs.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🗂️</span><b>Nothing here yet</b><p>Tap Add to store your first document.</p></div>}
          {shownDocs.map(d => (
            <button key={d.id} className="kap-row" onClick={() => setOpenDoc(d)}>
              <span className="kap-row-em">{d.icon}</span>
              <span className="kap-row-main"><b>{d.name}</b><small>{d.category}{d.fields.length ? ` · ${d.fields.length} fields` : ''}</small></span>
              <span className={`kap-exp ${expClass(d.expiry)}`}>{expLabel(d.expiry)}</span>
            </button>
          ))}
          <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('doc')}>＋ Add document</button>
        </>
      ) : tab === 'money' ? (
        <>
          <div style={{ marginTop: 4 }}>
            <Seg value={mtab} onChange={setMtab} options={[{ k: 'overview', label: 'Overview' }, { k: 'budget', label: 'Budget' }, { k: 'expenses', label: 'Expenses' }, { k: 'subs', label: 'Subs' }]} />
          </div>

          {mtab === 'overview' && (
            <>
              <div className="kap-hero" style={{ marginTop: 12 }}>
                <Ring pct={budgetPct} value={<CountUp to={budgetPct} fmt={n => `${Math.round(n)}%`} />} label={totalBudget ? 'of budget' : 'spent'} />
                <div className="kap-hero-main">
                  <div className="kap-hero-ey">This month</div>
                  <div className="kap-hero-big">QAR <CountUp to={monthTotal} /></div>
                  <div className="kap-hero-sub">{monthExp.length} transactions · {money(subTotal)}/mo subs</div>
                </div>
              </div>
              {topCats.length > 0 && (<>
                <div className="kap-sec"><h2>Top spending</h2></div>
                {topCats.map(c => (
                  <div key={c.cat} className="kap-card" style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><b>{c.icon} {c.cat}</b><small style={{ color: 'var(--faint)', fontWeight: 700 }}>{money(c.amt)}</small></div>
                    <div className="kap-bar"><i style={{ width: `${Math.round(c.amt / topCats[0].amt * 100)}%` }} /></div>
                  </div>
                ))}
              </>)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <button className="kap-btn primary" onClick={() => setSheet('expense')}>＋ Log expense</button>
                <button className="kap-btn" onClick={() => { setMtab('budget'); setSheet('budget') }}>Edit budget</button>
              </div>
            </>
          )}

          {mtab === 'budget' && (<>
            <div className="kap-sec"><h2>Monthly budgets</h2></div>
            {budgets.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">💰</span><b>No budget set</b><p>Set monthly limits to track spending.</p></div>}
            {budgets.map(b => { const used = monthExp.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0); const pct = b.monthly ? Math.min(100, Math.round(used / b.monthly * 100)) : 0; const over = b.monthly && used > b.monthly; return (
              <div key={b.id} className="kap-card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><b>{b.icon} {b.category}</b><small style={{ color: over ? 'var(--warn)' : 'var(--faint)' }}>{money(used)} / {money(b.monthly)}</small></div>
                <div className="kap-bar"><i style={{ width: `${pct}%`, background: over ? 'var(--warn)' : undefined }} /></div>
              </div>
            ) })}
            <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('budget')}>＋ Add budget</button>
          </>)}

          {mtab === 'expenses' && (<>
            <div className="kap-sec"><h2>Expenses</h2><span className="kap-sec-sub">{money(monthTotal)} this month</span></div>
            {expenses.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🧾</span><b>No expenses yet</b><p>Log what the family spends.</p></div>}
            {expenses.map(e => (
              <div key={e.id} className="kap-row">
                <span className="kap-row-em">{e.icon}</span>
                <span className="kap-row-main"><b>{e.descr || e.category}</b><small>{e.category} · {new Date(e.spentAt).toLocaleDateString()}{e.paidBy ? ` · ${nameOf(e.paidBy)}` : ''}</small></span>
                <span className="kap-row-right">{money(e.amount)}</span>
                <button onClick={async () => { try { await vault.delExpense(e.id); reloadE() } catch (er) { flash(errMsg(er)) } }} style={{ color: 'var(--faint)', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('expense')}>＋ Log expense</button>
          </>)}

          {mtab === 'subs' && (<>
            <div className="kap-sec"><h2>Subscriptions</h2><span className="kap-sec-sub">{money(subTotal)} / mo</span></div>
            {subs.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">📺</span><b>No subscriptions</b><p>Track recurring family costs.</p></div>}
            {subs.map(s => (
              <div key={s.id} className="kap-row">
                <span className="kap-row-em">{s.icon}</span>
                <span className="kap-row-main"><b>{s.name}</b><small>{s.category}{s.billingDay ? ` · bills day ${s.billingDay}` : ''}</small></span>
                <span className="kap-row-right">{money(s.amount)}</span>
                <button onClick={async () => { try { await vault.delSub(s.id); reloadSub() } catch (er) { flash(errMsg(er)) } }} style={{ color: 'var(--faint)', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('sub')}>＋ Add subscription</button>
          </>)}
        </>
      ) : (
        <>
          <div className="kap-sec"><h2>Family</h2><span className="kap-sec-sub">{members.length} members</span></div>
          {members.map(m => (
            <div key={m.id} className="kap-row">
              <span className="kap-av" style={{ background: colorFor(m.id), width: 36, height: 36, fontSize: 12 }}>{initials(m.name)}</span>
              <span className="kap-row-main"><b>{m.name}</b></span>
            </div>
          ))}
        </>
      )}

      {sheet === 'doc' && <DocSheet preset={cat} onClose={() => setSheet(null)} onSave={async d => { try { await vault.addDoc(cid, d); setSheet(null); reloadD(); flash('Document saved') } catch (e) { flash(errMsg(e)) } }} />}
      {sheet === 'budget' && <BudgetSheet onClose={() => setSheet(null)} onSave={async (c, i, m) => { try { await vault.setBudget(cid, c, i, m); setSheet(null); reloadB(); flash('Budget saved') } catch (e) { flash(errMsg(e)) } }} />}
      {sheet === 'expense' && <ExpenseSheet members={members} onClose={() => setSheet(null)} onSave={async e => { try { await vault.addExpense(cid, e); setSheet(null); reloadE(); flash('Expense logged') } catch (er) { flash(errMsg(er)) } }} />}
      {sheet === 'sub' && <SubSheet onClose={() => setSheet(null)} onSave={async s => { try { await vault.addSub(cid, s); setSheet(null); reloadSub(); flash('Subscription added') } catch (e) { flash(errMsg(e)) } }} />}
    </AppShell>
  )
}

function DocSheet({ preset, onClose, onSave }: { preset: string | null; onClose: () => void; onSave: (d: Partial<VaultDoc>) => void }) {
  const init = DOC_CATS.find(c => c[0] === preset) ?? DOC_CATS[0]
  const [name, setName] = useState(''); const [cat, setCat] = useState(init[0]); const [icon, setIcon] = useState(init[1]); const [exp, setExp] = useState(''); const [fields, setFields] = useState('')
  const parsed: VaultField[] = fields.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => { const [k, ...v] = l.split(':'); return { k: k.trim(), v: v.join(':').trim() } })
  return (
    <Sheet title="Add document" sub="Store details — fields stay private to your circle." onClose={onClose}>
      <input className="kap-field" placeholder="e.g. Dad's Passport" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div className="kap-lbl">Category</div>
      <div className="kap-choices">{DOC_CATS.map(([c, i]) => <button key={c} className={`kap-choice${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(i) }}>{i} {c}</button>)}</div>
      <div className="kap-lbl">Expiry (optional)</div>
      <input className="kap-field" type="date" value={exp} onChange={e => setExp(e.target.value)} />
      <div className="kap-lbl">Details (one per line, “label: value”)</div>
      <textarea className="kap-field" rows={3} placeholder={'Number: 1234\nIssued: 2024'} value={fields} onChange={e => setFields(e.target.value)} />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), category: cat, icon, expiry: exp || null, fields: parsed })}>Save document</button>
    </Sheet>
  )
}

function BudgetSheet({ onClose, onSave }: { onClose: () => void; onSave: (cat: string, icon: string, monthly: number) => void }) {
  const [cat, setCat] = useState(EXP_CATS[0][0]); const [icon, setIcon] = useState(EXP_CATS[0][1]); const [amt, setAmt] = useState('')
  return (
    <Sheet title="Add budget" sub="Set a monthly limit per category." onClose={onClose}>
      <div className="kap-choices" style={{ marginBottom: 12 }}>{EXP_CATS.map(([c, i]) => <button key={c} className={`kap-choice${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(i) }}>{i} {c}</button>)}</div>
      <input className="kap-field" inputMode="decimal" placeholder="Monthly limit (QAR)" value={amt} onChange={e => setAmt(e.target.value)} autoFocus />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!amt} onClick={() => onSave(cat, icon, Number(amt) || 0)}>Save budget</button>
    </Sheet>
  )
}

function ExpenseSheet({ members, onClose, onSave }: { members: { id: string; name: string }[]; onClose: () => void; onSave: (e: Partial<VaultExpense>) => void }) {
  const [descr, setDescr] = useState(''); const [cat, setCat] = useState(EXP_CATS[0][0]); const [icon, setIcon] = useState(EXP_CATS[0][1]); const [amt, setAmt] = useState(''); const [paidBy, setPaidBy] = useState<string[]>([])
  return (
    <Sheet title="Log expense" onClose={onClose}>
      <input className="kap-field" placeholder="What for?" value={descr} onChange={e => setDescr(e.target.value)} autoFocus />
      <input className="kap-field" inputMode="decimal" placeholder="Amount (QAR)" value={amt} onChange={e => setAmt(e.target.value)} style={{ marginTop: 10 }} />
      <div className="kap-lbl">Category</div>
      <div className="kap-choices">{EXP_CATS.map(([c, i]) => <button key={c} className={`kap-choice${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(i) }}>{i} {c}</button>)}</div>
      {members.length > 0 && (<>
        <div className="kap-lbl">Paid by</div>
        <MemberPicker members={members} selected={paidBy} max={1} onToggle={id => setPaidBy(p => p[0] === id ? [] : [id])} />
      </>)}
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!amt} onClick={() => onSave({ descr: descr.trim() || null, category: cat, icon, amount: Number(amt) || 0, paidBy: paidBy[0] ?? null })}>Log expense</button>
    </Sheet>
  )
}

function SubSheet({ onClose, onSave }: { onClose: () => void; onSave: (s: Partial<VaultSub>) => void }) {
  const [name, setName] = useState(''); const [cat, setCat] = useState(SUB_CATS[0][0]); const [icon, setIcon] = useState(SUB_CATS[0][1]); const [amt, setAmt] = useState(''); const [day, setDay] = useState('')
  return (
    <Sheet title="Add subscription" onClose={onClose}>
      <input className="kap-field" placeholder="e.g. Netflix" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <input className="kap-field" inputMode="decimal" placeholder="QAR / mo" value={amt} onChange={e => setAmt(e.target.value)} />
        <input className="kap-field" inputMode="numeric" placeholder="Bill day 1–31" value={day} onChange={e => setDay(e.target.value)} />
      </div>
      <div className="kap-lbl">Category</div>
      <div className="kap-choices">{SUB_CATS.map(([c, i]) => <button key={c} className={`kap-choice${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(i) }}>{i} {c}</button>)}</div>
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!name.trim() || !amt} onClick={() => onSave({ name: name.trim(), icon, amount: Number(amt) || 0, period: 'month', category: cat, billingDay: day ? Math.max(1, Math.min(31, Number(day))) : null })}>Add subscription</button>
    </Sheet>
  )
}
