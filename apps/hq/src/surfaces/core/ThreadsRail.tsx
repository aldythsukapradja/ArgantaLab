// C4b Step 1 skeleton — filled in at Step 2 (threads rail wiring).
export function ThreadsRail({ activeThreadId, onSelectThread, open, onToggle, sheet }: {
  activeThreadId: string | null
  onSelectThread: (id: string) => void
  open: boolean
  onToggle: () => void
  sheet?: boolean
}) {
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
        {!sheet && <button className="core-rail-collapse" onClick={onToggle} aria-label="Collapse threads">‹</button>}
      </div>
      <div className="core-rail-body">
        <div className="core-rail-empty">No threads yet.</div>
      </div>
    </div>
  )
}
