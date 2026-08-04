// WellCountPanel — the Reservoir Management VRR chart, re-aimed at development.
//
// Same grammar as reservoir/chart/VrrPanel (mirrored voidage bars, production
// above the zero line, injection below, animated draw-in, snapped hover): a user
// moving between the two tabs reads the same picture. Only the RIGHT-HAND SERIES
// changes — VRR% becomes the ACTIVE WELL COUNT.
//
// Why the swap. VRR asks "am I replacing the voidage I take out?", which is a
// surveillance question. Development asks "did the rate fall because the
// reservoir declined, or because I lost wells?" — and the bars alone cannot
// answer that. With the count overlaid: bars falling while the line holds is
// decline; both falling together is well availability. Two very different
// problems, and the chart now distinguishes them.
//
// d3-scale + d3-shape for the maths; React owns the DOM.
import { useEffect, useMemo, useRef, useState } from 'react';
import { line as d3line, area as d3area, curveStepAfter, curveMonotoneX } from 'd3-shape';
import { cssVar } from './hooks';
import type { ProdMonth } from '../../wb/types';
import { VOIDAGE_DEFAULT, voidageProduced, voidageInjected, type Voidage } from '../../engine/surveillance';
import { buildActivity, type WellSeries } from './well-activity';
import { buildFlow } from './flow-series';

const PAD = { l: 46, r: 42, t: 14, b: 26 };

