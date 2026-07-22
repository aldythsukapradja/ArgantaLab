import type { ReactNode } from 'react';

export type DataNature = 'measured' | 'reported' | 'interpreted' | 'derived' | 'scenario';
export type Method = 'deterministic' | 'stochastic' | 'llm';

const NATURE: Record<DataNature, { label: string; accent: string }> = {
  measured: { label: 'MEASURED', accent: 'var(--teal)' },
  reported: { label: 'REPORTED', accent: 'var(--amber)' },
  interpreted: { label: 'INTERPRETED', accent: 'var(--orange)' },
  derived: { label: 'DERIVED', accent: 'var(--violet)' },
  scenario: { label: 'SCENARIO', accent: 'var(--rose)' },
};

const METHOD: Record<Method, { glyph: string; label: string }> = {
  deterministic: { glyph: '◆', label: 'deterministic' },
  stochastic: { glyph: '▲', label: 'stochastic' },
  llm: { glyph: '✦', label: 'LLM' },
};

export function NatureBadge({ nature }: { nature: DataNature }) {
  const n = NATURE[nature];
  return (
    <span className="chip" style={{ borderColor: n.accent, color: n.accent }} title={`dataNature: ${nature}`}>
      <span className="dot" style={{ background: n.accent }} />
      {n.label}
    </span>
  );
}

export function MethodCapsule({ method }: { method: Method }) {
  const m = METHOD[method];
  return (
    <span className="chip" title={`method: ${m.label}`} style={{ color: 'var(--muted)' }}>
      <span style={{ color: 'var(--teal)' }}>{m.glyph}</span>{m.label}
    </span>
  );
}

export function SourceChip({ source, children }: { source: string; children?: ReactNode }) {
  return (
    <span className="chip mono" title={source} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <span style={{ color: 'var(--orange)' }}>src</span>
      {children ?? source}
    </span>
  );
}

const PROV: Record<string, { label: string; accent: string; tip: string }> = {
  computed: { label: 'COMPUTED', accent: 'var(--teal)', tip: 'Derived at build time from processed canonical data.' },
  qc: { label: 'QC-PRODUCT', accent: 'var(--amber)', tip: 'From the O2 refinery QC product (docs/arganta-energy/qc).' },
  measured: { label: 'MEASURED', accent: 'var(--teal)', tip: 'Instrument measurement.' },
};

export function ProvenanceChip({ kind }: { kind: string }) {
  const p = PROV[kind] ?? { label: kind.toUpperCase(), accent: 'var(--muted)', tip: kind };
  return (
    <span className="chip" style={{ color: p.accent, borderColor: p.accent }} title={p.tip}>{p.label}</span>
  );
}
