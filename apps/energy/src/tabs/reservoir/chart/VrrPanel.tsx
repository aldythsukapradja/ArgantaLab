// VrrPanel — the VRR chart (GeaVision `_dVRR` template), rebuilt as an INTERACTIVE SVG
// (was static canvas): a mirrored stacked-bar + line combo — production voidage bars
// ABOVE the zero line (oil/water, reservoir volumes), injection voidage BELOW, a
// cumulative VRR% line over the production half (0–200%), a dashed VRR=100% target, an
// animated draw-in, and a snapped hover tooltip (ym · voidage split · VRR%). VRR is
// computed from real Sm³ via engine FVFs (Bo·oil + Bw·water) — the honest, Volve-correct
// version. d3-scale + d3-shape; React owns the DOM.
import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveMonotoneX } from 'd3-shape';
import { cssVar } from '../../fielddev/hooks';
import type { ProdMonth } from '../../../wb/types';
import { VOIDAGE_DEFAULT, voidageProduced, voidageInjected, cumulativeVrr, type Voidage } from '../../../engine/surveillance';

const PAD = { l: 48, r: 46, t: 14, b: 28 };

export function VrrPanel({ months, v = VOIDAGE_DEFAULT, height }: { months: ProdMonth[]; v?: Voidage; height?: number }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hi, setHi] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { const wrap = wrapRef.current; if (!wrap) return; const ro = new ResizeObserver(() => setSize({ w: wrap.clientWidth, h: wrap.clientHeight })); ro.observe(wrap); setSize({ w: wrap.clientWidth, h: wrap.clientHeight }); return () => ro.disconnect(); }, []);
  useEffect(() => { setDrawn(false); const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true))); return () => cancelAnimationFrame(id); }, [months, size.w]);

  const m = useMemo(() => {
    const iw = size.w - PAD.l - PAD.r, ih = size.h - PAD.t - PAD.b;
    if (iw < 30 || ih < 30 || !months.length) return null;
    const prod = months.map((mm) => voidageProduced({ oil: mm.oil, water: mm.water, wi: 0 }, v));
    const inj = months.map((mm) => voidageInjected({ oil: 0, water: 0, wi: mm.wi }, v));
    const oilV = months.map((mm) => v.Bo * mm.oil), watV = months.map((mm) => v.Bw * mm.water);
    const maxVol = Math.max(1, ...prod, ...inj);
    const zeroY = PAD.t + ih / 2, halfH = ih / 2;
    const bw = iw / months.length;
    const xAt = (i: number) => PAD.l + i * bw;
    const volPx = (vol: number) => (vol / maxVol) * halfH;
    const { cum } = cumulativeVrr(months.map((mm) => ({ oil: mm.oil, water: mm.water, wi: mm.wi })), v);
    const vrrToY = (pct: number) => zeroY - (Math.min(200, pct) / 200) * halfH;
    const vrrScale = scaleLinear();
    return { iw, ih, prod, inj, oilV, watV, maxVol, zeroY, halfH, bw, xAt, volPx, cum, vrrToY, vrrScale };
  }, [months, size, v]);

  const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');
  const oilC = cssVar('--green'), watC = cssVar('--blue'), wiC = cssVar('--cblue') || '#26c6da', tgt = cssVar('--orange');

  const vrrLine = useMemo(() => m ? (d3line<number>().x((_, i) => m.xAt(i) + m.bw / 2).y((d) => m.vrrToY(d * 100)).curve(curveMonotoneX)(m.cum) || '') : '', [m]);

  function onMove(e: React.PointerEvent) {
    if (!m || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - PAD.l) / m.bw);
    setHi(i >= 0 && i < months.length ? i : null);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: height ?? '100%', minHeight: 240 }}>
      {m && (
        <svg ref={svgRef} width={size.w} height={size.h} style={{ display: 'block', position: 'absolute', inset: 0, cursor: 'crosshair' }}
          onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
          {/* frame + zero line */}
          <rect x={PAD.l} y={PAD.t} width={m.iw} height={m.ih} fill="none" stroke={line} strokeWidth={1} />
          <line x1={PAD.l} y1={m.zeroY} x2={size.w - PAD.r} y2={m.zeroY} stroke={line} strokeWidth={1.2} />
          {/* VRR gridlines (right) */}
          {[0, 50, 100, 150, 200].map((p) => <line key={p} x1={PAD.l} y1={m.vrrToY(p)} x2={size.w - PAD.r} y2={m.vrrToY(p)} stroke={line} strokeDasharray="2 4" opacity={0.25} />)}
          {/* bars */}
          {months.map((_, i) => {
            const x = m.xAt(i) + 0.5, w = Math.max(0.6, m.bw - 0.7);
            const ho = m.volPx(m.oilV[i]), hw = m.volPx(m.watV[i]), hj = m.volPx(m.inj[i]);
            const on = hi === i, op = hi == null || on ? 1 : 0.55;
            const sc = drawn || reduce ? 1 : 0;
            return (
              <g key={i} opacity={op} style={{ transition: 'opacity .15s' }}>
                <g style={{ transform: `scaleY(${sc})`, transformOrigin: `0 ${m.zeroY}px`, transformBox: 'view-box', transition: reduce ? undefined : `transform .6s cubic-bezier(.4,0,.2,1) ${Math.min(i * 0.004, 0.5)}s` }}>
                  <rect x={x} y={m.zeroY - ho} width={w} height={ho} fill={oilC} />
                  <rect x={x} y={m.zeroY - ho - hw} width={w} height={hw} fill={watC} />
                  <rect x={x} y={m.zeroY} width={w} height={hj} fill={wiC} />
                </g>
              </g>
            );
          })}
          {/* VRR target 100% dashed */}
          <line x1={PAD.l} y1={m.vrrToY(100)} x2={size.w - PAD.r} y2={m.vrrToY(100)} stroke={tgt} strokeWidth={1.3} strokeDasharray="5 3" opacity={0.7} />
          <text x={size.w - PAD.r - 3} y={m.vrrToY(100) - 4} textAnchor="end" fontSize={9} fill={tgt} fontFamily="var(--mono)">VRR 100%</text>
          {/* VRR line (animated draw-in) */}
          <path d={vrrLine} fill="none" stroke={text} strokeWidth={1.9} strokeLinejoin="round" pathLength={reduce ? undefined : 1}
            style={reduce ? undefined : { strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: 'stroke-dashoffset .8s ease' }} />
          {/* right VRR axis ticks */}
          {[0, 50, 100, 150, 200].map((p) => <text key={p} x={size.w - PAD.r + 5} y={m.vrrToY(p) + 3} fontSize={9} fill={muted} fontFamily="var(--mono)">{p}%</text>)}
          {/* left labels */}
          <text x={PAD.l - 6} y={PAD.t + m.halfH / 2} textAnchor="end" fontSize={9} fill={muted} fontFamily="var(--mono)">prod</text>
          <text x={PAD.l - 6} y={m.zeroY + m.halfH / 2} textAnchor="end" fontSize={9} fill={muted} fontFamily="var(--mono)">inj</text>
          {/* x axis endpoints */}
          <text x={PAD.l + 2} y={size.h - 8} fontSize={9} fill={muted} fontFamily="var(--mono)">{months[0].ym}</text>
          <text x={size.w - PAD.r} y={size.h - 8} textAnchor="end" fontSize={9} fill={muted} fontFamily="var(--mono)">{months[months.length - 1].ym}</text>
          {/* hover crosshair + dot */}
          {hi != null && (<>
            <line x1={m.xAt(hi) + m.bw / 2} y1={PAD.t} x2={m.xAt(hi) + m.bw / 2} y2={PAD.t + m.ih} stroke={muted} strokeWidth={1} opacity={0.4} />
            <circle cx={m.xAt(hi) + m.bw / 2} cy={m.vrrToY(m.cum[hi] * 100)} r={3.4} fill={cssVar('--panel')} stroke={text} strokeWidth={2} />
          </>)}
        </svg>
      )}
      {/* tooltip */}
      {m && hi != null && (
        <div className="mono" style={{ position: 'absolute', left: Math.min(m.xAt(hi) + 14, size.w - 150), top: PAD.t + 4,
          fontSize: 10.5, background: 'color-mix(in srgb, var(--panel) 94%, transparent)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.16)' }}>
          <div style={{ color: 'var(--muted)', marginBottom: 3 }}>{months[hi].ym}</div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: oilC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>oil</span><span style={{ color: 'var(--text)' }}>{(m.oilV[hi] / 1e3).toFixed(1)}k rm³</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: watC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>water</span><span style={{ color: 'var(--text)' }}>{(m.watV[hi] / 1e3).toFixed(1)}k</span></div>
          <div style={{ display: 'flex', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: wiC }} /><span style={{ color: 'var(--muted)', flex: 1 }}>inj</span><span style={{ color: 'var(--text)' }}>{(m.inj[hi] / 1e3).toFixed(1)}k</span></div>
          <div style={{ marginTop: 3, color: tgt }}>VRR {(m.cum[hi] * 100).toFixed(0)}%</div>
        </div>
      )}
      {!m && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 11 }}>no data</div>}
    </div>
  );
}
