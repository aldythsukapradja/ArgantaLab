import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { ROLE_LABEL, initials } from '@data/energy'
import { cloudReady } from '@lib/supabase'
import { IconSwitch, IconUserPlus, IconSun, IconMoon } from '@components/Icons'

export default function Me() {
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const { activeCircleId, setCircle, theme, toggleTheme } = useUiStore()

  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const members = people.filter(p => circle && circle.memberIds.includes(p.id))
  const me = members.find(p => p.role === 'owner') ?? members[0]

  const cycleCircle = () => {
    if (circles.length < 2) return
    const i = circles.findIndex(c => c.id === activeCircleId)
    setCircle(circles[(i + 1) % circles.length].id)
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
