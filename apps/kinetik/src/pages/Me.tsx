import { useAppStore } from '@store/appStore'
import { CIRCLES, PEOPLE, ROLE_LABEL, initials } from '@data/seed'
import { IconSwitch, IconUserPlus, IconSun, IconMoon } from '@components/Icons'
import { supabase, supabaseReady } from '@lib/supabase'

export default function Me() {
  const { activeCircleId, setCircle, theme, toggleTheme } = useAppStore()
  const circle = CIRCLES.find(c => c.id === activeCircleId) ?? CIRCLES[0]
  const members = PEOPLE.filter(p => circle.memberIds.includes(p.id))
  const me = PEOPLE[0]

  const cycleCircle = () => {
    const i = CIRCLES.findIndex(c => c.id === activeCircleId)
    setCircle(CIRCLES[(i + 1) % CIRCLES.length].id)
  }

  return (
    <div className="fade-in">
      <div className="me-head">
        <span className="me-av" style={{ background: `linear-gradient(135deg,${circle.accent[0]},${circle.accent[1]})` }}>{me.name[0]}</span>
        <div className="me-name">{me.name} Sukapradja</div>
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
        <button className="btn ghost" style={{ flex: 1 }} onClick={toggleTheme}>
          {theme === 'dark' ? <IconSun width={17} height={17} /> : <IconMoon width={17} height={17} />} {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      <SyncRow />

      <p className="me-foot">Private to the people you choose. No followers, no likes — just your circle.</p>
    </div>
  )
}

function SyncRow() {
  const session = useAppStore(s => s.session)
  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  const signOut = () => supabase.auth.signOut()
  const authed = session && session !== 'loading'

  return (
    <div className="card sync-row">
      <span className="sync-dot" data-on={authed ? '1' : '0'} />
      {!supabaseReady ? (
        <div className="sync-main"><b>Works offline</b><small>Add Supabase keys to sync across devices.</small></div>
      ) : authed ? (
        <>
          <div className="sync-main"><b>Synced</b><small>{session.user.email}</small></div>
          <button className="chip" onClick={signOut}>Sign out</button>
        </>
      ) : (
        <>
          <div className="sync-main"><b>Sync across devices</b><small>Sign in to back up your circle.</small></div>
          <button className="chip on" onClick={signIn}>Sign in</button>
        </>
      )}
    </div>
  )
}
