// Debrief — the Final Well Report cockpit. Prognosed-vs-actual formation tops,
// non-productive time by hole section, days & cost plan-vs-actual, as-built casing,
// and captured lessons. Available once the well is drilled (Execute gate) — the
// planned/actual deltas are what feed the next well's Basis.
import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { Inspector, InspectorSection } from '../fielddev/chrome';
import type { WdCandidate, NptRow } from './types';
import { wdTab } from './registry';
import { WdHead, GateLocked, usd } from './shared';
import { isGateReached } from './wdData';
import { useMeasure, ChartTip, TipRow } from './d3charts';

/** Interactive D3 horizontal NPT bars (hover for cause + hours). */
function NptBars({ npt }: { npt: NptRow[] }) {
  const { ref, w } = useMeasure<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const W = Math.max(w, 240);
  const ML = 118, MR = 40, rowH = 26, H = npt.length * rowH + 6;
  const max = Math.max(...npt.map((n) => n.hours), 1);
  const x = scaleLinear([0, max], [ML, W - MR]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {npt.map((n, i) => {
          const cy = i * rowH + 4;
          return (
            <g key={n.section} onPointerEnter={() => setHi(i)} onPointerLeave={() => setHi(null)} style={{ cursor: 'default' }}>
              <rect x={0} y={cy} width={W} height={rowH} fill={hi === i ? 'var(--panel-2)' : 'transparent'} />
              <text x={4} y={cy + rowH / 2 + 3} fill="var(--text)" style={{ font: '10.5px var(--mono)' }}>{n.section}</text>
              <rect x={ML} y={cy + 6} width={Math.max(0, x(n.hours) - ML)} height={rowH - 12} rx={3} fill="var(--rose)" opacity={hi === i ? 1 : 0.82} />
              <text x={x(n.hours) + 5} y={cy + rowH / 2 + 3} fill="var(--rose)" style={{ font: '10px var(--mono)' }}>{n.hours}h</text>
            </g>
          );
        })}
      </svg>
      {hi != null && <ChartTip x={W * 0.5} y={hi * rowH + rowH / 2 + 4} w={W}><TipRow k={npt[hi].section} v={`${npt[hi].hours} h`} c="var(--rose)" /><div style={{ color: 'var(--muted)', marginTop: 2 }}>{npt[hi].cause}</div></ChartTip>}
    </div>
  );
}

export function Debrief({ c }: { c: WdCandidate }) {
  const [inspOpen, setInspOpen] = useState(true);
  if (!isGateReached(c, 'execute') || !c.asDrilled) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <WdHead tab={wdTab('debrief')} well={c.name} gate={c.gate} nature="scenario" />
        <GateLocked what="The Final Well Report is written after the well is drilled." gate="Execute" />
      </div>
    );
  }
  const a = c.asDrilled;
  const nptTotal = a.npt.reduce((s, x) => s + x.hours, 0);
  const daysOver = a.daysActual - a.daysPlan;
  const costOver = a.costActualUsd - a.costPlanUsd;
  const lessons = [
    `Losses in the 17.5″ section cost ${a.npt.find((n) => /loss/i.test(n.cause))?.hours ?? 0} h — pre-treat with LCM and cap ECD on the next well.`,
    `Actual tops came in ${a.tops[a.tops.length - 1].actualMd! - a.tops[a.tops.length - 1].prognosedMd! > 0 ? 'deeper' : 'shallower'} than prognosis — update the depth model before the next infill.`,
    `In-zone ${a.inZonePct}% — geosteering held the target; carry the type-well correlation forward.`,
  ];

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WdHead tab={wdTab('debrief')} well={c.name} gate={c.gate} nature="reported"
          right={<span className="chip mono" style={{ color: daysOver > 0 ? 'var(--amber)' : 'var(--teal)', borderColor: daysOver > 0 ? 'var(--amber)' : 'var(--teal)' }}>{daysOver > 0 ? `+${daysOver} d` : 'on plan'}</span>} />
        <div className="wd-scroll" style={{ padding: 14 }}>
          {/* headline plan vs actual */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              ['Days plan → actual', `${a.daysPlan} → ${a.daysActual}`, daysOver > 0 ? 'var(--amber)' : 'var(--teal)'],
              ['Cost plan → actual', `${usd(a.costPlanUsd)} → ${usd(a.costActualUsd)}`, costOver > 0 ? 'var(--amber)' : 'var(--teal)'],
              ['Total NPT', `${nptTotal} h`, 'var(--rose)'],
              ['In-zone', `${a.inZonePct}%`, a.inZonePct >= 85 ? 'var(--teal)' : 'var(--amber)'],
            ].map(([k, v, col]) => (
              <div key={k} style={{ flex: '1 1 130px', border: '1px solid var(--line)', borderRadius: 5, padding: '7px 9px', background: 'var(--panel)' }}>
                <div className="eyebrow" style={{ fontSize: 9 }}>{k}</div><div className="mono" style={{ fontSize: 15, color: col }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* tops prognosed vs actual */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Formation tops · prognosed vs actual</div>
              <table className="mono" style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: 'var(--muted)', textAlign: 'right', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '3px 4px' }}>Surface</th><th>Prog. MD</th><th>Act. MD</th><th>Δ</th>
                </tr></thead>
                <tbody>
                  {a.tops.map((t) => {
                    const d = (t.actualMd ?? 0) - t.prognosedMd;
                    return (
                      <tr key={t.name} style={{ textAlign: 'right', borderBottom: '1px solid var(--line)' }}>
                        <td style={{ textAlign: 'left', padding: '4px 4px', color: 'var(--text)' }}>{t.name}</td>
                        <td>{t.prognosedMd}</td><td>{t.actualMd}</td>
                        <td style={{ color: Math.abs(d) > 20 ? 'var(--amber)' : 'var(--muted)' }}>{d > 0 ? '+' : ''}{d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* NPT by section */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Non-productive time by hole section</div>
              <NptBars npt={a.npt} />
            </div>
          </div>

          {/* as-built casing */}
          <div className="eyebrow" style={{ margin: '14px 0 6px' }}>As-built casing tally</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {c.casing.map((r) => (
              <div key={r.section} className="mono" style={{ flex: '1 1 120px', border: '1px solid var(--line)', borderRadius: 5, padding: '6px 9px', background: 'var(--panel)', fontSize: 10.5 }}>
                <div style={{ color: 'var(--muted)', fontSize: 9 }}>{r.section}</div>
                <div style={{ color: 'var(--text)' }}>{r.csgIn}″ @ {r.shoeMd} m</div>
              </div>
            ))}
          </div>
          <div className="wd-note">Final Well Report is <b>reported</b> data — as-run, not interpreted. Planned/actual deltas feed the next well's Basis of Design.</div>
        </div>
      </div>

      <Inspector title="Lessons learned" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Captured lessons">
          {lessons.map((l, i) => (
            <div key={i} style={{ fontSize: 10.5, color: 'var(--text)', padding: '6px 0', borderBottom: '1px solid var(--line)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--teal)' }}>◆</span> {l}
            </div>
          ))}
        </InspectorSection>
        <InspectorSection title="Feeds forward to">
          <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6 }}>These lessons + the depth-model update are handed to the next infill candidate's <b style={{ color: 'var(--text)' }}>Basis</b> and to Reservoir Management at <b style={{ color: 'var(--text)' }}>Handover</b>.</div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}
