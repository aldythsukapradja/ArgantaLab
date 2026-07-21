import { useStore } from '../store';
import { DOMAINS } from '../nav';
import foundation from '../data/foundation.json';
import { ChevronDown, Search, Sun, Moon } from 'lucide-react';

export function ContextBar() {
  const { domain, well, setWell, togglePalette, theme, toggleTheme } = useStore();
  const def = DOMAINS.find((d) => d.id === domain)!;
  const wellOptions = ['ALL WELLS', ...foundation.wells.map((w) => w.well_name)];

  return (
    <header
      style={{
        height: 'var(--topbar-h)', flex: '0 0 var(--topbar-h)', background: 'var(--panel)',
        borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center',
        gap: 14, padding: '0 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="mono" style={{ fontSize: 15, letterSpacing: '0.04em', fontWeight: 600 }}>
          ARGANTA<span style={{ color: 'var(--teal)' }}>ENERGY</span>
        </span>
        <span className="eyebrow">Volve · Operator Workstation</span>
      </div>

      {/* field / well selector */}
      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <select
          value={well}
          onChange={(e) => setWell(e.target.value)}
          aria-label="Well / field context"
          className="mono"
          style={{
            appearance: 'none', background: 'var(--panel-2)', color: 'var(--text)',
            border: '1px solid var(--line)', borderRadius: 3, padding: '5px 26px 5px 10px',
            fontSize: 11.5, letterSpacing: '0.03em', minWidth: 168,
          }}
        >
          {wellOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <ChevronDown size={13} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: 'var(--muted)' }} />
      </label>

      {/* Ctrl-K */}
      <button
        onClick={() => togglePalette(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel-2)',
          border: '1px solid var(--line)', borderRadius: 3, padding: '5px 10px', color: 'var(--muted)',
          fontSize: 11.5, minWidth: 210,
        }}
      >
        <Search size={13} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search domains…</span>
        <span className="mono chip" style={{ padding: '1px 5px' }}>⌘K</span>
      </button>

      <div style={{ flex: 1 }} />

      {/* theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        style={{
          display: 'grid', placeItems: 'center', width: 28, height: 28,
          background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--muted)',
        }}
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* route badge */}
      <span className="chip mono" style={{ color: `var(--${def.accent})`, borderColor: `var(--${def.accent})` }}>
        <span className="dot" style={{ background: `var(--${def.accent})` }} />
        /{def.id}
      </span>
      <span className="chip mono" style={{ color: def.status === 'live' ? 'var(--teal)' : 'var(--muted)' }}>
        {def.status === 'live' ? def.phase + ' · LIVE' : def.phase}
      </span>
    </header>
  );
}
