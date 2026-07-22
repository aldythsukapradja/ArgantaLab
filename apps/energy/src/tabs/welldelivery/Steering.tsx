// Steering — the drilling follow-up / geosteering cockpit (StarSteer-style). A TVT
// stratigraphic cross-section shows the reservoir zone band and the wellpath weaving
// through it; live in-zone %, distance-to-boundary and a type-well correlation. Only
// available once the candidate is on bottom (Execute gate) — else an honest lock.
import { useMemo, useState, useCallback } from 'react';
import { useCanvas, cssVar } from '../fielddev/hooks';
import { Inspector, InspectorSection, Slider } from '../fielddev/chrome';
import type { WdCandidate, SteerStation } from './types';
import { wdTab } from './registry';
import { WdHead, GateLocked } from './shared';
import { isGateReached } from './wdData';

/** Synthesize a plausible geosteering log across the reservoir section (deterministic). */
function steerStations(c: WdCandidate, zoneThick: number): SteerStation[] {
  const { tdMd } = c.trajectory;
  const start = tdMd * 0.72, n = 60, out: SteerStation[] = [];
  const half = zoneThick / 2;
  for (let i = 0; i <= n; i++) {
    const md = start + (tdMd - start) * (i / n);
    const p = i / n;
    // gentle drift + two corrections; leaves zone briefly near the toe
    const tvt = Math.sin(p * 7) * half * 0.55 + Math.sin(p * 2.1) * half * 0.4 + (p > 0.8 ? (p - 0.8) * half * 3.2 : 0);
    const inZone = Math.abs(tvt) <= half;
    out.push({ md, tvt, distToBoundary: half - Math.abs(tvt), inZone });
  }
  return out;
}

export function Steering({ c }: { c: WdCandidate }) {
  const [inspOpen, setInspOpen] = useState(true);
  const [zone, setZone] = useState(c.steering?.zoneThicknessM ?? 26);
  const reached = isGateReached(c, 'execute');
  const stations = useMemo(() => (reached ? steerStations(c, zone) : []), [c, zone, reached]);
  const inZonePct = stations.length ? Math.round((stations.filter((s) => s.inZone).length / stations.length) * 100) : 0;
  const last = stations[stations.length - 1];

  const draw = useCallback((cx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 34, padR = 12, padT = 14, padB = 22;
    const pw = w - padL - padR, ph = h - padT - padB;
    if (!stations.length) return;
    const md0 = stations[0].md, md1 = stations[stations.length - 1].md;
    const half = zone / 2, span = half * 3.4;
    const X = (md: number) => padL + ((md - md0) / (md1 - md0)) * pw;
    const Y = (tvt: number) => padT + ph / 2 + (tvt / span) * ph;
    // zone band
    cx.fillStyle = 'rgba(80,208,177,0.12)'; cx.fillRect(padL, Y(-half), pw, Y(half) - Y(-half));
    cx.strokeStyle = cssVar('--teal'); cx.setLineDash([4, 3]); cx.lineWidth = 0.8;
    [[-half], [half]].forEach(([v]) => { cx.beginPath(); cx.moveTo(padL, Y(v)); cx.lineTo(padL + pw, Y(v)); cx.stroke(); });
    cx.setLineDash([]);
    // type-well centre line
    cx.strokeStyle = cssVar('--muted'); cx.lineWidth = 0.6; cx.beginPath(); cx.moveTo(padL, Y(0)); cx.lineTo(padL + pw, Y(0)); cx.stroke();
    // wellpath, coloured by in/out of zone
    cx.lineWidth = 1.8;
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1], b = stations[i];
      cx.strokeStyle = b.inZone ? cssVar('--amber') : cssVar('--rose');
      cx.beginPath(); cx.moveTo(X(a.md), Y(a.tvt)); cx.lineTo(X(b.md), Y(b.tvt)); cx.stroke();
    }
    // labels
    cx.fillStyle = cssVar('--muted'); cx.font = '8px var(--mono)'; cx.textAlign = 'left';
    cx.fillText(`${c.steering?.typeWell ?? c.target.anchorWell} type well · zone ±${half.toFixed(0)} m TVT`, padL + 3, padT + 9);
    cx.textAlign = 'center'; cx.fillText(`reservoir section  ${md0.toFixed(0)}–${md1.toFixed(0)} m MD`, padL + pw / 2, h - 6);
  }, [stations, zone, c]);
  const chart = useCanvas(draw, [draw]);

  if (!reached) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <WdHead tab={wdTab('steering')} well={c.name} gate={c.gate} nature="scenario" />
        <GateLocked what="Geosteering follow-up needs the bit on bottom." gate="Execute" />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WdHead tab={wdTab('steering')} well={c.name} gate={c.gate} nature="scenario"
          right={<span className="chip mono" style={{ color: inZonePct >= 85 ? 'var(--teal)' : 'var(--amber)', borderColor: inZonePct >= 85 ? 'var(--teal)' : 'var(--amber)' }}>{inZonePct}% in zone</span>} />
        <div className="wd-scroll" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>TVT stratigraphic cross-section · plan vs actual</div>
          <div ref={chart.wrapRef} style={{ height: 300, position: 'relative' }}><canvas ref={chart.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              ['In-zone', `${inZonePct}%`, inZonePct >= 85 ? 'var(--teal)' : 'var(--amber)'],
              ['Dist. to boundary', last ? `${last.distToBoundary.toFixed(1)} m` : '—', last && last.distToBoundary > 0 ? 'var(--teal)' : 'var(--rose)'],
              ['Zone thickness', `${zone} m TVT`, 'var(--text)'],
              ['Type well', c.steering?.typeWell ?? c.target.anchorWell, 'var(--text)'],
            ].map(([k, v, col]) => (
              <div key={k} style={{ flex: '1 1 120px', border: '1px solid var(--line)', borderRadius: 5, padding: '7px 9px', background: 'var(--panel)' }}>
                <div className="eyebrow" style={{ fontSize: 9 }}>{k}</div><div className="mono" style={{ fontSize: 15, color: col }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="wd-note">TVT = true vertical thickness relative to the target. Amber = in zone, rose = out. Correlated to the {c.steering?.typeWell ?? c.target.anchorWell} type well. dataNature: scenario.</div>
        </div>
      </div>

      <Inspector title="Geosteering controls" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Target zone">
          <Slider label="Zone thickness" min={10} max={50} step={2} value={zone} onChange={setZone} fmt={(v) => `${v} m`} />
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Thinner zones demand tighter steering; watch the distance-to-boundary readout at the toe.</div>
        </InspectorSection>
        <InspectorSection title="Correlation">
          <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            Lateral gamma is stretched/squeezed onto the <b style={{ color: 'var(--text)' }}>{c.steering?.typeWell ?? c.target.anchorWell}</b> type well on a TVT scale, then a two-layer inversion gives distance-to-boundary for proactive steering.
          </div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}
