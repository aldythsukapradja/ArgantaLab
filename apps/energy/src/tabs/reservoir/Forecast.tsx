// Forecast.tsx — the Forecast & Potential tab (COSMO). Decline-curve analysis on real
// Volve production reusing engine/review.ts (hyperbolic fitDecline + a BLIND TEST that
// trains on early history and predicts the held-out tail — the honest robustness check).
// Keeps Field Development's honesty posture: Volve's injection-supported/faulted field is
// a WEAK DCA candidate and the blind-test MAPE says so out loud.
import { useMemo, useState } from 'react';
import { useRM } from './ReservoirMgmt';
import { RMChart, type RMSeries } from './chart/RMChart';
import { Panel, Stat, TabHeader, Page } from './surface';
import { fitDecline, arps, blindTest } from '../../engine/review';
import { SM3_TO_BBL } from './data';

export function Forecast() {
  const rm = useRM();
  const [scope, setScope] = useState<string>('field');
  const [trainFrac, setTrainFrac] = useState(0.6);

  const series = useMemo(() => {
    const src = scope === 'field' ? rm.field : (rm.byWell[scope] ?? rm.field);
    const oil = src.raw.map((m) => m.oil);
    const s = oil.findIndex((v) => v > 0);
    return s < 0 ? [] : oil.slice(s);
  }, [scope, rm]);

  const fit = useMemo(() => fitDecline(series), [series]);
  const bt = useMemo(() => (series.length > 8 ? blindTest(series, trainFrac) : null), [series, trainFrac]);

  const { chart, remainMM, cumMM } = useMemo(() => {
    const qEcon = Math.max(...series, 1) * 0.02;
    const hist: Array<[number, number]> = series.map((v, i) => [i, v * SM3_TO_BBL] as [number, number]);
    const fitted: Array<[number, number]> = []; const fcst: Array<[number, number]> = [];
    let remain = 0;
    for (let i = fit.peakIdx; i < series.length + 400; i++) {
      const q = arps(fit.qi, fit.Di, fit.b, i - fit.peakIdx);
      if (i < series.length) fitted.push([i, q * SM3_TO_BBL]);
      else { if (q < qEcon) break; fcst.push([i, q * SM3_TO_BBL]); remain += q; }
    }
    const c: RMSeries[] = [
      { name: 'history', color: 'var(--green)', pts: hist, width: 1.9, area: true },
      { name: 'decline fit', color: 'var(--orange)', pts: fitted, width: 1.4, dashed: true },
      { name: 'forecast', color: 'var(--violet)', pts: fcst, width: 1.6 },
    ];
    return { chart: c, remainMM: remain * SM3_TO_BBL / 1e6, cumMM: series.reduce((a, v) => a + v, 0) * SM3_TO_BBL / 1e6 };
  }, [series, fit]);

  return (
    <Page>
      <TabHeader title="Forecast & Potential" nature="derived"
        subtitle="Hyperbolic decline + blind test (train early → predict the tail). Volve is injection-supported/faulted — DCA is honestly weak here."
        right={
          <select value={scope} onChange={(e) => setScope(e.target.value)}
            style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)' }}>
            <option value="field">Whole field</option>
            {rm.producers.map((w) => <option key={w.well} value={w.well}>{w.well}</option>)}
          </select>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
        <Stat label="Cum History" value={cumMM.toFixed(1)} sub="MMbbl produced" accent="var(--green)" />
        <Stat label="Decline Di" value={(fit.Di * 100).toFixed(2) + '%'} sub={`/mo · Arps b=${fit.b.toFixed(2)}`} />
        <Stat label="Remaining (DCA)" value={remainMM.toFixed(1)} sub="MMbbl to econ limit" accent="var(--violet)" />
        <Stat label="Blind-test MAPE" value={bt ? bt.mapePct.toFixed(0) + '%' : '—'} sub="lower = more trustworthy" accent={bt && bt.mapePct > 40 ? 'var(--orange)' : 'var(--text)'} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title={`Decline & forecast · ${scope === 'field' ? 'whole field' : scope}`} minHeight={320}>
          <RMChart series={chart} xLabel="Month index" yLabel="Oil rate · bbl/mo" />
        </Panel>
      </div>

      <div style={{ marginTop: 12, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Blind-test train fraction
          <input type="range" min={0.4} max={0.8} step={0.05} value={trainFrac} onChange={(e) => setTrainFrac(parseFloat(e.target.value))} style={{ accentColor: 'var(--violet)' }} />
          <span className="mono" style={{ color: 'var(--text)' }}>{(trainFrac * 100).toFixed(0)}%</span>
        </label>
        {bt && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Trained on first {bt.trainN} months, predicted the rest: <span className="mono" style={{ color: bt.mapePct > 40 ? 'var(--orange)' : 'var(--text)' }}>MAPE {bt.mapePct.toFixed(0)}%</span> — {bt.mapePct > 40 ? 'a weak predictor, as expected for this field.' : 'reasonable.'}</span>}
      </div>
    </Page>
  );
}
