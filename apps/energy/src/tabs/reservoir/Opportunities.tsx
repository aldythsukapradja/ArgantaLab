// Opportunities.tsx — the Opportunity Screening tab (COSMO). Reuses engine/review.ts
// (evaluateFdp / findOpportunity / break-even). Screens rig & rigless redevelopment
// options on NPV against a live economic context (oil price, facility re-entry). Honest
// by construction: at base Volve economics every option screens OUT — the tool shows the
// break-even lever, not a fabricated upside. The final ranking stays an engineer's call.
import { useMemo, useState } from 'react';
import { useRM } from './ReservoirMgmt';
import { Panel, Stat, TabHeader, Page } from './surface';
import { evaluateFdp, findOpportunity, type EconCtx, type FdpOption } from '../../engine/review';

const OPTIONS: FdpOption[] = [
  { name: '1 infill producer', producers: 1, injectors: 0, incrRecoveryMMSm3: 0.6 },
  { name: '2 infill + 1 injector', producers: 2, injectors: 1, incrRecoveryMMSm3: 1.5 },
  { name: 'Full waterflood (3P + 2I)', producers: 3, injectors: 2, incrRecoveryMMSm3: 2.6 },
];

export function Opportunities() {
  const rm = useRM();
  const [oilPrice, setOilPrice] = useState(70);
  const [reentry, setReentry] = useState(700);

  const ctx: EconCtx = useMemo(() => ({ oilPrice, opexVar: 14, opexFixMM: 45, perWellCapexMM: 80, facilityReentryMM: reentry, discount: 0.10, abandonMM: 150, years: 7 }), [oilPrice, reentry]);
  const ranked = useMemo(() => OPTIONS.map((o) => ({ o, r: evaluateFdp(o, ctx) })).sort((a, b) => b.r.npvMM - a.r.npvMM), [ctx]);
  const opp = useMemo(() => findOpportunity(OPTIONS, ctx), [ctx]);

  return (
    <Page>
      <TabHeader title="Opportunity Screening" nature="scenario"
        subtitle={`${rm.producers.length}-producer field · screen → mature → rank on NPV · engineer decides the final call`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
        <Stat label="Best plan NPV" value={(opp ? (opp.bestPlan.npvMM >= 0 ? '+' : '−') + '$' + Math.abs(opp.bestPlan.npvMM).toFixed(0) + 'MM' : '—')} sub={opp?.bestPlan.name} accent={opp && opp.economicNow ? 'var(--green)' : 'var(--orange)'} />
        <Stat label="Break-even oil" value={opp?.breakEvenPriceUsd ? '$' + opp.breakEvenPriceUsd.toFixed(0) : '—'} sub="$/bbl to turn economic" />
        <Stat label="Recoverable" value={opp ? opp.recoverableMMbbl.toFixed(1) : '—'} sub={`MMbbl · ~${opp?.years ?? '—'} yr`} />
        <Stat label="Verdict" value={<span style={{ fontSize: 15, color: opp?.economicNow ? 'var(--green)' : 'var(--rose)' }}>{opp?.economicNow ? 'DEVELOP' : 'SUB-ECONOMIC'}</span>} sub="at current economics" />
      </div>

      <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 5, minWidth: 200 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>Oil price <span className="mono" style={{ color: 'var(--text)' }}>${oilPrice}/bbl</span></span>
          <input type="range" min={30} max={200} step={5} value={oilPrice} onChange={(e) => setOilPrice(+e.target.value)} style={{ accentColor: 'var(--green)' }} />
        </label>
        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 5, minWidth: 200 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>Facility re-entry <span className="mono" style={{ color: 'var(--text)' }}>${reentry}MM</span></span>
          <input type="range" min={0} max={900} step={25} value={reentry} onChange={(e) => setReentry(+e.target.value)} style={{ accentColor: 'var(--orange)' }} />
        </label>
      </div>

      {opp && <div style={{ marginTop: 12, padding: '11px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)', fontSize: 12, color: 'var(--text)' }}>{opp.summary}</div>}

      <Panel title="Screened options (ranked by NPV)" minHeight={0}>
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase' }}>
              <th style={{ padding: '7px 12px' }}>Option</th><th style={{ padding: '7px 12px' }}>Wells</th><th style={{ padding: '7px 12px' }}>Incr oil</th><th style={{ padding: '7px 12px' }}>Capex</th><th style={{ padding: '7px 12px' }}>NPV</th><th style={{ padding: '7px 12px' }}>Screen</th>
            </tr></thead>
            <tbody>
              {ranked.map(({ o, r }) => (
                <tr key={o.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '7px 12px', color: 'var(--text)' }}>{o.name}</td>
                  <td className="mono" style={{ padding: '7px 12px', color: 'var(--muted)' }}>{o.producers}P/{o.injectors}I</td>
                  <td className="mono" style={{ padding: '7px 12px' }}>{r.incrOilMMbbl.toFixed(1)} MMbbl</td>
                  <td className="mono" style={{ padding: '7px 12px' }}>${r.capexMM.toFixed(0)}MM</td>
                  <td className="mono" style={{ padding: '7px 12px', color: r.npvMM >= 0 ? 'var(--green)' : 'var(--rose)' }}>{r.npvMM >= 0 ? '+' : '−'}${Math.abs(r.npvMM).toFixed(0)}MM</td>
                  <td style={{ padding: '7px 12px' }}><span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: r.economic ? 'var(--green)' : 'var(--rose)' }}>{r.economic ? 'IN' : 'OUT'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--muted)' }}>Incremental-recovery volumes are screening scenarios (dataNature: scenario). Anchor them to the streamline remaining-oil map + analog engine before maturing an opportunity.</div>
    </Page>
  );
}
