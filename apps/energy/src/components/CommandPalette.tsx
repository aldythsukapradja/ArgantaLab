import { useEffect, useRef, useState } from 'react';
import { DOMAINS } from '../nav';
import { useStore } from '../store';

export function CommandPalette() {
  const { paletteOpen, togglePalette, setDomain } = useStore();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
      if (e.key === 'Escape') togglePalette(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePalette]);

  useEffect(() => {
    if (paletteOpen) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [paletteOpen]);

  if (!paletteOpen) return null;

  const results = DOMAINS.filter((d) => (d.label + d.id + d.blurb).toLowerCase().includes(q.toLowerCase()));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => togglePalette(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,10,.6)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'grid', placeItems: 'start center', paddingTop: '12vh' }}
    >
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: 'var(--panel-2)', overflow: 'hidden' }}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && results[idx]) setDomain(results[idx].id);
          }}
          placeholder="Jump to domain…"
          className="mono"
          style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '13px 16px', color: 'var(--text)', fontSize: 14, outline: 'none' }}
        />
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && <div style={{ padding: 16, color: 'var(--muted)' }}>No domain matches “{q}”.</div>}
          {results.map((d, i) => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => setDomain(d.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px',
                  borderRadius: 3, textAlign: 'left', background: i === idx ? 'var(--panel)' : 'transparent',
                  border: i === idx ? '1px solid var(--line)' : '1px solid transparent',
                }}
              >
                <Icon size={16} style={{ color: `var(--${d.accent})` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.blurb}</div>
                </div>
                <span className="chip mono" style={{ color: d.status === 'live' ? 'var(--teal)' : 'var(--muted)' }}>{d.status === 'live' ? d.phase + ' LIVE' : d.phase}</span>
              </button>
            );
          })}
        </div>
        <div className="mono" style={{ borderTop: '1px solid var(--line)', padding: '7px 14px', fontSize: 10, color: 'var(--muted)', display: 'flex', gap: 14 }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
