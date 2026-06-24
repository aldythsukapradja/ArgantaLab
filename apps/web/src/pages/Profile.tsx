import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS, STAGE_META, ageFromDob, stageForDob } from '@/data/learn'
import { worldRing, earnedBadges } from '@lib/learnProgress'
import { loadMyGames } from '@lib/myGames'
import { addKid as addKidLocal } from '@lib/circles'   // offline-only fallback
import Buddy from '@components/avatar/Buddy'
import KidForm, { type KidFormData } from '@components/auth/KidForm'
import FriendSearch from '@components/auth/FriendSearch'
import CircleMembers from '@components/circles/CircleMembers'
import EditKid from '@components/circles/EditKid'
import { cloudEnabled } from '@lib/supabase'
import {
  signOutCloud, parentCreateKid, unlinkKid, resetKidPin,
  listMyKids, myCircles, myInvites, respondToInvite, createCircle, circleRoster,
  socialStats, myFriends, myFriendRequests, respondFriendRequest,
  removeFriend, kidFriends, removeKidFriend, kidWorldRings,
  type CloudProfile, type CloudCircle, type PendingInvite, type CircleMember,
  type SocialStats, type Friend, type FriendRequest, type WorldRing,
} from '@lib/cloudAuth'
import '@/styles/profile-premium.css'

