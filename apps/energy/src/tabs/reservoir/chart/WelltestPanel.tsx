// WelltestPanel — the well-test chart (GeaVision `_dWelltest` template), rebuilt as an
// INTERACTIVE dual-axis SVG (was static canvas): left Y = rate (liquid + oil), right Y =
// water cut %, X = month; animated line draw-in, a snapped crosshair tooltip (ym · oil ·
// liquid · WCT · GOR), and optional event pins. Volve has no discrete build-up tests, so
// this runs on monthly-allocated rates (badged a proxy upstream). d3-scale + d3-shape.
import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveMonotoneX } from 'd3-shape';
import { cssVar } from '../../fielddev/hooks';
import type { RMWellSeries } from '../data';

export interface WtEvent { i: number; label: string; color?: string }
const PAD = { l: 48, r: 46, t: 14, b: 28 };

export function WelltestPanel({ w, events = [], height }: { w: RMWellSeries; events?: WtEvent[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hi, setHi] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { const wrap = wrapRef.current; if (!wrap) return; const ro = new ResizeObserver(() => setSize({ w: wrap.clientWidth, h: wrap.clientHeight })); ro.observe(wrap); setSize({ w: wrap.clientWidth, h: wrap.clientHeight }); return () => ro.disconnect(); }, []);
  useEffect(() => { setDrawn(false); const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true))); return () => cancelAnimationFrame(id); }, [w, size.w]);

  const m = useMemo(() => {
    const n = w.oilRate.length; const iw = size.w - PAD.l - PAD.r, ih = size.h - PAD.t - PAD.b;
    if (iw < 30 || ih < 30 || !n) return null;
    const maxRate = Math.max(1, ...w.liqRate);
    const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([PAD.l, PAD.l + iw]);
    const yR = scaleLinear().domain([0, maxRate]).range([PAD.t + ih, PAD.t]).nice();
    const yW = scaleLinear().domain([0, 100]).range([PAD.t + ih, PAD.t]);
    const mk = (arr: number[], sy: (v: number) => number) => d3line<number>().x((_, i) => x(i)).y((d) => sy(d)).curve(curveMonotoneX)(arr) || '';
    return { n, iw, ih, x, yR, yW, maxRate, liqPath: mk(w.liqRate, yR), oilPath: mk(w.oilRate, yR), wctPath: mk(w.wct, yW) };
  }, [w, size]);

  const line = cssVar('--line'), muted = cssVar('--muted');
  const liqC = cssVar('--violet'), oilC = cssVar('--green'), wctC = cssVar('--blue');
  const drawStyle = (d: number) => reduce ? undefined : { strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: `stroke-dashoffset .7s ease ${d}s` } as React.CSSProperties;

  function onMove(e: React.PointerEvent) { if (!m || !svgRef.current) return; const r = svgRef.current.getBoundingClientRect(); const i = Math.round(m.x.invert(e.clientX - r.left)); setHi(i >= 0 && i < m.n ? i : null); }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: height ?? '100%', minHeight: 240 }}>
      {m && (
        <svg ref={svgRef} width={size.w} height={size.h} style={{ display: 'block', position: 'absolute', inset: 0, cursor: 'crosshair' }} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
          <rect x={PAD.l} y={PAD.t} width={m.iw} height={m.ih} fill="none" stroke={line} strokeWidth={1} />
          {m.yR.ticks(4).map((v, i) => <g key={'r' + i}><line x1={PAD.l} y1={m.yR(v)} x2={PAD.l + m.iw} y2={m.yR(v)} stroke={line} strokeDasharray="2 4" opacity={0.3} /><text x={PAD.l - 6} y={m.yR(v) + 3} textAnchor="end" fontSize={9} fill={muted} fontFamily="var(--mono)">{v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}</text></g>)}
          {[0, 25, 50, 75, 100].map((p) => <text key={p} x={size.w - PAD.r + 5} y={m.yW(p) + 3} fontSize={9} fill={muted} fontFamily="var(--mono)">{p}%</text>)}
          {/* event pins */}
          {events.map((e, k) => { const xx = m.x(e.i); return <g key={k}><line x1={xx} y1={PAD.t} x2={xx} y2={PAD.t + m.ih} stroke={e.color || muted} strokeDasharray="3 3" opacity={0.55} /><path d={`M${xx},${PAD.t} l-4,-6 l8,0 z`} fill={e.color || muted} /></g>; })}
          {/* lines */}
          <path d={m.liqPath} fill="none" stroke={liqC} strokeWidth={1.7} pathLength={reduce ? undefined : 1} style={drawStyle(0)} strokeLinejoin="round" />
          <path d={m.oilPath} fill="none" stroke={oilC} strokeWidth={1.7} pathLength={reduce ? undefined : 1} style={drawStyle(0.08)} strokeLinejoin="round" />
          <path d={m.wctPath} fill="none" stroke={wctC} strokeWidth={1.5} pathLength={reduce ? undefined : 1} style={drawStyle(0.16)} strokeLinejoin="round" />
          {/* hover */}
          {hi != null && (<>
            <line x1={m.x(hi)} y1={PAD.t} x2={m.x(hi)} y2={PAD.t + m.ih} stroke={muted} strokeWidth={1} opacity={0.45} />
            <circle cx={m.x(hi)} cy={m.yR(w.liqRate[hi])} r={3.2} fill={cssVar('--panel')} stroke={liqC} strokeWidth={2} />
            <circle cx={m.x(hi)} cy={m.yR(w.oilRate[hi])} r={3.2} fill={cssVar('--panel')} stroke={oilC} strokeWidth={2} />
            <circle cx={m.x(hi)} cy={m.yW(w.wct[hi])} r={3.2} fill={cssVar('--panel')} stroke={wctC} strokeWidth={2} />
          </>)}
          {/* legend */}
          {([['Liquid', liqC], ['Oil', oilC], ['WC%', wctC]] as const).map(([lab, col], k) => <g key={lab} transform={`translate(${PAD.l + 6 + k * 60}, ${size.h - 8})`}><rect x={0} y={-4} width={11} height={3.5} rx={2} fill={col} /><text x={15} y={-1} fontSize={9} fill={muted} fontFamily="var(--mono)">{lab}</text></g>)}
        </svg>
      )}
      {m && hi != null && (
        <div className="mono" style={{ position: 'absolute', left: Math.min(m.x(hi) + 12, size.w - 140), top: PAD.t + 4, fontSize: 10.5, background: 'color-mix(in srgb, var(--panel) 94%, transparent)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.16)' }}>
          <div style={{ color: 'var(--muted)', marginBottom: 3 }}>{w.ym[hi]}</div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: oilC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>oil</span><span style={{ color: 'var(--text)' }}>{Math.round(w.oilRate[hi]).toLocaleString()} bopd</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: liqC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>liquid</span><span style={{ color: 'var(--text)' }}>{Math.round(w.liqRate[hi]).toLocaleString()} bld</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: wctC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>WCT</span><span style={{ color: 'var(--text)' }}>{w.wct[hi].toFixed(0)}%</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--muted)', flex: 1 }}>GOR</span><span style={{ color: 'var(--text)' }}>{Math.round(w.gor[hi]).toLocaleString()}</span></div>
        </div>
      )}
      {!m && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 11 }}>no data</div>}
    </div>
  );
}
