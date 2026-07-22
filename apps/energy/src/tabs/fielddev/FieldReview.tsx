// FieldReview.tsx — the redevelopment decision tab. Decline-curve HISTORY MATCH on
// real Volve production, a BLIND TEST (train on early history, predict the held-out
// tail → honest robustness), a remaining-reserves FORECAST, and an automated FIELD
// DEVELOPMENT PLAN that ranks redevelopment options on NPV — with a blunt verdict.
// If it's not economic, it says so. (engine/review.ts, truth-locked.)
import { useMemo, useState, useCallback } from 'react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Slider, Loading, ErrorBanner } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadProdField } from '../../wb/load';
import type { ProdJson } from '../../wb/types';
import { fitDecline, arps, blindTest, expCumToLimit, evaluateFdp, fdpVerdict, findOpportunity, type EconCtx, type FdpOption } from '../../engine/review';
import { matchAnalogs, analogPrior, reconcile, SEED_ANALOGS, type AnalogTarget } from '../../engine/analog';

const SM3_TO_BBL = 6.2898;
const mmbbl = (sm3: number) => (sm3 * SM3_TO_BBL / 1e6);

export function FieldReview() {
  const field = useAsync<ProdJson>(loadProdField, []);
  if (field.loading) return <Loading what="production history" />;
  if (field.error || !field.data) return <ErrorBanner msg={field.error || 'field production unavailable'} />;
  return <Inner field={field.data} />;
}