const ROLE_RANK: Record<string, number> = { owner: 0, coleader: 1, member: 2, viewer: 3 }
const AV_LIMIT = 6   // optimum: 6 avatars then "+N"

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
  const [rosters, setRosters] = useState<Record<string, CircleMember[]>>({})
  const reloadAll = () => {
    if (!cloudEnabled || !uid) return
    myCircles().then(cs => {
      setCircles(cs)
      // a few member avatars per circle (owner→co-leader→member), for the stacks
      Promise.all(cs.map(c => circleRoster(c.id).then(r => [c.id, r] as const)))
        .then(pairs => setRosters(Object.fromEntries(pairs)))
    })
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
  const [showFriendSearch, setShowFriendSearch] = useState(false)
  const [openCircle, setOpenCircle] = useState<CloudCircle | null>(null)
  const [editingKid, setEditingKid] = useState<CloudProfile | null>(null)
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

  // Create a new circle (e.g. Grandparents) → open its members popup to add people.
  const newCircle = async () => {
    const name = prompt('Name your new circle (e.g. Grandparents):')?.trim()
    if (!name) return
    const id = await createCircle(name, 'friends')
    if (!id) { addToast('Could not create circle', '⚠️'); return }
    addToast(`Created ${name} 🎉`, '✨')
    const fresh = await myCircles(); setCircles(fresh)
    const made = fresh.find(c => c.id === id)
    if (made) setOpenCircle(made)
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

  // ── Friends (code-gated for everyone; search popup excludes kids) ──
  const addFriend = () => setShowFriendSearch(true)
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
        <div className="pp-stats">
          <span className="pp-chip"><b>{stats.circles || circles.length}</b> Circles</span>
          <span className="pp-chip"><b>{stats.connections}</b> Connections</span>
          <span className="pp-chip"><b>{stats.friends || friends.length}</b> Friends</span>
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
          <div className="pp-friends">
            {friends.map(f => (
              <button key={f.id} className="pp-friend" title={f.source === 'circle' ? 'In a shared circle' : 'Friend'} onClick={() => dropFriend(f)}>
                <span className="pp-friend-av" style={{ background: f.role === 'kid' ? '#ec4899' : '#6366f1' }}>{(f.display_name[0] ?? '?').toUpperCase()}</span>
                <b>{f.display_name}</b>
                {f.source === 'circle' && <small>circle</small>}
              </button>
            ))}
          </div>
        )}
    </>
  )

  const friendSearchModal = showFriendSearch && (
    <FriendSearch onClose={() => setShowFriendSearch(false)} onChanged={reloadAll} />
  )

  // ════ KID MODE — only their own stuff, no grown-up tools ════
  if (kidMode) {
    return (
      <div className="screen ig" style={{ justifyContent: 'flex-start', gap: 14 }}>
        {header}
        <div className="pp-actions">
          <button className="pp-action" onClick={() => go({ tab: 'avatar' })}><span className="e">✏️</span> Edit avatar</button>
          <button className="pp-action" onClick={() => go({ tab: 'fame' })}><span className="e">🏆</span> Hall of Fame</button>
        </div>

        {friendReqInbox}

        <div className="section-label">My Circles</div>
        <div className="pp-circles">
          {circles.map(c => <CloudCircleCard key={c.id} circle={c} members={rosters[c.id] ?? []} onClick={() => setOpenCircle(c)} />)}
        </div>

        {friendsBlock}

        {rings}

        <div className="ig-foot">
          <div className="ig-foot-row"><b>{totalBadges}</b> badges earned</div>
          <button className="btn btn-ghost" onClick={kidLogout}>🔒 Log out</button>
        </div>
        <p className="ig-kc">👋 This is your own space, {learnerName}! Only you can see it.</p>
        {friendSearchModal}
        {openCircle && <CircleMembers circle={openCircle} myKids={[]} onClose={() => setOpenCircle(null)} onChanged={reloadAll} />}
      </div>
    )
  }

  // ════ GROWN-UP MODE — full family management ════
  return (
    <div className="screen ig" style={{ justifyContent: 'flex-start', gap: 14 }}>
      {header}

      <div className="pp-actions">
        <button className="pp-action" onClick={() => go({ tab: 'avatar' })}><span className="e">✏️</span> Edit avatar</button>
        {cloudEnabled
          ? <button className="pp-action" onClick={newCircle}><span className="e">➕</span> New circle</button>
          : <button className="pp-action" onClick={openSwitcher}><span className="e">🔑</span> Kid login</button>}
        {cloudEnabled && <button className="pp-action" onClick={addFriend}><span className="e">🫂</span> Add friend</button>}
        <button className="pp-action primary" onClick={() => setView('add')}><span className="e">➕</span> Add kid</button>
      </div>

      {invitesInbox}
      {friendReqInbox}

      <div className="section-label">My Circles <span style={{ fontWeight: 400, color: 'var(--t2)', fontSize: 12 }}>· tap to manage members &amp; roles</span></div>
      <div className="pp-circles">
        {circles.length === 0
          ? <p className="ig-kc" style={{ margin: 0 }}>Your family circle appears here once you add a child.</p>
          : circles.map(c => <CloudCircleCard key={c.id} circle={c} members={rosters[c.id] ?? []} onClick={() => setOpenCircle(c)} />)}
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
        <div className="pp-kids">
          {kids.map((k, i) => {
            const st = stageForDob(k.dob ?? undefined)
            const meta = STAGE_META[st.key]
            const color = PALETTE[i % PALETTE.length]
            return (
              <div key={k.id} className="pp-glass pp-kid">
                <div className="pp-kid-head">
                  <span className="pp-kid-av" style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}>{k.gender === 'girl' ? '👧' : '👦'}</span>
                  <div className="pp-kid-info">
                    <div className="pp-kid-name">{k.display_name}<span className="pp-kid-stage" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.emoji} {st.label}</span></div>
                    <div className="pp-kid-sub">{k.username ? `@${k.username} · ` : ''}code <code>{k.friend_code}</code> · {k.gender === 'girl' ? 'girl' : 'boy'}{k.dob ? ` · age ${ageFromDob(k.dob)}` : ''}</div>
                  </div>
                  <button className="pp-login" onClick={openSwitcher}>Log in</button>
                  <button className="pp-iconchip" title="Edit profile" onClick={() => setEditingKid(k)}>✏️</button>
                  <button className="pp-iconchip" title="Reset PIN" onClick={() => resetPin(k)}>🔑</button>
                  <button className="pp-iconchip" title="Kid's friends" onClick={() => viewKidFriends(k)}>🫂</button>
                  <button className="pp-iconchip" title="Remove from family" onClick={() => removeFromFamily(k)}>✕</button>
                </div>
                <div className="pp-ringrow">
                  {WORLDS.map(w => {
                    const pct = kidRings[k.id]?.find(r => r.world === w.key)?.pct ?? 0
                    return (
                      <div key={w.key} className="pp-ring">
                        <Ring pct={pct} color={w.color} />
                        <small>{RING_LABEL[w.key]}</small>
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

      <details className="pp-glass pp-soft" style={{ marginTop: 6 }}>
        <summary>▸ My learning (your own progress)</summary>
        {rings}
      </details>

      <div className="pp-glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}><b style={{ fontSize: 18 }}>{totalBadges}</b> <span style={{ color: 'var(--t2)' }}>badges earned</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pp-action" style={{ flex: '0 0 auto' }} onClick={() => go({ tab: 'parent' })}><span className="e">📊</span> Family Pulse</button>
          <button className="pp-action" style={{ flex: '0 0 auto' }} onClick={parentLogout}><span className="e">⏻</span> Log out</button>
        </div>
      </div>

      <p className="ig-kc">🔗 Circles are shared with <b>KinetikCircle</b> — our family social app — as it comes online.</p>
      {friendSearchModal}
      {openCircle && <CircleMembers circle={openCircle} myKids={kids} onClose={() => setOpenCircle(null)} onChanged={reloadAll} />}
      {editingKid && <EditKid kid={editingKid} onClose={() => setEditingKid(null)} onSaved={reloadAll} />}
    </div>
  )
}

const ROLE_NAME: Record<string, string> = { owner: 'Owner', coleader: 'Co-leader', member: 'Member', viewer: 'Viewer' }
function CloudCircleCard({ circle, members, onClick }: { circle: CloudCircle; members: CircleMember[]; onClick?: () => void }) {
  const accent = circle.accent || (circle.kind === 'family' ? '#6366f1' : '#8b5cf6')
  // sort owner → co-leader → member → viewer, take the first AV_LIMIT
  const sorted = [...members].sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9))
  const shown = sorted.slice(0, AV_LIMIT)
  const extra = Math.max(0, (members.length || circle.member_count) - shown.length)
  return (
    <button className="pp-circle" onClick={onClick}>
      <div className="pp-circle-accent" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}66)` }} />
      <div className="pp-circle-body">
        <div className="pp-circle-top">
          <span className="pp-circle-disc" style={{ background: `${accent}22`, color: accent }}>{circle.emoji ?? (circle.kind === 'family' ? '👨‍👩‍👧‍👦' : '👥')}</span>
          <div>
            <b style={{ fontSize: 14 }}>{circle.name}</b>
            <div className="pp-circle-meta">{circle.member_count} · {circle.role === 'owner' && <span>👑 </span>}{ROLE_NAME[circle.role] ?? circle.role}</div>
          </div>
        </div>
        {shown.length > 0 && (
          <div className="pp-avstack">
            {shown.map(m => (
              <span key={m.id} className="pp-av" style={{ background: m.is_kid ? '#ec4899' : '#6366f1' }} title={`${m.display_name} · ${ROLE_NAME[m.role] ?? m.role}`}>
                {m.photo_url ? <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (m.display_name[0] ?? '?').toUpperCase()}
              </span>
            ))}
            {extra > 0 && <span className="pp-av more">+{extra}</span>}
          </div>
        )}
      </div>
    </button>
  )
}
