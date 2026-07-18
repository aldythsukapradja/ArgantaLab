// The left rail for the Bridge brains (Claude Code / OpenAI). Same chrome as
// ThreadsRail (Sovereign chats), but the list is per-engine mission history from
// the Supabase `mission` table (see lib/missions.ts). Clicking a mission opens
// its read-only transcript in the console; "New mission" clears the selection.
import { useEffect, useState } from 'react'
import { SquarePen, X } from 'lucide-react'
import { listMissions, type MissionRow } from '../../lib/missions'
import { cloudEnabled } from '../../lib/supabase'
import { bucketFor, ArtifactsSection, LibrarySection } from './ThreadsRail'

type MissionSection = 'missions' | 'artifacts' | 'library'
const MISSION_SECTIONS: { id: MissionSection; label: string }[] = [
  { id: 'missions', label: 'Missions' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'library', label: 'Library' },
]

const REL_TIME = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const s = ms / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function groupMissions(rows: MissionRow[]): [string, MissionRow[]][] {
  const groups: [string, MissionRow[]][] = []
  for (const m of rows) {
    const label = bucketFor(m.createdAt)
    const last = groups[groups.length - 1]
    if (last && last[0] === label) last[1].push(m)
    else groups.push([label, [m]])
  }
  return groups
}

export function MissionsRail({ engine, engineLabel, activeMissionId, onSelectMission, onNewMission, open, onToggle, sheet, refreshKey }: {
  engine: 'claude' | 'codex'
  engineLabel: string
  activeMissionId: string | null
  onSelectMission: (id: string) => void
  onNewMission: () => void
  open: boolean
  onToggle: () => void
  sheet?: boolean
  refreshKey?: number
}) {
  const [rows, setRows] = useState<MissionRow[] | null>(null)
  const [section, setSection] = useState<MissionSection>('missions')

  useEffect(() => {
    if (section !== 'missions') return
    let live = true
    setRows(null)
    listMissions(engine).then(r => { if (live) setRows(r) })
    return () => { live = false }
  }, [engine, refreshKey, section])

  if (!open && !sheet) {
    return (
      <div className="core-rail core-rail-collapsed">
        <button className="core-rail-expand" onClick={onToggle} aria-label="Expand drawer">›</button>
      </div>
    )
  }

  const groups = rows ? groupMissions(rows) : []

  return (
    <div className={sheet ? 'core-rail core-rail-sheet' : 'core-rail'}>
      <div className="core-rail-head">
        <span>{engineLabel}</span>
        <div className="row" style={{ gap: 4 }}>
          <button className="core-rail-new" onClick={onNewMission} title="New mission" aria-label="New mission"><SquarePen size={14} /></button>
          {sheet
            ? <button className="core-rail-close" onClick={onToggle} title="Close" aria-label="Close drawer"><X size={15} /></button>
            : <button className="core-rail-collapse" onClick={onToggle} aria-label="Collapse drawer">‹</button>}
        </div>
      </div>

      <div className="core-rail-sections" role="tablist">
        {MISSION_SECTIONS.map(s => (
          <button
            key={s.id} role="tab" aria-selected={section === s.id}
            className={'core-rail-section' + (section === s.id ? ' is-on' : '')}
            onClick={() => setSection(s.id)}
          >{s.label}</button>
        ))}
      </div>

      <div className="core-rail-body">
        {section === 'artifacts' && <ArtifactsSection />}
        {section === 'library' && <LibrarySection />}
        {section === 'missions' && <>
          {!cloudEnabled && <div className="core-rail-empty">Mission history lives in Supabase — connect and sign in as an operator to see past runs.</div>}
          {cloudEnabled && rows === null && <div className="core-rail-empty">Loading…</div>}
          {cloudEnabled && rows?.length === 0 && <div className="core-rail-empty">No {engineLabel} missions yet. Give it a mission and it lands here.</div>}
          {groups.map(([label, missions]) => (
            <div key={label} className="core-rail-group">
              <div className="core-rail-group-head">{label}</div>
              {missions.map(m => (
                <div key={m.id} className={'core-rail-row' + (m.id === activeMissionId ? ' on' : '')}>
                  <button className="core-rail-item" onClick={() => onSelectMission(m.id)}>
                    <span className="core-rail-item-title">
                      <span className={`mission-dot mission-${m.status}`} aria-hidden />
                      {m.goal || 'Mission'}
                    </span>
                    <span className="core-rail-item-sub mono">
                      {m.status === 'running' ? 'running' : m.status === 'failed' ? 'failed' : 'done'}
                      {label !== 'Today' && label !== 'Yesterday' && <> · {REL_TIME(m.createdAt)}</>}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </>}
      </div>
    </div>
  )
}
