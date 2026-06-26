import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials, colorFor } from '@data/energy'
import { vault, type VaultDoc, type VaultBudget, type VaultExpense, type VaultSub, type VaultField } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'
import { Ring, CountUp } from './ui'

const ACCENT: [string, string] = ['#0E9D6B', '#34D399']
const TABS: AppTab[] = [{ key: 'docs', label: 'Documents' }, { key: 'money', label: 'Money' }, { key: 'family', label: 'Family' }]
const DOC_CATS: [string, string][] = [['Documents', '📄'], ['IDs & Passports', '🪪'], ['Insurance', '🛡️'], ['Warranties', '🧾'], ['Health', '💊'], ['Vehicle', '🚗']]
const money = (n: number) => `QAR ${Math.round(n).toLocaleString()}`
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
const daysTo = (iso: string | null) => iso ? Math.round((+new Date(iso) - Date.now()) / 864e5) : null

export default function VaultApp({ onClose }: { onClose: () => void }) {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const cid = circle?.id ?? ''
  const members = useMemo(() => people.filter(p => circle && circle.memberIds.includes(p.id)), [people, circle])

  const [tab, setTab] = useState('docs')
  const [money2, setMoney2] = useState('overview')
  const [docs, setDocs] = useState<VaultDoc[]>([])
  const [budgets, setBudgets] = useState<VaultBudget[]>([])
  const [expenses, setExpenses] = useState<VaultExpense[]>([])
  const [subs, setSubs] = useState<VaultSub[]>([])
  const [docCat, setDocCat] = useState('All')
  const [openDoc, setOpenDoc] = useState<VaultDoc | null>(null)
  const [sheet, setSheet] = useState<null | 'doc' | 'budget' | 'expense' | 'sub'>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1700) }

  const reloadD = () => vault.docs(cid).then(setDocs).catch(() => {})
  const reloadB = () => vault.budgets(cid).then(setBudgets).catch(() => {})
  const reloadE = () => vault.expenses(cid).then(setExpenses).catch(() => {})
  const reloadSub = () => vault.subs(cid).then(setSubs).catch(() => {})
  useEffect(() => { if (cid) { reloadD(); reloadB(); reloadE(); reloadSub() } }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownDocs = docCat === 'All' ? docs : docs.filter(d => d.category === docCat)
  const mStart = monthStart()
  const monthExp = expenses.filter(e => e.spentAt >= mStart)
  const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0)
  const subTotal = subs.reduce((s, x) => s + x.amount, 0)
  const totalBudget = budgets.reduce((s, b) => s + b.monthly, 0)
  const budgetPct = totalBudget ? Math.min(100, Math.round(monthTotal / totalBudget * 100)) : (monthTotal ? 100 : 0)
  const topCats = useMemo(() => {
    const m = new Map<string, { icon: string; amt: number }>()
    for (const e of monthExp) { const r = m.get(e.category) ?? { icon: e.icon, amt: 0 }; r.amt += e.amount; m.set(e.category, r) }
    return [...m.entries()].map(([cat, r]) => ({ cat, ...r })).sort((a, b) => b.amt - a.amt).slice(0, 3)
  }, [expenses])
  const expiringSoon = docs.filter(d => { const dt = daysTo(d.expiry); return dt != null && dt <= 30 }).length

  return (
    <AppShell accent={ACCENT} emoji="🔐" title="Family Vault" onBack={() => openDoc ? setOpenDoc(null) : onClose()} tabs={openDoc ? undefined : TABS} tab={tab} onTab={setTab} toast={toast}>
      {openDoc ? (
        <>
          <div className="kap-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span className="kap-row-em" style={{ fontSize: 24 }}>{openDoc.icon}</span>
              <div><div style={{ fontSize: 18, fontWeight: 800 }}>{openDoc.name}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{openDoc.category}</div></div>
            </div>
            {openDoc.expiry && <div style={{ fontSize: 12.5, fontWeight: 700, color: (daysTo(openDoc.expiry) ?? 99) <= 30 ? 'var(--warn)' : 'var(--faint)', marginBottom: 8 }}>⚠️ Expires {new Date(openDoc.expiry).toLocaleDateString()}</div>}
            {openDoc.fields.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}><span style={{ color: 'var(--faint)', fontSize: 13 }}>{f.k}</span><b style={{ fontSize: 13.5 }}>{f.v}</b></div>
            ))}
          </div>
          <button className="kap-btn block" style={{ marginTop: 14, color: 'var(--warn)' }} onClick={async () => { await vault.delDoc(openDoc.id).catch(() => {}); setOpenDoc(null); reloadD() }}>Delete document</button>
        </>
      ) : tab === 'docs' ? (
        <>
          {expiringSoon > 0 && <div className="kap-card" style={{ background: 'rgba(224,82,74,.08)', borderColor: 'rgba(224,82,74,.2)' }}><b style={{ color: 'var(--warn)' }}>⚠️ {expiringSoon} document{expiringSoon === 1 ? '' : 's'} expiring soon</b></div>}
          <div className="kap-chips" style={{ marginTop: 12 }}>{['All', ...DOC_CATS.map(c => c[0])].map(c => <button key={c} className={`kap-chip${docCat === c ? ' on' : ''}`} onClick={() => setDocCat(c)}>{c}</button>)}</div>
          <div className="kap-sec"><h2>{docCat === 'All' ? 'All documents' : docCat}</h2><span className="kap-sec-sub">{shownDocs.length}</span></div>
          {shownDocs.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🗂️</span><b>Nothing here yet</b><p>Tap Add to store your first document.</p></div>}
          {shownDocs.map(d => {
            const dt = daysTo(d.expiry)
            return (
              <button key={d.id} className="kap-row" style={{ marginBottom: 8 }} onClick={() => setOpenDoc(d)}>
                <span className="kap-row-em">{d.icon}</span>
                <span className="kap-row-main"><b>{d.name}</b><small>{d.category}{d.fields.length ? ` · ${d.fields.length} fields` : ''}</small></span>
                {dt != null && <span className="kap-row-right" style={{ color: dt <= 30 ? 'var(--warn)' : 'var(--faint)', fontSize: 11.5 }}>{dt < 0 ? 'expired' : `${dt}d`}</span>}
              </button>
            )
          })}
          <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('doc')}>＋ Add document</button>
        </>
      ) : tab === 'money' ? (
        <>
          <div className="kap-chips" style={{ marginTop: 4 }}>{[['overview', 'Overview'], ['budget', 'Budget'], ['expenses', 'Expenses'], ['subs', 'Subscriptions']].map(([k, l]) => <button key={k} className={`kap-chip${money2 === k ? ' on' : ''}`} onClick={() => setMoney2(k)}>{l}</button>)}</div>

          {money2 === 'overview' && (
            <>
              <div className="kap-hero" style={{ marginTop: 12 }}>
                <Ring pct={budgetPct} value={<CountUp to={budgetPct} fmt={n => `${Math.round(n)}%`} />} label={totalBudget ? 'of budget' : 'spent'} />
                <div className="kap-hero-main">
                  <div className="kap-hero-ey">This month</div>
                  <div className="kap-hero-big">QAR <CountUp to={monthTotal} /></div>
                  <div className="kap-hero-sub">{monthExp.length} transactions · {money(subTotal)}/mo subs</div>
                </div>
              </div>
              {topCats.length > 0 && (
                <>
                  <div className="kap-sec"><h2>Top spending</h2></div>
                  {topCats.map(c => (
                    <div key={c.cat} className="kap-card" style={{ marginBottom: 9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><b>{c.icon} {c.cat}</b><small style={{ color: 'var(--faint)', fontWeight: 700 }}>{money(c.amt)}</small></div>
                      <div className="kap-bar"><i style={{ width: `${Math.round(c.amt / topCats[0].amt * 100)}%` }} /></div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {money2 === 'budget' && (
            <>
              <div className="kap-sec"><h2>Monthly budgets</h2></div>
              {budgets.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">💰</span><b>No budget set</b><p>Set monthly limits to track spending.</p></div>}
              {budgets.map(b => { const used = monthExp.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0); const pct = b.monthly ? Math.min(100, Math.round(used / b.monthly * 100)) : 0; return (
                <div key={b.id} className="kap-card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><b>{b.icon} {b.category}</b><small style={{ color: 'var(--faint)' }}>{money(used)} / {money(b.monthly)}</small></div>
                  <div className="kap-bar"><i style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--warn)' : undefined }} /></div>
                </div>
              ) })}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('budget')}>＋ Add budget</button>
            </>
          )}

          {money2 === 'expenses' && (
            <>
              <div className="kap-sec"><h2>Expenses</h2><span className="kap-sec-sub">{money(monthTotal)} this month</span></div>
              {expenses.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🧾</span><b>No expenses yet</b><p>Log what the family spends.</p></div>}
              {expenses.map(e => (
                <div key={e.id} className="kap-row" style={{ marginBottom: 8 }}>
                  <span className="kap-row-em">{e.icon}</span>
                  <span className="kap-row-main"><b>{e.descr || e.category}</b><small>{e.category} · {new Date(e.spentAt).toLocaleDateString()}</small></span>
                  <span className="kap-row-right">{money(e.amount)}</span>
                </div>
              ))}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('expense')}>＋ Log expense</button>
            </>
          )}

          {money2 === 'subs' && (
            <>
              <div className="kap-sec"><h2>Subscriptions</h2><span className="kap-sec-sub">{money(subTotal)} / mo</span></div>
              {subs.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">📺</span><b>No subscriptions</b><p>Track recurring family costs.</p></div>}
              {subs.map(s => (
                <div key={s.id} className="kap-row" style={{ marginBottom: 8 }}>
                  <span className="kap-row-em">{s.icon}</span>
                  <span className="kap-row-main"><b>{s.name}</b><small>per {s.period}</small></span>
                  <span className="kap-row-right">{money(s.amount)}</span>
                  <button onClick={async () => { await vault.delSub(s.id).catch(() => {}); reloadSub() }} style={{ color: 'var(--faint)' }}>×</button>
                </div>
              ))}
              <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('sub')}>＋ Add subscription</button>
            </>
          )}
        </>
      ) : (
        <>
          <div className="kap-sec"><h2>Family</h2><span className="kap-sec-sub">{members.length} members</span></div>
          {members.map(m => (
            <div key={m.id} className="kap-row" style={{ marginBottom: 8 }}>
              <span className="kap-av" style={{ background: colorFor(m.id), width: 36, height: 36, fontSize: 12 }}>{initials(m.name)}</span>
              <span className="kap-row-main"><b>{m.name}</b></span>
            </div>
          ))}
        </>
      )}

      {sheet === 'doc' && <DocSheet onClose={() => setSheet(null)} onSave={async d => { await vault.addDoc(cid, d).catch(() => {}); setSheet(null); reloadD() }} />}
      {sheet === 'budget' && <BudgetSheet onClose={() => setSheet(null)} onSave={async (c, i, m) => { await vault.setBudget(cid, c, i, m).catch(() => {}); setSheet(null); reloadB() }} />}
      {sheet === 'expense' && <ExpenseSheet onClose={() => setSheet(null)} onSave={async e => { await vault.addExpense(cid, e).catch(() => {}); setSheet(null); reloadE() }} />}
      {sheet === 'sub' && <SubSheet onClose={() => setSheet(null)} onSave={async s => { await vault.addSub(cid, s).catch(() => {}); setSheet(null); reloadSub() }} />}
    </AppShell>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="kap-scrim" onClick={onClose}><div className="kap-sheet" onClick={e => e.stopPropagation()}><div className="kap-grip" /><h3>{title}</h3>{children}</div></div>
}

function DocSheet({ onClose, onSave }: { onClose: () => void; onSave: (d: Partial<VaultDoc>) => void }) {
  const [name, setName] = useState(''); const [cat, setCat] = useState('Documents'); const [icon, setIcon] = useState('📄'); const [exp, setExp] = useState(''); const [fields, setFields] = useState('')
  const parsed: VaultField[] = fields.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => { const [k, ...v] = l.split(':'); return { k: k.trim(), v: v.join(':').trim() } })
  return (
    <Sheet title="Add document" onClose={onClose}>
      <input className="kap-field" placeholder="Document name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div className="kap-lbl">Category</div>
      <div className="kap-chips" style={{ flexWrap: 'wrap' }}>{DOC_CATS.map(([c, i]) => <button key={c} className={`kap-chip${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(i) }}>{i} {c}</button>)}</div>
      <div className="kap-lbl">Expiry (optional)</div>
      <input className="kap-field" type="date" value={exp} onChange={e => setExp(e.target.value)} />
      <div className="kap-lbl">Details (one per line, “label: value”)</div>
      <textarea className="kap-field" rows={3} placeholder={'Number: 1234\nIssued: 2024'} value={fields} onChange={e => setFields(e.target.value)} />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), category: cat, icon, expiry: exp || null, fields: parsed })}>Save document</button>
    </Sheet>
  )
}

function BudgetSheet({ onClose, onSave }: { onClose: () => void; onSave: (cat: string, icon: string, monthly: number) => void }) {
  const [cat, setCat] = useState('Groceries'); const [icon, setIcon] = useState('🛒'); const [amt, setAmt] = useState('')
  const CATS: [string, string][] = [['Groceries', '🛒'], ['Dining', '🍽️'], ['Transport', '⛽'], ['Utilities', '💡'], ['Kids', '🧒'], ['Other', '💵']]
  return (
    <Sheet title="Add budget" onClose={onClose}>
      <div className="kap-chips" style={{ flexWrap: 'wrap', margin: '6px 0 12px' }}>{CATS.map(([c, i]) => <button key={c} className={`kap-chip${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(i) }}>{i} {c}</button>)}</div>
      <input className="kap-field" inputMode="decimal" placeholder="Monthly limit (QAR)" value={amt} onChange={e => setAmt(e.target.value)} autoFocus />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!amt} onClick={() => onSave(cat, icon, Number(amt) || 0)}>Save budget</button>
    </Sheet>
  )
}

function ExpenseSheet({ onClose, onSave }: { onClose: () => void; onSave: (e: Partial<VaultExpense>) => void }) {
  const [descr, setDescr] = useState(''); const [cat, setCat] = useState('Groceries'); const [icon, setIcon] = useState('🛒'); const [amt, setAmt] = useState('')
  const CATS: [string, string][] = [['Groceries', '🛒'], ['Dining', '🍽️'], ['Transport', '⛽'], ['Utilities', '💡'], ['Kids', '🧒'], ['Other', '🧾']]
  return (
    <Sheet title="Log expense" onClose={onClose}>
      <input className="kap-field" placeholder="What for?" value={descr} onChange={e => setDescr(e.target.value)} autoFocus />
      <input className="kap-field" inputMode="decimal" placeholder="Amount (QAR)" value={amt} onChange={e => setAmt(e.target.value)} style={{ marginTop: 10 }} />
      <div className="kap-lbl">Category</div>
      <div className="kap-chips" style={{ flexWrap: 'wrap' }}>{CATS.map(([c, i]) => <button key={c} className={`kap-chip${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setIcon(i) }}>{i} {c}</button>)}</div>
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!amt} onClick={() => onSave({ descr: descr.trim() || null, category: cat, icon, amount: Number(amt) || 0 })}>Log expense</button>
    </Sheet>
  )
}

function SubSheet({ onClose, onSave }: { onClose: () => void; onSave: (s: Partial<VaultSub>) => void }) {
  const [name, setName] = useState(''); const [icon, setIcon] = useState('📺'); const [amt, setAmt] = useState('')
  const EMO = ['📺', '🎵', '☁️', '📱', '🎮', '📰']
  return (
    <Sheet title="Add subscription" onClose={onClose}>
      <div className="kap-chips" style={{ margin: '6px 0 12px' }}>{EMO.map(x => <button key={x} className={`kap-chip${icon === x ? ' on' : ''}`} onClick={() => setIcon(x)}>{x}</button>)}</div>
      <input className="kap-field" placeholder="Service name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <input className="kap-field" inputMode="decimal" placeholder="Amount / month (QAR)" value={amt} onChange={e => setAmt(e.target.value)} style={{ marginTop: 10 }} />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!name.trim() || !amt} onClick={() => onSave({ name: name.trim(), icon, amount: Number(amt) || 0, period: 'month' })}>Add subscription</button>
    </Sheet>
  )
}
