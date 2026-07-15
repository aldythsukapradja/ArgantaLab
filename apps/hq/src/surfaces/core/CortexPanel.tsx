// C4b Step 1 skeleton — collapsed by default. v1 scope per C4a §0: toggle +
// session cost + tool activity list only. No placeholder region/recall cards
// (those arrive with C5/C6) — do not build empty sections for them here.
export function CortexPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  if (!open) {
    return (
      <div className="core-cortex core-cortex-collapsed">
        <button className="core-cortex-expand" onClick={onToggle} aria-label="Expand cortex panel">‹</button>
      </div>
    )
  }
  return (
    <div className="core-cortex">
      <div className="core-cortex-head">
        <span>Cortex</span>
        <button className="core-cortex-collapse" onClick={onToggle} aria-label="Collapse cortex panel">›</button>
      </div>
      <div className="core-cortex-body">
        <div className="core-cortex-cost mono">session · $0.0000 · 0 runs</div>
        <div className="core-cortex-empty">No tool activity yet.</div>
      </div>
    </div>
  )
}
