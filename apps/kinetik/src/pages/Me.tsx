import { useEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials } from '@data/energy'
import { cloudReady, supabase } from '@lib/supabase'
import * as repo from '@repo/kinetikRepo'
import { fetchMomentCount } from '@repo/momentsRepo'
import type { World, SocialStats, FamilyMember } from '@repo/kinetikRepo'
import type { Circle } from '@data/types'
import { CircleEmblem as Emblem, accentOf } from '@components/CircleEmblem'
import { IconSun, IconMoon, IconShare, IconPlus, IconLogout, IconTrash, IconChevron, IconPencil } from '@components/Icons'

const ACCENTS = ['#F43F5E', '#0EA5E9', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899']
const KID_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E']
const roleText = (r: string) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : r)
const ROLE_LABEL: Record<string, string> = { owner: 'Owner', coleader: 'Co-leader', member: 'Member', viewer: 'Viewer' }
const roleLabel = (r: string) => ROLE_LABEL[r] ?? roleText(r)
function colorFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return KID_COLORS[h % KID_COLORS.length]
}

// Kid stage/tier by age — mirrors ArgantaLab's STAGES (Tiny → Legend).
const STAGES: { label: string; min: number; max: number }[] = [
  { label: 'Tiny', min: 1, max: 6 }, { label: 'Starter', min: 6, max: 8 },
  { label: 'Explorer', min: 8, max: 11 }, { label: 'Builder', min: 11, max: 14 },
  { label: 'Champion', min: 14, max: 16 }, { label: 'Legend', min: 16, max: 19 },
]
function tierFor(age: number | null): string | null {
  if (age == null) return null
  return STAGES.find(s => age >= s.min && age < s.max)?.label ?? (age >= 19 ? 'Legend' : null)
}

function errMsg(e: unknown): string {
  if (!e) return 'Something went wrong'
  if (e instanceof Error) return e.message
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    const parts = [o.message, o.details, o.hint].filter(Boolean) as string[]
    if (parts.length) return parts.join(' · ')
    if (o.code) return `Error ${o.code}`
  }
  return String(e)
}

