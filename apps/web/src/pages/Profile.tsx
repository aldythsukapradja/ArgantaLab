import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import { worldRing, earnedBadges } from '@lib/learnProgress'
import { loadMyGames } from '@lib/myGames'
import {
  loadCircles, addKid, removeKid, peopleCount,
  type KidProfile, type Circle,
} from '@lib/circles'
import Buddy from '@components/avatar/Buddy'
import { supabase } from '@lib/supabase'

const RING_LABEL: Record<string, string> = {
  NUM: 'Number', WRD: 'Word', WON: 'Wonder', LOG: 'Logic', WLD: 'World', LIF: 'Life',
}

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 20, c = 2 * Math.PI * r
  return (
    <svg width="50" height="50" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r={r} fill="none" stroke="var(--border)" strokeWidth="4.5" />
      <circle cx="25" cy="25" r={r} fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 25 25)" />
      <text x="25" y="29" textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>{pct}</text>
    </svg>
  )
}

export default function Profile() {
  const { learnerName, level, resolvedOutfit, go, isKidMode, openSwitcher, lockSession, addToast } = useAppStore()
  const outfit = resolvedOutfit()
  const kidLogout = () => { addToast('Logged out 👋', '🔒'); lockSession() }
  const parentLogout = async () => { try { await supabase.auth.signOut() } catch { /* ignore */ } addToast('Logged out 👋', '⏻'); lockSession() }
  const [view, setView] = useState<'home' | 'add'>('home')
  const [state, setState] = useState(() => loadCircles())
  const refresh = () => setState(loadCircles())

  const games = loadMyGames().length
  const totalBadges = WORLDS.reduce((a, w) => a + earnedBadges(w).size, 0)
  const handle = '@' + learnerName.toLowerCase().replace(/\s+/g, '')
  const kidMode = isKidMode()

  if (view === 'add') return <AddKid onDone={() => { refresh(); setView('home') }} onCancel={() => setView('home')} />

  // ── shared header ──
  const header = (
    <div className="ig-head">
      <div className="ig-avatar"><Buddy mood="happy" size={92} outfit={outfit} showBg bob={false} /></div>
      <div className="ig-head-r">
        <div className="ig-stats">
          <button className="ig-stat" onClick={() => go({ tab: 'gamestore' })}><b>{games}</b><span>Games</span></button>
          <div className="ig-stat"><b>{state.circles.length}</b><span>Circles</span></div>
          <div className="ig-stat"><b>{peopleCount()}</b><span>People</span></div>
        </div>
        <div className="ig-id">
          <b className="ig-name">{learnerName}</b>
          <span className="ig-handle">{handle} · Lv {level} Explorer</span>
        </div>
      </div>
    </div>
  )

  const rings = (
    <>
      <div className="section-label">Skill rings</div>
      <div className="ig-rings">
        {WORLDS.map(w => (
          <button key={w.key} className="ig-ring" onClick={() => go({ tab: w.key.toLowerCase() })}>
            <Ring pct={worldRing(w)} color={w.color} />
            <small>{RING_LABEL[w.key]}</small>
          </button>
        ))}
      </div>
    </>
  )

  // ════ KID MODE — only their own stuff, no grown-up tools ════
  if (kidMode) {
    return (
      <div className="screen ig" style={{ justifyContent: 'flex-start', gap: 14 }}>
        {header}
        <div className="ig-actions">
          <button className="ig-btn" onClick={() => go({ tab: 'avatar' })}>✏️ Edit avatar</button>
          <button className="ig-btn" onClick={() => go({ tab: 'fame' })}>🏆 Hall of Fame</button>
          <button className="ig-btn" onClick={openSwitcher}>🔄 Switch player</button>
        </div>

        <div className="section-label">My Circle</div>
        <div className="ig-circles">
          {state.circles.map(c => <CircleCard key={c.id} circle={c} kids={state.kids} />)}
        </div>

        {rings}

        <div className="ig-foot">
          <div className="ig-foot-row"><b>{totalBadges}</b> badges earned</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={openSwitcher}>🔄 Switch</button>
            <button className="btn btn-ghost" onClick={kidLogout}>🔒 Log out</button>
          </div>
        </div>
        <p className="ig-kc">👋 This is your own space, {learnerName}! Only you can see it.</p>
      </div>
    )
  }

  // ════ GROWN-UP MODE — full family management ════
  return (
    <div className="screen ig" style={{ justifyContent: 'flex-start', gap: 14 }}>
      {header}

      <div className="ig-actions">
        <button className="ig-btn" onClick={() => go({ tab: 'avatar' })}>✏️ Edit avatar</button>
        <button className="ig-btn" onClick={openSwitcher}>🔑 Kid login</button>
        <button className="ig-btn primary" onClick={() => setView('add')}>＋ Add kid</button>
      </div>

      <div className="section-label">My Circles</div>
      <div className="ig-circles">
        {state.circles.map(c => <CircleCard key={c.id} circle={c} kids={state.kids} />)}
      </div>

      <div className="section-label">Kids in this family</div>
      {state.kids.length === 0 ? (
        <div className="ig-empty">
          <span className="ig-empty-ic">🧒</span>
          <b>No kid profiles yet</b>
          <p>Add a profile for each child. They sign in with a username and a 4-digit PIN you set (and can always see).</p>
          <button className="btn btn-primary" onClick={() => setView('add')}>＋ Add your first kid</button>
        </div>
      ) : (
        <div className="ig-kids">
          {state.kids.map(k => (
            <div key={k.id} className="ig-kid">
              <span className="ig-kid-av" style={{ background: k.color }}>{k.emoji}</span>
              <div className="ig-kid-meta">
                <b>{k.displayName}</b>
                <small>@{k.username} · PIN <code>{k.pin}</code>{k.linkedEmail ? ' · 📧 linked' : ''}</small>
              </div>
              <button className="ig-kid-play" onClick={openSwitcher}>Log in</button>
              <button className="ig-kid-del" title="Remove" onClick={() => { if (confirm(`Remove ${k.displayName}'s profile?`)) { removeKid(k.id); refresh() } }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {rings}

      <div className="ig-foot">
        <div className="ig-foot-row"><b>{totalBadges}</b> badges earned</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => go({ tab: 'parent' })}>🧑‍🏫 Dashboard</button>
          <button className="btn btn-ghost" onClick={parentLogout}>⏻ Log out</button>
        </div>
      </div>

      <p className="ig-kc">🔗 Your Circles will connect to <b>KinetikCircle</b> — our family social app — when it launches.</p>
    </div>
  )
}

function CircleCard({ circle, kids }: { circle: Circle; kids: KidProfile[] }) {
  const members = circle.memberIds.map(id => kids.find(k => k.id === id)).filter(Boolean) as KidProfile[]
  return (
    <div className="ig-circle">
      <div className="ig-circle-top">
        <span className="ig-circle-ic">{circle.emoji}</span>
        <div><b>{circle.name}</b><small>{members.length + 1} member{members.length ? 's' : ''}</small></div>
      </div>
      <div className="ig-circle-members">
        <span className="ig-mem parent" title="You">🧑</span>
        {members.slice(0, 5).map(m => <span key={m.id} className="ig-mem" style={{ background: m.color }} title={m.displayName}>{m.emoji}</span>)}
      </div>
    </div>
  )
}

// ── Add-kid form ──────────────────────────────────────────────
function AddKid({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [age, setAge] = useState('')
  const ok = name.trim() && username.trim() && pin.length === 4

  const submit = () => {
    if (!ok) return
    addKid({ displayName: name.trim(), username: username.trim(), pin, age: age ? Number(age) : undefined })
    onDone()
  }

  return (
    <div className="screen kid-form" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="kid-form-card">
        <div className="kid-form-ic">🧒</div>
        <h2>Add a kid</h2>
        <p>Create a profile your child signs into with a username and PIN.</p>
        <label>Child's name<input className="le-input" value={name} onChange={e => setName(e.target.value)} placeholder="Baginda" /></label>
        <label>Username<input className="le-input" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} placeholder="baginda" /></label>
        <div className="kid-form-row">
          <label>4-digit PIN<input className="le-input" value={pin} inputMode="numeric" maxLength={4} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" /></label>
          <label>Age (optional)<input className="le-input" value={age} inputMode="numeric" maxLength={2} onChange={e => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="8" /></label>
        </div>
        <p className="kid-form-hint">🔒 The PIN is only stored on this device, and you can always see it. Later, your child can upgrade to a Google login.</p>
        <div className="kid-form-btns">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={!ok} style={{ opacity: ok ? 1 : 0.5 }} onClick={submit}>Create profile</button>
        </div>
      </div>
    </div>
  )
}
