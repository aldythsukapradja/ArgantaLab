import { useState, useEffect } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { supabase } from '@lib/supabase'
import { ROLE_LABEL, initials } from '@data/energy'
import { cloudReady } from '@lib/supabase'
import { IconSwitch, IconUserPlus, IconSun, IconMoon, IconPlus, IconGem } from '@components/Icons'

interface ChildWithProgress {
  id: string; display_name: string; color: string; emoji: string; age?: number
  progress?: { ring_pct?: number; xp?: number; skills_mastered?: number }
}

interface UserProfile {
  display_name: string; photo_url: string | null; diamonds: number; email: string
}

export default function Me() {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const events = useDataStore(s => s.events)
  const moments = useDataStore(s => s.moments)
  const { activeCircleId, setCircle, theme, toggleTheme, go } = useUiStore()

  const [children, setChildren] = useState<ChildWithProgress[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))
  const me = members.find(p => p.role === 'owner') ?? members[0]

  // Calculate stats
  const momentCount = moments.filter(m => m.circleId === circle?.id).length
  const circleCount = circles.length
  const connectionCount = members.length
  // Friends = sum of all members across circles
  const friendCount = new Set(circles.flatMap(c => c.memberIds)).size

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr || !user) throw new Error('Not authenticated')

        const { data: prof } = await supabase
          .from('profiles')
          .select('display_name, photo_url, diamonds')
          .eq('id', user.id)
          .single()

        setProfile({
          display_name: prof?.display_name || user.user_metadata?.full_name || 'User',
          photo_url: prof?.photo_url || user.user_metadata?.avatar_url || null,
          diamonds: prof?.diamonds || 0,
          email: user.email || '',
        })

        // Fetch children
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
        console.error('Failed to fetch profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
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

  if (loading) {
    return (
      <div className="fade-in" style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)' }}>
        <div className="boot"><span className="boot-orb" /><p>Loading profile…</p></div>
      </div>
    )
  }

  return (
    <div className="fade-in me-page">
      {/* ── Profile Header ── */}
      <div className="me-profile-header">
        <div className="mph-cover" />
        <div className="mph-main">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt={profile.display_name} className="mph-avatar" referrerPolicy="no-referrer" />
          ) : (
            <div className="mph-avatar" style={{ background: 'var(--grad)', fontSize: '32px' }}>
              {initials(profile?.display_name || 'U')}
            </div>
          )}
          <div className="mph-info">
            <h1 className="mph-name">{profile?.display_name}</h1>
            <span className="mph-circle">
              <span className="mph-dot" style={{ background: circle?.accent[0] ?? 'var(--accent)' }} />
              {circle?.name}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="me-stats-grid">
        <div className="mstat" onClick={() => go('moments')}>
          <span className="mstat-num">{momentCount}</span>
          <span className="mstat-label">Moments</span>
        </div>
        <div className="mstat" onClick={() => go('calendar')}>
          <span className="mstat-num">{circleCount}</span>
          <span className="mstat-label">Circles</span>
        </div>
        <div className="mstat">
          <span className="mstat-num">{connectionCount}</span>
          <span className="mstat-label">Members</span>
        </div>
        <div className="mstat">
          <span className="mstat-num">{friendCount}</span>
          <span className="mstat-label">Friends</span>
        </div>
      </div>

      {/* ── Diamonds Bar ── */}
      <div className="me-gem-bar">
        <IconGem width={20} height={20} style={{ color: '#60a5fa' }} />
        <span><b>{profile?.diamonds || 0}</b> Diamonds</span>
      </div>

      {/* ── Action Buttons ── */}
      <div className="me-action-buttons">
        <button className="mab-btn">
          <IconPlus width={18} height={18} />
          Add Circle
        </button>
        <button className="mab-btn">
          <IconPlus width={18} height={18} />
          Add Kids
        </button>
      </div>

      {/* ── Kids Learning Section ── */}
      {children.length > 0 && (
        <section className="me-section">
          <h2 className="mes-title">Kids Learning Progress</h2>
          <div className="me-kids-carousel">
            {children.map(kid => (
              <div key={kid.id} className="kid-card-fancy">
                <div className="kcf-header" style={{ background: `linear-gradient(135deg, ${kid.color}, ${kid.color}dd)` }}>
                  <span className="kcf-emoji">{kid.emoji || initials(kid.display_name)}</span>
                  {kid.age && <span className="kcf-age">{kid.age}y</span>}
                </div>
                <div className="kcf-body">
                  <h3 className="kcf-name">{kid.display_name}</h3>
                  {kid.progress?.ring_pct !== undefined && (
                    <div className="progress-ring-container">
                      <svg width="60" height="60" viewBox="0 0 60 60" className="progress-svg">
                        <circle cx="30" cy="30" r="24" className="pring-bg" />
                        <circle
                          cx="30" cy="30" r="24"
                          className="pring-fill"
                          style={{
                            strokeDasharray: `${Math.round(kid.progress.ring_pct * 1.51)} 150.8`,
                            stroke: kid.color,
                          }}
                        />
                      </svg>
                      <span className="pring-pct">{Math.round(kid.progress.ring_pct)}%</span>
                    </div>
                  )}
                  <div className="kcf-stats">
                    {kid.progress?.xp && <span className="ks-stat">XP {kid.progress.xp}</span>}
                    {kid.progress?.skills_mastered && <span className="ks-stat">{kid.progress.skills_mastered} skills</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Circle Members ── */}
      {members.length > 0 && (
        <section className="me-section">
          <h2 className="mes-title">Circle Members</h2>
          <div className="members-list">
            {members.map(p => (
              <div key={p.id} className="member-item">
                <span className="mi-av" style={{ background: p.color }}>
                  {initials(p.name)}
                </span>
                <div className="mi-info">
                  <span className="mi-name">{p.name}</span>
                  <span className="mi-role">{ROLE_LABEL[p.role]}</span>
                </div>
                <span className="mi-gem">💎</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Settings Section ── */}
      <section className="me-section me-section-last">
        <h2 className="mes-title">Settings & Preferences</h2>
        <div className="settings-card">
          <button className="settings-row" onClick={toggleTheme}>
            <span className="sr-icon" style={{
              background: theme === 'dark' ? 'color-mix(in srgb, var(--play) 16%, transparent)' : 'color-mix(in srgb, var(--memory) 14%, transparent)',
            }}>
              {theme === 'dark' ? <IconSun width={18} height={18} style={{ color: 'var(--play)' }} /> : <IconMoon width={18} height={18} style={{ color: 'var(--memory)' }} />}
            </span>
            <span className="sr-main">
              <b>Appearance</b>
              <small>Currently {theme === 'dark' ? 'dark' : 'light'} mode</small>
            </span>
            <span className="sr-val">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>

          <button className="settings-row" onClick={() => cycleCircle()}>
            <span className="sr-icon" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}>
              <IconSwitch width={18} height={18} style={{ color: 'var(--accent)' }} />
            </span>
            <span className="sr-main">
              <b>Active Circle</b>
              <small>{circle?.name || 'Select a circle'}</small>
            </span>
            <span className="sr-val">→</span>
          </button>

          <button className="settings-row" onClick={handleLogout} style={{ borderTop: '0.5px solid var(--line)' }}>
            <span className="sr-icon" style={{ background: 'color-mix(in srgb, var(--care) 14%, transparent)' }}>
              🚪
            </span>
            <span className="sr-main">
              <b>Sign Out</b>
              <small>Log out of your account</small>
            </span>
            <span className="sr-val">→</span>
          </button>
        </div>
      </section>

      <SyncRow />
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
        <div><b>Works offline</b><small>Add Supabase keys in .env.local to sync</small></div>
      ) : source === 'cloud' ? (
        <div><b>Live · synced to cloud</b><small>Real data from Supabase</small></div>
      ) : (
        <div><b>Offline copy</b><small>Last synced cache — reconnect to sync</small></div>
      )}
    </div>
  )
}
