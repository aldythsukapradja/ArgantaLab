import { useStore } from '../store';
import { DOMAINS, SUBTABS } from '../nav';
import foundation from '../data/foundation.json';
import { ChevronDown, Search, Sun, Moon } from 'lucide-react';

// Top bar = the SUB-TAB bar: brand (compact) · domain sub-tabs · well selector · ⌘K ·
// theme toggle · route badge. Sub-tabs render from the SUBTABS config (config-driven).
export function ContextBar({ mobile = false }: { mobile?: boolean }) {
  const { domain, subtab, setSubtab, well, setWell, togglePalette, theme, toggleTheme } = useStore();
  const def = DOMAINS.find((d) => d.id === domain)!;
  const subs = SUBTABS[domain];
  const wellOptions = ['ALL WELLS', ...foundation.wells.map((w) => w.well_name)];

  return (
    <header style={{
      minHeight: 'var(--topbar-h)', flex: '0 0 auto', background: 'var(--panel)',
      borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center',
      gap: 12, padding: '0 12px',
    }}>
      {!mobile && (
        <span className="mono" style={{ fontSize: 13, letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {def.label}
        </span>
      )}

      {/* sub-tabs (scrollable strip on mobile) */}
      <div role="tablist" aria-label={`${def.label} sub-tabs`}
        style={{ display: 'flex', gap: 2, flex: mobile ? 1 : 'unset', overflowX: 'auto', alignItems: 'stretch', height: '100%' }}>
        {subs.map((s) => {
          const active = subtab === s.id;
          return (
            <button key={s.id} role="tab" aria-selected={active} onClick={() => setSubtab(s.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '0 12px', fontSize: 12, whiteSpace: 'nowrap',
                color: active ? 'var(--text)' : 'var(--muted)',
                borderBottom: active ? `2px solid var(--${def.accent})` : '2px solid transparent',
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {!mobile && (
        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select value={well} onChange={(e) => setWell(e.target.value)} aria-label="Well / field context" className="mono"
            style={{ appearance: 'none', background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)',
              borderRadius: 3, padding: '5px 26px 5px 10px', fontSize: 11.5, letterSpacing: '0.03em', minWidth: 150 }}>
            {wellOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: 'var(--muted)' }} />
        </label>
      )}

      <button onClick={() => togglePalette(true)} aria-label="Command palette"
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel-2)', border: '1px solid var(--line)',
          borderRadius: 3, padding: '5px 9px', color: 'var(--muted)', fontSize: 11.5 }}>
        <Search size={13} />
        {!mobile && <span style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>Search…</span>}
        <span className="mono chip" style={{ padding: '1px 5px' }}>⌘K</span>
      </button>

      <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, background: 'var(--panel-2)',
          border: '1px solid var(--line)', borderRadius: 3, color: 'var(--muted)', flexShrink: 0 }}>
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {!mobile && (
        <span className="chip mono" style={{ color: `var(--${def.accent})`, borderColor: `var(--${def.accent})` }}>
          <span className="dot" style={{ background: `var(--${def.accent})` }} />/{def.id}
        </span>
      )}
    </header>
  );
}
