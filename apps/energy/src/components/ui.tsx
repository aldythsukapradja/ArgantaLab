import type { ReactNode } from 'react';

export function Panel({ title, right, children, style, pad = true }: {
  title?: ReactNode; right?: ReactNode; children: ReactNode; style?: React.CSSProperties; pad?: boolean;
}) {
  return (
    <section className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--line)' }}>
          <div className="eyebrow" style={{ flex: 1 }}>{title}</div>
          {right}
        </div>
      )}
      <div style={{ padding: pad ? 12 : 0, flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
    </section>
  );
}

export function StateTag({ state }: { state: string }) {
  const map: Record<string, { c: string; l: string }> = {
    verified: { c: 'var(--teal)', l: 'VERIFIED' },
    mirrored: { c: 'var(--teal)', l: 'MIRRORED' },
    'partial-or-full': { c: 'var(--teal)', l: 'MIRRORED' },
    selected: { c: 'var(--amber)', l: 'SELECTED' },
    excluded: { c: 'var(--rose)', l: 'EXCLUDED BY RULE' },
    deferred: { c: 'var(--orange)', l: 'DEFERRED' },
    unavailable: { c: 'var(--muted)', l: 'UNAVAILABLE' },
    empty: { c: 'var(--muted)', l: 'EMPTY' },
  };
  const m = map[state] ?? { c: 'var(--muted)', l: state.toUpperCase() };
  return <span className="chip" style={{ color: m.c, borderColor: m.c }}><span className="dot" style={{ background: m.c }} />{m.l}</span>;
}

export function fmtBytes(b: number): string {
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}
