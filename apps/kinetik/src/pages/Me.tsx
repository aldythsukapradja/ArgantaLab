import { useEffect, useState } from 'react'
import { useDataStore, personById } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials } from '@data/energy'
import { cloudReady } from '@lib/supabase'
import * as repo from '@repo/kinetikRepo'
import { IconSun, IconMoon } from '@components/Icons'

interface MemberStats {
  ringPct: number
  xp: number
  skills: number
  streak: number
  diamonds: number
}

export default function Me() {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const authUser = useDataStore(s => s.me)
  const { activeCircleId, setCircle, theme, toggleTheme } = useUiStore()
  const [memberStats, setMemberStats] = useState<Record<string, MemberStats>>({})

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))

  useEffect(() => {
    if (!circle) return
    repo.fetchMemberProgress(circle.id).then(setMemberStats).catch(() => {})
  }, [circle])

  if (!circle || !authUser) {
    return <div className="fade-in"><p className="me-foot">No circle loaded yet.</p></div>
  }

  const momentCount = 0 // TODO: count moments in dataStore
  const circleCount = circles.length
  const memberCount = members.length
  const friendCount = members.reduce((sum, m) => sum + (m.role !== 'viewer' ? 1 : 0), 0)

  return (
    <div className="fade-in">
      {/* Instagram-style header */}
      <div className="ig-header">
        <div className="ig-avatar">
          {authUser.photoUrl ? (
            <img src={authUser.photoUrl} alt={authUser.name} referrerPolicy="no-referrer" />
          ) : (
            <div className="av-initials">{initials(authUser.name)}</div>
          )}
        </div>
        <div className="ig-stats">
          <div className="stat-box">
            <div className="stat-value">{momentCount}</div>
            <div className="stat-label">Moments</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{circleCount}</div>
            <div className="stat-label">Circles</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{memberCount}</div>
            <div className="stat-label">Members</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{friendCount}</div>
            <div className="stat-label">Friends</div>
          </div>
        </div>
      </div>

      {/* Bio section */}
      <div className="ig-bio">
        <div className="bio-name">{authUser.name}</div>
        <div className="bio-meta">
          <span className="bio-circle">{circle.name}</span>
          <span className="bio-diamonds">💎 {authUser.diamonds}</span>
        </div>
        <div className="bio-actions">
          <button className="btn-secondary">Add Circle</button>
          <button className="btn-secondary">Add Kids</button>
        </div>
      </div>

      {/* Circle members with progress rings */}
      <div className="section-label">Members in {circle.name}</div>
      <div className="members-list">
        {members.map(p => {
          const stats = memberStats[p.id]
          return (
            <div key={p.id} className="member-card">
              <div className="member-ring-container">
                <svg className="member-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" className="ring-bg" />
                  <circle cx="50" cy="50" r="45" className="ring-progress" style={{
                    strokeDasharray: `${(stats?.ringPct || 0) * 2.827}px 282.7px`,
                  }} />
                </svg>
                <div className="member-avatar" style={{ background: p.color }}>{initials(p.name)}</div>
              </div>
              <div className="member-info">
                <div className="member-name">{p.name}</div>
                <div className="member-stats">
                  <span>{stats?.ringPct || 0}%</span>
                  <span>XP {stats?.xp || 0}</span>
                </div>
                <div className="member-diamonds">💎 {stats?.diamonds || 0}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Settings */}
      <div className="section-label">Settings</div>
      <div className="card settings-card">
        <button className="settings-row" onClick={toggleTheme}>
          {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button className="settings-row" onClick={() => alert('Sign out coming soon')}>
          <span>Sign Out</span>
        </button>
      </div>

      <SyncRow />
      <p className="me-foot">Private to the people you choose. No followers, no likes — just your circle.</p>
    </div>
  )
}

function SyncRow() {
  const source = useDataStore(s => s.source)
  const on = cloudReady && source === 'cloud'
  return (
    <div className="card sync-row">
      <span className="sync-dot" data-on={on ? '1' : '0'} />
      {!cloudReady ? (
        <div className="sync-main"><b>Works offline</b><small>Add Supabase keys in .env.local to sync across devices.</small></div>
      ) : source === 'cloud' ? (
        <div className="sync-main"><b>Live · synced to cloud</b><small>This is your real data from Supabase.</small></div>
      ) : (
        <div className="sync-main"><b>Offline copy</b><small>Showing the last synced cache — reconnect to sync.</small></div>
      )}
    </div>
  )
}
