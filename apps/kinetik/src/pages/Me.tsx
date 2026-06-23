import { useState, useEffect } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { supabase } from '@lib/supabase'
import { ROLE_LABEL, initials } from '@data/energy'
import { cloudReady } from '@lib/supabase'
import { IconSwitch, IconUserPlus, IconSun, IconMoon, IconMe } from '@components/Icons'

interface ChildWithProgress {
  id: string; display_name: string; color: string; emoji: string; age?: number
  progress?: { ring_pct?: number; xp?: number; skills_mastered?: number }
}

export default function Me() {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const { activeCircleId, setCircle, theme, toggleTheme } = useUiStore()
  const [children, setChildren] = useState<ChildWithProgress[]>([])
  const [loadingKids, setLoadingKids] = useState(false)

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))
  const me = members.find(p => p.role === 'owner') ?? members[0]

  useEffect(() => {
    const fetchChildren = async () => {
      setLoadingKids(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: kids } = await supabase
          .from('child_profiles')
          .select('id, display_name, color, emoji, age')
          .eq('parent_id', user.id)
        if (kids) {
          const withProgress = await Promise.all(
            kids.map(async (kid) => {
              const { data: prog } = await supabase
                .from('world_progress')
                .select('ring_pct, xp, skills_mastered')
                .eq('user_id', kid.id)
                .single()
              return { ...kid, progress: prog ?? undefined }
            })
          )
          setChildren(withProgress as ChildWithProgress[])
        }
      } catch (err) {
        console.error('Failed to fetch children:', err)
      } finally {
        setLoadingKids(false)
      }
    }
    fetchChildren()
  }, [])

  const cycleCircle = () => {
    if (circles.length < 2) return
    const i = circles.findIndex(c => c.id === activeCircleId)
    setCircle(circles[(i + 1) % circles.length].id)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (!circle || !me) {
    return <div className="fade-in"><p className="me-foot">No circle loaded yet.</p></div>
  }

  return (
    <div className="fade-in">
      <div className="me-head">
        <span className="me-av" style={{ background: `linear-gradient(135deg,${circle.accent[0]},${circle.accent[1]})` }}>{me.name[0]}</span>
        <div className="me-name">{me.name}</div>
        <button className="circle-pill" onClick={cycleCircle}>
          <span className="circle-dot" style={{ background: `linear-gradient(135deg,${circle.accent[0]},${circle.accent[1]})` }} />
          {circle.name}
          <IconSwitch width={14} height={14} style={{ color: 'var(--accent)' }} />
        </button>
      </div>

      <div className="section-label">People in this circle</div>
      <div className="card people">
        {members.map(p => (
          <div key={p.id} className="person-row">
            <span className="p-av" style={{ background: p.color }}>{initials(p.name)}</span>
            <span className="p-name">{p.name}</span>
            <span className="p-role" data-role={p.role}>{ROLE_LABEL[p.role]}</span>
          </div>
        ))}
      </div>

      <div className="me-actions">
        <button className="btn ghost" style={{ flex: 1 }}><IconUserPlus width={17} height={17} /> Invite</button>
      </div>

      {children.length > 0 && (
        <>
          <div className="section-label">Kids Learning</div>
          <div className="kids-grid">
            {children.map(kid => (
              <div key={kid.id} className="kid-card">
                <div className="kid-av" style={{ background: kid.color }}>{kid.emoji || initials(kid.display_name)}</div>
                <span className="kid-name">{kid.display_name}</span>
                {kid.progress?.ring_pct !== undefined && (
                  <div className="progress-ring-wrap">
                    <svg width="56" height="56" viewBox="0 0 56 56" className="progress-ring-svg">
                      <circle cx="28" cy="28" r="22" className="progress-ring-bg" />
                      <circle
                        cx="28" cy="28" r="22"
                        className="progress-ring-fill"
                        style={{ strokeDasharray: `${Math.round(kid.progress.ring_pct * 1.38)} 138`, stroke: kid.color }}
                      />
                    </svg>
                    <span className="progress-pct">{Math.round(kid.progress.ring_pct)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <SyncRow />

      <div className="section-label">Settings</div>
      <div className="card">
        <button className="settings-row" onClick={toggleTheme}>
          <span className="sr-icon" style={{ background: theme === 'dark' ? 'color-mix(in srgb, var(--play) 16%, transparent)' : 'color-mix(in srgb, var(--memory) 14%, transparent)' }}>
            {theme === 'dark'
              ? <IconSun width={17} height={17} style={{ color: 'var(--play)' }} />
              : <IconMoon width={17} height={17} style={{ color: 'var(--memory)' }} />}
          </span>
          <span className="sr-main">
            <b>Appearance</b>
            <small>Currently {theme === 'dark' ? 'dark' : 'light'} mode</small>
          </span>
          <span className="sr-val">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
        <button className="settings-row" onClick={handleLogout} style={{ borderTop: '0.5px solid var(--line)' }}>
          <span className="sr-icon" style={{ background: 'color-mix(in srgb, var(--care) 14%, transparent)' }}>
            🚪
          </span>
          <span className="sr-main">
            <b>Sign Out</b>
            <small>Log out of your account</small>
          </span>
        </button>
      </div>

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
