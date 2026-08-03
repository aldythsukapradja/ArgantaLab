// Steering — the geosteering cockpit, rebuilt StarSteer-style as ONE interactive
// D3/SVG scene (no more <canvas>): a vertical type-well GR track (layer cake from
// REAL Volve GR), a measured-GR-vs-VS ribbon, and a dipping structural cross-section
// with the planned vs actual wellpath weaving through the target window past a fault.
// Hover for a crosshair readout (VS·MD·TVD·TVT·GR·distance-to-boundary·in/out);
// wheel to zoom the section, drag to pan. Gate-locked until the well is on bottom.
import { useMemo, useState, useRef, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { Inspector, InspectorSection, Slider } from '../../fielddev/chrome';
import { useAsync } from '../../fielddev/hooks';
import { loadLogs } from '../../../wb/load';
import type { LogsJson } from '../../../wb/types';
import type { WdCandidate } from './types';
import { wdTab } from './registry';
import { WdHead, GateLocked } from './shared';
import { isGateReached } from './wdData';
import { buildSteerModel, grAtStrat, type SteerModel, type SteerNode } from './steerModel';
import { useMeasure, ChartTip, TipRow } from './d3charts';

const ML = 74, GAP = 12, RIBBON = 92, PADT = 8, PADB = 22, PADR = 10;

function SteerScene({ model }: { model: SteerModel }) {
  const { ref, w, h } = useMeasure<HTMLDivElement>();
  const [dom, setDom] = useState<[number, number]>([0, model.vsMax]);
  const [hoverVs, setHoverVs] = useState<number | null>(null);
  const drag = useRef<{ x: number; d0: [number, number] } | null>(null);
  const W = Math.max(w, 320), H = Math.max(h, 260);

  const secTop = RIBBON + GAP;
  const xVs = scaleLinear(dom, [ML, W - PADR]);
  const yGr = scaleLinear([model.grMin, model.grMax], [RIBBON - 4, PADT]);   // high GR up
  const yTvd = scaleLinear([model.tvdMin, model.tvdMax], [secTop + PADT, H - PADB]);
  const xTrack = scaleLinear([model.grMin, model.grMax], [ML - 8, 8]);       // GR increases left

  const vis = model.nodes.filter((n) => n.vs >= dom[0] - 20 && n.vs <= dom[1] + 20);
  const samples = useMemo(() => {
    const out: number[] = []; const N = 80;
    for (let i = 0; i <= N; i++) out.push(dom[0] + (dom[1] - dom[0]) * (i / N));
    return out;
  }, [dom]);

  const bandArea = area<number>().x((vs) => xVs(vs)).y0((vs) => yTvd(model.topTvdAt(vs))).y1((vs) => yTvd(model.baseTvdAt(vs)));
  const topLine = line<number>().x((vs) => xVs(vs)).y((vs) => yTvd(model.topTvdAt(vs)));
  const baseLine = line<number>().x((vs) => xVs(vs)).y((vs) => yTvd(model.baseTvdAt(vs)));
  const planLine = line<SteerNode>().x((n) => xVs(n.vs)).y((n) => yTvd(n.topTvd + n.tvtPlan)).curve(curveMonotoneX);
  const grRibbon = line<SteerNode>().x((n) => xVs(n.vs)).y((n) => yGr(n.gr)).curve(curveMonotoneX);
  const trackLine = line<{ s: number; gr: number }>().x((p) => xTrack(p.gr)).y((p) => yTvd(model.topTvd0 + p.s));

  // actual wellpath split into in/out runs so we can colour it
  const runs: { inZone: boolean; pts: SteerNode[] }[] = [];
  for (const n of vis) {
    const last = runs[runs.length - 1];
    if (last && last.inZone === n.inZone) last.pts.push(n);
    else runs.push({ inZone: n.inZone, pts: [n] });
  }
  const segLine = line<SteerNode>().x((n) => xVs(n.vs)).y((n) => yTvd(n.wellTvd)).curve(curveMonotoneX);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const vsAt = scaleLinear([ML, W - PADR], dom).clamp(true)(px);
    const k = e.deltaY < 0 ? 0.86 : 1.16;
    let a = vsAt - (vsAt - dom[0]) * k, b = vsAt + (dom[1] - vsAt) * k;
    a = Math.max(0, a); b = Math.min(model.vsMax, b);
    if (b - a > 60) setDom([a, b]);
  }, [dom, W, model.vsMax]);

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, d0: [...dom] as [number, number] }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (drag.current) {
      const perPx = (dom[1] - dom[0]) / (W - ML - PADR);
      let a = drag.current.d0[0] - (e.clientX - drag.current.x) * perPx;
      let b = drag.current.d0[1] - (e.clientX - drag.current.x) * perPx;
      if (a < 0) { b -= a; a = 0; } if (b > model.vsMax) { a -= b - model.vsMax; b = model.vsMax; }
      setDom([Math.max(0, a), Math.min(model.vsMax, b)]);
    } else if (px >= ML && px <= W - PADR) {
      setHoverVs(scaleLinear([ML, W - PADR], dom).clamp(true)(px));
    }
  };
  const onUp = () => { drag.current = null; };

  const hn = hoverVs == null ? null : model.nodes.reduce((a, b) => (Math.abs(b.vs - hoverVs) < Math.abs(a.vs - hoverVs) ? b : a));
  const cutoff = 60; // GR sand cutoff (API)

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <svg width={W} height={H} style={{ display: 'block', cursor: drag.current ? 'grabbing' : 'crosshair', touchAction: 'none' }}
        onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { setHoverVs(null); onUp(); }}>
        <defs>
          <clipPath id="secClip"><rect x={ML} y={secTop} width={W - ML - PADR} height={H - secTop - PADB + PADT} /></clipPath>
          <clipPath id="ribClip"><rect x={ML} y={0} width={W - ML - PADR} height={RIBBON} /></clipPath>
        </defs>

        {/* ── measured-GR ribbon (top) ── */}
        <text x={6} y={12} fill="var(--muted)" style={{ font: '8px var(--mono)' }}>MEASURED GR (API)</text>
        <rect x={ML} y={PADT} width={W - ML - PADR} height={RIBBON - PADT - 4} fill="none" stroke="var(--line)" strokeWidth={0.5} />
        <line x1={ML} x2={W - PADR} y1={yGr(cutoff)} y2={yGr(cutoff)} stroke="var(--amber)" strokeDasharray="3 3" strokeWidth={0.7} />
        <text x={W - PADR - 2} y={yGr(cutoff) - 3} textAnchor="end" fill="var(--amber)" style={{ font: '7.5px var(--mono)' }}>sand ≤ {cutoff}</text>
        <g clipPath="url(#ribClip)">
          <path d={area<SteerNode>().x((n) => xVs(n.vs)).y0(RIBBON - 4).y1((n) => yGr(n.gr)).curve(curveMonotoneX)(vis) || ''} fill="var(--violet)" opacity={0.10} />
          <path d={grRibbon(vis) || ''} fill="none" stroke="var(--violet)" strokeWidth={1.3} />
        </g>

        {/* ── type-well GR track (left, vertical layer cake) ── */}
        <text x={6} y={secTop} fill="var(--muted)" style={{ font: '8px var(--mono)' }}>TYPE {model.typeWell}</text>
        <rect x={8} y={yTvd(model.topTvd0)} width={ML - 16} height={yTvd(model.topTvd0 + model.zoneThick) - yTvd(model.topTvd0)} fill="var(--amber)" opacity={0.14} />
        <path d={trackLine(model.grByStrat) || ''} fill="none" stroke="var(--violet)" strokeWidth={1} />

        {/* ── structural cross-section (main) ── */}
        <g clipPath="url(#secClip)">
          <path d={bandArea(samples) || ''} fill="var(--amber)" opacity={0.13} />
          <path d={topLine(samples) || ''} fill="none" stroke="var(--teal)" strokeWidth={1.1} />
          <path d={baseLine(samples) || ''} fill="none" stroke="var(--teal)" strokeWidth={1.1} strokeDasharray="5 3" opacity={0.8} />
          {/* fault */}
          {model.faultVs != null && model.faultVs >= dom[0] && model.faultVs <= dom[1] && (
            <line x1={xVs(model.faultVs)} x2={xVs(model.faultVs)} y1={yTvd(model.topTvdAt(model.faultVs) - 14)} y2={yTvd(model.baseTvdAt(model.faultVs) + 14)} stroke="var(--rose)" strokeWidth={1} strokeDasharray="2 2" />
          )}
          {/* planned + actual */}
          <path d={planLine(vis) || ''} fill="none" stroke="var(--muted)" strokeWidth={1.1} strokeDasharray="4 3" />
          {runs.map((r, i) => <path key={i} d={segLine(r.pts) || ''} fill="none" stroke={r.inZone ? 'var(--amber)' : 'var(--rose)'} strokeWidth={2} />)}
          {/* bit at toe */}
          {vis.length > 0 && (() => { const b = vis[vis.length - 1]; return <circle cx={xVs(b.vs)} cy={yTvd(b.wellTvd)} r={3.5} fill="var(--text)" stroke="var(--panel)" strokeWidth={1} />; })()}
        </g>

        {/* faint labels */}
        {model.faultVs != null && model.faultVs >= dom[0] && model.faultVs <= dom[1] && (
          <text x={xVs(model.faultVs) + 3} y={secTop + 12} fill="var(--rose)" style={{ font: '7.5px var(--mono)' }}>fault ~{model.faultThrow}m</text>
        )}
        <text x={ML} y={H - 6} fill="var(--muted)" style={{ font: '8px var(--mono)' }}>VS {dom[0].toFixed(0)}–{dom[1].toFixed(0)} m →</text>

        {/* crosshair */}
        {hn && (
          <g pointerEvents="none">
            <line x1={xVs(hn.vs)} x2={xVs(hn.vs)} y1={PADT} y2={H - PADB} stroke="var(--text)" strokeWidth={0.6} opacity={0.5} />
            <circle cx={xVs(hn.vs)} cy={yTvd(hn.wellTvd)} r={4} fill="none" stroke="var(--text)" strokeWidth={1.2} />
            <circle cx={xVs(hn.vs)} cy={yGr(hn.gr)} r={2.5} fill="var(--violet)" />
          </g>
        )}
      </svg>
      {hn && hoverVs != null && (
        <ChartTip x={xVs(hn.vs)} y={secTop + 30} w={W}>
          <TipRow k="VS" v={`${hn.vs.toFixed(0)} m`} />
          <TipRow k="MD" v={`${hn.md.toFixed(0)} m`} />
          <TipRow k="TVD" v={`${hn.wellTvd.toFixed(1)} m`} />
          <TipRow k="TVT" v={`${hn.tvtActual.toFixed(1)} m`} c={hn.inZone ? 'var(--amber)' : 'var(--rose)'} />
          <TipRow k="GR" v={`${hn.gr.toFixed(0)} API`} />
          <TipRow k="→ top / base" v={`${hn.dtbUp.toFixed(1)} / ${hn.dtbDown.toFixed(1)} m`} />
          <TipRow k="status" v={hn.inZone ? 'IN ZONE' : 'OUT'} c={hn.inZone ? 'var(--teal)' : 'var(--rose)'} />
        </ChartTip>
      )}
    </div>
  );
}

