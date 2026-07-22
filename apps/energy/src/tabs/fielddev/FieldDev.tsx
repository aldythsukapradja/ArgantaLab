// FieldDev.tsx — the field-development workbench surface. Routes the active
// sub-tab to a live viewer (Map/Logs/Correlation) or an honest placeholder.
import { Component, type ReactNode } from 'react';
import { VIEWERS } from './registry';
import { Placeholder } from './Placeholder';
import { MapView } from './MapView';
import { LogsView } from './LogsView';
import { CorrelationView } from './CorrelationView';
import { Petrophysics } from './Petrophysics';
import { Structural } from './Structural';
import { Property } from './Property';
import { Volumetrics } from './Volumetrics';
import { Uncertainty } from './Uncertainty';
import { Forecast } from './Forecast';
import { Economics } from './Economics';

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

export function FieldDev({ subtab }: { subtab: string }) {
  const m = VIEWERS[subtab] ?? VIEWERS.map;
  let body;
  if (m.id === 'map') body = <MapView />;
  else if (m.id === 'logs') body = <LogsView />;
  else if (m.id === 'correlation') body = <CorrelationView />;
  else if (m.id === 'petrophysics') body = <Petrophysics />;
  else if (m.id === 'structural') body = <Structural />;
  else if (m.id === 'property') body = <Property />;
  else if (m.id === 'volumetrics') body = <Volumetrics />;
  else if (m.id === 'uncertainty') body = <Uncertainty />;
  else if (m.id === 'forecast') body = <Forecast />;
  else if (m.id === 'economics') body = <Economics />;
  else body = <Placeholder m={m} />;
  return <div style={{ height: '100%', minHeight: 0 }}><ViewerBoundary name={m.name} key={m.id}>{body}</ViewerBoundary></div>;
}
