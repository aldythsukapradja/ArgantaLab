// WellDelivery.tsx — routes the active Well Delivery tab to its cockpit, wrapped
// in a runtime-error boundary. Mirrors FieldDev.tsx exactly (same template).
import { Component, type ReactNode } from 'react';
import type { WdCandidate } from './types';
import { wdTab } from './registry';
import { Proposal } from './Proposal';
import { Basis } from './Basis';
import { Clearance } from './Clearance';
import { Steering } from './Steering';
import { Debrief } from './Debrief';
import { Handover } from './Handover';

class ViewerBoundary extends Component<{ children: ReactNode; name: string }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: String((e as Error)?.message || e) }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div className="panel" style={{ maxWidth: 420, padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--rose)' }}>{this.props.name} · runtime error</div>
            <p className="mono" style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{this.state.err}</p>
            <button onClick={() => this.setState({ err: null })} style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 3, padding: '5px 12px', background: 'var(--panel-2)', color: 'var(--text)' }}>Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function WellDelivery({ subtab, candidate, onChange }: {
  subtab: string; candidate: WdCandidate; onChange: (c: WdCandidate) => void;
}) {
  const t = wdTab(subtab);
  let body: ReactNode;
  if (t.id === 'proposal') body = <Proposal c={candidate} />;
  else if (t.id === 'basis') body = <Basis c={candidate} onChange={onChange} />;
  else if (t.id === 'clearance') body = <Clearance c={candidate} />;
  else if (t.id === 'steering') body = <Steering c={candidate} />;
  else if (t.id === 'debrief') body = <Debrief c={candidate} />;
  else body = <Handover c={candidate} onChange={onChange} />;
  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <ViewerBoundary name={t.name} key={t.id + candidate.id}>{body}</ViewerBoundary>
    </div>
  );
}