export function Steering({ c }: { c: WdCandidate }) {
  const [inspOpen, setInspOpen] = useState(true);
  const [zone, setZone] = useState(c.steering?.zoneThicknessM ?? 26);
  const reached = isGateReached(c, 'execute');
  const typeWell = c.steering?.typeWell ?? c.target.anchorWell;
  const log = useAsync<LogsJson | null>(() => (reached ? loadLogs(typeWell).catch(() => null) : Promise.resolve(null)), [typeWell, reached]);

  const model = useMemo(() => {
    if (!reached) return null;
    const gr = log.data?.curves?.GR?.values?.filter((v): v is number => v != null) ?? [];
    return buildSteerModel({ typeWell, realGr: gr.length ? gr : Array.from({ length: 200 }, (_, i) => 75 + 35 * Math.sin(i / 3)), zoneThick: zone, topTvd0: c.trajectory.tdTvd - zone / 2 });
  }, [reached, log.data, typeWell, zone, c.trajectory.tdTvd]);

  if (!reached || !model) {
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
          right={<span className="chip mono" style={{ color: model.inZonePct >= 85 ? 'var(--teal)' : 'var(--amber)', borderColor: model.inZonePct >= 85 ? 'var(--teal)' : 'var(--amber)' }}>{model.inZonePct}% in zone</span>} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '8px 12px 4px' }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Geosteering cross-section · TVT · plan vs actual {log.loading ? '· loading type-well GR…' : `· type well ${typeWell}`}</div>
          <SteerScene model={model} />
          <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap', font: '8.5px var(--mono)', color: 'var(--muted)' }}>
            <span><span style={{ color: 'var(--amber)' }}>▬</span> in zone</span>
            <span><span style={{ color: 'var(--rose)' }}>▬</span> out of zone</span>
            <span><span style={{ color: 'var(--muted)' }}>┈</span> planned</span>
            <span><span style={{ color: 'var(--teal)' }}>▬</span> top / base boundary</span>
            <span><span style={{ color: 'var(--violet)' }}>▬</span> GR</span>
            <span style={{ marginLeft: 'auto' }}>scroll = zoom · drag = pan</span>
          </div>
        </div>
      </div>

      <Inspector title="Geosteering controls" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Target zone">
          <Slider label="Zone thickness" min={10} max={50} step={2} value={zone} onChange={setZone} fmt={(v) => `${v} m`} />
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Thinner zones demand tighter steering — watch the distance-to-boundary in the hover readout.</div>
        </InspectorSection>
        <InspectorSection title="Correlation">
          <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            Lateral GR is correlated on a <b style={{ color: 'var(--text)' }}>TVT</b> scale to the <b style={{ color: 'var(--text)' }}>{typeWell}</b> type well (real Volve GR). When the bit climbs out of the sand, measured GR rises above the {60} API cut and the path colours <b style={{ color: 'var(--rose)' }}>rose</b>.
          </div>
        </InspectorSection>
        <InspectorSection title="Model">
          {[['Structural dip', `${(Math.atan(model.dip) * 180 / Math.PI).toFixed(1)}°`], ['Fault throw', `${model.faultThrow} m`], ['Zone', `${model.zoneThick} m TVT`], ['In-zone', `${model.inZonePct}%`], ['GR @ boundary', `~${grAtStrat(model.grByStrat, 0).toFixed(0)} API`]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, padding: '2px 0' }}><span style={{ color: 'var(--muted)' }}>{k}</span><span className="mono" style={{ color: 'var(--text)' }}>{v}</span></div>
          ))}
        </InspectorSection>
      </Inspector>
    </div>
  );
}
