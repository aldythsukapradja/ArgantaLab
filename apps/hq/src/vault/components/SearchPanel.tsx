// HQ Vault — global search panel: title/frontmatter/body with snippets and
// highlighted matches.

import { useMemo } from 'react'
import { SearchX, Search } from 'lucide-react'
import { useVault } from '../store'
import { searchNotes } from '../storage'
import { PRODUCT_COLOR } from '../types'

function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>
  const lower = text.toLowerCase()
  const n = needle.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0, k = 0
  while (i < text.length) {
    const hit = lower.indexOf(n, i)
    if (hit === -1) { parts.push(<span key={k++}>{text.slice(i)}</span>); break }
    if (hit > i) parts.push(<span key={k++}>{text.slice(i, hit)}</span>)
    parts.push(<mark key={k++} className="v-mark">{text.slice(hit, hit + n.length)}</mark>)
    i = hit + n.length
  }
  return <>{parts}</>
}

export function SearchPanel() {
  const q = useVault(s => s.searchQuery)
  const setQ = useVault(s => s.setSearchQuery)
  const notes = useVault(s => s.notes)
  const openNote = useVault(s => s.openNote)

  const hits = useMemo(() => searchNotes(q, notes), [q, notes])

  return (
    <div className="vx">
      <div className="vx-head">
        <input className="vx-filter" placeholder="Search vault…" value={q} autoFocus
          onChange={e => setQ(e.target.value)} aria-label="Search vault" />
      </div>
      <div className="vx-scroll vs-results">
        {!q.trim() && (
          <div className="vs-idle">
            <Search size={20} />
            <p>Search across titles, properties and note bodies.</p>
            <p className="vs-hint">Try “Argons”, “retention” or “pilot”.</p>
          </div>
        )}
        {q.trim() !== '' && hits.length === 0 && (
          <div className="vs-idle"><SearchX size={20} /><p>No matches for “{q}”.</p></div>
        )}
        {hits.map(h => {
          const note = notes[h.id]
          return (
            <button key={h.id} className="vs-hit" onClick={() => openNote(h.id)}>
              <div className="vs-hit-top">
                <span className="vp-dot" style={{ background: note ? PRODUCT_COLOR[note.fm.product] : 'var(--v-tx3)' }} />
                <span className="vs-hit-t"><Highlight text={h.title} needle={q} /></span>
                <span className="vs-hit-in">{h.matchIn.join(' · ')}</span>
              </div>
              {h.snippet && <div className="vs-snip"><Highlight text={h.snippet} needle={q} /></div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
