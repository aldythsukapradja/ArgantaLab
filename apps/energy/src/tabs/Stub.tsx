import type { DomainDef } from '../nav';

export function Stub({ def }: { def: DomainDef }) {
  const Icon = def.icon;
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel" style={{ position: 'relative', overflow: 'hidden', maxWidth: 460, width: '100%', textAlign: 'center', padding: '36px 28px' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative' }}>
          <div style={{ width: 52, height: 52, margin: '0 auto 16px', borderRadius: 8, display: 'grid', placeItems: 'center',
            border: '1px solid var(--line)', background: 'var(--panel-2)', color: `var(--${def.accent})` }}>
            <Icon size={24} strokeWidth={1.7} />
          </div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Domain · {def.label}</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Coming in {def.phase}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '0 auto', maxWidth: 340 }}>{def.blurb}</p>
          <div style={{ marginTop: 16 }}>
            <span className="chip mono" style={{ color: `var(--${def.accent})`, borderColor: `var(--${def.accent})` }}>PLACEHOLDER · {def.phase}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
