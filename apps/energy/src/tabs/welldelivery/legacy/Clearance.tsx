// Clearance — the safe-to-drill cockpit. The pore/collapse/fracture MUD WINDOW is now
// an interactive D3/SVG chart (hover a depth for the exact gradients); ISCWSA-style
// ANTI-COLLISION separation factor is computed against REAL offset-well trajectories;
// the two-envelope WELL-BARRIER schematic follows NORSOK D-010. Anti-collision math is
// a documented simplification (see trajectory-math.ts).
import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line, area } from 'd3-shape';
import { useAsync } from '../../fielddev/hooks';
import { Inspector, InspectorSection, Slider } from '../../fielddev/chrome';
import { loadIndex, loadTraj } from '../../../wb/load';
import type { WbIndex } from '../../../wb/types';
import type { WdCandidate, MudPoint } from './types';
import { wdTab } from './registry';
import { WdHead } from './shared';
import { candidateStations } from './wdData';
import { closestApproaches, separationFactor, type OffsetCandidate } from './trajectory-math';
import { useMeasure, ChartTip, TipRow } from './d3charts';

async function loadOffsets(c: WdCandidate): Promise<{ index: WbIndex; offsets: OffsetCandidate[] }> {
  const index = await loadIndex();
  const offsets: OffsetCandidate[] = [];
  for (const name of c.offsets) {
    const w = index.wells.find((x) => x.name === name);
    if (!w || !w.has.traj) continue;
    try { const tr = await loadTraj(name); offsets.push({ well: name, surfaceX: w.x, surfaceY: w.y, stations: tr.stations }); } catch { /* skip */ }
  }
  return { index, offsets };
}

/** Interactive D3 mud-weight window (sg vs depth). */
function MudWindow({ mw }: { mw: MudPoint[] }) {
  const { ref, w, h } = useMeasure<HTMLDivElement>();
  const [hy, setHy] = useState<number | null>(null);
  const W = Math.max(w, 260), H = Math.max(h, 180);
  const ML = 34, MR = 10, MT = 12, MB = 22;
  const dMax = Math.max(...mw.map((p) => p.md), 1);
  const x = scaleLinear([0.9, 1.9], [ML, W - MR]);
  const y = scaleLinear([0, dMax], [MT, H - MB]);
  const mk = (key: keyof MudPoint) => line<MudPoint>().x((p) => x(p[key])).y((p) => y(p.md))(mw) || '';
  const safe = area<MudPoint>().x0((p) => x(p.collapseSg)).x1((p) => x(p.fracSg)).y((p) => y(p.md))(mw) || '';
  const hp = hy == null ? null : mw.reduce((a, b) => (Math.abs(y(b.md) - hy) < Math.abs(y(a.md) - hy) ? b : a));

  return (
    <div ref={ref} style={{ height: 230, position: 'relative' }}>
      <svg width={W} height={H} style={{ display: 'block', cursor: 'crosshair' }}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHy(e.clientY - r.top); }}
        onPointerLeave={() => setHy(null)}>
        <rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} fill="none" stroke="var(--line)" strokeWidth={0.5} />
        {[1.0, 1.2, 1.4, 1.6, 1.8].map((sg) => (
          <g key={sg}><line x1={x(sg)} x2={x(sg)} y1={MT} y2={H - MB} stroke="var(--line)" strokeWidth={0.4} opacity={0.5} />
            <text x={x(sg)} y={H - 7} textAnchor="middle" fill="var(--muted)" style={{ font: '8px var(--mono)' }}>{sg.toFixed(1)}</text></g>
        ))}
        {[0, 1, 2, 3].map((k) => { const d = dMax * k / 3; return <text key={k} x={ML - 3} y={y(d) + 3} textAnchor="end" fill="var(--muted)" style={{ font: '8px var(--mono)' }}>{(d / 1000).toFixed(1)}k</text>; })}
        <path d={safe} fill="var(--teal)" opacity={0.10} />
        <path d={mk('poreSg')} fill="none" stroke="var(--blue)" strokeWidth={1.1} strokeDasharray="4 2" />
        <path d={mk('collapseSg')} fill="none" stroke="var(--violet)" strokeWidth={1.1} strokeDasharray="2 2" />
        <path d={mk('fracSg')} fill="none" stroke="var(--rose)" strokeWidth={1.1} strokeDasharray="4 2" />
        <path d={mk('mudSg')} fill="none" stroke="var(--amber)" strokeWidth={1.7} />
        {[['pore', '--blue'], ['collapse', '--violet'], ['frac', '--rose'], ['mud', '--amber']].map(([lab, v], i) => (
          <text key={lab} x={ML + 4 + i * 46} y={MT + 9} fill={`var(${v})`} style={{ font: '8px var(--mono)' }}>{lab}</text>
        ))}
        {hp && <line x1={ML} x2={W - MR} y1={y(hp.md)} y2={y(hp.md)} stroke="var(--text)" strokeWidth={0.5} opacity={0.5} />}
      </svg>
      {hp && (
        <ChartTip x={W * 0.5} y={y(hp.md)} w={W}>
          <TipRow k="depth" v={`${hp.md.toFixed(0)} m`} />
          <TipRow k="pore" v={`${hp.poreSg.toFixed(2)} sg`} c="var(--blue)" />
          <TipRow k="collapse" v={`${hp.collapseSg.toFixed(2)} sg`} c="var(--violet)" />
          <TipRow k="frac" v={`${hp.fracSg.toFixed(2)} sg`} c="var(--rose)" />
          <TipRow k="mud" v={`${hp.mudSg.toFixed(2)} sg`} c="var(--amber)" />
        </ChartTip>
      )}
    </div>
  );
}

