// C4b Step 2 — threads rail wired to real core_thread rows via lib/core/thread.
import { useEffect, useMemo, useState } from 'react'
import { Search as SearchIcon, SquarePen } from 'lucide-react'
import { createThread, listRecentThreads } from '../../lib/core'

interface ThreadSummary { id: string; title: string; updatedAt: string }

const REL_TIME = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const s = ms / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function ThreadsRail({ activeThreadId, onSelectThread, open, onToggle, sheet, refreshKey }: {
  activeThreadId: string | null
  onSelectThread: (id: string) => void
  open: boolean
  onToggle: () => void
  sheet?: boolean
  /** Bump to force a reload (e.g. after the first message creates a thread). */
  refreshKey?: number
}) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let active = true
    listRecentThreads().then(rows => { if (active) setThreads(rows) })
    return () => { active = false }
  }, [refreshKey])

  const filtered = useMemo(() => {
    if (!threads) return []
    const s = q.trim().toLowerCase()
    if (!s) return threads
    return threads.filter(t => t.title.toLowerCase().includes(s))
  }, [threads, q])

  const newThread = async () => {
    const id = await createThread()
    if (id) onSelectThread(id)
  }

  if (!open && !sheet) {
    return (
      <div className="core-rail core-rail-collapsed">
        <button className="core-rail-expand" onClick={onToggle} aria-label="Expand threads">›</button>
      </div>
    )
  }

  return (
    <div className={sheet ? 'core-rail core-rail-sheet' : 'core-rail'}>
      <div className="core-rail-head">
        <span>Threads</span>
        <div className="row" style={{ gap: 4 }}>
          <button className="core-rail-new" onClick={newThread} title="New thread" aria-label="New thread">
            <SquarePen size={14} />
          </button>
          {!sheet && <button className="core-rail-collapse" onClick={onToggle} aria-label="Collapse threads">‹</button>}
        </div>
      </div>
      <div className="core-rail-search">
        <SearchIcon size={13} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search threads…" aria-label="Search threads" />
      </div>
      <div className="core-rail-body">
        {threads === null && <div className="core-rail-empty">Loading…</div>}
        {threads !== null && filtered.length === 0 && q && <div className="core-rail-empty">No threads match.</div>}
        {threads !== null && filtered.length === 0 && !q && <div className="core-rail-empty">No threads yet.</div>}
        {filtered.map(t => (
          <button
            key={t.id}
            className={'core-rail-item' + (t.id === activeThreadId ? ' on' : '')}
            onClick={() => onSelectThread(t.id)}
          >
            <span className="core-rail-item-title">{t.title || 'New thread'}</span>
            <span className="core-rail-item-time mono">{REL_TIME(t.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
