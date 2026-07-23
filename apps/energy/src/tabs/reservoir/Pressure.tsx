// Pressure.tsx — the Pressure Evolution tab (COSMO). Real MEASURED downhole (BHP) and
// wellhead (THP) pressure per producer over time, from the R0 build (6,667 daily BHP
// readings aggregated to monthly flowing means). Cohort/focus by selection; a per-well
// depletion table (first→latest flowing BHP). Datum Pi from the deck PVT.
import { useMemo } from 'react';
import { useRM } from './ReservoirMgmt';
import { useSelection, setSelection } from './selection';
import { RMChart, type RMSeries } from './chart/RMChart';
import { Panel, Stat, TabHeader, Page } from './surface';
import { BARA_TO_PSI } from './data';
import type { RMWellSeries } from './data';

function seriesOf(wells: RMWellSeries[], pick: (w: RMWellSeries) => Array<number | null>, focus: string | null, col: string): RMSeries[] {
  return wells.map((w) => {
    const arr = pick(w); const pts: Array<[number, number]> = [];
    for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (v != null && Number.isFinite(v)) pts.push([i, v]); }
    const isF = w.well === focus;
    return { name: w.well, color: isF ? col : 'var(--muted)', pts, faded: !isF && !!focus, width: isF ? 2 : 1.1 };
  }).filter((s) => s.pts.length > 0);
}
const firstLast = (a: Array<number | null>) => { const v = a.filter((x): x is number => x != null); return v.length ? { first: v[0], last: v[v.length - 1], n: v.length } : null; };

export function Pressure() {
  const rm = useRM();
  const sel = useSelection();
  const pi = (rm.index.pvt?.Pi ?? 0) * BARA_TO_PSI;
  const bhpSeries = useMemo(() => seriesOf(rm.producers, (w) => w.bhp, sel.well, 'var(--violet)'), [rm, sel.well]);
  const thpSeries = useMemo(() => seriesOf([...rm.producers, ...rm.injectors], (w) => w.thp, sel.well, 'var(--blue)'), [rm, sel.well]);
  const rows = useMemo(() => rm.producers.map((w) => ({ well: w.well, bhp: firstLast(w.bhp) })).filter((r) => r.bhp), [rm]);

  return (
    <Page>
      <TabHeader title="Pressure Evolution" nature="measured"
        subtitle={`Flowing BHP/THP from real Volve gauges (monthly means) · datum Pi ≈ ${pi.toFixed(0)} psi (${(rm.index.pvt?.Pi ?? 0)} bara, deck)${sel.well ? ` · focus ${sel.well}` : ''}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
        <Stat label="Initial Pressure" value={pi.toFixed(0)} sub="psi · deck EQUIL" />
        <Stat label="Producers w/ BHP" value={rows.length} sub="measured gauges" accent="var(--violet)" />
        <Stat label="Bubble Point" value={((rm.index.pvt?.Pb ?? 0) * BARA_TO_PSI).toFixed(0)} sub={`psi · undersaturated`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel title="Downhole Pressure (BHP) — producers" minHeight={260}>
          <RMChart series={bhpSeries} xLabel="Month index" yLabel="BHP · psi" target={pi > 0 ? { y: pi, label: 'Pi' } : undefined} />
        </Panel>
        <Panel title="Wellhead Pressure (THP)" minHeight={260}>
          <RMChart series={thpSeries} xLabel="Month index" yLabel="THP · psi" />
        </Panel>
      </div>

      <Panel title="Depletion by well (first → latest flowing BHP)" minHeight={0}>
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase' }}>
              <th style={{ padding: '7px 12px' }}>Well</th><th style={{ padding: '7px 12px' }}>Initial BHP</th><th style={{ padding: '7px 12px' }}>Latest BHP</th><th style={{ padding: '7px 12px' }}>Δ depletion</th><th style={{ padding: '7px 12px' }}>Months</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => { const b = r.bhp!; const dd = b.first - b.last; return (
                <tr key={r.well} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => setSelection({ well: r.well, pattern: null })}>
                  <td className="mono" style={{ padding: '7px 12px', color: 'var(--text)' }}>{r.well}</td>
                  <td className="mono" style={{ padding: '7px 12px' }}>{b.first.toFixed(0)}</td>
                  <td className="mono" style={{ padding: '7px 12px' }}>{b.last.toFixed(0)}</td>
                  <td className="mono" style={{ padding: '7px 12px', color: dd > 0 ? 'var(--orange)' : 'var(--green)' }}>{dd > 0 ? '−' : '+'}{Math.abs(dd).toFixed(0)} psi</td>
                  <td className="mono" style={{ padding: '7px 12px', color: 'var(--muted)' }}>{b.n}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  );
}
