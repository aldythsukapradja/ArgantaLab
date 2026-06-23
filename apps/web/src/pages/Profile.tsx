import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS, STAGE_META, ageFromDob, stageForDob } from '@/data/learn'
import { worldRing, earnedBadges } from '@lib/learnProgress'
import { loadMyGames } from '@lib/myGames'
import { addKid as addKidLocal } from '@lib/circles'   // offline-only fallback
import Buddy from '@components/avatar/Buddy'
import KidForm, { type KidFormData } from '@components/auth/KidForm'
import { cloudEnabled } from '@lib/supabase'
import {
  signOutCloud, linkKid, parentCreateKid, unlinkKid, resetKidPin,
  listMyKids, myCircles, inviteToCircle, myInvites, respondToInvite,
  type CloudProfile, type CloudCircle, type PendingInvite,
} from '@lib/cloudAuth'

const RING_LABEL: Record<string, string> = {
  NUM: 'Number', WRD: 'Word', WON: 'Wonder', LOG: 'Logic', WLD: 'World', LIF: 'Life',
}
const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6']

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
  const { learnerName, level, resolvedOutfit, go, isKidMode, openSwitcher, lockSession, addToast, session } = useAppStore()
  const realSession = session && session !== 'loading' ? session : null
  const uid = realSession?.user?.id

  // EVERYTHING family-related is cloud-authoritative (server is the only truth):
  //   kids     → my_children()  (guardian_id OR guardianships, so co-parented kids show)
  //   circles  → my_circles()
  //   invites  → my_invites()
  const [cloudKids, setCloudKids] = useState<CloudProfile[] | null>(null)
  const [circles, setCircles] = useState<CloudCircle[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const reloadAll = () => {
    if (!cloudEnabled || !uid) return
    listMyKids().then(setCloudKids)
    myCircles().then(setCircles)
    myInvites().then(setInvites)
  }
  useEffect(reloadAll, [uid])

  const [view, setView] = useState<'home' | 'add'>('home')
  const outfit = resolvedOutfit()

  const kidLogout = async () => { addToast('Logged out 👋', '🔒'); await signOutCloud(); useAppStore.setState({ role: 'user' }); lockSession() }
  const parentLogout = async () => { await signOutCloud(); addToast('Logged out 👋', '⏻'); lockSession() }

  const addKidCloud = async (d: KidFormData) => {
    if (cloudEnabled && uid) {
      const r = await parentCreateKid(d, uid)
      addToast(r.ok ? `${d.displayName} added ☁️` : (r.error ?? 'Could not create'), r.ok ? '✨' : '⚠️')
      reloadAll()
    } else {
      addKidLocal(d)   // offline dev only
    }
  }

  const linkAKid = async () => {
    const code = prompt('Enter your child\'s friend-code to add them to your family:')
    if (!code) return
    const r = await linkKid(code)
    addToast(r.ok ? 'Kid linked! 👨‍👩‍👧' : (r.error ?? 'Could not link'), r.ok ? '🔗' : '⚠️')
    if (r.ok) reloadAll()
  }

  // Invite another REGISTERED grown-up (by friend code) into the family circle,
  // as a co-guardian. Two+ adults per circle is supported by design.
  const familyCircle = circles.find(c => c.kind === 'family' && c.role === 'owner') ?? circles.find(c => c.kind === 'family')
  const inviteGrownUp = async () => {
    if (!familyCircle) { addToast('Add a child first to create your family circle', '🧒'); return }
    const code = prompt('Enter the grown-up\'s friend-code to invite them as a co-parent:')
    if (!code) return
    const r = await inviteToCircle(familyCircle.id, code, 'admin', true)
    addToast(r.ok ? 'Invite sent 📨 — they accept it on their profile' : (r.error ?? 'Could not invite'), r.ok ? '✅' : '⚠️')
  }

  const removeFromFamily = async (k: CloudProfile) => {
    if (!confirm(`Remove ${k.display_name} from your family? (their account is kept)`)) return
    await unlinkKid(k.id)
    addToast(`Removed ${k.display_name}`, '👋')
    reloadAll()
  }

  const resetPin = async (k: CloudProfile) => {
    const pin = prompt(`Set a new 4-digit PIN for ${k.display_name}:`)
    if (!pin) return
    if (!/^\d{4}$/.test(pin)) { addToast('PIN must be exactly 4 digits', '⚠️'); return }
    const r = await resetKidPin(k.id, pin)
    addToast(r.ok ? `${k.display_name}'s PIN updated 🔑` : (r.error ?? 'Could not update'), r.ok ? '✅' : '⚠️')
  }

  const answerInvite = async (inv: PendingInvite, accept: boolean) => {
    const ok = await respondToInvite(inv.id, accept)
    addToast(ok ? (accept ? `Joined ${inv.circle_name} 🎉` : 'Invite declined') : 'Something went wrong', accept ? '✨' : '👋')
    reloadAll()
  }

  const games = loadMyGames().length
  const totalBadges = WORLDS.reduce((a, w) => a + earnedBadges(w).size, 0)
  const handle = '@' + learnerName.toLowerCase().replace(/\s+/g, '')
  const kidMode = isKidMode()
  const kids = cloudKids ?? []

  if (view === 'add') return <KidForm mode="add" onSave={async d => { await addKidCloud(d); setView('home') }} onCancel={() => setView('home')} />

  // ── shared header ──
  const header = (
    <div className="ig-head">
      <div className="ig-avatar"><Buddy mood="happy" size={92} outfit={outfit} showBg bob={false} /></div>
      <div className="ig-head-r">
        <div className="ig-stats">
          <button className="ig-stat" onClick={() => go({ tab: 'gamestore' })}><b>{games}</b><span>Games</span></button>
          <div className="ig-stat"><b>{circles.length}</b><span>Circles</span></div>
          <div className="ig-stat"><b>{kids.length}</b><span>Kids</span></div>
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

  // Pending invites — shown to ANY signed-in user (a grown-up invited to a circle)
  const invitesInbox = invites.length > 0 && (
    <>
      <div className="section-label">📨 Invites</div>
      <div className="ig-kids">
        {invites.map(inv => (
          <div key={inv.id} className="ig-kid">
            <span className="ig-kid-av" style={{ background: '#6366f1' }}>{inv.circle_kind === 'family' ? '👨‍👩‍👧‍👦' : '👥'}</span>
            <div className="ig-kid-meta">
              <b>{inv.circle_name}</b>
              <small>{inv.invited_by_name} invited you · {inv.role}{inv.as_guardian ? ' · co-parent' : ''}</small>
            </div>
            <button className="ig-kid-play" onClick={() => answerInvite(inv, true)}>Accept</button>
            <button className="ig-kid-del" title="Decline" onClick={() => answerInvite(inv, false)}>✕</button>
          </div>
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

        <div className="section-label">My Circles</div>
        <div className="ig-circles">
          {circles.map(c => <CloudCircleCard key={c.id} circle={c} />)}
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
        {cloudEnabled
          ? <button className="ig-btn" onClick={linkAKid}>🔗 Link kid</button>
          : <button className="ig-btn" onClick={openSwitcher}>🔑 Kid login</button>}
        {cloudEnabled && <button className="ig-btn" onClick={inviteGrownUp}>👥 Invite grown-up</button>}
        <button className="ig-btn primary" onClick={() => setView('add')}>＋ Add kid</button>
      </div>

      {invitesInbox}

      <div className="section-label">My Circles</div>
      <div className="ig-circles">
        {circles.length === 0
          ? <p className="ig-kc" style={{ margin: 0 }}>Your family circle appears here once you add a child.</p>
          : circles.map(c => <CloudCircleCard key={c.id} circle={c} />)}
      </div>

      <div className="section-label">Kids in this family</div>
      {kids.length === 0 ? (
        <div className="ig-empty">
          <span className="ig-empty-ic">🧒</span>
          <b>{cloudEnabled && cloudKids === null ? 'Loading your family…' : 'No kid profiles yet'}</b>
          <p>Add a profile for each child. They sign in with a username and a 4-digit PIN you set.</p>
          <button className="btn btn-primary" onClick={() => setView('add')}>＋ Add your first kid</button>
        </div>
      ) : (
        <div className="ig-kids">
          {kids.map((k, i) => {
            const st = stageForDob(k.dob ?? undefined)
            const meta = STAGE_META[st.key]
            const color = PALETTE[i % PALETTE.length]
            return (
              <div key={k.id} className="ig-kid">
                <span className="ig-kid-av" style={{ background: color }}>{k.gender === 'girl' ? '👧' : '👦'}</span>
                <div className="ig-kid-meta">
                  <b>{k.display_name} <span className="ig-kid-stage" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.emoji} {st.label}</span></b>
                  <small>{k.username ? `@${k.username} · ` : ''}code <code>{k.friend_code}</code> · {k.gender === 'girl' ? '👧 girl' : '👦 boy'}{k.dob ? ` · age ${ageFromDob(k.dob)}` : ''}</small>
                </div>
                <button className="ig-kid-play" onClick={openSwitcher}>Log in</button>
                <button className="ig-kid-edit2" title="Reset PIN" onClick={() => resetPin(k)}>🔑</button>
                <button className="ig-kid-del" title="Remove from family" onClick={() => removeFromFamily(k)}>✕</button>
              </div>
            )
          })}
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

      <p className="ig-kc">🔗 Circles are shared with <b>KinetikCircle</b> — our family social app — as it comes online.</p>
    </div>
  )
}

function CloudCircleCard({ circle }: { circle: CloudCircle }) {
  return (
    <div className="ig-circle">
      <div className="ig-circle-top">
        <span className="ig-circle-ic">{circle.emoji ?? (circle.kind === 'family' ? '👨‍👩‍👧‍👦' : '👥')}</span>
        <div>
          <b>{circle.name}</b>
          <small>{circle.member_count} member{circle.member_count === 1 ? '' : 's'} · {circle.role}</small>
        </div>
      </div>
    </div>
  )
}
