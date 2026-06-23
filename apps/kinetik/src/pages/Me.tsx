import { useState, useEffect } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { supabase, cloudReady } from '@lib/supabase'
import { fetchMemberProgress, type MemberProgress } from '@repo/kinetikRepo'
import { ROLE_LABEL, initials } from '@data/energy'
import { IconSwitch, IconSun, IconMoon, IconPlus } from '@components/Icons'

export default function Me() {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const moments = useDataStore(s => s.moments)
  const me = useDataStore(s => s.me)            // the one real signed-in user
  const status = useDataStore(s => s.status)
  const { activeCircleId, setCircle, theme, toggleTheme, go } = useUiStore()

  const [progress, setProgress] = useState<Record<string, MemberProgress>>({})

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))

  // Instagram-style stats
  const momentCount = moments.filter(m => m.circleId === circle?.id).length
  const circleCount = circles.length
  const memberCount = members.length
  const friendCount = new Set(circles.flatMap(c => c.memberIds)).size

  // Live member progress whenever the circle changes
  useEffect(() => {
    if (!circle) return
    fetchMemberProgress(circle.id).then(setProgress).catch(() => setProgress({}))
  }, [circle?.id])

  const loading = status === 'loading' && !me

  const cycleCircle = () => {
    if (circles.length < 2) return
    const i = circles.findIndex(c => c.id === activeCircleId)
    setCircle(circles[(i + 1) % circles.length].id)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="fade-in" style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div className="boot"><span className="boot-orb" /><p>Loading profile…</p></div>
      </div>
    )
  }

  const accent0 = circle?.accent[0] ?? 'var(--accent)'
  const accent1 = circle?.accent[1] ?? 'var(--care)'

  return (
    <div className="fade-in me-page">
      {/* ── Instagram-style header: avatar + inline stats ── */}
      <div className="ig-header">
        {me?.photoUrl ? (
          <img src={me.photoUrl} alt={me.name} className="ig-avatar" referrerPolicy="no-referrer" />
        ) : (
          <div className="ig-avatar ig-avatar-fallback" style={{ background: `linear-gradient(135deg,${accent0},${accent1})` }}>
            {initials(me?.name || 'U')}
          </div>
        )}

        <div className="ig-stats">
          <button className="ig-stat" onClick={() => go('moments')}>
            <b>{momentCount}</b><span>Moments</span>
          </button>
          <button className="ig-stat" onClick={cycleCircle}>
            <b>{circleCount}</b><span>Circles</span>
          </button>
          <button className="ig-stat">
            <b>{memberCount}</b><span>Members</span>
          </button>
          <button className="ig-stat">
            <b>{friendCount}</b><span>Friends</span>
          </button>
        </div>
      </div>

      {/* ── Name + circle + diamonds ── */}
      <div className="ig-bio">
        <h1 className="ig-name">{me?.name ?? 'Your profile'}</h1>
        <div className="ig-bio-row">
          <span className="ig-circle-tag">
            <span className="ig-dot" style={{ background: accent0 }} />
            {circle?.name}
          </span>
          <span className="ig-diamonds">💎 {(me?.diamonds || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* ── Add buttons ── */}
      <div className="ig-actions">
        <button className="ig-action-btn"><IconPlus width={16} height={16} /> Add Circle</button>
        <button className="ig-action-btn"><IconPlus width={16} height={16} /> Add Kids</button>
      </div>

      {/* ── Circle members with LIVE progress rings ── */}
      <section className="me-section">
        <div className="mes-head">
          <h2 className="mes-title">Circle Members</h2>
          <span className="mes-live"><span className="live-dot" /> live</span>
        </div>
        <div className="members-list">
          {members.map(p => {
            const prog = progress[p.id]
            const pct = prog?.ringPct ?? 0
            return (
              <div key={p.id} className="member-row">
                <MemberRing color={p.color} pct={pct} label={initials(p.name)} />
                <div className="mr-info">
                  <span className="mr-name">{p.name}</span>
                  <span className="mr-sub">
                    {ROLE_LABEL[p.role]}
                    {prog && pct > 0 && <> · <b style={{ color: p.color }}>{pct}%</b></>}
                    {prog && prog.xp > 0 && <> · {prog.xp.toLocaleString()} XP</>}
                  </span>
                </div>
                <span className="mr-diamonds">💎 {(prog?.diamonds || 0).toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Settings ── */}
      <section className="me-section me-section-last">
        <h2 className="mes-title">Settings</h2>
        <div className="settings-card">
          <button className="settings-row" onClick={toggleTheme}>
            <span className="sr-icon" style={{ background: theme === 'dark' ? 'color-mix(in srgb, var(--play) 16%, transparent)' : 'color-mix(in srgb, var(--memory) 14%, transparent)' }}>
              {theme === 'dark' ? <IconSun width={18} height={18} style={{ color: 'var(--play)' }} /> : <IconMoon width={18} height={18} style={{ color: 'var(--memory)' }} />}
            </span>
            <span className="sr-main"><b>Appearance</b><small>{theme === 'dark' ? 'Dark' : 'Light'} mode</small></span>
            <span className="sr-val">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
          <button className="settings-row" onClick={cycleCircle}>
            <span className="sr-icon" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}>
              <IconSwitch width={18} height={18} style={{ color: 'var(--accent)' }} />
            </span>
            <span className="sr-main"><b>Active Circle</b><small>{circle?.name || 'Select a circle'}</small></span>
            <span className="sr-val">→</span>
          </button>
          <button className="settings-row" onClick={handleLogout}>
            <span className="sr-icon" style={{ background: 'color-mix(in srgb, var(--care) 14%, transparent)' }}>🚪</span>
            <span className="sr-main"><b>Sign Out</b><small>Log out of your account</small></span>
            <span className="sr-val">→</span>
          </button>
        </div>
      </section>

      <SyncRow />
    </div>
  )
}

/** Avatar wrapped in a circular progress ring. */
function MemberRing({ color, pct, label }: { color: string; pct: number; label: string }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const dash = (Math.min(pct, 100) / 100) * circ
  return (
    <div className="member-ring">
      <svg width="54" height="54" viewBox="0 0 54 54" className="mr-svg">
        <circle cx="27" cy="27" r={r} className="mr-track" />
        <circle
          cx="27" cy="27" r={r}
          className="mr-prog"
          style={{ stroke: color, strokeDasharray: `${dash} ${circ}` }}
        />
      </svg>
      <span className="mr-av" style={{ background: color }}>{label}</span>
    </div>
  )
}

function SyncRow() {
  const source = useDataStore(s => s.source)
  const on = cloudReady && source === 'cloud'
  return (
    <div className="sync-indicator" style={{ marginTop: 20 }}>
      <span className="sync-dot" data-on={on ? '1' : '0'} />
      {!cloudReady ? (
        <div><b>Works offline</b><small>Add Supabase keys to sync</small></div>
      ) : source === 'cloud' ? (
        <div><b>Live · synced to cloud</b><small>Real data from Supabase</small></div>
      ) : (
        <div><b>Offline copy</b><small>Last synced cache — reconnect to sync</small></div>
      )}
    </div>
  )
}
