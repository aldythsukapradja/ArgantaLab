import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials } from '@data/energy'
import { cloudReady } from '@lib/supabase'
import * as repo from '@repo/kinetikRepo'
import type { MemberProgress } from '@repo/kinetikRepo'
import { IconSun, IconMoon, IconSwitch, IconUserPlus, IconPlus } from '@components/Icons'

export default function Me() {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const moments = useDataStore(s => s.moments)
  const authUser = useDataStore(s => s.me)
  const { activeCircleId, setCircle, theme, toggleTheme } = useUiStore()
  const [progress, setProgress] = useState<Record<string, MemberProgress>>({})

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))

  // Live learning progress (rings + diamonds) for every member of the circle.
  useEffect(() => {
    if (!circle) return
    let alive = true
    repo.fetchMemberProgress(circle.id).then(p => { if (alive) setProgress(p) }).catch(() => {})
    return () => { alive = false }
  }, [circle?.id])

  const root = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!root.current) return
    gsap.fromTo(root.current.querySelectorAll('.rise'),
      { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
  }, [circle?.id])

  if (!circle) {
    return <div className="fade-in"><p className="me-foot">No circle loaded yet.</p></div>
  }

  // Stats — all real, derived from loaded data.
  const momentCount = moments.filter(m => m.circleId === circle.id).length
  const circleCount = circles.length
  const memberCount = members.length
  // "Friends" = everyone you share a circle with, across all your circles (minus yourself).
  const friendCount = Math.max(people.length - 1, 0)

  const name = authUser?.name ?? members.find(m => m.role === 'owner')?.name ?? 'You'
  const ownerDiamonds = authUser?.diamonds ?? 0

  const cycleCircle = () => {
    if (circles.length < 2) return
    const i = circles.findIndex(c => c.id === activeCircleId)
    setCircle(circles[(i + 1) % circles.length].id)
  }

  return (
    <div className="fade-in me-page" ref={root}>
      {/* ── Instagram-style header: avatar + inline stats ── */}
      <div className="ig-header rise">
        {authUser?.photoUrl ? (
          <img className="ig-avatar" src={authUser.photoUrl} alt={name} referrerPolicy="no-referrer" />
        ) : (
          <div className="ig-avatar ig-avatar-fallback" style={{ background: `linear-gradient(135deg,${circle.accent[0]},${circle.accent[1]})` }}>
            {initials(name)}
          </div>
        )}
        <div className="ig-stats">
          <div className="ig-stat"><b>{momentCount}</b><span>Moments</span></div>
          <div className="ig-stat"><b>{circleCount}</b><span>Circles</span></div>
          <div className="ig-stat"><b>{memberCount}</b><span>Members</span></div>
          <div className="ig-stat"><b>{friendCount}</b><span>Friends</span></div>
        </div>
      </div>

      {/* ── Name + circle + diamonds ── */}
      <div className="ig-bio rise">
        <div className="ig-name">{name}</div>
        <div className="ig-bio-row">
          <button className="ig-circle-tag" onClick={cycleCircle}>
            <span className="ig-dot" style={{ background: `linear-gradient(135deg,${circle.accent[0]},${circle.accent[1]})` }} />
            {circle.name}
            <IconSwitch width={13} height={13} style={{ color: 'var(--accent)' }} />
          </button>
          <span className="ig-diamonds"><IconDiamondGem /> {ownerDiamonds}</span>
        </div>
      </div>

      {/* ── Add circle / kids ── */}
      <div className="ig-actions rise">
        <button className="ig-action-btn" onClick={() => alert('Add Circle — coming soon')}>
          <IconPlus width={16} height={16} style={{ color: 'var(--accent)' }} /> Add Circle
        </button>
        <button className="ig-action-btn" onClick={() => alert('Add Kids — coming soon')}>
          <IconUserPlus width={16} height={16} style={{ color: 'var(--accent)' }} /> Add Kids
        </button>
      </div>

      {/* ── Circle members with LIVE progress rings + diamonds ── */}
      <div className="me-section rise">
        <div className="mes-head">
          <span className="mes-title">Circle Members</span>
          {cloudReady && <span className="mes-live"><span className="live-dot" /> Live</span>}
        </div>
        <div className="members-list">
          {members.map(p => {
            const prog = progress[p.id]
            return <MemberRow key={p.id} name={p.name} color={p.color} role={p.role} progress={prog} />
          })}
        </div>
      </div>

      {/* ── Settings ── */}
      <div className="me-section rise">
        <div className="mes-head"><span className="mes-title">Settings</span></div>
        <div className="settings-card">
          <button className="settings-row" onClick={toggleTheme}>
            <span className="sr-icon" style={{ background: 'color-mix(in srgb, var(--memory) 14%, transparent)', color: 'var(--memory)' }}>
              {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
            </span>
            <div className="sr-main"><b>Appearance</b><small>Switch light / dark theme</small></div>
            <span className="sr-val">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
          <button className="settings-row" onClick={cycleCircle}>
            <span className="sr-icon" style={{ background: 'color-mix(in srgb, var(--mind) 14%, transparent)', color: 'var(--mind)' }}>
              <IconSwitch width={18} height={18} />
            </span>
            <div className="sr-main"><b>Circle</b><small>Switch active circle</small></div>
            <span className="sr-val">{circle.name}</span>
          </button>
        </div>
      </div>

      {/* ── Sync status ── */}
      <div className="me-section me-section-last rise">
        <SyncRow />
        <p className="me-foot">Private to the people you choose. No followers, no likes — just your circle.</p>
      </div>
    </div>
  )
}

