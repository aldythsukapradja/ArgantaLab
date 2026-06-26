import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { updateKid, type CloudProfile } from '@lib/cloudAuth'
import { STAGES, STAGE_META, stageForDob } from '@/data/learn'

// Guardian edits a child's profile: name, DOB, gender, and LEVEL. Age (DOB) only
// seeds the level; the owner can pin a different stage here (saved as
// stage_override; "Auto" clears it so it follows age again).
export default function EditKid({ kid, onClose, onSaved }: { kid: CloudProfile; onClose: () => void; onSaved: () => void }) {
  const addToast = useAppStore(s => s.addToast)
  const [name, setName] = useState(kid.display_name)
  const [dob, setDob] = useState(kid.dob ?? '')
  const [gender, setGender] = useState(kid.gender ?? 'boy')
  const [stage, setStage] = useState(kid.stage_override ?? '')   // '' = auto-by-age
  const [busy, setBusy] = useState(false)

  const autoStage = stageForDob(dob || undefined)

  const save = async () => {
    if (!name.trim()) { addToast('Name is required', '⚠️'); return }
    setBusy(true)
    const r = await updateKid(kid.id, name.trim(), dob || null, gender, stage || 'auto')
    setBusy(false)
    addToast(r.ok ? `${name.trim()} updated ✏️` : (r.error ?? 'Could not save'), r.ok ? '✅' : '⚠️')
    if (r.ok) { onSaved(); onClose() }
  }

  const field: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, background: 'var(--card)' }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,30,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(400px,94vw)', background: 'var(--bg, #fff)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <b style={{ fontSize: 16, flex: 1 }}>Edit {kid.display_name}</b>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--t2)' }}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--t2)' }}>Name
            <input value={name} onChange={e => setName(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--t2)' }}>Date of birth <span style={{ color: 'var(--t3)' }}>(sets their age band)</span>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
          <div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>Gender</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['boy', 'girl'] as const).map(g => (
                <button key={g} onClick={() => setGender(g)}
                  style={{ flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                           border: `1.5px solid ${gender === g ? '#6366f1' : 'var(--border)'}`,
                           background: gender === g ? 'color-mix(in srgb, #6366f1 12%, transparent)' : 'var(--card)' }}>
                  {g === 'girl' ? '👧 Girl' : '👦 Boy'}
                </button>
              ))}
            </div>
          </div>
          <label style={{ fontSize: 12, color: 'var(--t2)' }}>Level <span style={{ color: 'var(--t3)' }}>(age sets it — change it anytime)</span>
            <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...field, marginTop: 4, cursor: 'pointer' }}>
              <option value="">🎯 Auto · by age ({STAGE_META[autoStage.key]?.emoji} {autoStage.label})</option>
              {STAGES.map(s => <option key={s.key} value={s.key}>{STAGE_META[s.key]?.emoji} {s.label} · ages {s.minAge}–{s.maxAge}</option>)}
            </select>
          </label>
          <small style={{ color: 'var(--t3)', fontSize: 11 }}>Username and PIN don't change here — reset the PIN from the kid card. Level applies next time they sign in.</small>
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={save} disabled={busy} className="btn btn-primary" style={{ flex: 2, padding: '10px', borderRadius: 12, fontSize: 14, fontWeight: 700 }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>, document.body,
  )
}
