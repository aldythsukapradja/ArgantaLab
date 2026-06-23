import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { searchUsers, sendFriendRequest, type DirUser } from '@lib/cloudAuth'

const PAGE = 8

// Add-friend search popup: a paginated directory of registered grown-ups
// (kids are never listed). Type to filter; tap Add to send a request; tap
// "Load more" to fetch the next page. Also supports adding by exact code.
export default function FriendSearch({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const addToast = useAppStore(s => s.addToast)
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<DirUser[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const seq = useRef(0)

  // (re)load page 0 on query change (debounced)
  useEffect(() => {
    const id = ++seq.current
    setLoading(true)
    const t = setTimeout(async () => {
      const rows = await searchUsers(q, PAGE, 0)
      if (seq.current !== id) return
      setUsers(rows); setOffset(rows.length); setMore(rows.length === PAGE); setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const loadMore = async () => {
    const rows = await searchUsers(q, PAGE, offset)
    setUsers(u => [...u, ...rows]); setOffset(o => o + rows.length); setMore(rows.length === PAGE)
  }

  const add = async (u: DirUser) => {
    const r = await sendFriendRequest(u.friend_code)
    if (r.ok) { setSent(s => ({ ...s, [u.id]: true })); addToast(`Request sent to ${u.display_name} 📨`, '✅'); onChanged() }
    else addToast(r.error ?? 'Could not send', '⚠️')
  }

  const addByCode = async () => {
    const code = prompt('Add by exact friend code (works for kids too):')?.trim()
    if (!code) return
    const r = await sendFriendRequest(code)
    addToast(r.ok ? 'Friend request sent 📨' : (r.error ?? 'Could not send'), r.ok ? '✅' : '⚠️')
    if (r.ok) onChanged()
  }

  return createPortal(
    <div className="fs-scrim" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,30,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(440px,94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: 'var(--bg, #fff)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <b style={{ fontSize: 16, flex: 1 }}>Add a friend</b>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--t2)' }}>✕</button>
        </div>

        <div style={{ padding: 12 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search grown-ups by name…"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, background: 'var(--card)' }} />
        </div>

        <div style={{ overflowY: 'auto', padding: '0 12px 12px', flex: 1 }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--t2)', fontSize: 13, padding: '18px 0' }}>Searching…</p>
          ) : users.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--t2)', fontSize: 13, padding: '18px 0' }}>No grown-ups found. Try the exact code below.</p>
          ) : users.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 36, height: 36, borderRadius: '50%', flex: '0 0 auto', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                {u.photo_url ? <img src={u.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (u.display_name[0] ?? '?').toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.display_name}</b>
                <small style={{ color: 'var(--t2)', fontSize: 11 }}>code {u.friend_code}</small>
              </div>
              {u.rel === 'friend' ? (
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>✓ Friends</span>
              ) : u.rel === 'pending' || sent[u.id] ? (
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>Pending</span>
              ) : (
                <button onClick={() => add(u)} style={{ fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', borderRadius: 999, padding: '5px 12px', background: 'var(--card)', cursor: 'pointer' }}>＋ Add</button>
              )}
            </div>
          ))}
          {more && !loading && (
            <button onClick={loadMore} style={{ width: '100%', marginTop: 10, padding: '9px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Load more</button>
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <button onClick={addByCode} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🔑 Add by exact code (incl. kids)</button>
        </div>
      </div>
    </div>, document.body,
  )
}
