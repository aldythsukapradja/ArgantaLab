import { useEffect } from 'react'
import { Command, Moon, Sun } from 'lucide-react'
import { useHQ } from './store'

// P0: the deterministic command surface (a stub action set). Later this is the
// front-end to the ActionRegistry, and the LLM parser slots in behind it.
const ACTIONS = [
  'compare ArgantaLab vs Kinetik retention',
  'show diamond economy health',
  'which features are dead weight',
  'draft a weekly founder update',
]

export function CommandBar() {
  const { cmdOpen, setCmd, theme, toggleTheme } = useHQ()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(!cmdOpen) }
      if (e.key === 'Escape') setCmd(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cmdOpen, setCmd])

  return (
    <>
      <div className="row" style={{ gap: 10 }}>
        <button onClick={() => setCmd(true)} style={{ flex: '1 1 auto', minWidth: 0, display: 'flex',
          alignItems: 'center', gap: 8, border: '1px solid var(--brd2)', borderRadius: 10, padding: '8px 11px',
          color: 'var(--faint)', fontSize: 13, background: 'var(--chip)' }}>
          <Command size={15} /> Ask Circle HQ or type a command
          <span style={{ marginLeft: 'auto', fontSize: 11, border: '1px solid var(--brd2)', borderRadius: 4, padding: '1px 5px' }}>⌘K</span>
        </button>
        <button onClick={toggleTheme} title="Toggle theme" className="row"
          style={{ gap: 5, fontSize: 12, color: 'var(--dim)', border: '1px solid var(--brd2)', borderRadius: 10, padding: '8px 10px' }}>
          {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
          <span className="hq-hide-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
        <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,var(--acc),var(--acc3))' }}>AS</div>
      </div>

      {cmdOpen && (
        <div onClick={() => setCmd(false)} style={{ position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(2,4,12,.55)', display: 'flex', justifyContent: 'center', paddingTop: '12vh' }}>
          <div onClick={(e) => e.stopPropagation()} className="glass"
            style={{ width: 'min(560px,92vw)', height: 'fit-content', borderRadius: 16, padding: 12 }}>
            <div className="row" style={{ gap: 8, padding: '6px 6px 10px', borderBottom: '1px solid var(--brd)' }}>
              <Command size={16} style={{ color: 'var(--dim)' }} />
              <input autoFocus placeholder="Type a command…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14 }} />
              <span className="faint" style={{ fontSize: 11 }}>deterministic · LLM later</span>
            </div>
            <div style={{ paddingTop: 8 }}>
              {ACTIONS.map((a) => (
                <div key={a} style={{ padding: '9px 8px', fontSize: 13, color: 'var(--dim)', borderRadius: 8, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--chip)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  {a}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
