import { useEffect, useId, useRef, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape'
import { useMeasure, useTooltip, TooltipLayer, roundedTopBar } from './chartkit'
import { compact } from '../../lib/format'

/** Measure a container's width AND height (ResizeObserver). Used where the
 * viewBox must equal the real rendered box 1:1 — any mismatch, combined with
 * a CSS-forced height, stretches circular markers into ellipses. */
function useMeasureBox<T extends HTMLElement>(): [React.RefObject<T>, number, number] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) })
    })
    ro.observe(el)
    let tries = 0
    let timer = 0
    const measure = () => {
      const box = el.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) { setSize({ w: Math.round(box.width), h: Math.round(box.height) }); return }
      if (tries++ < 20) timer = window.setTimeout(measure, 60)
    }
    measure()
    return () => { ro.disconnect(); window.clearTimeout(timer) }
  }, [])
  return [ref, size.w, size.h]
}

// ── Mission-Control micro marks ─────────────────────────────────────────────
// Small, dense D3 pieces the one-page Portfolio is built from: a benchmark
// meter (funnel rail), a vertical histogram (power-user curve) and a bare
// sparkline (fleet matrix header). Same mark specs as the big charts.

/** Funnel meter: value bar + benchmark tick. Fill ≤12px, rounded data-end. */
export function Meter({ pct, tick, color }: { pct: number; tick?: number | null; color: string }) {
  const w = Math.max(2, Math.min(100, pct))
  return (
    <span style={{ position: 'relative', display: 'block', height: 12, borderRadius: 6, background: 'var(--bg3)', minWidth: 0 }}>
      <i style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: `${w}%`,
        borderRadius: '6px 4px 4px 6px', background: color, transition: 'width .4s var(--ease)',
      }} />
      {tick != null && (
        <u style={{ position: 'absolute', top: -3, bottom: -3, left: `${Math.min(100, tick)}%`, width: 2, background: 'var(--tx3)', opacity: 0.8 }} />
      )}
    </span>
  )
}

/** Vertical histogram — the a16z power-user curve. Bars ≤24px, rounded tops. */
export function VCols({ values, height = 92, labelEvery = 6, valueFmt = compact, ariaLabel = 'Histogram' }: {
  values: { label: string; value: number }[]
  height?: number
  labelEvery?: number
  valueFmt?: (v: number) => string
  ariaLabel?: string
}) {
  const [wrapRef, width] = useMeasure<HTMLDivElement>()
  const { wrapRef: tipWrap, tip, show, hide } = useTooltip()
  if (!values.length) return null
  const W = Math.max(220, width)
  const H = height
  const padB = 14
  const n = values.length
  const gap = 3
  const bw = Math.min(24, (W - (n - 1) * gap) / n)
  const y = scaleLinear().domain([0, Math.max(1, ...values.map(v => v.value))]).range([0, H - padB - 4])

  return (
    <div ref={wrapRef}>
      <div ref={tipWrap} style={{ position: 'relative' }}>
        {width > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label={ariaLabel}>
            <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="var(--bd)" strokeWidth={1} />
            {values.map((v, i) => {
              const h = Math.max(v.value > 0 ? 2 : 0, y(v.value))
              const x = i * (bw + gap)
              return (
                <g key={v.label}
                  onPointerMove={(e) => show(e, <span><b style={{ color: 'var(--tx)' }}>{valueFmt(v.value)}</b><span style={{ color: 'var(--tx3)' }}> · {v.label}</span></span>)}
                  onPointerLeave={hide}>
                  <rect x={x} y={0} width={bw + gap} height={H - padB} fill="transparent" />
                  {h > 0 && <path d={roundedTopBar(x, H - padB - h, bw, h, 3)} fill="var(--ch1)" opacity={0.45 + 0.55 * (i / Math.max(1, n - 1))} />}
                  {(i % labelEvery === 0 || i === n - 1) && (
                    <text x={x + bw / 2} y={H - 3} fontSize={8.5} fill="var(--tx3)" textAnchor="middle">{v.label}</text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
        <TooltipLayer tip={tip} />
      </div>
    </div>
  )
}

/** Bare sparkline — no axes, no hooks beyond measure; for matrix headers. */
export function Spark({ values, color, height = 22 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />
  const W = 120, H = height
  const max = Math.max(1, ...values)
  const x = (i: number) => (i * (W - 8)) / (values.length - 1) + 4
  const y = (v: number) => 3 + (1 - v / max) * (H - 8)
  const path = d3line<number>().x((_, i) => x(i)).y(v => y(v)).curve(curveMonotoneX)(values) ?? ''
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.6} fill={color} stroke="var(--bg)" strokeWidth={1.5} />
    </svg>
  )
}

/** Gradient-filled sparkline with a glowing end marker and a draw-in animation —
 * the fleet-card mark. Same footprint as Spark, richer treatment. */
export function SparkArea({ values, color, height = 34 }: { values: number[]; color: string; height?: number }) {
  const uid = useId().replace(/[:]/g, '')
  const [wrapRef, measuredW, measuredH] = useMeasureBox<HTMLDivElement>()
  const pathRef = useRef<SVGPathElement>(null)
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { setDrawn(false); const t = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(t) }, [values.join(',')])

  if (values.length < 2) return <div ref={wrapRef} style={{ height }} />
  // Viewbox tracks the real measured box 1:1 (width AND height) so x/y scale
  // uniformly — a viewBox that doesn't match the CSS-forced render size
  // squashed the end-marker circle into an ellipse.
  const W = Math.max(60, measuredW || 120), H = Math.max(16, measuredH || height)
  const max = Math.max(1, ...values)
  const x = (i: number) => (i * (W - 8)) / (values.length - 1) + 4
  const y = (v: number) => 3 + (1 - v / max) * (H - 8)
  const line = d3line<number>().x((_, i) => x(i)).y(v => y(v)).curve(curveMonotoneX)(values) ?? ''
  const area = d3area<number>().x((_, i) => x(i)).y0(H).y1(v => y(v)).curve(curveMonotoneX)(values) ?? ''
  const len = pathRef.current?.getTotalLength() ?? W
  const lastX = x(values.length - 1)
  const lastY = y(values[values.length - 1])

  return (
    <div ref={wrapRef}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.38} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`spark-line-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
        <filter id={`spark-glow-${uid}`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
        </filter>
      </defs>
      <path d={area} fill={`url(#spark-fill-${uid})`} />
      <path
        ref={pathRef}
        d={line}
        fill="none"
        stroke={`url(#spark-line-${uid})`}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={drawn ? 0 : len}
        style={{ transition: 'stroke-dashoffset .6s var(--ease, ease-out)' }}
      />
      <circle cx={lastX} cy={lastY} r={5} fill={color} opacity={0.5} filter={`url(#spark-glow-${uid})`} />
      <circle cx={lastX} cy={lastY} r={2.8} fill={color} stroke="var(--bg)" strokeWidth={1.5} />
    </svg>
    </div>
  )
}
