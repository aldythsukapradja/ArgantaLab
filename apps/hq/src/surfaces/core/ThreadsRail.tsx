// C5-B3 · Drawer v2 — the left drawer, sectioned like Claude/ChatGPT:
// Chats · Projects · Artifacts · Library. It replaces the flat, title-only,
// action-less thread list that shipped in C4b Step 2.
//
// Everything here is backed by a REAL store, never a placeholder:
//   Chats     → core_thread RPCs (pin/rename/delete/search need
//               migration_core_projects.sql; the section degrades honestly
//               without it rather than showing dead buttons).
//   Projects  → core_project RPCs (same migration).
//   Artifacts → hq_artifacts_recent (migration_hq_artifacts.sql, already live).
//   Library   → media_assets_recent (already live) — every generated image/clip.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search as SearchIcon, SquarePen, Pin, Trash2, Pencil, FolderPlus, X } from 'lucide-react'
import {
  createThread, listRecentThreads, listProjects, createProject, deleteProject,
  renameThread, setThreadPinned, setThreadProject, deleteThread, searchThreads,
  projectsSupported, type ThreadSummary, type CoreProject, type ProjectsSupport,
} from '../../lib/core'
import { listRecentArtifacts, type StoredArtifact } from '../../builder-core/persist'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { mediaAssetPublicUrl } from '../../lib/mediaAssets'
import { openPreview } from './previewBus'

type Section = 'chats' | 'projects' | 'artifacts' | 'library'

// Projects are hidden until migration_core_projects.sql is actually applied —
// founder's call: an always-"run the migration" tab is noise, not a feature.
// The section itself is kept intact (not deleted) because the ONLY thing
// standing between it and working is that migration; flip this to true the day
// it runs. Note the chats ⋯ menu's "Move to project" already hides itself when
// projects aren't supported, so nothing else needs touching.
const SHOW_PROJECTS = false

const ALL_SECTIONS: { id: Section; label: string }[] = [
  { id: 'chats', label: 'Chats' },
  { id: 'projects', label: 'Projects' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'library', label: 'Library' },
]
const SECTIONS = ALL_SECTIONS.filter(s => s.id !== 'projects' || SHOW_PROJECTS)

const REL_TIME = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const s = ms / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

// ── date grouping (Claude/ChatGPT's "Today / Yesterday / Previous 7 days") ──
// Buckets are computed from LOCAL calendar days, not elapsed hours: a chat from
// 11pm last night is "Yesterday" at 1am, not "2h ago" filed under Today.
const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export function bucketFor(iso: string, now = new Date()): string {
  const today = startOfLocalDay(now)
  const day = startOfLocalDay(new Date(iso))
  const daysAgo = Math.round((today - day) / 86_400_000)
  if (daysAgo <= 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo <= 7) return 'Previous 7 days'
  if (daysAgo <= 30) return 'Previous 30 days'
  // Older than a month: group by month, and include the year once it's not this
  // one, so "January" can't silently mean three different Januaries.
  const d = new Date(iso)
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' })
}

/** Threads → ordered [bucketLabel, threads[]] pairs. Input must already be
 * sorted newest-first; buckets inherit that order, so no bucket can appear
 * out of sequence. Pinned chats are pulled out into their own leading group —
 * a pinned chat you last touched in March should stay at the top, not vanish
 * into "March". */
export function groupByDate(threads: ThreadSummary[]): [string, ThreadSummary[]][] {
  const groups: [string, ThreadSummary[]][] = []
  const push = (label: string, t: ThreadSummary) => {
    const last = groups[groups.length - 1]
    if (last && last[0] === label) last[1].push(t)
    else groups.push([label, [t]])
  }
  const pinned = threads.filter(t => t.pinned)
  pinned.forEach(t => push('Pinned', t))
  threads.filter(t => !t.pinned).forEach(t => push(bucketFor(t.updatedAt), t))
  return groups
}

