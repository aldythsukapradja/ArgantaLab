import data from '../data/data.json';
import foundation from '../data/foundation.json';
import { Panel } from '../components/ui';
import { MethodCapsule } from '../components/Provenance';
import { HardDriveDownload, Binary, ShieldCheck, ArrowRight } from 'lucide-react';

// Data → Pipeline sub-tab: mirror → decode → validate stage cards with REAL counts
// (deterministic, sourced from data.json + foundation metrics). No fabrication.
export function DataPipeline() {
  const m = data.mirror;
  const prodRows = foundation.metrics.find((x) => x.key === 'production')?.value ?? 0;
  const logValues = foundation.metrics.find((x) => x.key === 'logvalues')?.value ?? 0;

  const stages = [
    {
      icon: HardDriveDownload, accent: 'teal', label: 'Mirror', sub: '1:1 raw byte mirror',
      stats: [
        { k: 'Files', v: m.files.toLocaleString() },
        { k: 'Size', v: m.gb + ' GB' },
        { k: 'sha256', v: `${m.verified}/${m.files}` },
      ],
    },
    {
      icon: Binary, accent: 'amber', label: 'Decode', sub: 'raw → canonical tables',
      stats: [
        { k: 'Production rows', v: prodRows.toLocaleString() },
        { k: 'Log curve values', v: logValues.toLocaleString() },
        { k: 'Wells', v: String(foundation.wells.length) },
      ],
    },
    {
      icon: ShieldCheck, accent: 'blue', label: 'Validate', sub: 'FK + provenance checks',
      stats: [
        { k: 'Failures', v: String(m.failures) },
        { k: 'Verified', v: `${m.verified}/${m.files}` },
        { k: 'Status', v: m.failures === 0 ? 'OK' : 'REVIEW' },
      ],
    },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 14 }}>
      <Panel title="Ingestion pipeline" right={<MethodCapsule method="deterministic" />}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
          {stages.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 240px' }}>
                <div className="panel-2 hairline" style={{ flex: 1, borderRadius: 6, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 6, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', color: `var(--${s.accent})` }}><Icon size={16} /></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                      <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{s.sub}</div>
                    </div>
                  </div>
                  {s.stats.map((st) => (
                    <div key={st.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}>
                      <span className="eyebrow" style={{ letterSpacing: '0.08em' }}>{st.k}</span>
                      <span className="mono" style={{ color: 'var(--text)' }}>{st.v}</span>
                    </div>
                  ))}
                </div>
                {i < stages.length - 1 && <ArrowRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12 }}>
          Deterministic · idempotent · every processed row.source_id resolves to a sha256 in the mirror ledger · {m.source}
        </div>
      </Panel>
    </div>
  );
}
