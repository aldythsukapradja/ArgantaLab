import { useEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials } from '@data/energy'
import { cloudReady, supabase } from '@lib/supabase'
import * as repo from '@repo/kinetikRepo'
import type { MemberProgress } from '@repo/kinetikRepo'
import type { Role, Circle } from '@data/types'
import { CircleEmblem as Emblem, accentOf } from '@components/CircleEmblem'
import {
  IconSun, IconMoon, IconShare, IconPlus, IconUserPlus,
  IconLogout, IconTrash, IconMinus, IconChevron, IconPencil,
} from '@components/Icons'

const MEMBER_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E']
const ACCENTS = ['#F43F5E', '#0EA5E9', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899']
const ROLES: Role[] = ['member', 'coleader', 'viewer']

// Show roles EXACTLY as stored in the DB (owner / coleader / member / viewer),
// only capitalising the first letter. No friendly relabelling ("Leader" etc).
const roleText = (r: string) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : r)

// Supabase errors are plain objects ({message, details, hint, code}), NOT Error
// instances — String(e) on them yields "[object Object]". Extract a real message.
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
  const people = useDataStore(s => s.people)
  const moments = useDataStore(s => s.moments)
  const authUser = useDataStore(s => s.me)
  const { addPerson, removePerson, addCircle, updateCircle, removeCircle } = useDataStore.getState()
  const { activeCircleId, setCircle, theme, toggleTheme } = useUiStore()

  const [progress, setProgress] = useState<Record<string, MemberProgress>>({})
  const [editMembers, setEditMembers] = useState(false)
  const [editCircles, setEditCircles] = useState(false)
  const [sheet, setSheet] = useState<'member' | 'circle' | null>(null)
  const [editing, setEditing] = useState<Circle | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))

  useEffect(() => {
    if (!circle) return
    let alive = true
    repo.fetchMemberProgress(circle.id).then(p => { if (alive) setProgress(p) }).catch(() => {})
    return () => { alive = false }
  }, [circle?.id, people.length])

  const root = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!root.current) return
    gsap.fromTo(root.current.querySelectorAll('.rise'),
      { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out' })
  }, [circle?.id])

  if (!circle) return <div className="fade-in"><p className="me-foot">No circle loaded yet.</p></div>

  const [a0, a1] = accentOf(circle)
  const name = authUser?.name ?? members.find(m => m.role === 'owner')?.name ?? 'You'
  const diamonds = authUser?.diamonds ?? 0
  const myRole = members.find(m => m.name === name)?.role ?? 'owner'

  const momentCount = moments.filter(m => m.circleId === circle.id).length
  const circleCount = circles.length
  const connectionCount = members.length
  const friendCount = Math.max(people.length - 1, 0)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr(errMsg(e)) }
    finally { setBusy(false) }
  }
  const onRemoveMember = (id: string, who: string) => {
    if (!window.confirm(`Remove ${who} from ${circle.name}?`)) return
    run(() => removePerson(id))
  }
  const onDeleteCircle = (id: string, nm: string) => {
    if (!window.confirm(`Delete “${nm}”? This removes its members, routines and events. This cannot be undone.`)) return
    run(() => removeCircle(id)).then(() => setEditCircles(false))
  }
  const nextColor = () => MEMBER_COLORS[members.length % MEMBER_COLORS.length]
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.reload() }

  return (
    <div className="fade-in me3" ref={root} style={{ ['--c0' as any]: a0, ['--c1' as any]: a1 }}>
      {/* Header (no cover) */}
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
      <div className="me3-role rise"><span className="me3-role-dot" />{roleText(myRole)} · {circle.name}</div>

      {/* Stats */}
      <div className="me3-stats rise">
        <div className="me3-stat"><b>{momentCount}</b><span>Moments</span></div>
        <div className="me3-stat"><b>{circleCount}</b><span>Circles</span></div>
        <div className="me3-stat"><b>{connectionCount}</b><span>Connections</span></div>
        <div className="me3-stat"><b>{friendCount}</b><span>Friends</span></div>
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
          return (
            <div key={c.id} className={`me3-circle-row${on ? ' on' : ''}`}>
              <button className="me3-circle-main" onClick={() => setCircle(c.id)}>
                <Emblem accent={accentOf(c)} size={36} active={on} />
                <span className="me3-circle-info">
                  <b>{c.name}</b>
                  <small>{c.kind ?? 'family'} · {c.memberIds.length} member{c.memberIds.length === 1 ? '' : 's'}</small>
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

      {/* Members (above settings) — live from kinetik_people */}
      <div className="me3-sec-head rise">
        <span className="me3-sec-title">Members · {circle.name}</span>
        <div className="me3-sec-right">
          {cloudReady && <span className="me3-live"><span className="live-dot" /> Live</span>}
          <button className="me3-edit" onClick={() => setEditMembers(v => !v)}>{editMembers ? 'Done' : 'Edit'}</button>
        </div>
      </div>
      <div className="me3-card rise">
        {members.length === 0 && <div className="me3-empty">No members yet.</div>}
        {members.map(p => {
          // Per-member diamonds come ONLY from the kinetik_member_progress RPC.
          // If it isn't deployed (or returns nothing for this member), show no
          // chip — never a fabricated 0 or the owner's wallet number.
          const prog = progress[p.id]
          return (
            <div key={p.id} className="me3-member">
              {editMembers && p.role !== 'owner' && (
                <button className="me3-remove" disabled={busy} aria-label={`Remove ${p.name}`} onClick={() => onRemoveMember(p.id, p.name)}><IconMinus width={19} height={19} /></button>
              )}
              <span className="me3-mav" style={{ background: p.color }}>{initials(p.name)}</span>
              <div className="me3-minfo"><b>{p.name}</b><small>{roleText(p.role)}</small></div>
              {prog && <span className="me3-mdia"><IconDiamondGem size={13} /> {prog.diamonds.toLocaleString()}</span>}
            </div>
          )
        })}
        <button className="me3-add-row me3-add-member" disabled={busy} onClick={() => { setErr(null); setSheet('member') }}>
          <span className="me3-add-ic accent"><IconUserPlus width={17} height={17} /></span><span>Add member</span>
        </button>
      </div>

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

      {sheet === 'member' && <AddMemberSheet circleName={circle.name} busy={busy} onClose={() => setSheet(null)}
        onSubmit={(nm, role) => run(() => addPerson(circle.id, nm, role, nextColor())).then(() => setSheet(null))} />}
      {sheet === 'circle' && <NewCircleSheet busy={busy} onClose={() => setSheet(null)}
        onSubmit={(nm, accent) => run(() => addCircle(nm, accent)).then(() => setSheet(null))} />}
      {editing && <EditCircleSheet circle={editing} busy={busy} onClose={() => setEditing(null)}
        onSubmit={(nm, accent) => run(() => updateCircle(editing.id, { name: nm, accent })).then(() => setEditing(null))} />}
    </div>
  )
}

// ── Add member ──
function AddMemberSheet({ circleName, busy, onClose, onSubmit }: {
  circleName: string; busy: boolean; onClose: () => void; onSubmit: (name: string, role: Role) => void
}) {
  const [nm, setNm] = useState('')
  const [role, setRole] = useState<Role>('member')
  return (
    <Sheet title={`Add to ${circleName}`} onClose={onClose}>
      <input className="field" placeholder="Member name" value={nm} onChange={e => setNm(e.target.value)} autoFocus />
      <div className="sheet-lbl">Role</div>
      <div className="me3-seg">
        {ROLES.map(r => <button key={r} className={`me3-seg-btn${role === r ? ' on' : ''}`} onClick={() => setRole(r)}>{roleText(r)}</button>)}
      </div>
      <button className="btn grad me3-submit" disabled={busy || !nm.trim()} onClick={() => onSubmit(nm.trim(), role)}>{busy ? 'Adding…' : 'Add member'}</button>
    </Sheet>
  )
}

// ── New circle ──
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

// ── Edit circle: rename + recolor (writes to DB) ──
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