function MemberRow({ name, color, role, progress }: {
  name: string; color: string; role: string; progress?: MemberProgress
}) {
  const pct = Math.min(Math.max(progress?.ringPct ?? 0, 0), 100)
  const C = 2 * Math.PI * 24 // r = 24 → circumference
  const dash = `${(pct / 100) * C} ${C}`
  const xp = progress?.xp ?? 0
  const diamonds = progress?.diamonds ?? 0
  const roleLabel = role === 'owner' ? 'Owner' : role === 'coleader' ? 'Co-leader' : role === 'viewer' ? 'Viewer' : 'Member'

  return (
    <div className="member-row">
      <div className="member-ring">
        <svg className="mr-svg" viewBox="0 0 54 54">
          <circle className="mr-track" cx="27" cy="27" r="24" />
          <circle className="mr-prog" cx="27" cy="27" r="24" stroke={color} strokeDasharray={dash} />
        </svg>
        <span className="mr-av" style={{ background: color }}>{initials(name)}</span>
      </div>
      <div className="mr-info">
        <span className="mr-name">{name}</span>
        <span className="mr-sub">{roleLabel} · {pct}% · {xp} XP</span>
      </div>
      <span className="mr-diamonds"><IconDiamondGem /> {diamonds}</span>
    </div>
  )
}

// Small filled gem used inline (the stroke IconDiamond reads too thin at this size).
function IconDiamondGem() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5.5 3h13l3.5 6-10 12L2 9l3.5-6z" opacity="0.95" />
    </svg>
  )
}

function SyncRow() {
  const source = useDataStore(s => s.source)
  const on = cloudReady && source === 'cloud'
  return (
    <div className="sync-indicator">
      <span className="sync-dot" data-on={on ? '1' : '0'} />
      {!cloudReady ? (
        <div><b>Works offline</b><small>Add Supabase keys to sync across devices.</small></div>
      ) : source === 'cloud' ? (
        <div><b>Live · synced to cloud</b><small>This is your real data from Supabase.</small></div>
      ) : (
        <div><b>Offline copy</b><small>Showing the last synced cache — reconnect to sync.</small></div>
      )}
    </div>
  )
}
