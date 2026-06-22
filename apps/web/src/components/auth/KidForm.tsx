import { useState } from 'react'
import { STAGE_META, stageForDob, ageFromDob } from '@/data/learn'
import type { KidProfile, Gender } from '@lib/circles'

export interface KidFormData { displayName: string; username: string; pin: string; dob: string; gender: Gender }

// Shared kid form — used by the parent's Add/Edit (Profile) and by a kid's own
// self-signup (PlayerSwitcher). `mode` only changes the copy.
export default function KidForm({ initial, mode = 'add', busy, error, onSave, onCancel }: {
  initial?: KidProfile
  mode?: 'add' | 'edit' | 'signup'
  busy?: boolean
  error?: string | null
  onSave: (d: KidFormData) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.displayName ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [pin, setPin] = useState(initial?.pin ?? '')
  const [dob, setDob] = useState(initial?.dob ?? '')
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '')
  const ok = !!name.trim() && !!username.trim() && pin.length === 4 && !!dob && !!gender

  const st = dob ? stageForDob(dob) : null
  const meta = st ? STAGE_META[st.key] : null

  const copy = {
    add: { ic: '🧒', title: 'Add a kid', sub: 'Create a profile your child signs into with a username and PIN.', cta: 'Create profile' },
    edit: { ic: '✏️', title: `Edit ${initial?.displayName ?? ''}`, sub: 'Update your child\'s details. Kids can\'t change these themselves.', cta: 'Save changes' },
    signup: { ic: '🎉', title: 'Make your player!', sub: 'Pick a name, a username, and a secret 4-digit PIN. You can start playing right away!', cta: 'Start playing →' },
  }[mode]

  const submit = () => { if (ok && !busy) onSave({ displayName: name.trim(), username: username.trim(), pin, dob, gender: gender as Gender }) }

  return (
    <div className="screen kid-form" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="kid-form-card">
        <div className="kid-form-ic">{copy.ic}</div>
        <h2>{copy.title}</h2>
        <p>{copy.sub}</p>
        <label>{mode === 'signup' ? 'Your name' : "Child's name"}<input className="le-input" value={name} onChange={e => setName(e.target.value)} placeholder="Baginda" /></label>
        <label>Username<input className="le-input" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} placeholder="baginda" /></label>
        <div className="kid-form-row">
          <label>4-digit PIN<input className="le-input" value={pin} inputMode="numeric" maxLength={4} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" /></label>
          <label>Date of birth<input className="le-input" type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setDob(e.target.value)} /></label>
        </div>
        <label>Gender
          <div className="kid-gender">
            <button type="button" className={`kid-gender-opt${gender === 'boy' ? ' on boy' : ''}`} onClick={() => setGender('boy')}>👦 Boy</button>
            <button type="button" className={`kid-gender-opt${gender === 'girl' ? ' on girl' : ''}`} onClick={() => setGender('girl')}>👧 Girl</button>
          </div>
        </label>
        {st && meta && (
          <div className="kid-stage-preview" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
            {meta.emoji} {mode === 'signup' ? 'You\'re a' : 'Auto-classified as'} <b>&nbsp;{st.label}</b>&nbsp;(age {ageFromDob(dob)})
          </div>
        )}
        {error && <p className="kid-login-err" style={{ marginTop: 4 }}>{error}</p>}
        <p className="kid-form-hint">🔒 The PIN is your secret. Date of birth sets the learning stage automatically.</p>
        <div className="kid-form-btns">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" disabled={!ok || busy} style={{ opacity: ok && !busy ? 1 : 0.5 }} onClick={submit}>{busy ? 'Working…' : copy.cta}</button>
        </div>
      </div>
    </div>
  )
}