export function ThreadsRail({ activeThreadId, onSelectThread, open, onToggle, sheet, refreshKey, onThreadsLoaded }: {
  activeThreadId: string | null
  onSelectThread: (id: string) => void
  open: boolean
  onToggle: () => void
  sheet?: boolean
  refreshKey?: number
  onThreadsLoaded?: (count: number) => void
}) {
  const [section, setSection] = useState<Section>('chats')
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null)
  const [projects, setProjects] = useState<CoreProject[] | null>(null)
  const [canProject, setCanProject] = useState<ProjectsSupport | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ThreadSummary[] | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const rows = await listRecentThreads()
    setThreads(rows)
    onThreadsLoaded?.(rows.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { reload() }, [refreshKey, reload])
  useEffect(() => { projectsSupported().then(setCanProject) }, [])
  useEffect(() => { if (canProject === 'ok') listProjects().then(setProjects) }, [canProject, refreshKey])

  // Server-side search covers message BODIES, which title filtering can't. When
  // the migration isn't applied it returns null and we fall back to the old
  // title filter — degraded, but never silently empty.
  useEffect(() => {
    const s = q.trim()
    if (!s) { setHits(null); return }
    let live = true
    const id = setTimeout(() => { searchThreads(s).then(r => { if (live) setHits(r) }) }, 220)
    return () => { live = false; clearTimeout(id) }
  }, [q])

  const visibleThreads = useMemo(() => {
    const base = hits ?? threads ?? []
    const s = q.trim().toLowerCase()
    const filtered = (hits || !s) ? base : base.filter(t => t.title.toLowerCase().includes(s))
    // Pinned first, then recency. `pinned` is undefined pre-migration, which
    // sorts as "not pinned" for everyone — a stable, honest flat list.
    return [...filtered].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || +new Date(b.updatedAt) - +new Date(a.updatedAt))
  }, [hits, threads, q])

  const newThread = async () => {
    const id = await createThread()
    if (id) { onSelectThread(id); reload() }
  }

  if (!open && !sheet) {
    return (
      <div className="core-rail core-rail-collapsed">
        <button className="core-rail-expand" onClick={onToggle} aria-label="Expand drawer">›</button>
      </div>
    )
  }

  return (
    <div className={sheet ? 'core-rail core-rail-sheet' : 'core-rail'}>
      <div className="core-rail-head">
        <span>Arganta Core</span>
        <div className="row" style={{ gap: 4 }}>
          <button className="core-rail-new" onClick={newThread} title="New chat" aria-label="New chat"><SquarePen size={14} /></button>
          {/* On mobile the drawer is a slide-over sheet, and it previously had NO
              visible way out — you had to know to tap the backdrop. Both mounts
              now carry an explicit control next to New chat: ‹ collapses the
              desktop column, ✕ closes the sheet. */}
          {sheet
            ? <button className="core-rail-close" onClick={onToggle} title="Close" aria-label="Close drawer"><X size={15} /></button>
            : <button className="core-rail-collapse" onClick={onToggle} aria-label="Collapse drawer">‹</button>}
        </div>
      </div>

      <div className="core-rail-sections" role="tablist">
        {SECTIONS.map(s => (
          <button
            key={s.id} role="tab" aria-selected={section === s.id}
            className={'core-rail-section' + (section === s.id ? ' is-on' : '')}
            onClick={() => setSection(s.id)}
          >{s.label}</button>
        ))}
      </div>

      {section === 'chats' && (
        <div className="core-rail-search">
          <SearchIcon size={13} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={hits !== null || canProject ? 'Search chats and messages…' : 'Search chat titles…'} aria-label="Search chats" />
          {q && <button className="core-rail-clear" onClick={() => setQ('')} aria-label="Clear search"><X size={12} /></button>}
        </div>
      )}

      <div className="core-rail-body">
        {section === 'chats' && (
          <ChatsSection
            threads={visibleThreads} loading={threads === null} q={q}
            activeThreadId={activeThreadId} onSelectThread={onSelectThread}
            canManage={canProject === 'ok'} projects={projects ?? []}
            menuFor={menuFor} setMenuFor={setMenuFor} onChanged={reload}
          />
        )}
        {section === 'projects' && (
          <ProjectsSection
            supported={canProject} projects={projects} threads={threads ?? []}
            onSelectThread={onSelectThread} onChanged={() => { listProjects().then(setProjects); reload() }}
          />
        )}
        {section === 'artifacts' && <ArtifactsSection />}
        {section === 'library' && <LibrarySection />}
      </div>
    </div>
  )
}

