// ReservoirMgmt.tsx — the Reservoir-Management workbench router. Routes the active
// sub-tab to a live viewer (or an honest placeholder), each wrapped in an error
// boundary. Mirrors tabs/fielddev/FieldDev.tsx. Shares one loaded RMData across tabs
// via a lightweight context so every tab reads the same real Volve series.
import { Component, createContext, useContext, type ReactNode } from 'react';
import { useAsync } from '../fielddev/hooks';
import { Loading, ErrorBanner } from '../fielddev/chrome';
import { loadRMData, type RMData } from './data';
import { RM_VIEWERS } from './registry';
import { Overview } from './Overview';
import { Production } from './Production';
import { InjectionVrr } from './InjectionVrr';
import { Pressure } from './Pressure';
import { WellTests } from './WellTests';
import { Patterns } from './Patterns';
import { Forecast } from './Forecast';
import { Opportunities } from './Opportunities';
import { Surveillance } from './Surveillance';

const RMCtx = createContext<RMData | null>(null);
export function useRM(): RMData { const d = useContext(RMCtx); if (!d) throw new Error('RM data not loaded'); return d; }

class ViewerBoundary extends Component<{ children: ReactNode; name: string }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: String((e as Error)?.message || e) }; }
  render() {
    if (this.state.err) return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 440, padding: 24, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)' }}>
          <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--rose)' }}>{this.props.name} · runtime error</div>
          <p className="mono" style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{this.state.err}</p>
          <button onClick={() => this.setState({ err: null })} style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 3, padding: '5px 12px', background: 'var(--panel-2)', color: 'var(--text)' }}>Retry</button>
        </div>
      </div>);
    return this.props.children;
  }
}

function Body({ subtab }: { subtab: string }) {
  switch (subtab) {
    case 'overview': return <Overview />;
    case 'surveillance': return <Surveillance />;
    case 'production': return <Production />;
    case 'injection': return <InjectionVrr />;
    case 'pressure': return <Pressure />;
    case 'welltests': return <WellTests />;
    case 'patterns': return <Patterns />;
    case 'forecast': return <Forecast />;
    case 'opportunities': return <Opportunities />;
    default: return <Overview />;
  }
}

export function ReservoirMgmt({ subtab }: { subtab: string }) {
  const rm = useAsync<RMData>(loadRMData, []);
  const v = RM_VIEWERS[subtab] ?? RM_VIEWERS.overview;
  if (rm.loading) return <Loading what="production surveillance data" />;
  if (rm.error || !rm.data) return <ErrorBanner msg={rm.error || 'reservoir data unavailable'} />;
  return (
    <RMCtx.Provider value={rm.data}>
      <ViewerBoundary name={v.label}><Body subtab={v.id} /></ViewerBoundary>
    </RMCtx.Provider>
  );
}
