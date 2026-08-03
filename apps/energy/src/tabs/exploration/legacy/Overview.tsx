// Exploration Overview — the decision workspace / cockpit: portfolio KPI tiles,
// petroleum-system readiness, a ranked drill inventory (EMV) and the founder's own
// acceptance spec rendered below. "Move from regional evidence to ranked, auditable
// opportunities" (COSMO TAB_SPECS.exploration.Overview).
import { useMemo } from 'react';
import { Compass, Gem, TrendingUp, Crosshair, Gauge } from 'lucide-react';
import { NatureBadge } from '../../../components/Provenance';
import { Markdown } from '../../md';
import { gcos, riskedResource, emv, rankProspects, GCOS_ELEMENTS } from '../../../engine/explore';
import type { ExplSel } from './ExplorationExplorer';
import { PROSPECTS, PS_EVIDENCE, VOLVE_OUTCOME, toMMbbl } from './explData';
import { explSpecMd } from './registry';

export function ExplOverview({ setSel }: { setSel: (s: ExplSel) => void }) {
  const inv = useMemo(() => PROSPECTS.map((p) => {
    const pos = gcos(GCOS_ELEMENTS.map((e) => ({ p: p.gcos[e.key] })));
    const r = riskedResource(p.mc, pos, 4000, 4242);
    const value = emv({ pos, npvSuccess: p.econ.npvSuccess, dryHoleCost: p.econ.dryHoleCost });
    return { id: p.id, name: p.name, status: p.status, pos, riskedMean: r.riskedMean, meanSuccess: r.meanSuccess, emv: value };
  }), []);
  const ranked = rankProspects(inv.map((i) => ({ id: i.id, name: i.name, pos: i.pos, riskedMean: i.riskedMean, emv: i.emv })));
  const drillReady = inv.filter((i) => i.emv > 0).length;
  const bestEmv = Math.max(...inv.map((i) => i.emv));
  const totalRisked = inv.reduce((a, i) => a + i.riskedMean, 0);
  const posRange = [Math.min(...inv.map((i) => i.pos)), Math.max(...inv.map((i) => i.pos))];

  const volve = PROSPECTS[0];

  const Tile = ({ icon: Ic, k, v, s, c }: { icon: typeof Gem; k: string; v: string; s: string; c: string }) => (
    <div className="panel" style={{ padding: '13px 15px', flex: 1, minWidth: 150, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Ic size={14} style={{ color: c }} /><span className="eyebrow">{k}</span></div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{v}</div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s}</div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Compass size={20} style={{ color: 'var(--cyan)' }} />
        <h2 style={{ margin: 0, fontSize: 18 }}>Exploration Decision Workspace</h2>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '0 0 16px' }}>Move from regional evidence to ranked, auditable opportunities — grounded in the real Volve petroleum system.</p>

      {/* KPI tiles */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile icon={Crosshair} k="Drill-ready" v={`${drillReady} / ${PROSPECTS.length}`} s="EMV > 0" c="var(--green)" />
        <Tile icon={TrendingUp} k="Best EMV" v={`+$${(bestEmv / 1e6).toFixed(0)}M`} s="risked expectation" c="var(--cyan)" />
        <Tile icon={Gem} k="Risked resource" v={`${toMMbbl(totalRisked).toFixed(0)}`} s="MMbbl · portfolio Σ" c="var(--amber)" />
        <Tile icon={Gauge} k="POS range" v={`${(posRange[0] * 100).toFixed(0)}–${(posRange[1] * 100).toFixed(0)}%`} s="chance of success" c="var(--violet)" />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* petroleum system readiness (Volve) */}
        <div className="panel" style={{ padding: 16, flex: 1, minWidth: 300 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Petroleum system · {volve.name.split(' ')[0]} play</div>
          {GCOS_ELEMENTS.map((el) => { const p = volve.gcos[el.key]; const ev = PS_EVIDENCE[el.key]; return (
            <div key={el.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ width: 110, fontSize: 11, color: 'var(--text)' }}>{el.label.split(' ')[0]}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--panel-2)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${p * 100}%`, height: '100%', background: p > 0.75 ? 'var(--green)' : p > 0.6 ? 'var(--amber)' : 'var(--rose)' }} /></div>
              <span className="mono" style={{ width: 34, textAlign: 'right', fontSize: 11, color: 'var(--text)' }}>{p.toFixed(2)}</span>
              <NatureBadge nature={ev.nature} />
            </div>
          ); })}
        </div>

        {/* ranked inventory */}
        <div className="panel" style={{ padding: 16, flex: 1, minWidth: 300 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Drill inventory · ranked by EMV</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead><tr>{['#', 'Prospect', 'POS', 'Risked', 'EMV'].map((h, i) => <th key={h} style={{ textAlign: i > 1 ? 'right' : 'left', padding: '4px 6px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{h}</th>)}</tr></thead>
            <tbody>{ranked.map((r, i) => { const it = inv.find((x) => x.id === r.id)!; return (
              <tr key={r.id} onClick={() => setSel({ folder: 'prospects', id: r.id })} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '5px 6px', color: 'var(--muted)' }}>{i + 1}</td>
                <td style={{ padding: '5px 6px', color: 'var(--text)' }}>{r.name.split(' ').slice(0, 2).join(' ')}</td>
                <td className="mono" style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--cyan)' }}>{(r.pos * 100).toFixed(0)}%</td>
                <td className="mono" style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text)' }}>{toMMbbl(it.meanSuccess).toFixed(0)}</td>
                <td className="mono" style={{ padding: '5px 6px', textAlign: 'right', color: r.emv >= 0 ? 'var(--green)' : 'var(--rose)' }}>{r.emv >= 0 ? '+' : '−'}{Math.abs(r.emv / 1e6).toFixed(0)}M</td>
              </tr>
            ); })}</tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            Scored against the realised outcome: {VOLVE_OUTCOME.discoveryWell} ({VOLVE_OUTCOME.discoveryYear}) — ≈{VOLVE_OUTCOME.inPlaceMMSm3} MMSm³ in place, ~{VOLVE_OUTCOME.producedMMbbl} MMbbl produced. <NatureBadge nature="scenario" />
          </div>
        </div>
      </div>

      {/* founder acceptance spec */}
      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>▸ Founder acceptance spec (COSMO TAB_SPECS.exploration.Overview)</summary>
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}><Markdown body={explSpecMd('Overview')} /></div>
      </details>
    </div>
  );
}