export function Clearance({ c }: { c: WdCandidate }) {
  const [inspOpen, setInspOpen] = useState(true);
  const [sfAlert, setSfAlert] = useState(1.5);
  const res = useAsync(() => loadOffsets(c), [c.id]);
  const mine = useMemo(() => candidateStations(c), [c]);
  const collisions = useMemo(() => {
    if (!res.data) return [];
    return closestApproaches(c.trajectory.surfaceX, c.trajectory.surfaceY, mine, res.data.offsets)
      .map((x) => ({ ...x, sf: separationFactor(x.minDistM, x.atMd) }));
  }, [res.data, mine, c]);

  const worst = collisions[0];
  const clearance = worst ? (worst.sf >= 4 ? 'clear' : worst.sf >= sfAlert ? 'watch' : 'alert') : 'clear';
  const clColor = clearance === 'clear' ? 'var(--teal)' : clearance === 'watch' ? 'var(--amber)' : 'var(--rose)';

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WdHead tab={wdTab('clearance')} well={c.name} gate={c.gate} nature="scenario"
          right={<span className="chip mono" style={{ color: clColor, borderColor: clColor }}>{clearance === 'clear' ? '◆ CLEARED' : clearance === 'watch' ? '▲ WATCH' : '■ ALERT'}</span>} />
        <div className="wd-scroll" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Mud-weight window (sg vs depth)</div>
            <MudWindow mw={c.mudWindow} />
            <div className="wd-note">Lower bound = max(pore, collapse); upper = fracture. Planned mud rides mid-window. Hover a depth for the exact gradients. dataNature: scenario/derived.</div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Well-barrier schematic (NORSOK D-010)</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {c.barriers.map((b) => (
                <div key={b.name} style={{ flex: 1, border: `1.5px solid ${b.name === 'Primary' ? 'var(--teal)' : 'var(--blue)'}`, borderRadius: 8, padding: 10, background: 'var(--panel)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: b.name === 'Primary' ? 'var(--teal)' : 'var(--blue)' }}>{b.name.toUpperCase()}</span>
                    <span className="mono" style={{ fontSize: 8, marginLeft: 'auto', color: b.verified ? 'var(--teal)' : 'var(--muted)' }}>{b.verified ? '✓ verified' : '○ pending'}</span>
                  </div>
                  {b.elements.map((el) => <div key={el} style={{ fontSize: 10.5, color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid var(--line)' }}>{el}</div>)}
                </div>
              ))}
            </div>
            <div className="wd-note">Two independent, tested envelopes (WBE stack). Each envelope isolates the source of flow.</div>
          </div>

          <div style={{ gridColumn: '1 / 3' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Anti-collision · separation factor vs real offset wells</div>
            {res.loading && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading offset trajectories…</div>}
            {res.data && (
              <table className="mono" style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: 'var(--muted)', textAlign: 'right', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Offset well</th><th>Min distance</th><th>At MD</th><th>Separation factor</th><th style={{ textAlign: 'left', paddingLeft: 10 }}>Status</th>
                </tr></thead>
                <tbody>
                  {collisions.map((x) => {
                    const st = x.sf >= 4 ? 'clear' : x.sf >= sfAlert ? 'watch' : 'alert';
                    const cc = st === 'clear' ? 'var(--teal)' : st === 'watch' ? 'var(--amber)' : 'var(--rose)';
                    return (
                      <tr key={x.well} style={{ textAlign: 'right', borderBottom: '1px solid var(--line)' }}>
                        <td style={{ textAlign: 'left', padding: '5px 6px', color: 'var(--text)' }}>{x.well}</td>
                        <td>{x.minDistM.toFixed(0)} m</td>
                        <td style={{ color: 'var(--muted)' }}>{x.atMd.toFixed(0)} m</td>
                        <td style={{ color: cc, fontWeight: 600 }}>{x.sf.toFixed(2)}</td>
                        <td style={{ textAlign: 'left', paddingLeft: 10, color: cc }}>{st === 'clear' ? '✓ clear' : st === 'watch' ? '▲ watch' : '■ alert'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="wd-note">SF = min distance ÷ combined positional uncertainty (~1.5% of MD). Thresholds: SF ≥ 4 clear · SF ≥ {sfAlert.toFixed(1)} watch · below = alert. Simplified vs the full ISCWSA covariance model.</div>
          </div>
        </div>
      </div>

      <Inspector title="Clearance controls" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Anti-collision threshold">
          <Slider label="Alert below SF" min={1.0} max={3.0} step={0.1} value={sfAlert} onChange={setSfAlert} fmt={(v) => v.toFixed(1)} />
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>ISCWSA collision-avoidance rule of thumb is SF ≥ 1.2–1.5; raise it for a shared template.</div>
        </InspectorSection>
        <InspectorSection title="Shallow-hazard screen">
          {['Shallow gas (pilot-hole survey)', 'Shallow water flow', 'Seabed / drop-object', 'Existing wellbores at slot'].map((s) => (
            <div key={s} style={{ fontSize: 10.5, color: 'var(--text)', padding: '3px 0', display: 'flex', gap: 6 }}><span style={{ color: 'var(--amber)' }}>▲</span>{s}</div>
          ))}
        </InspectorSection>
        <InspectorSection title="Offsets used">
          {c.offsets.map((o) => <div key={o} className="mono" style={{ fontSize: 10.5, color: 'var(--text)', padding: '2px 0' }}>{o}</div>)}
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 6 }}>Real Volve trajectories, nearest by surface location.</div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}
