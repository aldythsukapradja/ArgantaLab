// Exploration.tsx — the exploration workbench surface. Routes the active canonical
// sub-tab (COSMO TAB_SPECS.exploration) to its live deterministic viewer, or — for a
// tab not yet built (Seismic) — to the founder's rendered acceptance spec. Mirrors
// FieldDev.tsx (ViewerBoundary + honest fallback).
import { Component, type ReactNode } from 'react';
import type { ExplSel } from './ExplorationExplorer';
import './exploration.css';
import { explStatus } from './registry';
import { SpecCanvas } from './SpecCanvas';
import { ExplOverview } from './Overview';
import { ExplBasemap } from './Basemap';
import { ExplWells } from './Wells';
import { ExplInterpretation } from './Interpretation';
import { ExplPlaysProspects } from './PlaysProspects';
import { ExplVolumetrics } from './Volumetrics';
import { ExplRisk } from './Risk';

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

export function Exploration({ tab, sel, setSel }: { tab: string; sel: ExplSel; setSel: (s: ExplSel) => void }) {
  let body: ReactNode;
  if (explStatus(tab) === 'spec') body = <SpecCanvas tab={tab} />;
  else if (tab === 'Overview') body = <ExplOverview setSel={setSel} />;
  else if (tab === 'Basemap') body = <ExplBasemap sel={sel} setSel={setSel} />;
  else if (tab === 'Wells') body = <ExplWells sel={sel} setSel={setSel} />;
  else if (tab === 'Interpretation') body = <ExplInterpretation sel={sel} />;
  else if (tab === 'Plays & Prospects') body = <ExplPlaysProspects sel={sel} setSel={setSel} />;
  else if (tab === 'Volumetrics') body = <ExplVolumetrics sel={sel} setSel={setSel} />;
  else if (tab === 'Risk & Uncertainty') body = <ExplRisk sel={sel} setSel={setSel} />;
  else body = <SpecCanvas tab={tab} />;
  return <div className="expl-surface" style={{ height: '100%', minHeight: 0 }}><ViewerBoundary name={tab} key={tab}>{body}</ViewerBoundary></div>;
}
