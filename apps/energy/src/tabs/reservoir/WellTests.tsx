// WellTests.tsx — the Well Test Monitoring tab (COSMO). Uses the GeaVision well-test
// template (WelltestPanel: dual-Y rate + water-cut). Volve has no discrete well-test
// build-up dataset, so this runs on monthly-ALLOCATED rates as a proxy (badged
// interpreted). Well navigation → KPI snapshot → chart → risk-based priority (trailing
// WOR/oil trend from the surveillance engine).
import { useMemo } from 'react';
import { useRM } from './ReservoirMgmt';
import { useSelection, setSelection } from './selection';
import { WelltestPanel } from './chart/WelltestPanel';
import { Panel, Stat, TabHeader, Page } from './surface';
import { lastLiveIdx } from './data';
import { annualPct } from '../../engine/surveillance';

export function WellTests() {
  const rm = useRM();
  const sel = useSelection();
  const active = rm.producers.find((w) => w.well === sel.well) ?? rm.producers[0];

  const priority = useMemo(() => rm.producers.map((w) => {
    const wct = w.wct.length ? w.wct[w.wct.length - 1] : 0;
    const worTrend = annualPct(w.wor);
    const oilTrend = annualPct(w.oilRate);
    const risk = Math.max(0, worTrend) * 0.6 + Math.max(0, -oilTrend) * 0.4 + (wct > 85 ? 20 : 0);
    return { well: w.well, wct, worTrend, oilTrend, risk };
  }).sort((a, b) => b.risk - a.risk), [rm]);

  if (!active) return <Page><TabHeader title="Well Test Monitoring" subtitle="No producing wells." /></Page>;
  const li = lastLiveIdx(active);
  const lastOil = active.oilRate[li] ?? 0;
  const lastWct = active.wct[li] ?? 0;
  const lastLiq = active.liqRate[li] ?? 0;

  return (
    <Page>
      <TabHeader title="Well Test Monitoring" nature="interpreted"
        subtitle={`${active.well} · monthly-allocated proxy (Volve has no discrete build-up tests) · latest vs history`}
        right={
          <select value={active.well} onChange={(e) => setSelection({ well: e.target.value, pattern: null })}
            style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)' }}>
            {rm.producers.map((w) => <option key={w.well} value={w.well}>{w.well}</option>)}
          </select>
        } />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
        <Stat label="Oil Rate" value={Math.round(lastOil).toLocaleString()} sub="bopd · latest" accent="var(--green)" />
        <Stat label="Liquid Rate" value={Math.round(lastLiq).toLocaleString()} sub="bld · latest" />
        <Stat label="Water Cut" value={lastWct.toFixed(0) + '%'} sub="latest" accent={lastWct > 80 ? 'var(--orange)' : 'var(--text)'} />
        <Stat label="WOR trend" value={(annualPct(active.wor) > 0 ? '+' : '') + annualPct(active.wor).toFixed(0) + '%/yr'} sub="trailing 12m" />
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title={`Well test — ${active.well} (rate + water cut)`} minHeight={300}>
          <WelltestPanel w={active} />
        </Panel>
      </div>

      <Panel title="Risk-based test priority (worst first)" minHeight={0}>
        <div style={{ maxHeight: 240, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase' }}>
              <th style={{ padding: '7px 12px' }}>Well</th><th style={{ padding: '7px 12px' }}>Risk</th><th style={{ padding: '7px 12px' }}>Water cut</th><th style={{ padding: '7px 12px' }}>WOR trend</th><th style={{ padding: '7px 12px' }}>Oil trend</th>
            </tr></thead>
            <tbody>
              {priority.map((p) => (
                <tr key={p.well} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer', background: p.well === active.well ? 'var(--sel)' : undefined }} onClick={() => setSelection({ well: p.well, pattern: null })}>
                  <td className="mono" style={{ padding: '7px 12px', color: 'var(--text)' }}>{p.well}</td>
                  <td className="mono" style={{ padding: '7px 12px', color: p.risk > 40 ? 'var(--red)' : p.risk > 20 ? 'var(--orange)' : 'var(--muted)' }}>{p.risk.toFixed(0)}</td>
                  <td className="mono" style={{ padding: '7px 12px' }}>{p.wct.toFixed(0)}%</td>
                  <td className="mono" style={{ padding: '7px 12px', color: p.worTrend > 30 ? 'var(--orange)' : 'var(--muted)' }}>{p.worTrend > 0 ? '+' : ''}{p.worTrend.toFixed(0)}%</td>
                  <td className="mono" style={{ padding: '7px 12px', color: p.oilTrend < -20 ? 'var(--orange)' : 'var(--muted)' }}>{p.oilTrend > 0 ? '+' : ''}{p.oilTrend.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  );
}