export default function Me() {
  const circles = useDataStore(s => s.circles)
  const authUser = useDataStore(s => s.me)
  const { addCircle, updateCircle, removeCircle } = useDataStore.getState()
  const { activeCircleId, setCircle, theme, toggleTheme } = useUiStore()

  // Real ArgantaLab family data (owner-only; populates when signed in as owner).
  const [worlds, setWorlds] = useState<World[]>([])
  const [family, setFamily] = useState<FamilyMember[] | null>(null)
  const [rings, setRings] = useState<Record<string, Record<string, number>>>({})
  const [stats, setStats] = useState<SocialStats | null>(null)
  const [momentCount, setMomentCount] = useState(0)

  const [editCircles, setEditCircles] = useState(false)
  const [sheet, setSheet] = useState<'circle' | null>(null)
  const [editing, setEditing] = useState<Circle | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]

  useEffect(() => { repo.fetchWorlds().then(setWorlds).catch(() => {}) }, [])
  useEffect(() => { repo.fetchSocialStats().then(setStats).catch(() => {}) }, [authUser?.id])
  useEffect(() => { if (circle) fetchMomentCount(circle.id).then(setMomentCount).catch(() => setMomentCount(0)) }, [circle?.id])

  // Load the circle's real roster, then each kid's world rings.
  useEffect(() => {
    if (!circle) return
    let alive = true
    setFamily(null)
    repo.fetchFamily(circle.id, authUser).then(fam => {
      if (!alive) return
      setFamily(fam)
      fam.filter(m => m.kind === 'child').forEach(kid => {
        repo.fetchKidRings(kid.id).then(r => { if (alive) setRings(prev => ({ ...prev, [kid.id]: r })) }).catch(() => {})
      })
    }).catch(() => { if (alive) setFamily([]) })
    return () => { alive = false }
  }, [circle?.id, authUser?.id])

  const root = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!root.current) return
    gsap.fromTo(root.current.querySelectorAll('.rise'),
      { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out' })
  }, [circle?.id])

  if (!circle) return <div className="fade-in"><p className="me-foot">No circle loaded yet.</p></div>

  const [a0, a1] = accentOf(circle)
  const name = authUser?.name ?? 'You'
  const diamonds = authUser?.diamonds ?? 0

  // The signed-in user's own role in this circle — Owner / Co-leader / Member.
  // Resolved from the real roster so a co-leader isn't mislabelled as the owner.
  const myMember = family?.find(m => m.isMe) ?? null
  const myRole = myMember ? roleLabel(myMember.role) : null

  // Stats — Moments from the real kinetik_post table; the rest from social_stats RPC.
  const activeCount = family?.length ?? circle.memberIds.length

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const onDeleteCircle = (id: string, nm: string) => {
    if (!window.confirm(`Delete “${nm}”? This removes its members, routines and events. This cannot be undone.`)) return
    run(() => removeCircle(id)).then(() => setEditCircles(false))
  }
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.reload() }

  return (
    <div className="fade-in me3" ref={root} style={{ ['--c0' as any]: a0, ['--c1' as any]: a1 }}>
      {/* Header */}
      <div className="me3-head rise">
        {authUser?.photoUrl
          ? <img className="me3-avatar" src={authUser.photoUrl} alt={name} referrerPolicy="no-referrer" />
          : <div className="me3-avatar me3-avatar-fb">{initials(name)}</div>}
        <div className="me3-head-actions">
          <span className="me3-wallet"><IconDiamondGem /> {diamonds.toLocaleString()}</span>
          <button className="me3-icon-btn" aria-label="Share profile" onClick={() => alert('Share — coming soon')}><IconShare width={16} height={16} /></button>
          <button className="me3-icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>{theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}</button>
        </div>
      </div>
      <div className="me3-name rise">{name}</div>
      <div className="me3-role rise"><span className="me3-role-dot" />{myRole ? `${myRole} · ` : ''}{circle.name}</div>

      {/* Stats (real social_stats; Moments from kinetik) */}
      <div className="me3-stats rise">
        <div className="me3-stat"><b>{momentCount}</b><span>Moments</span></div>
        <div className="me3-stat"><b>{stats?.circles ?? circles.length}</b><span>Circles</span></div>
        <div className="me3-stat"><b>{stats?.connections ?? activeCount}</b><span>Connections</span></div>
        <div className="me3-stat"><b>{stats?.friends ?? 0}</b><span>Friends</span></div>
      </div>

      {err && <div className="me3-error rise">{err}</div>}

      {/* Your circles */}
      <div className="me3-sec-head rise">
        <span className="me3-sec-title">Your circles</span>
        {circles.length > 0 && <button className="me3-edit" onClick={() => setEditCircles(v => !v)}>{editCircles ? 'Done' : 'Manage'}</button>}
      </div>
      <div className="me3-card rise">
        {circles.map(c => {
          const on = c.id === activeCircleId
          const count = on ? activeCount : c.memberIds.length
          return (
            <div key={c.id} className={`me3-circle-row${on ? ' on' : ''}`}>
              <button className="me3-circle-main" onClick={() => setCircle(c.id)}>
                <Emblem accent={accentOf(c)} size={36} active={on} />
                <span className="me3-circle-info">
                  <b>{c.name}</b>
                  <small>{c.kind ?? 'family'} · {count} member{count === 1 ? '' : 's'}</small>
                </span>
              </button>
              {editCircles ? (
                <span className="me3-circle-tools">
                  <button className="me3-tool" aria-label={`Edit ${c.name}`} onClick={() => { setErr(null); setEditing(c) }}><IconPencil width={17} height={17} /></button>
                  <button className="me3-tool danger" disabled={busy} aria-label={`Delete ${c.name}`} onClick={() => onDeleteCircle(c.id, c.name)}><IconTrash width={17} height={17} /></button>
                </span>
              ) : on && <span className="me3-active"><span className="me3-check">✓</span>Active</span>}
            </div>
          )
        })}
        <button className="me3-add-row" disabled={busy} onClick={() => { setErr(null); setSheet('circle') }}>
          <span className="me3-add-ic"><IconPlus width={17} height={17} /></span><span>New circle</span>
        </button>
      </div>

      {/* Members — REAL family (circle_members + child_profiles + kid_today_rings, daily) */}
      <div className="me3-sec-head rise">
        <span className="me3-sec-title">Members · {circle.name}</span>
        {cloudReady && <span className="me3-live"><span className="live-dot" /> Live</span>}
      </div>
      <div className="me3-card rise">
        {family === null && <div className="me3-empty">Loading family…</div>}
        {family && family.length === 0 && <div className="me3-empty">Sign in as the circle owner to see members.</div>}
        {family && family.map(m => (
          <MemberRow key={m.id} m={m} worlds={worlds} rings={rings[m.id]} myDiamonds={m.isMe ? diamonds : null} />
        ))}
      </div>
      {family && family.some(m => m.kind === 'child') && (
        <p className="me3-hint rise">Rings show today's learning and reset each day — read live from ArgantaLab. Manage kids (add / edit / PIN) in the ArgantaLab app.</p>
      )}

      {/* Settings */}
      <div className="me3-sec-head rise"><span className="me3-sec-title">Settings</span></div>
      <div className="me3-card rise">
        <button className="me3-srow" onClick={toggleTheme}>
          <span className="me3-sicon" style={{ background: 'color-mix(in srgb, var(--memory) 14%, transparent)', color: 'var(--memory)' }}>{theme === 'dark' ? <IconSun width={17} height={17} /> : <IconMoon width={17} height={17} />}</span>
          <b>Appearance</b><span className="me3-sval">{theme === 'dark' ? 'Dark' : 'Light'}</span><IconChevron width={16} height={16} className="me3-chev" />
        </button>
        <button className="me3-srow me3-danger" onClick={handleLogout}>
          <span className="me3-sicon" style={{ background: 'color-mix(in srgb, var(--care) 14%, transparent)', color: 'var(--care)' }}><IconLogout width={17} height={17} /></span>
          <b>Sign out</b><IconChevron width={16} height={16} className="me3-chev" />
        </button>
      </div>

      <p className="me-foot rise">Private to the people you choose. No followers, no likes — just your circle.</p>

      {sheet === 'circle' && <NewCircleSheet busy={busy} onClose={() => setSheet(null)}
        onSubmit={(nm, accent) => run(() => addCircle(nm, accent)).then(() => setSheet(null))} />}
      {editing && <EditCircleSheet circle={editing} busy={busy} onClose={() => setEditing(null)}
        onSubmit={(nm, accent) => run(() => updateCircle(editing.id, { name: nm, accent })).then(() => setEditing(null))} />}
    </div>
  )
}

