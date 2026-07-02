import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { myCircles, listMyKids, type CloudCircle, type CloudProfile } from '@lib/cloudAuth'
import { createCup, CUP_METRICS, CUP_DURATIONS, type CupMetric, type CupPrizeKind } from '@lib/competitions'
import { MOUNTS } from '@/data/openworld'
import { COSMETICS } from '@/data/cosmetics'

// Guardian creates an ArgantaCup: a time-boxed contest inside one of their
// circles with a real prize (diamonds / mount / shop item). Diamond prizes are
// escrowed from the guardian's budget by the server on start.
export default function CupCreate({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const addToast = useAppStore(s => s.addToast)
  const budget = useAppStore(s => s.diamonds)

  const [circles, setCircles] = useState<CloudCircle[]>([])
  const [kids, setKids] = useState<CloudProfile[]>([])
  const [circleId, setCircleId] = useState('')
  const [title, setTitle] = useState('Weekend Sprint')
  const [metric, setMetric] = useState<CupMetric>('xp')
  const [days, setDays] = useState(7)
  const [off, setOff] = useState<Set<string>>(new Set())        // deselected kids
  const [prizeKind, setPrizeKind] = useState<CupPrizeKind>('diamonds')
  const [diamonds, setDiamonds] = useState(500)
  const [mountId, setMountId] = useState(MOUNTS[0]?.id ?? '')
  const [itemId, setItemId] = useState(COSMETICS[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    myCircles().then(cs => {
      const mine = cs.filter(c => c.role === 'owner' || c.role === 'coleader')
      setCircles(mine); setCircleId(mine[0]?.id ?? '')
    })
    listMyKids().then(setKids)
  }, [])

  const selectedKids = useMemo(() => kids.filter(k => !off.has(k.id)), [kids, off])
  const toggleKid = (id: string) => setOff(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const create = async () => {
    if (!circleId) { addToast('Make a family circle first (add a kid).', '⚠️'); return }
    if (prizeKind === 'diamonds' && diamonds > budget) { addToast("That prize is above your diamond budget.", '💎'); return }
    setBusy(true)
    // all kids selected → send null so the server enters EVERY kid in the circle
    const allOn = off.size === 0
    const r = await createCup({
      circleId, title: title.trim(), metric, days, prizeKind,
      prizeDiamonds: prizeKind === 'diamonds' ? diamonds : 0,
      prizeItem: prizeKind === 'mount' ? mountId : prizeKind === 'item' ? itemId : null,
      kids: allOn ? null : selectedKids.map(k => k.id),
    })
    setBusy(false)
    if (r.ok) {
      if (typeof r.balance === 'number') useAppStore.setState({ diamonds: r.balance })
      addToast(`ArgantaCup started! 🏆`, '🏆')
      onCreated(); onClose()
    } else addToast(r.error ?? 'Could not start the cup', '⚠️')
  }

  const field: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, background: 'var(--card)' }
  const chip = (on: boolean): React.CSSProperties => ({ flex: 1, padding: '9px 4px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    border: `1.5px solid ${on ? '#6366f1' : 'var(--border)'}`, background: on ? 'color-mix(in srgb,#6366f1 12%,transparent)' : 'var(--card)', color: on ? '#6366f1' : 'inherit' })

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,30,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 95, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px,94vw)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg,#fff)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <b style={{ fontSize: 16, flex: 1 }}>🏆 New ArgantaCup</b>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--t2)' }}>✕</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {circles.length > 1 && (
            <label style={{ fontSize: 12, color: 'var(--t2)' }}>Circle
              <select value={circleId} onChange={e => setCircleId(e.target.value)} style={{ ...field, marginTop: 4, cursor: 'pointer' }}>
                {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}

          <label style={{ fontSize: 12, color: 'var(--t2)' }}>Cup name
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>

          <label style={{ fontSize: 12, color: 'var(--t2)' }}>Challenge
            <select value={metric} onChange={e => setMetric(e.target.value as CupMetric)} style={{ ...field, marginTop: 4, cursor: 'pointer' }}>
              {CUP_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>

          <div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>Runs for</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {CUP_DURATIONS.map(d => (
                <button key={d} onClick={() => setDays(d)} style={chip(days === d)}>{d}d</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>Who's in <span style={{ color: 'var(--t3)' }}>· all kids by default</span></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {kids.length === 0 && <span style={{ fontSize: 12, color: 'var(--t3)' }}>No kids in this family yet.</span>}
              {kids.map(k => {
                const on = !off.has(k.id)
                return (
                  <button key={k.id} onClick={() => toggleKid(k.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 6px', borderRadius: 999, cursor: 'pointer', fontSize: 13,
                      border: `1.5px solid ${on ? '#6366f1' : 'var(--border)'}`, background: on ? 'color-mix(in srgb,#6366f1 10%,transparent)' : 'var(--card)', color: on ? '#6366f1' : 'var(--t2)' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: on ? '#6366f1' : 'var(--border)', color: on ? '#fff' : 'var(--t2)' }}>{on ? '✓' : ''}</span>
                    {k.display_name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>Prize</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setPrizeKind('diamonds')} style={chip(prizeKind === 'diamonds')}>💎 Diamonds</button>
              <button onClick={() => setPrizeKind('mount')} style={chip(prizeKind === 'mount')}>🐎 Mount</button>
              <button onClick={() => setPrizeKind('item')} style={chip(prizeKind === 'item')}>🎁 Item</button>
            </div>

            {prizeKind === 'diamonds' && (
              <>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[100, 500, 1000].map(v => <button key={v} onClick={() => setDiamonds(v)} style={chip(diamonds === v)}>{v}</button>)}
                  <input type="number" min={1} value={diamonds} onChange={e => setDiamonds(Math.max(0, Math.floor(Number(e.target.value) || 0)))} style={{ ...field, width: 90, textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel,rgba(127,127,140,.1))', borderRadius: 12, padding: '8px 12px', marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>🔒 {diamonds.toLocaleString()} held from your budget ({budget.toLocaleString()}) until a winner is crowned — refunded if no one plays.</span>
                </div>
              </>
            )}
            {prizeKind === 'mount' && (
              <select value={mountId} onChange={e => setMountId(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                {MOUNTS.map(m => <option key={m.id} value={m.id}>{m.name} · {m.rarity}</option>)}
              </select>
            )}
            {prizeKind === 'item' && (
              <select value={itemId} onChange={e => setItemId(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                {COSMETICS.map(c => <option key={c.id} value={c.id}>{c.name} · {c.rarity}</option>)}
              </select>
            )}
          </div>
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={create} disabled={busy || !circleId} className="btn btn-primary" style={{ flex: 2, padding: '10px', borderRadius: 12, fontSize: 14, fontWeight: 700, opacity: busy || !circleId ? 0.6 : 1 }}>{busy ? 'Starting…' : 'Start the cup'}</button>
        </div>
      </div>
    </div>, document.body,
  )
}
