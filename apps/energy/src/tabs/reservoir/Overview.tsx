// Overview.tsx — the Reservoir-Management cockpit (COSMO Overview tab): field health,
// exceptions, actions & gains, forecast confidence. KPI tiles + field oil-rate and
// cumulative-VRR trends (RMChart) + an exception-first ranked well table (water-cut and
// trailing WOR trend from the surveillance engine). Real Volve field aggregate.
import { useMemo } from 'react';
import { useRM } from './ReservoirMgmt';
import { setSelection } from './selection';
import { RMChart } from './chart/RMChart';
import { Panel, Stat, TabHeader, Page } from './surface';
import { lastLiveIdx } from './data';
import { annualPct, wellHealth } from '../../engine/surveillance';

export function Overview() {
  const rm = useRM();
  const f = rm.field;
  const fi = lastLiveIdx(f);
  const lastOil = f.oilRate[fi] ?? 0;
  const lastWct = f.wct[fi] ?? 0;

  const ranked = useMemo(() => rm.producers.map((w) => {
    const li = lastLiveIdx(w);
    const wct = w.wct[li] ?? 0;
    const up = w.uptime.filter((v): v is number => v != null);
    const uptime = up.length ? up[up.length - 1] : 1;
    const worTrend = annualPct(w.wor, 12, 12);
    const health = wellHealth({ wct: wct / 100, uptime, declineRate: Math.max(0, -annualPct(w.oilRate) / 100) });
    return { well: w.well, wct, uptime, worTrend, health };
  }).sort((a, b) => a.health - b.health), [rm]);

  const oilTrend = useMemo(() => f.ym.map((_, i) => [i, f.oilRate[i]] as [number, number]), [f]);
  const vrrTrend = useMemo(() => f.ym.map((_, i) => [i, f.vrr.cum[i]] as [number, number]), [f]);

  return (
    <Page>
      <TabHeader title="Reservoir Management Workspace" nature="reported"
        subtitle="Monitor · diagnose · forecast · act · track · learn — Volve field, real production & injection" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 14 }}>
        <Stat label="Cum Oil" value={f.cumOilMM.toFixed(1)} sub="MMbbl · reported" accent="var(--green)" />
        <Stat label="Field Oil Rate" value={Math.round(lastOil).toLocaleString()} sub="bopd · latest month" />
        <Stat label="Water Cut" value={lastWct.toFixed(0) + '%'} sub="field latest" accent={lastWct > 80 ? 'var(--orange)' : 'var(--text)'} />
        <Stat label="VRR (cum)" value={f.vrr.final.toFixed(2)} sub="voidage replacement" accent={Math.abs(f.vrr.final - 1) < 0.15 ? 'var(--green)' : 'var(--orange)'} />
        <Stat label="Producers" value={rm.producers.length} sub={`${rm.injectors.length} injectors`} />
        <Stat label="Cum Winj" value={f.cumWinjMM.toFixed(1)} sub="MMbbl water injected" accent="var(--cblue)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel title="Field Oil Rate" minHeight={220}>
          <RMChart series={[{ name: 'field oil', color: 'var(--green)', pts: oilTrend, area: true }]} xLabel="Month index" yLabel="Oil rate · bopd" />
        </Panel>
        <Panel title="Cumulative VRR (target 1.0)" minHeight={220}>
          <RMChart series={[{ name: 'VRR', color: 'var(--cblue)', pts: vrrTrend, area: true }]} xLabel="Month index" yLabel="VRR" target={{ y: 1, label: 'VRR = 1' }} />
        </Panel>
      </div>

      <Panel title="Exception-first well health (worst first)" minHeight={0}>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '7px 12px' }}>Well</th><th style={{ padding: '7px 12px' }}>Health</th>
                <th style={{ padding: '7px 12px' }}>Water cut</th><th style={{ padding: '7px 12px' }}>Uptime</th>
                <th style={{ padding: '7px 12px' }}>WOR trend</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.well} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => setSelection({ well: r.well, pattern: null })}>
                  <td className="mono" style={{ padding: '7px 12px', color: 'var(--text)' }}>{r.well}</td>
                  <td style={{ padding: '7px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--panel-2)', overflow: 'hidden', display: 'inline-block' }}>
                        <span style={{ display: 'block', height: '100%', width: r.health + '%', background: r.health > 66 ? 'var(--green)' : r.health > 40 ? 'var(--orange)' : 'var(--red)' }} />
                      </span>
                      <span className="mono" style={{ color: 'var(--muted)' }}>{r.health.toFixed(0)}</span>
                    </span>
                  </td>
                  <td className="mono" style={{ padding: '7px 12px', color: r.wct > 80 ? 'var(--orange)' : 'var(--text)' }}>{r.wct.toFixed(0)}%</td>
                  <td className="mono" style={{ padding: '7px 12px', color: 'var(--muted)' }}>{(r.uptime * 100).toFixed(0)}%</td>
                  <td className="mono" style={{ padding: '7px 12px', color: r.worTrend > 30 ? 'var(--orange)' : 'var(--muted)' }}>{r.worTrend > 0 ? '+' : ''}{r.worTrend.toFixed(0)}%/yr</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  );
}
