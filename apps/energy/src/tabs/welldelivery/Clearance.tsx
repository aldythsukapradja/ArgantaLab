// Clearance — the safe-to-drill cockpit. Pore/collapse/fracture MUD WINDOW (canvas),
// ISCWSA-style ANTI-COLLISION separation factor computed against REAL offset-well
// trajectories, and the two-envelope WELL-BARRIER schematic (NORSOK D-010). The
// anti-collision math is a documented simplification (see trajectory-math.ts).
import { useMemo, useState, useCallback } from 'react';
import { useCanvas, cssVar, useAsync } from '../fielddev/hooks';
import { Inspector, InspectorSection, Slider } from '../fielddev/chrome';
import { loadIndex, loadTraj } from '../../wb/load';
import type { WbIndex } from '../../wb/types';
import type { WdCandidate } from './types';
import { wdTab } from './registry';
import { WdHead } from './shared';
import { candidateStations } from './wdData';
import { closestApproaches, separationFactor, type OffsetCandidate } from './trajectory-math';

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

  const mw = c.mudWindow;
  const draw = useCallback((cx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 30, padR = 10, padT = 10, padB = 20;
    const pw = w - padL - padR, ph = h - padT - padB;
    const sgMin = 0.9, sgMax = 1.9;
    const dMax = Math.max(...mw.map((p) => p.md), 1);
    const X = (sg: number) => padL + ((sg - sgMin) / (sgMax - sgMin)) * pw;
    const Y = (d: number) => padT + (d / dMax) * ph;
    // axes
    cx.strokeStyle = cssVar('--line'); cx.lineWidth = 0.5;
    cx.strokeRect(padL, padT, pw, ph);
    cx.fillStyle = cssVar('--muted'); cx.font = '8px var(--mono)'; cx.textAlign = 'center';
    for (let sg = 1.0; sg <= 1.8; sg += 0.2) { cx.fillText(sg.toFixed(1), X(sg), h - 6); cx.strokeStyle = cssVar('--line'); cx.globalAlpha = 0.4; cx.beginPath(); cx.moveTo(X(sg), padT); cx.lineTo(X(sg), padT + ph); cx.stroke(); cx.globalAlpha = 1; }
    cx.textAlign = 'right';
    for (let k = 0; k <= 3; k++) { const d = dMax * k / 3; cx.fillText(`${(d / 1000).toFixed(1)}k`, padL - 3, Y(d) + 3); }
    // safe window shading (collapse → fracture)
    cx.fillStyle = 'rgba(80,208,177,0.10)'; cx.beginPath();
    mw.forEach((p, i) => { const x = X(p.collapseSg), y = Y(p.md); i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
    for (let i = mw.length - 1; i >= 0; i--) { cx.lineTo(X(mw[i].fracSg), Y(mw[i].md)); }
    cx.closePath(); cx.fill();
    const line = (key: 'poreSg' | 'collapseSg' | 'fracSg' | 'mudSg', color: string, dash: number[] = []) => {
      cx.strokeStyle = color; cx.lineWidth = key === 'mudSg' ? 1.6 : 1.1; cx.setLineDash(dash); cx.beginPath();
      mw.forEach((p, i) => { const x = X(p[key]), y = Y(p.md); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.stroke(); cx.setLineDash([]);
    };
    line('poreSg', cssVar('--blue'), [4, 2]);
    line('collapseSg', cssVar('--violet'), [2, 2]);
    line('fracSg', cssVar('--rose'), [4, 2]);
    line('mudSg', cssVar('--amber'));
    // legend
    cx.textAlign = 'left'; cx.font = '8px var(--mono)';
    const lg: [string, string][] = [['pore', '--blue'], ['collapse', '--violet'], ['frac', '--rose'], ['mud', '--amber']];
    lg.forEach(([lab, v], i) => { cx.fillStyle = cssVar(v); cx.fillText(lab, padL + 4 + i * 44, padT + 9); });
  }, [mw]);
  const chart = useCanvas(draw, [draw]);

  const worst = collisions[0];
  const clearance = worst ? (worst.sf >= 4 ? 'clear' : worst.sf >= sfAlert ? 'watch' : 'alert') : 'clear';
  const clColor = clearance === 'clear' ? 'var(--teal)' : clearance === 'watch' ? 'var(--amber)' : 'var(--rose)';

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WdHead tab={wdTab('clearance')} well={c.name} gate={c.gate} nature="scenario"
          right={<span className="chip mono" style={{ color: clColor, borderColor: clColor }}>{clearance === 'clear' ? '◆ CLEARED' : clearance === 'watch' ? '▲ WATCH' : '■ ALERT'}</span>} />
        <div className="wd-scroll" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* mud window */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Mud-weight window (sg vs depth)</div>
            <div ref={chart.wrapRef} style={{ height: 230, position: 'relative' }}><canvas ref={chart.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} /></div>
            <div className="wd-note">Lower bound = max(pore, collapse); upper = fracture. Planned mud rides mid-window. Volve is close to normally pressured. dataNature: scenario/derived.</div>
          </div>

          {/* barrier schematic */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Well-barrier schematic (NORSOK D-010)</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {c.barriers.map((b) => (
                <div key={b.name} style={{ flex: 1, border: `1.5px solid ${b.name === 'Primary' ? 'var(--teal)' : 'var(--blue)'}`, borderRadius: 8, padding: 10, background: 'var(--panel)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: b.name === 'Primary' ? 'var(--teal)' : 'var(--blue)' }}>{b.name.toUpperCase()}</span>
                    <span className="mono" style={{ fontSize: 8, marginLeft: 'auto', color: b.verified ? 'var(--teal)' : 'var(--muted)' }}>{b.verified ? '✓ verified' : '○ pending'}</span>
                  </div>
                  {b.elements.map((el) => (
                    <div key={el} style={{ fontSize: 10.5, color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid var(--line)' }}>{el}</div>
                  ))}
                </div>
              ))}
            </div>
            <div className="wd-note">Two independent, tested envelopes (WBE stack). Each envelope isolates the source of flow.</div>
          </div>

          {/* anti-collision */}
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
            <div className="wd-note">SF = min distance ÷ combined positional uncertainty (~1.5% of MD). Industry thresholds: SF ≥ 4 clear · SF ≥ {sfAlert.toFixed(1)} watch · below = alert. Simplified vs the full ISCWSA covariance model.</div>
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
