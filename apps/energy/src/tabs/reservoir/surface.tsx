// surface.tsx — shared Reservoir-Management tab chrome: a header (title + provenance +
// subtitle), a panel card, and a KPI stat tile. Token-themed, both themes.
import type { ReactNode } from 'react';
import { NatureBadge, type DataNature } from '../../components/Provenance';

export function TabHeader({ title, subtitle, nature, right }: {
  title: string; subtitle?: string; nature?: DataNature; right?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 650, margin: 0, color: 'var(--text)' }}>{title}</h2>
          {nature && <NatureBadge nature={nature} />}
        </div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function Panel({ title, right, children, minHeight = 200 }: { title: string; right?: ReactNode; children: ReactNode; minHeight?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)', overflow: 'hidden', minHeight }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderBottom: '1px solid var(--line)' }}>
        <span className="eyebrow" style={{ flex: 1, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{title}</span>
        {right}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)', padding: '11px 13px', minWidth: 120 }}>
      <div className="eyebrow" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: accent || 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/** A scrollable page body with comfortable padding (every RM tab wraps content in this). */
export function Page({ children }: { children: ReactNode }) {
  return <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>{children}</div>;
}
