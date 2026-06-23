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
  signOutCloud, linkKid, parentCreateKid, unlinkKid, resetKidPin, adoptKid,
  listMyKids, myCircles, inviteToCircle, myInvites, respondToInvite,
  socialStats, myFriends, myFriendRequests, sendFriendRequest, respondFriendRequest,
  removeFriend, kidFriends, removeKidFriend, kidWorldRings,
  type CloudProfile, type CloudCircle, type PendingInvite,
  type SocialStats, type Friend, type FriendRequest, type WorldRing,
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
  const [stats, setStats] = useState<SocialStats>({ circles: 0, connections: 0, friends: 0 })
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendReqs, setFriendReqs] = useState<FriendRequest[]>([])
  const [kidRings, setKidRings] = useState<Record<string, WorldRing[]>>({})
  const reloadAll = () => {
    if (!cloudEnabled || !uid) return
    myCircles().then(setCircles)
    myInvites().then(setInvites)
    socialStats().then(setStats)
    myFriends().then(setFriends)
    myFriendRequests().then(setFriendReqs)
    listMyKids().then(ks => {
      setCloudKids(ks)
      // per-kid world rings for the command-center cards
      Promise.all(ks.map(k => kidWorldRings(k.id).then(r => [k.id, r] as const)))
        .then(pairs => setKidRings(Object.fromEntries(pairs)))
    })
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
  // Repair path for an existing kid whose cloud account isn't linked to you yet
  // (e.g. created before guardian-linking was reliable). Claims them by PIN.
  const claimKid = async () => {
    const username = prompt('Claim an existing kid — their username:')?.trim()
    if (!username) return
    const pin = prompt(`Enter ${username}'s 4-digit PIN to prove you're their grown-up:`)?.trim()
    if (!pin) return
    const linked = await adoptKid(username, pin)
    addToast(linked ? `${username} is now in your family ☁️` : 'No match — check the username and PIN', linked ? '✨' : '⚠️')
    if (linked) reloadAll()
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

  // ── Friends (code-gated for everyone) ──────────────────────
  const addFriend = async () => {
    const code = prompt('Enter your friend\'s code to add them:')?.trim()
    if (!code) return
    const r = await sendFriendRequest(code)
    addToast(r.ok ? (r.data?.status === 'accepted' ? 'Already friends 🎉' : 'Friend request sent 📨') : (r.error ?? 'Could not send'), r.ok ? '✅' : '⚠️')
    if (r.ok) reloadAll()
  }
  const answerFriendReq = async (req: FriendRequest, accept: boolean) => {
    await respondFriendRequest(req.id, accept)
    addToast(accept ? `You and ${req.from_name} are friends 🎉` : 'Request declined', accept ? '✨' : '👋')
    reloadAll()
  }
  const dropFriend = async (f: Friend) => {
    if (f.source === 'circle') { addToast('In a shared circle — remove from the circle to unfriend', 'ℹ️'); return }
    if (!confirm(`Remove ${f.display_name} from your friends?`)) return
    await removeFriend(f.id); addToast(`Removed ${f.display_name}`, '👋'); reloadAll()
  }
  const viewKidFriends = async (k: CloudProfile) => {
    const list = await kidFriends(k.id)
    if (list.length === 0) { addToast(`${k.display_name} has no friends yet`, '🧒'); return }
    const names = list.map(f => `${f.display_name} (${f.status})`).join('\n')
    const who = prompt(`${k.display_name}'s friends:\n\n${names}\n\nType a name to REMOVE, or cancel:`)?.trim()
    if (!who) return
    const target = list.find(f => f.display_name.toLowerCase() === who.toLowerCase())
    if (!target) { addToast('No match', '⚠️'); return }
    await removeKidFriend(k.id, target.id); addToast(`Removed ${target.display_name} from ${k.display_name}`, '🛡️')
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
          <div className="ig-stat"><b>{stats.circles}</b><span>Circles</span></div>
          <div className="ig-stat"><b>{stats.connections}</b><span>Connections</span></div>
          <div className="ig-stat"><b>{stats.friends}</b><span>Friends</span></div>
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

  // Friend requests inbox (shown to anyone with pending requests)
  const friendReqInbox = friendReqs.length > 0 && (
    <>
      <div className="section-label">🤝 Friend requests</div>
      <div className="ig-kids">
        {friendReqs.map(req => (
          <div key={req.id} className="ig-kid">
            <span className="ig-kid-av" style={{ background: '#10b981' }}>{(req.from_name[0] ?? '?').toUpperCase()}</span>
            <div className="ig-kid-meta"><b>{req.from_name}</b><small>wants to be friends</small></div>
            <button className="ig-kid-play" onClick={() => answerFriendReq(req, true)}>Accept</button>
            <button className="ig-kid-del" title="Decline" onClick={() => answerFriendReq(req, false)}>✕</button>
          </div>
        ))}
      </div>
    </>
  )

  // Friends list (circle co-members ∪ explicit friends)
  const friendsBlock = (
    <>
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Friends</span>
        <button className="ig-btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addFriend}>＋ Add friend</button>
      </div>
      {friends.length === 0
        ? <p className="ig-kc" style={{ margin: 0 }}>Add friends by their code — everyone in your circles is a friend too.</p>
        : (
          <div className="ig-friends" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {friends.map(f => (
              <button key={f.id} className="ig-friend" title={f.source === 'circle' ? 'In a shared circle' : 'Friend'} onClick={() => dropFriend(f)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 999, padding: '5px 12px 5px 6px', background: 'var(--card)', cursor: 'pointer' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: f.role === 'kid' ? '#ec4899' : '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{(f.display_name[0] ?? '?').toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{f.display_name}</span>
                {f.source === 'circle' && <span style={{ fontSize: 10, color: 'var(--t2)' }}>circle</span>}
              </button>
            ))}
          </div>
        )}
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

        {friendReqInbox}

        <div className="section-label">My Circles</div>
        <div className="ig-circles">
          {circles.map(c => <CloudCircleCard key={c.id} circle={c} />)}
        </div>

        {friendsBlock}

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
        {cloudEnabled && <button className="ig-btn" onClick={claimKid}>🪪 Claim kid</button>}
        {cloudEnabled && <button className="ig-btn" onClick={inviteGrownUp}>👥 Add to circle</button>}
        {cloudEnabled && <button className="ig-btn" onClick={addFriend}>🤝 Add friend</button>}
        <button className="ig-btn primary" onClick={() => setView('add')}>＋ Add kid</button>
      </div>

      {invitesInbox}
      {friendReqInbox}

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
                <button className="ig-kid-edit2" title="Kid's friends" onClick={() => viewKidFriends(k)}>🤝</button>
                <button className="ig-kid-del" title="Remove from family" onClick={() => removeFromFamily(k)}>✕</button>
                <div className="ig-kid-rings" style={{ flexBasis: '100%', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginTop: 8 }}>
                  {WORLDS.map(w => {
                    const pct = kidRings[k.id]?.find(r => r.world === w.key)?.pct ?? 0
                    return (
                      <div key={w.key} style={{ textAlign: 'center' }}>
                        <Ring pct={pct} color={w.color} />
                        <small style={{ display: 'block', fontSize: 9, color: 'var(--t2)' }}>{RING_LABEL[w.key]}</small>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {friendsBlock}

      <details className="ig-mylearning" style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--t2)', fontWeight: 700 }}>My learning (your own progress)</summary>
        {rings}
      </details>

      <div className="ig-foot">
        <div className="ig-foot-row"><b>{totalBadges}</b> badges earned</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => go({ tab: 'parent' })}>📊 Family Pulse</button>
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
