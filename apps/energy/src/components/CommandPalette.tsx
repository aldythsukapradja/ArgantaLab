import { useEffect, useMemo, useRef, useState } from 'react';
import { DOMAINS, SUBTABS, type DomainId } from '../nav';
import { useStore } from '../store';

interface Cmd { key: string; domain: DomainId; sub?: string; label: string; blurb: string; accent: string; phase: string; live: boolean }

export function CommandPalette() {
  const { paletteOpen, togglePalette, goto } = useStore();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Cmd[]>(() => {
    const out: Cmd[] = [];
    for (const d of DOMAINS) {
      out.push({ key: d.id, domain: d.id, label: d.label, blurb: d.blurb, accent: d.accent, phase: d.phase, live: d.status === 'live' });
      for (const s of SUBTABS[d.id]) {
        if (SUBTABS[d.id].length > 1) out.push({ key: d.id + ':' + s.id, domain: d.id, sub: s.id, label: `${d.label} · ${s.label}`, blurb: `${s.label} view`, accent: d.accent, phase: d.phase, live: d.status === 'live' });
      }
    }
    return out;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); togglePalette(); }
      if (e.key === 'Escape') togglePalette(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePalette]);

  useEffect(() => { if (paletteOpen) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [paletteOpen]);

  if (!paletteOpen) return null;

  const results = commands.filter((c) => (c.label + c.key + c.blurb).toLowerCase().includes(q.toLowerCase()));
  const run = (c: Cmd) => goto(c.domain, c.sub);

  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette" onClick={() => togglePalette(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,10,.6)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'grid', placeItems: 'start center', paddingTop: '12vh' }}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: 'var(--panel-2)', overflow: 'hidden' }}>
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && results[idx]) run(results[idx]);
          }}
          placeholder="Jump to domain or sub-tab…" className="mono"
          style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '13px 16px', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && <div style={{ padding: 16, color: 'var(--muted)' }}>No match for “{q}”.</div>}
          {results.map((c, i) => (
            <button key={c.key} onMouseEnter={() => setIdx(i)} onClick={() => run(c)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 3, textAlign: 'left',
                background: i === idx ? 'var(--panel)' : 'transparent', border: i === idx ? '1px solid var(--line)' : '1px solid transparent' }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: `var(--${c.accent})`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.blurb}</div>
              </div>
              <span className="chip mono" style={{ color: c.live ? 'var(--teal)' : 'var(--muted)' }}>{c.live ? c.phase + ' LIVE' : c.phase}</span>
            </button>
          ))}
        </div>
        <div className="mono" style={{ borderTop: '1px solid var(--line)', padding: '7px 14px', fontSize: 10, color: 'var(--muted)', display: 'flex', gap: 14 }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
