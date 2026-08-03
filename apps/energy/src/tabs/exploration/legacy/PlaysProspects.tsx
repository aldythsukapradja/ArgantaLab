// Plays & Prospects — GeoX-style prospect maturation: score the 5 GCoS play elements
// (editable chance factors → live POS = Π), a drill-ready prospect inventory ranked by
// EMV, and a risk–reward matrix (POS vs risked resource). Founder spec: "score play
// elements · define prospect · review evidence · advance gate" (COSMO TAB_SPECS).
import { useMemo, useState } from 'react';
import { useAsync } from '../../fielddev/hooks';
import { Loading, ErrorBanner } from '../../fielddev/chrome';
import { NatureBadge } from '../../../components/Provenance';
import { loadIndex } from '../../../wb/load';
import type { WbIndex } from '../../../wb/types';
import { gcos, riskedResource, emv, rankProspects, GCOS_ELEMENTS, type GcosKey } from '../../../engine/explore';
import type { ExplSel } from './ExplorationExplorer';
import { PROSPECTS, PS_EVIDENCE, toMMbbl } from './explData';

type Factors = Record<string, Record<GcosKey, number>>;

export function ExplPlaysProspects({ sel, setSel }: { sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const idx = useAsync<WbIndex>(loadIndex, []);
  // editable GCoS factors, seeded from explData (interpreted; user can adjust)
  const [factors, setFactors] = useState<Factors>(() => Object.fromEntries(PROSPECTS.map((p) => [p.id, { ...p.gcos }])));
  const pid = sel?.folder === 'prospects' ? sel.id : 'volve';
  const prospect = PROSPECTS.find((p) => p.id === pid) ?? PROSPECTS[0];
  const f = factors[prospect.id];

  const inventory = useMemo(() => PROSPECTS.map((p) => {
    const pf = factors[p.id]; const pos = gcos(GCOS_ELEMENTS.map((e) => ({ p: pf[e.key] })));
    const r = riskedResource(p.mc, pos, 4000, 4242);
    const npvUnit = p.econ.npvSuccess; // $ at success
    const value = emv({ pos, npvSuccess: npvUnit, dryHoleCost: p.econ.dryHoleCost });
    return { id: p.id, name: p.name, status: p.status, pos, riskedMean: r.riskedMean, meanSuccess: r.meanSuccess, emv: value };
  }), [factors]);
  const ranked = useMemo(() => rankProspects(inventory.map((i) => ({ id: i.id, name: i.name, pos: i.pos, riskedMean: i.riskedMean, emv: i.emv }))), [inventory]);

  if (idx.loading) return <Loading what="prospect inventory" />;
  if (idx.error) return <ErrorBanner msg={idx.error} />;

  const setF = (k: GcosKey, v: number) => setFactors((s) => ({ ...s, [prospect.id]: { ...s[prospect.id], [k]: v } }));
  const pos = gcos(GCOS_ELEMENTS.map((e) => ({ p: f[e.key] })));

  // matrix geometry
  const maxRes = Math.max(...inventory.map((i) => i.meanSuccess), 1);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      {/* left — GCoS element scoring for the selected prospect */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{prospect.name}</h2>
          <span className="chip mono" style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)' }}>{prospect.status}</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 14px' }}>{prospect.note}</p>

        <div className="eyebrow" style={{ marginBottom: 8 }}>Geological chance of success — 5 play elements (Π)</div>
        {GCOS_ELEMENTS.map((el) => {
          const ev = PS_EVIDENCE[el.key]; const v = f[el.key];
          return (
            <div key={el.key} className="panel" style={{ padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{el.label}</span>
                <NatureBadge nature={ev.nature} />
                <span className="mono" style={{ fontSize: 13, color: 'var(--cyan)', width: 40, textAlign: 'right' }}>{v.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => setF(el.key, parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--cyan)' }} />
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{ev.assessment}</div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{ev.evidence.map((e, i) => <li key={i} style={{ fontSize: 10.5, color: 'var(--ink3, var(--muted))' }}>{e}</li>)}</ul>
            </div>
          );
        })}
        <div className="panel" style={{ padding: '12px 14px', marginTop: 4, display: 'flex', alignItems: 'center', gap: 14, borderColor: 'var(--cyan)' }}>
          <div><div className="eyebrow">POS = Π(factors)</div><div style={{ fontSize: 26, fontWeight: 700, color: 'var(--cyan)' }}>{(pos * 100).toFixed(0)}%</div></div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{GCOS_ELEMENTS.map((e) => f[e.key].toFixed(2)).join(' × ')} = {pos.toFixed(3)}<br />Independent factors (transparent GeoX decomposition).</div>
        </div>
      </div>

      {/* right — inventory + risk-reward matrix */}
      <aside style={{ width: 400, flexShrink: 0, borderLeft: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
        <div style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Risk–reward matrix</div>
          <svg viewBox="0 0 320 200" style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel-2)' }}>
            <line x1="34" y1="170" x2="310" y2="170" stroke="var(--line)" /><line x1="34" y1="12" x2="34" y2="170" stroke="var(--line)" />
            <text x="170" y="192" fill="var(--muted)" fontSize="9" textAnchor="middle">Risked resource (MMbbl) →</text>
            <text x="12" y="90" fill="var(--muted)" fontSize="9" textAnchor="middle" transform="rotate(-90 12 90)">POS →</text>
            {inventory.map((i) => {
              const x = 34 + (toMMbbl(i.meanSuccess) / toMMbbl(maxRes)) * 270;
              const y = 170 - i.pos * 155; const r = 5 + Math.min(12, Math.abs(i.emv) / 1e7);
              const on = i.id === prospect.id;
              return <g key={i.id} style={{ cursor: 'pointer' }} onClick={() => setSel({ folder: 'prospects', id: i.id })}>
                <circle cx={x} cy={y} r={r} fill={i.emv >= 0 ? 'var(--green)' : 'var(--rose)'} fillOpacity={on ? 0.85 : 0.4} stroke={on ? 'var(--text)' : 'none'} strokeWidth="1.5" />
                <text x={x} y={y - r - 3} fill="var(--text)" fontSize="8.5" textAnchor="middle">{i.name.split(' ')[0]}</text>
              </g>;
            })}
          </svg>
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4 }}>Bubble size ∝ |EMV| · green = EMV&gt;0 (drill), red = sub-economic.</div>
        </div>
        <div style={{ padding: '0 14px 14px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Drill-ready inventory · ranked by EMV</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr>{['Prospect', 'POS', 'Risked', 'EMV'].map((h) => <th key={h} style={{ textAlign: h === 'Prospect' ? 'left' : 'right', padding: '4px 6px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {ranked.map((r, i) => { const inv = inventory.find((x) => x.id === r.id)!; const on = r.id === prospect.id; return (
                <tr key={r.id} onClick={() => setSel({ folder: 'prospects', id: r.id })} style={{ cursor: 'pointer', background: on ? 'var(--sel)' : 'transparent' }}>
                  <td style={{ padding: '4px 6px', color: 'var(--text)' }}>{i + 1}. {r.name.split(' ').slice(0, 2).join(' ')}</td>
                  <td className="mono" style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--cyan)' }}>{(r.pos * 100).toFixed(0)}%</td>
                  <td className="mono" style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text)' }}>{toMMbbl(inv.meanSuccess).toFixed(0)}</td>
                  <td className="mono" style={{ padding: '4px 6px', textAlign: 'right', color: r.emv >= 0 ? 'var(--green)' : 'var(--rose)' }}>{r.emv >= 0 ? '+' : ''}{(r.emv / 1e6).toFixed(0)}M</td>
                </tr>
              ); })}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}><NatureBadge nature="scenario" /> <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>Chance factors interpreted; volumes & EMV are pre-drill scenario.</span></div>
        </div>
      </aside>
    </div>
  );
}
