import type { ViewerManifest } from './registry';

/** Honest phase-labelled placeholder listing the planned mechanics for a viewer. */
export function Placeholder({ m }: { m: ViewerManifest }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24, overflow: 'auto' }}>
      <div className="panel" style={{ position: 'relative', overflow: 'hidden', maxWidth: 520, width: '100%', padding: '28px 26px' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Field Development · {m.name}</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Coming in {m.phase}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '0 0 16px' }}>{m.blurb}</p>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Planned mechanics</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {m.planned.map((p, i) => (
              <li key={i} style={{ fontSize: 12.5, color: 'var(--text)' }}>{p}</li>
            ))}
          </ul>
          <div style={{ marginTop: 18 }}>
            <span className="chip mono" style={{ color: 'var(--orange)', borderColor: 'var(--orange)' }}>PHASE · {m.phase}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