// ── A member row: adults show role + (you) diamonds; kids show 6 world rings ──
function MemberRow({ m, worlds, rings, myDiamonds }: {
  m: FamilyMember; worlds: World[]; rings?: Record<string, number>; myDiamonds: number | null
}) {
  const isKid = m.kind === 'child'
  const avatarBg = m.color || (isKid ? colorFor(m.id) : 'var(--grad)')
  const face = m.emoji || initials(m.name)
  const tier = isKid ? tierFor(m.age) : null
  const sub = isKid
    ? [m.age != null ? `age ${m.age}` : null, m.username ? `@${m.username}` : null].filter(Boolean).join(' · ')
    : roleLabel(m.role)
  return (
    <div className={`me3-member${m.isMe ? ' me' : ''}${isKid ? ' kid' : ''}`}>
      <div className="me3-member-top">
        {m.photoUrl
          ? <img className="me3-mav" src={m.photoUrl} alt={m.name} referrerPolicy="no-referrer" />
          : <span className="me3-mav" style={{ background: avatarBg }}>{face}</span>}
        <div className="me3-minfo">
          <b>
            {m.name}
            {m.isMe && <span className="me3-you">You</span>}
            {tier && <span className="me3-tier">{tier}</span>}
          </b>
          <small>{sub || '—'}</small>
        </div>
        {myDiamonds != null && <span className="me3-mdia"><IconDiamondGem size={13} /> {myDiamonds.toLocaleString()}</span>}
      </div>
      {m.kind === 'child' && worlds.length > 0 && (
        <div className="me3-rings">
          {worlds.map(w => {
            const pct = Math.min(Math.max(rings?.[w.key] ?? 0, 0), 100)
            return (
              <div className="me3-ring" key={w.key}>
                <span className="me3-ring-disc" style={{ ['--rc' as any]: w.color, ['--p' as any]: `${pct * 3.6}deg` }}>
                  <b style={{ color: w.color }}>{pct}</b>
                </span>
                <small>{w.short}</small>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NewCircleSheet({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (name: string, accent: string) => void }) {
  const [nm, setNm] = useState('')
  const [accent, setAccent] = useState(ACCENTS[0])
  return (
    <Sheet title="New circle" onClose={onClose}>
      <input className="field" placeholder="Circle name" value={nm} onChange={e => setNm(e.target.value)} autoFocus />
      <div className="sheet-lbl">Theme colour</div>
      <Swatches value={accent} onPick={setAccent} />
      <button className="btn grad me3-submit" disabled={busy || !nm.trim()} onClick={() => onSubmit(nm.trim(), accent)}>{busy ? 'Creating…' : 'Create circle'}</button>
    </Sheet>
  )
}

function EditCircleSheet({ circle, busy, onClose, onSubmit }: { circle: Circle; busy: boolean; onClose: () => void; onSubmit: (name: string, accent: string) => void }) {
  const [nm, setNm] = useState(circle.name)
  const [accent, setAccent] = useState(circle.accent[0])
  const dirty = nm.trim() !== circle.name || accent !== circle.accent[0]
  return (
    <Sheet title="Edit circle" onClose={onClose}>
      <input className="field" placeholder="Circle name" value={nm} onChange={e => setNm(e.target.value)} autoFocus />
      <div className="sheet-lbl">Theme colour</div>
      <Swatches value={accent} onPick={setAccent} />
      <button className="btn grad me3-submit" disabled={busy || !nm.trim() || !dirty} onClick={() => onSubmit(nm.trim(), accent)}>{busy ? 'Saving…' : 'Save changes'}</button>
    </Sheet>
  )
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="me3-swatches">
      {ACCENTS.map(c => <button key={c} className={`me3-swatch${value === c ? ' on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} aria-label={c} />)}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{title}</div>
        {children}
      </div>
    </div>
  )
}

function IconDiamondGem({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M5.5 3h13l3.5 6-10 12L2 9l3.5-6z" opacity="0.95" /></svg>
}
