import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import {
  circleRoster, setMemberRole, removeCircleMember, addKidToCircle, inviteToCircle,
  deleteCircle, leaveCircle,
  type CloudCircle, type CircleMember, type CloudProfile,
} from '@lib/cloudAuth'

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', coleader: 'Co-leader', member: 'Member', viewer: 'Viewer' }
const ASSIGNABLE = ['coleader', 'member', 'viewer']

// Polished circle-members popup: see everyone + their role, assign roles
// (owner/co-leader), add members (grown-up by code, or your own child), remove,
// and delete (owner) / leave (everyone else). Reused for any circle kind.
export default function CircleMembers({ circle, myKids, onClose, onChanged }: {
  circle: CloudCircle; myKids: CloudProfile[]; onClose: () => void; onChanged: () => void
}) {
  const addToast = useAppStore(s => s.addToast)
  const [members, setMembers] = useState<CircleMember[]>([])
  const [adding, setAdding] = useState(false)
  const canManage = circle.role === 'owner' || circle.role === 'coleader'
  const isOwner = circle.role === 'owner'

  const load = () => circleRoster(circle.id).then(setMembers)
  useEffect(() => { load() }, [circle.id])

  const changeRole = async (m: CircleMember, role: string) => {
    const r = await setMemberRole(circle.id, m.id, role)
    addToast(r.ok ? `${m.display_name} is now ${ROLE_LABEL[role]}` : (r.error ?? 'Could not update'), r.ok ? '✅' : '⚠️')
    if (r.ok) { load(); onChanged() }
  }
  const remove = async (m: CircleMember) => {
    if (!confirm(`Remove ${m.display_name} from ${circle.name}?`)) return
    const r = await removeCircleMember(circle.id, m.id)
    addToast(r ? `Removed ${m.display_name}` : 'Could not remove', r ? '👋' : '⚠️')
    if (r) { load(); onChanged() }
  }
  const addByCode = async () => {
    const code = prompt('Add a grown-up by their friend code:')?.trim()
    if (!code) return
    const r = await inviteToCircle(circle.id, code, 'member', circle.kind === 'family')
    addToast(r.ok ? 'Invite sent 📨' : (r.error ?? 'Could not invite'), r.ok ? '✅' : '⚠️')
    if (r.ok) { load(); onChanged() }
  }
  const addChild = async (k: CloudProfile) => {
    const r = await addKidToCircle(circle.id, k.id)
    addToast(r.ok ? `${k.display_name} added` : (r.error ?? 'Could not add'), r.ok ? '✨' : '⚠️')
    if (r.ok) { setAdding(false); load(); onChanged() }
  }
  const doDelete = async () => {
    if (!confirm(`Delete ${circle.name}? This can't be undone.`)) return
    const r = await deleteCircle(circle.id)
    addToast(r.ok ? `Deleted ${circle.name}` : (r.error ?? 'Could not delete'), r.ok ? '🗑️' : '⚠️')
    if (r.ok) { onChanged(); onClose() }
  }
  const doLeave = async () => {
    if (!confirm(`Leave ${circle.name}?`)) return
    const r = await leaveCircle(circle.id)
    addToast(r ? `Left ${circle.name}` : 'Could not leave', r ? '👋' : '⚠️')
    if (r) { onChanged(); onClose() }
  }

  const memberIds = new Set(members.map(m => m.id))
  const addableKids = myKids.filter(k => !memberIds.has(k.id))

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,30,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px,94vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', background: 'var(--bg, #fff)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 20 }}>{circle.emoji ?? (circle.kind === 'family' ? '👨‍👩‍👧‍👦' : '👥')}</span>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 16 }}>{circle.name}</b>
            <div style={{ fontSize: 11, color: 'var(--t2)' }}>{members.length} member{members.length === 1 ? '' : 's'} · you are {ROLE_LABEL[circle.role] ?? circle.role}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--t2)' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', flex: '0 0 auto', background: m.is_kid ? '#ec4899' : '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                {m.photo_url ? <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (m.display_name[0] ?? '?').toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>{m.display_name}</b>
                {m.is_kid && <span style={{ fontSize: 10, color: 'var(--t2)', marginLeft: 6 }}>kid</span>}
              </div>
              {m.role === 'owner' || !canManage ? (
                <span style={{ fontSize: 11, color: 'var(--t2)', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>{ROLE_LABEL[m.role] ?? m.role}</span>
              ) : (
                <>
                  <select value={ASSIGNABLE.includes(m.role) ? m.role : 'member'} onChange={e => changeRole(m, e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }}>
                    {ASSIGNABLE.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button onClick={() => remove(m)} title="Remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--t2)', fontSize: 15 }}>✕</button>
                </>
              )}
            </div>
          ))}

          {adding && (
            <div style={{ padding: '8px 14px', borderTop: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6 }}>Add one of your children</div>
              {addableKids.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--t2)', margin: 0 }}>All your kids are already here.</p>
                : addableKids.map(k => (
                  <button key={k.id} onClick={() => addChild(k)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', marginBottom: 6 }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#ec4899', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{(k.display_name[0] ?? '?').toUpperCase()}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{k.display_name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {canManage && (
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={addByCode} style={{ flex: 1, fontSize: 12, padding: '8px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer' }}>🤝 Add grown-up</button>
            <button onClick={() => setAdding(a => !a)} style={{ flex: 1, fontSize: 12, padding: '8px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer' }}>🧒 Add child</button>
          </div>
        )}
        <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'flex-end' }}>
          {isOwner
            ? <button onClick={doDelete} style={{ fontSize: 12, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>🗑️ Delete circle</button>
            : <button onClick={doLeave} style={{ fontSize: 12, color: 'var(--t2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Leave circle</button>}
        </div>
      </div>
    </div>, document.body,
  )
}