export function WellCountPanel({ months, wells, v = VOIDAGE_DEFAULT, height, rs = null }: {
  months: ProdMonth[];
  /** per-well series — the count is derived from these, never assumed */
  wells: WellSeries[];
  v?: Voidage;
  height?: number;
  /** solution GOR from the field's own PVT, used to split produced gas into the
   *  part already inside the oil voidage and the part that is a separate
   *  reservoir volume. Null when the bundle publishes none — then no gas is
   *  claimed as free, and the chart says the split could not be made. */
  rs?: number | null;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hi, setHi] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const ro = new ResizeObserver(() => setSize({ w: wrap.clientWidth, h: wrap.clientHeight }));
    ro.observe(wrap); setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setDrawn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [months, size.w]);

  const act = useMemo(() => buildActivity(months.map((m) => m.ym), wells), [months, wells]);
  const flow = useMemo(
    () => buildFlow(months as unknown as Parameters<typeof buildFlow>[0], rs, v),
    [months, rs, v],
  );

  const m = useMemo(() => {
    const iw = size.w - PAD.l - PAD.r, ih = size.h - PAD.t - PAD.b;
    if (iw < 30 || ih < 30 || !months.length) return null;
    const prod = flow.points.map((p) => voidageProduced(
      { oil: p.oil, water: p.water, wi: 0, gasFree: p.freeGas }, v,
    ));
    const inj = months.map((mm) => voidageInjected({ oil: 0, water: 0, wi: mm.wi }, v));
    const oilV = flow.points.map((p) => p.oilV);
    const gasV = flow.points.map((p) => p.freeGasV);
    const watV = flow.points.map((p) => p.waterV);
    const maxVol = Math.max(1, ...prod, ...inj);
    const zeroY = PAD.t + ih / 2, halfH = ih / 2;
    const bw = iw / months.length;
    const xAt = (i: number) => PAD.l + i * bw;
    const volPx = (vol: number) => (vol / maxVol) * halfH;
    // the count axis shares the production half, so the line rides above the bars
    // it explains. Rounded up to a sensible tick so the top is never a bare max.
    const wMax = Math.max(4, Math.ceil(act.maxWells / 2) * 2);
    const nToY = (n: number) => zeroY - (Math.min(wMax, n) / wMax) * halfH;
    // Gas rides the production half on its OWN scale. It has to: gas is a surface
    // volume in Sm³ and the bars are reservoir volumes in rm³, so there is no
    // shared axis they could honestly share. Drawn as a line rather than a bar
    // segment for the same reason — a stacked segment would imply it adds to the
    // voidage beneath it, and 98% of it does not.
    const gMax = Math.max(1, flow.maxGas);
    const gToY = (g: number) => zeroY - (g / gMax) * halfH;
    return { iw, ih, prod, inj, oilV, gasV, watV, maxVol, zeroY, halfH, bw, xAt, volPx, wMax, nToY, gMax, gToY };
  }, [months, size, v, act.maxWells, flow]);

  const line = cssVar('--line'), muted = cssVar('--muted');
  // NB cssVar() falls back to '#888' for an UNDEFINED token, never to '' — so
  // `cssVar('--x') || fallback` can never fire. `--cblue` is not defined in this
  // theme, so injection is given its colour literally rather than silently grey.
  const oilC = cssVar('--green'), watC = cssVar('--blue'), wiC = '#26c6da';
  // The count lines must not wear the same colours as the bars they sit on top of
  // — they are a different quantity on a different axis. Same reasoning as
  // VrrPanel drawing its VRR line in --text rather than a fluid colour.
  const prodLineC = cssVar('--text'), injLineC = cssVar('--orange');
  // gas gets the industry red, distinct from every other series on the chart
  const gasC = '#e0534d';

  // stepAfter, not a smooth curve: a well count is a step function — it changes on
  // the month a well comes on or goes down, and interpolating between two integers
  // would draw well-counts that never existed.
  const pLine = useMemo(() => (m
    ? d3line<number>().x((_, i) => m.xAt(i) + m.bw / 2).y((d) => m.nToY(d)).curve(curveStepAfter)(act.points.map((p) => p.producers)) || ''
    : ''), [m, act]);
  const iLine = useMemo(() => (m
    ? d3line<number>().x((_, i) => m.xAt(i) + m.bw / 2).y((d) => m.nToY(d)).curve(curveStepAfter)(act.points.map((p) => p.injectors)) || ''
    : ''), [m, act]);

  // Monotone, not stepped: a gas rate is a continuous measurement, unlike a well
  // count. Filled underneath so it reads as a rate envelope over the bars.
  const gLine = useMemo(() => (m
    ? d3line<number>().x((_, i) => m.xAt(i) + m.bw / 2).y((d) => m.gToY(d)).curve(curveMonotoneX)(flow.points.map((p) => p.gas)) || ''
    : ''), [m, flow]);
  const gArea = useMemo(() => (m
    ? d3area<number>().x((_, i) => m.xAt(i) + m.bw / 2).y0(m.zeroY).y1((d) => m.gToY(d)).curve(curveMonotoneX)(flow.points.map((p) => p.gas)) || ''
    : ''), [m, flow]);

  function onMove(e: React.PointerEvent) {
    if (!m || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - PAD.l) / m.bw);
    setHi(i >= 0 && i < months.length ? i : null);
  }

  const ticks = m ? [0, m.wMax / 2, m.wMax] : [];

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: height ?? '100%', minHeight: 200 }}>
      {m && (
        <svg ref={svgRef} width={size.w} height={size.h}
          style={{ display: 'block', position: 'absolute', inset: 0, cursor: 'crosshair' }}
          onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
          <rect x={PAD.l} y={PAD.t} width={m.iw} height={m.ih} fill="none" stroke={line} strokeWidth={1} />
          <line x1={PAD.l} y1={m.zeroY} x2={size.w - PAD.r} y2={m.zeroY} stroke={line} strokeWidth={1.2} />
          {ticks.map((t) => (
            <line key={t} x1={PAD.l} y1={m.nToY(t)} x2={size.w - PAD.r} y2={m.nToY(t)}
              stroke={line} strokeDasharray="2 4" opacity={0.25} />
          ))}

          {months.map((_, i) => {
            const x = m.xAt(i) + 0.5, w = Math.max(0.6, m.bw - 0.7);
            const ho = m.volPx(m.oilV[i]), hw = m.volPx(m.watV[i]), hj = m.volPx(m.inj[i]);
            const hg = m.volPx(m.gasV[i]);
            const on = hi === i, op = hi == null || on ? 1 : 0.55;
            const sc = drawn || reduce ? 1 : 0;
            return (
              <g key={i} opacity={op} style={{ transition: 'opacity .15s' }}>
                <g style={{
                  transform: `scaleY(${sc})`, transformOrigin: `0 ${m.zeroY}px`, transformBox: 'view-box',
                  transition: reduce ? undefined : `transform .6s cubic-bezier(.4,0,.2,1) ${Math.min(i * 0.004, 0.5)}s`,
                }}>
                  <rect x={x} y={m.zeroY - ho} width={w} height={ho} fill={oilC} />
                  {/* free gas sits ON oil, where it exists. Zero-height while the
                      field's voidage set carries no Bg, which is the honest answer
                      for an undersaturated reservoir rather than a padded bar. */}
                  {hg > 0.4 && <rect x={x} y={m.zeroY - ho - hg} width={w} height={hg} fill={gasC} />}
                  <rect x={x} y={m.zeroY - ho - hg - hw} width={w} height={hw} fill={watC} />
                  <rect x={x} y={m.zeroY} width={w} height={hj} fill={wiC} />
                </g>
              </g>
            );
          })}

          {/* gas rate, on its own scale over the production half */}
          <defs>
            <linearGradient id="fds-gasfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gasC} stopOpacity={0.34} />
              <stop offset="100%" stopColor={gasC} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={gArea} fill="url(#fds-gasfill)" stroke="none"
            style={reduce ? undefined : { opacity: drawn ? 1 : 0, transition: 'opacity .7s ease .2s' }} />
          <path d={gLine} fill="none" stroke={gasC} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round"
            style={reduce ? undefined : { strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: 'stroke-dashoffset .9s ease' }}
            pathLength={reduce ? undefined : 1} />

          <path d={pLine} fill="none" stroke={prodLineC} strokeWidth={1.9} strokeLinejoin="round"
            style={reduce ? undefined : { strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: 'stroke-dashoffset .8s ease' }}
            pathLength={reduce ? undefined : 1} />
          <path d={iLine} fill="none" stroke={injLineC} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" opacity={0.9} />

          {ticks.map((t) => (
            <text key={t} x={size.w - PAD.r + 5} y={m.nToY(t) + 3} fontSize={9} fill={muted} fontFamily="var(--mono)">{t}</text>
          ))}
          <text x={size.w - PAD.r + 5} y={PAD.t + 8} fontSize={8} fill={muted} fontFamily="var(--mono)">wells</text>
          <text x={PAD.l - 6} y={PAD.t + m.halfH / 2} textAnchor="end" fontSize={9} fill={muted} fontFamily="var(--mono)">prod</text>
          <text x={PAD.l - 6} y={m.zeroY + m.halfH / 2} textAnchor="end" fontSize={9} fill={muted} fontFamily="var(--mono)">inj</text>
          <text x={PAD.l + 2} y={size.h - 8} fontSize={9} fill={muted} fontFamily="var(--mono)">{months[0].ym}</text>
          <text x={size.w - PAD.r} y={size.h - 8} textAnchor="end" fontSize={9} fill={muted} fontFamily="var(--mono)">{months[months.length - 1].ym}</text>

          {hi != null && (
            <>
              <line x1={m.xAt(hi) + m.bw / 2} y1={PAD.t} x2={m.xAt(hi) + m.bw / 2} y2={PAD.t + m.ih}
                stroke={muted} strokeWidth={1} opacity={0.4} />
              <circle cx={m.xAt(hi) + m.bw / 2} cy={m.nToY(act.points[hi].producers)} r={3.2}
                fill={cssVar('--panel')} stroke={prodLineC} strokeWidth={2} />
              <circle cx={m.xAt(hi) + m.bw / 2} cy={m.gToY(flow.points[hi].gas)} r={3}
                fill={cssVar('--panel')} stroke={gasC} strokeWidth={2} />
            </>
          )}
        </svg>
      )}

      {m && hi != null && (
        <div className="mono" style={{
          position: 'absolute', left: Math.min(m.xAt(hi) + 14, size.w - 156), top: PAD.t + 4, fontSize: 10.5,
          background: 'color-mix(in srgb, var(--panel) 94%, transparent)', border: '1px solid var(--line)',
          borderRadius: 6, padding: '5px 8px', pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
        }}>
          <div style={{ color: 'var(--muted)', marginBottom: 3 }}>{months[hi].ym}</div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: oilC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>oil</span><span>{(m.oilV[hi] / 1e3).toFixed(1)}k rm³</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: watC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>water</span><span>{(m.watV[hi] / 1e3).toFixed(1)}k</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: wiC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>inj</span><span>{(m.inj[hi] / 1e3).toFixed(1)}k</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: gasC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>gas</span><span>{(flow.points[hi].gas / 1e6).toFixed(2)}M Sm³</span></div>
          {/* GOR against the field's own solution GOR is the reading that says
              whether this month made free gas at all. Null oil ⇒ no GOR, said so. */}
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8 }} /><span style={{ color: 'var(--muted)', flex: 1 }}>GOR</span><span>
            {flow.points[hi].gor == null ? 'no oil' : `${Math.round(flow.points[hi].gor)}${flow.rs ? ` / Rs ${flow.rs}` : ''}`}
          </span></div>
          <div style={{ marginTop: 3, color: 'var(--text)' }}>
            {act.points[hi].producers} producing · {act.points[hi].injectors} injecting
          </div>
        </div>
      )}

      {m && (
        <div className="fds-ad-flow-key">
          <span><i style={{ background: oilC }} />oil</span>
          <span><i style={{ background: gasC }} />gas
            {flow.solutionGasShare != null && (
              <em title={`Produced gas is split on the field's own solution GOR (Rs ${flow.rs}). Solution gas was dissolved in the oil in the reservoir and is already inside the oil voidage, so it is NOT stacked again; only free gas is.`}>
                {' '}({(flow.solutionGasShare * 100).toFixed(0)}% in solution)
              </em>
            )}
          </span>
          <span><i style={{ background: watC }} />water</span>
          <span><i style={{ background: wiC }} />injected</span>
          <span className="ln"><i style={{ background: prodLineC }} />active producers</span>
          <span className="ln"><i style={{ background: injLineC, opacity: 0.85 }} />active injectors</span>
          {act.peakProducers && (
            <em title="the month the field carried the most simultaneous producers">
              peak {act.peakProducers.n}P · {act.peakProducers.ym}
            </em>
          )}
        </div>
      )}
      {!m && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 11 }}>no data</div>}
    </div>
  );
}
