// Patterns.tsx — the Well & Pattern Review tab (COSMO). The water-diagnosis centrepiece
// the founder asked to add — neither reference app had these, they are authored from the
// petroleum-engineering literature and truth-locked in test-surveillance.mjs:
//   • Chan's diagnostic (WOR + WOR′ vs t, log-log) with a coning/channeling/multilayer
//     classification, per producer;
//   • Tong's water-drive chart (童氏图版): field water cut fw vs recovery degree R, with
//     the Type-A characteristic line extrapolated to a movable-oil EUR;
//   • pattern allocation (nearest-producer distance-weighted default from patterns.json).
import { useMemo } from 'react';
import { useRM } from './ReservoirMgmt';
import { useSelection, setSelection } from './selection';
import { RMChart, type RMSeries } from './chart/RMChart';
import { Panel, Stat, TabHeader, Page } from './surface';
import { chanWor, tongWaterDrive, waterCut, type WaterMechanism } from '../../engine/surveillance';
import { SM3_TO_BBL } from './data';

const MECH_COL: Record<WaterMechanism, string> = { coning: 'var(--teal)', channeling: 'var(--orange)', multilayer: 'var(--red)', undetermined: 'var(--muted)' };
const MECH_NOTE: Record<WaterMechanism, string> = {
  coning: 'Bottom-water coning — WOR plateaus, WOR′ flattens. Consider rate control / downdip perforation.',
  channeling: 'Channeling / high-perm streak — WOR & WOR′ rise together (unit slope). Consider conformance / shut-off.',
  multilayer: 'Multilayer channeling — steep WOR′. Consider selective isolation.',
  undetermined: 'Insufficient watered-up history to classify.',
};
const OOIP_SM3 = 22e6; // published Volve dynamic-model STOIIP (MMSm³) — reference-class OOIP for R%

export function Patterns() {
  const rm = useRM();
  const sel = useSelection();
  const active = rm.producers.find((w) => w.well === sel.well) ?? rm.producers[0];

  const chan = useMemo(() => active ? chanWor(active.t, active.oilRate, active.waterRate) : null, [active]);
  const chanSeries: RMSeries[] = useMemo(() => {
    if (!chan) return [];
    const wor: Array<[number, number]> = chan.t.map((t, i) => [t, chan.y[i]] as [number, number]);
    const deriv: Array<[number, number]> = []; for (let i = 0; i < chan.t.length; i++) if (chan.deriv[i] > 0) deriv.push([chan.t[i], chan.deriv[i]]);
    return [
      { name: 'WOR', color: 'var(--green)', pts: wor, width: 1.9 },
      { name: "WOR′", color: 'var(--orange)', pts: deriv, width: 1.6, dashed: true },
    ];
  }, [chan]);

  const tong = useMemo(() => {
    const f = rm.field.raw; let np = 0, wp = 0; const npCum: number[] = [], wpCum: number[] = [], fw: number[] = [];
    for (const m of f) { np += m.oil; wp += m.water; npCum.push(np); wpCum.push(wp); fw.push(waterCut(m.oil, m.water)); }
    return { r: tongWaterDrive(npCum, wpCum, fw, OOIP_SM3, 0.95, 0.5), fwR: npCum.map((n, i) => [n / OOIP_SM3 * 100, fw[i] * 100] as [number, number]) };
  }, [rm]);

  const alloc = useMemo(() => rm.patterns.patterns.map((p) => {
    const inv = p.producers.map((pr) => ({ well: pr.well, w: 1 / Math.max(1, pr.distM) }));
    const tot = inv.reduce((s, x) => s + x.w, 0) || 1;
    return { injector: p.injector, shares: inv.map((x) => ({ well: x.well, pct: (x.w / tot) * 100 })) };
  }), [rm]);

  return (
    <Page>
      <TabHeader title="Well & Pattern Review" nature="derived"
        subtitle={`Water diagnosis (Chan's + Tong's) + injector→producer allocation${active ? ` · Chan on ${active.well}` : ''}`}
        right={active &&
          <select value={active.well} onChange={(e) => setSelection({ well: e.target.value, pattern: null })}
            style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)' }}>
            {rm.producers.map((w) => <option key={w.well} value={w.well}>{w.well}</option>)}
          </select>} />

      {chan && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', padding: '4px 11px', borderRadius: 20, border: `1px solid ${MECH_COL[chan.mechanism]}`, color: MECH_COL[chan.mechanism], textTransform: 'uppercase', letterSpacing: '0.05em' }}>{chan.mechanism}</span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{MECH_NOTE[chan.mechanism]} <span className="mono">(late-slope {chan.slope})</span></span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel title={`Chan's diagnostic — ${active?.well ?? ''} (WOR & WOR′, log-log)`} minHeight={280}>
          <RMChart series={chanSeries} xLabel="Time · days (log)" yLabel="WOR / WOR′ (log)" xLog yLog />
        </Panel>
        <Panel title="Tong's water-drive chart — field (fw vs recovery)" minHeight={280}
          right={<span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>EUR ≈ {(tong.r.eurNp * SM3_TO_BBL / 1e6).toFixed(1)} MMbbl</span>}>
          <RMChart series={[{ name: 'fw', color: 'var(--blue)', pts: tong.fwR, width: 1.9 }]} xLabel="Recovery degree R · %" yLabel="Water cut · %" target={{ y: 95, label: 'econ fw' }} />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
        <Stat label="Tong EUR" value={(tong.r.eurNp * SM3_TO_BBL / 1e6).toFixed(1)} sub="MMbbl @ 95% fw" accent="var(--blue)" />
        <Stat label="Recovery @ EUR" value={(tong.r.eurR * 100).toFixed(0) + '%'} sub={`of ${(OOIP_SM3 * SM3_TO_BBL / 1e6).toFixed(0)} MMbbl OOIP`} />
        <Stat label="Chan mechanism" value={<span style={{ fontSize: 15, color: MECH_COL[chan?.mechanism ?? 'undetermined'] }}>{chan?.mechanism ?? '—'}</span>} sub={active?.well} />
      </div>

      <Panel title="Pattern allocation (nearest-producer distance-weighted default)" minHeight={0}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alloc.map((a) => (
            <div key={a.injector}>
              <div style={{ fontSize: 12, marginBottom: 5 }}><span className="mono" style={{ color: 'var(--cblue)' }}>{a.injector}</span> <span style={{ color: 'var(--muted)', fontSize: 11 }}>→ producers</span></div>
              <div style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line)' }}>
                {a.shares.map((s, i) => (
                  <div key={s.well} title={`${s.well} ${s.pct.toFixed(0)}%`} onClick={() => setSelection({ well: s.well, pattern: a.injector })}
                    style={{ width: s.pct + '%', background: `color-mix(in srgb, var(--green) ${70 - i * 12}%, var(--panel-2))`, display: 'grid', placeItems: 'center', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text)', cursor: 'pointer', borderRight: '1px solid var(--line)' }}>
                    {s.pct > 12 ? `${s.well} ${s.pct.toFixed(0)}%` : ''}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Default = 1/distance weighting. Physics-based injector→producer allocation via the streamline engine (engine/sim/streamline.ts) is available for a future wiring.</div>
        </div>
      </Panel>
    </Page>
  );
}