function Inner({ field }: { field: ProdJson }) {
  const [price, setPrice] = useState(70);
  const [reentry, setReentry] = useState(700);   // $MM to re-establish an offshore facility
  const [trainFrac, setTrainFrac] = useState(0.6);
  const [physicsRf, setPhysicsRf] = useState(0.50);  // your sim/physics RF estimate
  const [dataConf, setDataConf] = useState(0.4);     // trust in the physics (data-rich→1)
  const [derisk, setDerisk] = useState(0.9);         // engineering upside haircut
  const [inspOpen, setInspOpen] = useState(true);

  const oil = useMemo(() => field.monthly.map((m) => m.oil), [field]);          // Sm³/mo
  const series = useMemo(() => { const s = oil.findIndex((v) => v > 0); return s < 0 ? [] : oil.slice(s); }, [oil]);
  const cumHist = useMemo(() => series.reduce((a, v) => a + v, 0), [series]);

  const fit = useMemo(() => fitDecline(series), [series]);
  const bt = useMemo(() => blindTest(series, trainFrac), [series, trainFrac]);

  // remaining reserves at current wells: decline the last rate to the economic limit
  const lastRate = series.length ? series[series.length - 1] : 0;
  const qEcon = Math.max(...series, 1) * 0.02;
  const remainingSm3 = expCumToLimit(Math.max(lastRate, qEcon), fit.Di, qEcon);

  // automated FDP: screen redevelopment options
  const ctx: EconCtx = { oilPrice: price, opexVar: 14, opexFixMM: 45, perWellCapexMM: 80, facilityReentryMM: reentry, discount: 0.10, abandonMM: 150, years: 7 };
  const options: FdpOption[] = useMemo(() => [
    { name: 'Do nothing (abandon)', producers: 0, injectors: 0, incrRecoveryMMSm3: 0 },
    { name: '1 infill producer', producers: 1, injectors: 0, incrRecoveryMMSm3: 0.6 },
    { name: '2 infill + 1 injector', producers: 2, injectors: 1, incrRecoveryMMSm3: 1.5 },
    { name: 'Full waterflood expansion', producers: 3, injectors: 2, incrRecoveryMMSm3: 2.6 },
  ], []);
  const results = useMemo(() => options.map((o) => evaluateFdp(o, ctx)), [options, ctx]);
  const verdict = useMemo(() => fdpVerdict(results.filter((r) => r.capexMM > 0), mmbbl(remainingSm3)), [results, remainingSm3]);
  const opp = useMemo(() => findOpportunity(options, ctx), [options, ctx]);

  // Analog benchmark + engineering judgement: analog anchors the recovery factor,
  // physics bands it, data-confidence weights the blend, derisk haircuts the upside.
  const analog = useMemo(() => {
    const target: AnalogTarget = { lithology: 'sandstone', drive: 'waterflood', depthM: 3000, porosity: 0.21, permMd: 400, oilAPI: 29 };
    const matches = matchAnalogs(target, SEED_ANALOGS, 6);
    const prior = analogPrior(matches);
    const answer = reconcile(physicsRf, prior, dataConf, { derisk });
    return { matches, prior, answer };
  }, [physicsRf, dataConf, derisk]);

  // ── history-match + blind-test chart ──
  const draw = useCallback((cx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 44, padB = 22, padT = 12, padR = 10;
    const pw = w - padL - padR, ph = h - padB - padT;
    const nFull = series.length + 48;
    const qMax = Math.max(...series, 1);
    const x = (t: number) => padL + (t / nFull) * pw;
    const y = (q: number) => padT + ph - (q / qMax) * ph;
    cx.strokeStyle = cssVar('--line'); cx.lineWidth = 0.5; cx.beginPath(); cx.moveTo(padL, padT); cx.lineTo(padL, padT + ph); cx.lineTo(padL + pw, padT + ph); cx.stroke();
    cx.fillStyle = cssVar('--muted'); cx.font = '9px var(--mono)'; cx.textAlign = 'right';
    for (let i = 0; i <= 3; i++) { const q = qMax * i / 3; cx.fillText((q / 1e3).toFixed(0) + 'k', padL - 3, y(q) + 3); }
    // real history (teal)
    cx.strokeStyle = cssVar('--teal'); cx.lineWidth = 1.5; cx.beginPath();
    series.forEach((q, t) => { const px = x(t), py = y(q); t ? cx.lineTo(px, py) : cx.moveTo(px, py); }); cx.stroke();
    // decline history-match (amber dashed) over full + forecast
    cx.strokeStyle = cssVar('--amber'); cx.lineWidth = 1.25; cx.setLineDash([5, 3]); cx.beginPath();
    for (let t = fit.peakIdx; t < nFull; t++) { const q = arps(fit.qi, fit.Di, fit.b, t - fit.peakIdx); if (q < qEcon) break; const px = x(t), py = y(q); t === fit.peakIdx ? cx.moveTo(px, py) : cx.lineTo(px, py); } cx.stroke(); cx.setLineDash([]);
    // blind-test split line + predicted-on-holdout (rose)
    cx.strokeStyle = cssVar('--muted'); cx.setLineDash([2, 3]); cx.lineWidth = 0.75; cx.beginPath(); cx.moveTo(x(bt.trainN), padT); cx.lineTo(x(bt.trainN), padT + ph); cx.stroke(); cx.setLineDash([]);
    cx.fillStyle = cssVar('--muted'); cx.textAlign = 'center'; cx.fillText('train | blind test', x(bt.trainN), padT + 8);
    cx.strokeStyle = cssVar('--rose'); cx.lineWidth = 1.5; cx.beginPath();
    bt.predicted.forEach((q, k) => { const px = x(bt.trainN + k), py = y(q); k ? cx.lineTo(px, py) : cx.moveTo(px, py); }); cx.stroke();
    // legend
    cx.textAlign = 'left'; cx.font = '9px var(--mono)';
    cx.fillStyle = cssVar('--teal'); cx.fillText('real', padL + 4, padT + 9);
    cx.fillStyle = cssVar('--amber'); cx.fillText('decline match', padL + 34, padT + 9);
    cx.fillStyle = cssVar('--rose'); cx.fillText('blind prediction', padL + 116, padT + 9);
    cx.fillStyle = cssVar('--muted'); cx.textAlign = 'center'; cx.fillText('producing months → forecast', padL + pw / 2, h - 5);
  }, [series, fit, bt, qEcon]);
  const chart = useCanvas(draw, [draw]);

  const eurSm3 = cumHist + remainingSm3;
  const rf = verdict.redevelop ? 'var(--teal)' : 'var(--rose)';

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        {/* VERDICT banner */}
        <div style={{ margin: 10, padding: 12, border: `1px solid ${rf}`, borderRadius: 6, background: 'color-mix(in srgb, var(--panel) 90%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="chip mono" style={{ color: rf, borderColor: rf }}>{verdict.redevelop ? '◆ DEVELOP' : '■ DO NOT REDEVELOP'}</span>
            <NatureBadge nature="scenario" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{verdict.headline}</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
            {verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        {/* OPPORTUNITY — can it be saved? the tangible what-would-it-take answer */}
        {opp && (
          <div style={{ margin: '0 10px 10px', padding: 11, border: '1px solid var(--amber)', borderRadius: 6, background: 'color-mix(in srgb, var(--amber) 6%, transparent)' }}>
            <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--amber)', marginBottom: 5 }}>Opportunity · can it be saved at abandonment?</div>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginBottom: 8 }}>{opp.summary}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                ['Best plan', opp.bestPlan.name, 'var(--text)'],
                ['Recoverable', `${opp.recoverableMMbbl.toFixed(1)} MMbbl`, 'var(--amber)'],
                ['Field life', `~${opp.years} yr`, 'var(--text)'],
                ['Break-even oil', opp.breakEvenPriceUsd ? `$${opp.breakEvenPriceUsd.toFixed(0)}/bbl` : 'never', opp.economicNow ? 'var(--teal)' : 'var(--rose)'],
                ['Re-entry ceiling', opp.breakEvenReentryMM !== null ? `≤ $${opp.breakEvenReentryMM.toFixed(0)}MM` : 'n/a', 'var(--muted)'],
              ].map(([k, v, c]) => (
                <div key={k} style={{ flex: '1 1 92px', border: '1px solid var(--line)', borderRadius: 5, padding: '5px 8px', background: 'var(--panel)' }}>
                  <div className="eyebrow" style={{ fontSize: 8.5 }}>{k}</div>
                  <div className="mono" style={{ fontSize: 12.5, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 7 }}>
              Today: oil <b style={{ color: 'var(--text)' }}>${price}/bbl</b> · re-entry <b style={{ color: 'var(--text)' }}>${reentry}MM</b>. {opp.economicNow ? 'These clear the bar — the plan pays.' : 'Neither threshold is met at current assumptions → the plan does not pay. Drag the sliders to test what would change that.'}
            </div>
          </div>
        )}

        {/* ANALOG BENCHMARK + ENGINEERING JUDGEMENT — physics sanity-checks, the
            benchmark + judgement take control. The answer with an honest range. */}
        <div style={{ margin: '0 10px 10px', padding: 11, border: '1px solid var(--teal)', borderRadius: 6, background: 'color-mix(in srgb, var(--teal) 5%, transparent)' }}>
          <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--teal)', marginBottom: 6 }}>Recovery factor · analog benchmark + engineering judgement</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {[
              ['Physics (sim)', `${(physicsRf * 100).toFixed(0)}%`, 'var(--muted)'],
              ['Analog P50', `${(analog.prior.p50 * 100).toFixed(0)}%`, 'var(--amber)'],
              ['Analog range', `${(analog.prior.p10 * 100).toFixed(0)}–${(analog.prior.p90 * 100).toFixed(0)}%`, 'var(--muted)'],
              ['ANSWER P50', `${(analog.answer.p50 * 100).toFixed(0)}%`, 'var(--teal)'],
              ['Answer range', `${(analog.answer.p10 * 100).toFixed(0)}–${(analog.answer.p90 * 100).toFixed(0)}%`, 'var(--text)'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ flex: '1 1 92px', border: '1px solid var(--line)', borderRadius: 5, padding: '5px 8px', background: 'var(--panel)' }}>
                <div className="eyebrow" style={{ fontSize: 8.5 }}>{k}</div>
                <div className="mono" style={{ fontSize: 13, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
            <b style={{ color: 'var(--text)' }}>Basis:</b> {analog.answer.basis}. Physics is the sanity band; the benchmark ({analog.prior.n} analogs, effN {analog.prior.effN.toFixed(1)}) + judgement set the answer. Nearest: {analog.matches.slice(0, 3).map((m) => `${m.field.name.split(' · ')[0]} ${(m.field.recoveryFactor * 100).toFixed(0)}%`).join(' · ')}.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 9.5, color: 'var(--muted)' }}>
            <label>physics RF <input type="range" min={0.2} max={0.7} step={0.01} value={physicsRf} onChange={(e) => setPhysicsRf(+e.target.value)} style={{ width: '100%', accentColor: 'var(--teal)' }} /> {(physicsRf * 100).toFixed(0)}%</label>
            <label>data confidence <input type="range" min={0} max={1} step={0.05} value={dataConf} onChange={(e) => setDataConf(+e.target.value)} style={{ width: '100%', accentColor: 'var(--teal)' }} /> {(dataConf * 100).toFixed(0)}%</label>
            <label>derisk <input type="range" min={0.6} max={1} step={0.05} value={derisk} onChange={(e) => setDerisk(+e.target.value)} style={{ width: '100%', accentColor: 'var(--teal)' }} /> {(derisk * 100).toFixed(0)}%</label>
          </div>
        </div>

        {/* history match + blind test */}
        <div style={{ padding: '0 10px' }} className="eyebrow">History match · blind test (train {(trainFrac * 100).toFixed(0)}% → predict tail)</div>
        <div ref={chart.wrapRef} style={{ flex: '0 0 200px', minHeight: 160, position: 'relative', margin: '4px 10px 8px' }}>
          <canvas ref={chart.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* stat strip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 10px 10px' }}>
          {[
            ['Cum produced', `${mmbbl(cumHist).toFixed(1)} MMbbl`, 'var(--teal)'],
            ['Blind-test MAPE', `${bt.mapePct.toFixed(1)}%`, bt.mapePct < 15 ? 'var(--teal)' : 'var(--amber)'],
            ['Remaining @ wells', `${mmbbl(remainingSm3).toFixed(1)} MMbbl`, 'var(--amber)'],
            ['EUR (existing)', `${mmbbl(eurSm3).toFixed(1)} MMbbl`, 'var(--text)'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ flex: '1 1 120px', border: '1px solid var(--line)', borderRadius: 5, padding: '7px 9px', background: 'var(--panel)' }}>
              <div className="eyebrow" style={{ fontSize: 9 }}>{k}</div>
              <div className="mono" style={{ fontSize: 15, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* FDP option table */}
        <div style={{ padding: '0 10px 4px' }} className="eyebrow">Automated FDP · redevelopment options (screening NPV)</div>
        <div style={{ padding: '0 10px 14px', overflowX: 'auto' }}>
          <table className="mono" style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', minWidth: 480 }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right', borderBottom: '1px solid var(--line)' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>Option</th><th>Wells</th><th>Incr. oil</th><th>Capex</th><th>NPV</th><th>Payback</th><th style={{ textAlign: 'left', paddingLeft: 10 }}>Screen</th>
            </tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.name} style={{ textAlign: 'right', borderBottom: '1px solid var(--line)', background: i === 0 ? 'transparent' : (r.economic ? 'color-mix(in srgb, var(--teal) 8%, transparent)' : 'transparent') }}>
                  <td style={{ textAlign: 'left', padding: '5px 6px', color: 'var(--text)' }}>{r.name}</td>
                  <td>{options[i].producers + options[i].injectors || '—'}</td>
                  <td style={{ color: 'var(--amber)' }}>{r.incrOilMMbbl > 0 ? `${r.incrOilMMbbl.toFixed(1)} MMbbl` : '—'}</td>
                  <td>{r.capexMM > 0 ? `$${r.capexMM.toFixed(0)}MM` : '—'}</td>
                  <td style={{ color: r.npvMM >= 0 ? 'var(--teal)' : 'var(--rose)', fontWeight: 600 }}>{r.capexMM > 0 ? `${r.npvMM >= 0 ? '+' : ''}$${r.npvMM.toFixed(0)}MM` : '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{r.paybackYr ? `${r.paybackYr} yr` : '—'}</td>
                  <td style={{ textAlign: 'left', paddingLeft: 10, color: r.capexMM === 0 ? 'var(--muted)' : (r.economic ? 'var(--teal)' : 'var(--rose)') }}>{r.capexMM === 0 ? 'baseline' : (r.economic ? '✓ in' : '✗ out')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 6 }}>Screening economics — NOT investment advice. Incremental recovery from analog/sweep; capex includes offshore facility re-entry. bbl ×{SM3_TO_BBL}.</div>
        </div>
      </div>

      <Inspector title="Field review inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Decline (history match)">
          <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {[['qi', `${(fit.qi / 1e3).toFixed(1)}k Sm³/mo`], ['Di', `${(fit.Di * 100).toFixed(2)}%/mo`], ['b (Arps)', fit.b.toFixed(1)], ['months', `${series.length}`], ['qEcon', `${(qEcon / 1e3).toFixed(1)}k Sm³/mo`]].map(([k, v]) => <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{v}</td></tr>)}
          </tbody></table>
        </InspectorSection>
        <InspectorSection title="Blind test">
          <Slider label="Training fraction" min={0.4} max={0.8} step={0.05} value={trainFrac} onChange={setTrainFrac} fmt={(v) => `${(v * 100).toFixed(0)}%`} />
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>Fit on the first {(trainFrac * 100).toFixed(0)}%, predict the rest. MAPE <b style={{ color: bt.mapePct < 15 ? 'var(--teal)' : 'var(--amber)' }}>{bt.mapePct.toFixed(1)}%</b> · RMSE {bt.rmsePct.toFixed(1)}%.</div>
        </InspectorSection>
        <InspectorSection title="Economics (stress)">
          <Slider label="Oil price" min={40} max={200} step={5} value={price} onChange={setPrice} fmt={(v) => `$${v}/bbl`} />
          <Slider label="Facility re-entry" min={0} max={1200} step={50} value={reentry} onChange={setReentry} fmt={(v) => `$${v}MM`} />
          <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>opex $14/bbl + $45MM/yr · capex $80MM/well · discount 10% · abandon $150MM.</div>
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Volve was decommissioned in 2016. This screen is honest about whether re-entry pays — set re-entry to $0 to see the pure infill case.</div>
      </Inspector>
    </div>
  );
}
