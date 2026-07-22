// Risk & Uncertainty — separate chance of success (POS) from the range of outcomes.
// EMV two-outcome decision tree with a live drill / no-drill verdict, editable
// NPV(success) & dry-hole cost, and a scenario comparison across the prospect
// inventory. Founder spec: "review evidence · set distributions · run uncertainty ·
// identify top drivers" (COSMO TAB_SPECS.exploration).
import { useMemo, useState } from 'react';
import { useAsync } from '../fielddev/hooks';
import { Inspector, InspectorSection, Slider, Loading, ErrorBanner } from '../fielddev/chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex } from '../../wb/load';
import type { WbIndex } from '../../wb/types';
import { gcos, riskedResource, emv, GCOS_ELEMENTS } from '../../engine/explore';
import type { ExplSel } from '../../cosmo/ExplorationExplorer';
import { PROSPECTS, toMMbbl } from './explData';

export function ExplRisk({ sel, setSel }: { sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const pid = sel?.folder === 'prospects' ? sel.id : 'volve';
  const prospect = PROSPECTS.find((p) => p.id === pid) ?? PROSPECTS[0];
  const [npvSuccess, setNpv] = useState(prospect.econ.npvSuccess);
  const [dry, setDry] = useState(prospect.econ.dryHoleCost);
  const [inspOpen, setInspOpen] = useState(true);

  const pos = useMemo(() => gcos(GCOS_ELEMENTS.map((e) => ({ p: prospect.gcos[e.key] }))), [prospect]);
  const risked = useMemo(() => riskedResource(prospect.mc, pos, 8000, 4242), [prospect, pos]);
  const value = emv({ pos, npvSuccess, dryHoleCost: dry });
  const drill = value > 0;

  const compare = useMemo(() => PROSPECTS.map((p) => {
    const pp = gcos(GCOS_ELEMENTS.map((e) => ({ p: p.gcos[e.key] })));
    const r = riskedResource(p.mc, pp, 4000, 4242);
    const v = emv({ pos: pp, npvSuccess: p.econ.npvSuccess, dryHoleCost: p.econ.dryHoleCost });
    return { id: p.id, name: p.name, pos: pp, p90: r.recoverable.p90, p50: r.recoverable.p50, p10: r.recoverable.p10, emv: v };
  }), []);

  if (idx.loading) return <Loading what="risk analysis" />;
  if (idx.error) return <ErrorBanner msg={idx.error} />;

  const fanMax = Math.max(risked.recoverable.p10, 1);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{prospect.name} — decision</h2>
          <span className="chip mono" style={{ color: drill ? 'var(--green)' : 'var(--rose)', borderColor: drill ? 'var(--green)' : 'var(--rose)' }}>{drill ? 'DRILL' : 'NO DRILL'}</span>
        </div>

        {/* EMV decision tree */}
        <div className="panel" style={{ padding: 16, marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Expected monetary value (two-outcome tree)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 12 }}>
            <div style={{ textAlign: 'center' }}><div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--text)', margin: '0 auto 6px' }} /><div className="mono" style={{ color: 'var(--muted)' }}>drill</div></div>
            <div style={{ flex: 1, position: 'relative', height: 90, margin: '0 12px' }}>
              <Branch top={16} label={`success · POS ${(pos * 100).toFixed(0)}%`} val={`+$${(npvSuccess / 1e6).toFixed(0)}M`} col="--green" />
              <Branch top={64} label={`dry · ${((1 - pos) * 100).toFixed(0)}%`} val={`−$${(dry / 1e6).toFixed(0)}M`} col="--rose" />
            </div>
            <div style={{ textAlign: 'right', minWidth: 130 }}>
              <div className="eyebrow">EMV</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: drill ? 'var(--green)' : 'var(--rose)' }}>{value >= 0 ? '+' : '−'}${Math.abs(value / 1e6).toFixed(0)}M</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{(pos).toFixed(2)}·{(npvSuccess / 1e6).toFixed(0)} − {(1 - pos).toFixed(2)}·{(dry / 1e6).toFixed(0)}</div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}><NatureBadge nature="scenario" /></div>
        </div>

        {/* chance vs range */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div className="panel" style={{ padding: 16, flex: 1, minWidth: 220 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Chance of success</div>
            <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, display: 'block', margin: '0 auto' }}>
              <circle cx="60" cy="60" r="48" fill="none" stroke="var(--panel-2)" strokeWidth="14" />
              <circle cx="60" cy="60" r="48" fill="none" stroke="var(--cyan)" strokeWidth="14" strokeDasharray={`${pos * 301.6} 301.6`} strokeLinecap="round" transform="rotate(-90 60 60)" />
              <text x="60" y="66" fill="var(--text)" fontSize="24" fontWeight="700" textAnchor="middle">{(pos * 100).toFixed(0)}%</text>
            </svg>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>Π of {GCOS_ELEMENTS.length} independent play elements</div>
          </div>
          <div className="panel" style={{ padding: 16, flex: 1.4, minWidth: 260 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Range of outcomes · recoverable (given success)</div>
            {([['P90', risked.recoverable.p90, '--amber'], ['P50', risked.recoverable.p50, '--cyan'], ['P10', risked.recoverable.p10, '--green']] as const).map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="mono" style={{ width: 30, fontSize: 11, color: 'var(--muted)' }}>{k}</span>
                <div style={{ flex: 1, height: 10, background: 'var(--panel-2)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${(v / fanMax) * 100}%`, height: '100%', background: `var(${c})` }} /></div>
                <span className="mono" style={{ width: 96, textAlign: 'right', fontSize: 11, color: 'var(--text)' }}>{toMMbbl(v).toFixed(0)} MMbbl</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>P10/P90 ratio {(risked.recoverable.p10 / Math.max(1e-9, risked.recoverable.p90)).toFixed(1)}× — uncertainty span.</div>
          </div>
        </div>

        {/* scenario comparison */}
        <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Scenario comparison</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead><tr>{['Prospect', 'POS', 'P90', 'P50', 'P10', 'EMV', 'Call'].map((h) => <th key={h} style={{ textAlign: h === 'Prospect' ? 'left' : 'right', padding: '5px 8px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{h}</th>)}</tr></thead>
          <tbody>{compare.map((c) => { const on = c.id === prospect.id; const d = c.emv > 0; return (
            <tr key={c.id} onClick={() => setSel({ folder: 'prospects', id: c.id })} style={{ cursor: 'pointer', background: on ? 'var(--sel)' : 'transparent' }}>
              <td style={{ padding: '5px 8px', color: 'var(--text)' }}>{c.name}</td>
              <td className="mono" style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--cyan)' }}>{(c.pos * 100).toFixed(0)}%</td>
              <td className="mono" style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--muted)' }}>{toMMbbl(c.p90).toFixed(0)}</td>
              <td className="mono" style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text)' }}>{toMMbbl(c.p50).toFixed(0)}</td>
              <td className="mono" style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--muted)' }}>{toMMbbl(c.p10).toFixed(0)}</td>
              <td className="mono" style={{ padding: '5px 8px', textAlign: 'right', color: d ? 'var(--green)' : 'var(--rose)' }}>{d ? '+' : '−'}{Math.abs(c.emv / 1e6).toFixed(0)}M</td>
              <td style={{ padding: '5px 8px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 10, color: d ? 'var(--green)' : 'var(--rose)' }}>{d ? 'DRILL' : 'PASS'}</span></td>
            </tr>
          ); })}</tbody>
        </table>
      </div>

      <Inspector title="Decision inputs" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Economics (scenario)">
          <Slider label="NPV on success" min={50e6} max={600e6} step={10e6} value={npvSuccess} onChange={setNpv} fmt={(v) => `$${(v / 1e6).toFixed(0)}M`} />
          <Slider label="Dry-hole cost" min={20e6} max={120e6} step={5e6} value={dry} onChange={setDry} fmt={(v) => `$${(v / 1e6).toFixed(0)}M`} />
        </InspectorSection>
        <InspectorSection title="POS breakdown">
          <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {GCOS_ELEMENTS.map((e) => <tr key={e.key}><td style={{ color: 'var(--muted)' }}>{e.label}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{prospect.gcos[e.key].toFixed(2)}</td></tr>)}
            <tr><td style={{ color: 'var(--cyan)', paddingTop: 6 }}>POS = Π</td><td style={{ textAlign: 'right', color: 'var(--cyan)', paddingTop: 6 }}>{pos.toFixed(3)}</td></tr>
          </tbody></table>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>Edit factors in <b>Plays &amp; Prospects</b>.</div>
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)', lineHeight: 1.5 }}>EMV &gt; 0 ⇒ drill-worthy (Newendorp). All monetary values are scenario; POS from interpreted chance factors.</div>
      </Inspector>
    </div>
  );
}

function Branch({ top, label, val, col }: { top: number; label: string; val: string; col: string }) {
  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 1, background: `var(${col})`, opacity: 0.5 }} />
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{label}</span>
      <span className="mono" style={{ fontSize: 12, color: `var(${col})`, fontWeight: 600 }}>{val}</span>
    </div>
  );
}