function ChatsSection({ threads, loading, q, activeThreadId, onSelectThread, canManage, projects, menuFor, setMenuFor, onChanged }: {
  threads: ThreadSummary[]; loading: boolean; q: string
  activeThreadId: string | null; onSelectThread: (id: string) => void
  canManage: boolean; projects: CoreProject[]
  menuFor: string | null; setMenuFor: (id: string | null) => void; onChanged: () => void
}) {
  if (loading) return <div className="core-rail-empty">Loading…</div>
  if (!threads.length) return <div className="core-rail-empty">{q ? 'No chats match.' : 'No chats yet.'}</div>
  const groups = groupByDate(threads)
  return (
    <>
      {groups.map(([label, rows]) => (
        <div key={label} className="core-rail-group">
          <div className="core-rail-group-head">{label}</div>
          {rows.map(t => (
            <div key={t.id} className={'core-rail-row' + (t.id === activeThreadId ? ' on' : '')}>
              <button className="core-rail-item" onClick={() => onSelectThread(t.id)}>
                <span className="core-rail-item-title">
                  {t.pinned && <Pin size={10} className="core-rail-pin" />}
                  {t.title || 'New thread'}
                </span>
                {t.snippet && <span className="core-rail-snippet">{t.snippet}</span>}
                {/* The relative stamp is redundant inside Today/Yesterday (the
                    header already says it) but stays useful for older buckets,
                    where "12d" is more legible than a bare month name. */}
                {label !== 'Today' && label !== 'Yesterday' && <span className="core-rail-item-time mono">{REL_TIME(t.updatedAt)}</span>}
              </button>
              {canManage && (
                <button className="core-rail-more" onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} aria-label="Chat actions">⋯</button>
              )}
              {menuFor === t.id && (
                <ThreadMenu
                  thread={t} projects={projects}
                  onClose={() => setMenuFor(null)}
                  onChanged={() => { setMenuFor(null); onChanged() }}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function ThreadMenu({ thread, projects, onClose, onChanged }: {
  thread: ThreadSummary; projects: CoreProject[]; onClose: () => void; onChanged: () => void
}) {
  const rename = async () => {
    const next = window.prompt('Rename chat', thread.title)
    if (next == null) { onClose(); return }
    await renameThread(thread.id, next)
    onChanged()
  }
  // Deleting a thread destroys its messages (core_message cascades). Irreversible,
  // so it always confirms — the one action in this drawer that can lose work.
  const remove = async () => {
    if (!window.confirm(`Delete “${thread.title}” and all its messages? This can’t be undone.`)) { onClose(); return }
    await deleteThread(thread.id)
    onChanged()
  }
  const pin = async () => { await setThreadPinned(thread.id, !thread.pinned); onChanged() }
  const move = async (projectId: string | null) => { await setThreadProject(thread.id, projectId); onChanged() }

  return (
    <>
      <div className="core-menu-backdrop" onClick={onClose} />
      <div className="core-menu" role="menu">
        <button role="menuitem" onClick={pin}><Pin size={12} /> {thread.pinned ? 'Unpin' : 'Pin'}</button>
        <button role="menuitem" onClick={rename}><Pencil size={12} /> Rename</button>
        {projects.length > 0 && (
          <>
            <div className="core-menu-label">Move to project</div>
            {projects.map(p => (
              <button key={p.id} role="menuitem" onClick={() => move(p.id)} disabled={p.id === thread.projectId}>
                {p.emoji || '📁'} {p.name}
              </button>
            ))}
            {thread.projectId && <button role="menuitem" onClick={() => move(null)}>↩ Remove from project</button>}
          </>
        )}
        <button role="menuitem" className="core-menu-danger" onClick={remove}><Trash2 size={12} /> Delete</button>
      </div>
    </>
  )
}

function ProjectsSection({ supported, projects, threads, onSelectThread, onChanged }: {
  supported: ProjectsSupport | null; projects: CoreProject[] | null; threads: ThreadSummary[]
  onSelectThread: (id: string) => void; onChanged: () => void
}) {
  if (supported === null) return <div className="core-rail-empty">Checking…</div>
  // Name the ACTUAL blocker. Telling an offline founder to run a migration
  // would send them to fix the wrong thing.
  if (supported === 'offline') {
    return <div className="core-rail-empty">Projects live in Supabase — connect and sign in as an operator to use them.</div>
  }
  if (supported === 'needs-migration') {
    return (
      <div className="core-rail-empty">
        Projects need <code>migration_core_projects.sql</code>. Run it in Supabase and this section fills in — it also unlocks pin, rename, delete and message search on chats.
      </div>
    )
  }
  const add = async () => {
    const name = window.prompt('Project name')
    if (!name) return
    await createProject(name)
    onChanged()
  }
  const drop = async (p: CoreProject) => {
    if (!window.confirm(`Delete project “${p.name}”? Its chats are kept and become loose chats.`)) return
    await deleteProject(p.id)
    onChanged()
  }
  return (
    <>
      <button className="core-rail-add" onClick={add}><FolderPlus size={13} /> New project</button>
      {projects === null && <div className="core-rail-empty">Loading…</div>}
      {projects?.length === 0 && <div className="core-rail-empty">No projects yet. A project groups chats and gives them shared standing context.</div>}
      {projects?.map(p => {
        const inside = threads.filter(t => t.projectId === p.id)
        return (
          <div key={p.id} className="core-rail-project">
            <div className="core-rail-project-head">
              <span>{p.emoji || '📁'} {p.name}</span>
              <button className="core-rail-more" onClick={() => drop(p)} aria-label={`Delete ${p.name}`}><Trash2 size={11} /></button>
            </div>
            {inside.length === 0
              ? <div className="core-rail-project-empty">No chats yet — move one in from its ⋯ menu.</div>
              : inside.map(t => (
                <button key={t.id} className="core-rail-item core-rail-item-nested" onClick={() => onSelectThread(t.id)}>
                  <span className="core-rail-item-title">{t.title}</span>
                  <span className="core-rail-item-time mono">{REL_TIME(t.updatedAt)}</span>
                </button>
              ))}
          </div>
        )
      })}
    </>
  )
}

function ArtifactsSection() {
  const [rows, setRows] = useState<StoredArtifact[] | null>(null)
  useEffect(() => { listRecentArtifacts(50).then(setRows) }, [])
  if (rows === null) return <div className="core-rail-empty">Loading…</div>
  if (!rows.length) return <div className="core-rail-empty">No saved artifacts yet. Ask Core to build a website or an app and it lands here.</div>
  return (
    <>
      {rows.map(a => (
        <button
          key={a.id} className="core-rail-item"
          onClick={() => openPreview({ kind: 'artifact', title: a.title, html: a.html, artifactId: a.id })}
        >
          <span className="core-rail-item-title">{a.title}</span>
          <span className="core-rail-item-sub mono">{a.kind} · v{a.currentVersion} · {a.status}</span>
        </button>
      ))}
    </>
  )
}

function LibrarySection() {
  const [rows, setRows] = useState<any[] | null>(null)
  useEffect(() => {
    if (!cloudEnabled) { setRows([]); return }
    supabase.rpc('media_assets_recent', { p_limit: 60 }).then(({ data }) => setRows((data as any[]) || []))
  }, [])
  if (rows === null) return <div className="core-rail-empty">Loading…</div>
  if (!rows.length) return <div className="core-rail-empty">No generated media yet. Every image and voice clip Core makes is saved here.</div>
  return (
    <div className="core-rail-library">
      {rows.map(a => {
        const url = mediaAssetPublicUrl(a.path)
        return a.kind === 'image' ? (
          // Opens the real file in a tab — full size, and the browser's own
          // save works from there. (The chat card has an explicit Download.)
          <a key={a.id} className="core-lib-tile" href={url} target="_blank" rel="noopener noreferrer" title={a.prompt || 'Generated image'}>
            <img src={url} alt={a.prompt || 'Generated image'} loading="lazy" />
          </a>
        ) : (
          <a key={a.id} className="core-lib-audio" href={url} target="_blank" rel="noopener noreferrer" title={a.prompt || 'Generated audio'}>
            ♪ {(a.prompt || 'audio').slice(0, 40)}
          </a>
        )
      })}
    </div>
  )
}
