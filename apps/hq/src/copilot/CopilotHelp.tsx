import { useMemo } from 'react'
import { Hand, Mic, Sparkles, X } from 'lucide-react'
import type { RegistryEntry } from './registry'
import type { CommandCategory } from './intents'
import './copilot.css'

// ─────────────────────────────────────────────────────────────────────────
// CopilotHelp — the voice/gesture cheat-sheet. Renders straight from the live
// command registry (so it always matches what actually works), grouped by
// category, with a gesture legend. Everyday-use popup, so no operator-only
// controls here — "Generate voice replies" lives in the Copilot control tab.
// ─────────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: { id: CommandCategory; label: string }[] = [
  { id: 'navigate', label: 'Navigate' },
  { id: 'product', label: 'Products' },
  { id: 'control', label: 'Control' },
  { id: 'system', label: 'System' },
]

export interface CopilotHelpProps {
  entries: RegistryEntry[]
  source: 'db' | 'seed'
  onClose: () => void
}

export function CopilotHelp({ entries, source, onClose }: CopilotHelpProps) {
  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map(cat => ({
      ...cat,
      items: entries.filter(e => e.category === cat.id),
    })).filter(g => g.items.length)
  }, [entries])

  return (
    <div className="cp-help-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="cp-help" role="dialog" aria-modal="true" aria-labelledby="cp-help-title">
        <header className="cp-help-head">
          <div className="cp-help-title">
            <span className="cp-help-mark"><Sparkles size={16} /></span>
            <div>
              <div className="cp-kicker">JARVIS COPILOT</div>
              <h2 id="cp-help-title">Voice &amp; gesture commands</h2>
            </div>
          </div>
          <button className="cp-help-close" onClick={onClose} aria-label="Close command list"><X size={18} /></button>
        </header>

        <div className="cp-help-legend">
          <span><Mic size={13} /> Tap the mic, then speak a phrase</span>
          <span><Hand size={13} /> Swipe = cycle · Pinch = close</span>
        </div>

        <div className="cp-help-grid">
          {grouped.map(group => (
            <div className="cp-help-group" key={group.id}>
              <h3>{group.label}</h3>
              <ul>
                {group.items.map(item => (
                  <li key={item.id}>
                    <div className="cp-cmd-phrases">
                      {item.phrases.slice(0, 2).map(p => <code key={p}>“{p}”</code>)}
                    </div>
                    <span className="cp-cmd-label">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <footer className="cp-help-foot">
          <span className="cp-source">{source === 'db' ? 'Live from command registry' : 'Built-in commands'}</span>
        </footer>
      </section>
    </div>
  )
}
