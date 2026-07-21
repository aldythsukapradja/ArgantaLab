import foundation from '../data/foundation.json';
import { Panel } from '../components/ui';
import { NatureBadge, MethodCapsule, ProvenanceChip, type DataNature } from '../components/Provenance';
import { SchemaCanvas } from './SchemaCanvas';

const fmt = (n: number) => n.toLocaleString('en-US');

export function Foundation() {
  const f = foundation;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto', padding: 14 }}>
      {/* HERO */}
      <div className="panel" style={{ position: 'relative', overflow: 'hidden', padding: '22px 24px' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Field Data Refinery · Volve · North Sea</div>
            <h1 style={{ margin: 0, fontSize: 27, fontWeight: 650, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              A verifiable operator picture of the <span style={{ color: 'var(--teal)' }}>Volve</span> field.
            </h1>
            <p style={{ color: 'var(--muted)', maxWidth: 620, marginTop: 10, fontSize: 13 }}>
              Raw Equinor bytes refined into OSDU-aligned canonical tables. Every value below is measured, reported or
              interpreted — carrying a source_id that resolves to a sha256 in the mirror manifest. No conversions, no
              fabrication, no external identities.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MethodCapsule method="deterministic" />
            <span className="chip" style={{ color: 'var(--teal)', borderColor: 'var(--teal)' }}>● PROVENANCE-COMPLETE</span>
          </div>
        </div>
      </div>

      {/* LIVE METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {f.metrics.map((m) => (
          <div key={m.key} className="panel" style={{ padding: 14, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 2, background: `var(--${m.accent})` }} />
            <div className="eyebrow" style={{ marginBottom: 8 }}>{m.label}</div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: `var(--${m.accent})`, lineHeight: 1 }}>
              {fmt(m.value)}<span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>{m.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{m.note}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 9 }}>
              <NatureBadge nature={m.nature as DataNature} />
              <ProvenanceChip kind={m.provenance} />
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 7, opacity: 0.75 }} title={m.source}>
              src · {m.source}
            </div>
          </div>
        ))}
      </div>

      {/* TRI-BRAIN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {f.triBrain.map((b) => (
          <div key={b.key} className="panel" style={{ padding: 16, borderTop: `2px solid var(--${b.accent})` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: `var(--${b.accent})` }}>{b.title}</h3>
              <span className="chip mono" style={{ marginLeft: 'auto' }}>{b.tag}</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '0 0 12px' }}>{b.body}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {b.stats.map((s) => (
                <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>{s.k}</span>
                  <span className="mono">{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* RELATIONAL SCHEMA CANVAS */}
      <Panel title="Relational Schema · Field → Well → Wellbore → {Production · Logs · Trajectory · Markers}"
        right={<MethodCapsule method="deterministic" />} pad={false} style={{ minHeight: 340 }}>
        <SchemaCanvas schema={f.schema} />
      </Panel>
    </div>
  );
}
