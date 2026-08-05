// The pieces every Exploration chart is made of. Six files' worth of shared
// behaviour in one module, because what makes nine tabs read as ONE product is
// that they hover the same way, degrade the same way and label the same way.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Table2, TriangleAlert } from 'lucide-react';

/** The measured plot box.
 *
 *  Charts used to measure the whole widget and then subtract a guessed constant
 *  for the legend and note ("size.h - 74"). Every one of those guesses was wrong
 *  at some breakpoint, which is what produced the squashed and overlapping
 *  panels: when the guess exceeded the real height the SVG got a negative box.
 *
 *  Now the plot measures ITSELF. It is the flex child that takes the leftover
 *  space, so `size` is exactly the drawable area — no arithmetic, nothing to get
 *  wrong, and the legend/note below can grow without stealing from the chart. */
export function Plot({ children, minHeight = 150 }: {
  children: (size: { w: number; h: number }) => ReactNode; minHeight?: number;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <div className="viz-plot" ref={ref} style={{ minHeight }}>
      {size.w > 8 && size.h > 8 ? children(size) : null}
    </div>
  );
}

/** Measure a container so every SVG is fluid. No fixed chart widths anywhere —
 *  this is what makes the canvas responsive rather than merely scaled.
 *
 *  The first measurement is taken synchronously in a layout effect, NOT left to
 *  the ResizeObserver. A chart that only draws once RO fires draws nothing at all
 *  wherever RO is throttled — a background tab, a hidden pane, a headless run —
 *  and a blank panel is a worse failure than a slightly stale one. RO then keeps
 *  it honest on every subsequent resize. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (width: number, height: number) => setSize((prev) => (
      Math.abs(prev.w - width) > 1 || Math.abs(prev.h - height) > 1 ? { w: width, h: height } : prev));

    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      apply(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}

/** Provenance textures. A chart can be blue AND recalled at once, so provenance
 *  gets the texture channel and series identity keeps the hue channel. */
export function VizDefs() {
  return (
    <defs>
      <pattern id="viz-recalled" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="currentColor" opacity="0.22" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2.4" />
      </pattern>
      <pattern id="viz-user" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
        <rect width="6" height="6" fill="currentColor" opacity="0.14" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
      </pattern>
    </defs>
  );
}

/** The one tooltip. Four fields everywhere — value, unit, n, provenance — so the
 *  user learns it once and it works on all 27 widgets. */
export interface TipData { x: number; y: number; title: string; rows: [string, string][]; grade?: string }

export function Tip({ tip, host }: { tip: TipData | null; host: { w: number; h: number } }) {
  if (!tip) return null;
  const flipX = tip.x > host.w - 190;
  const flipY = tip.y > host.h - 110;
  return (
    <div
      className="viz-tip"
      style={{ left: flipX ? tip.x - 178 : tip.x + 12, top: flipY ? tip.y - 14 - 90 : tip.y + 12 }}
      role="tooltip"
    >
      <b>{tip.title}</b>
      {tip.rows.map(([k, v]) => <span key={k}><i>{k}</i>{v}</span>)}
      {tip.grade && <em className={`viz-tip-grade ${tip.grade.toLowerCase()}`}>{tip.grade}</em>}
    </div>
  );
}

/** The degrade gate. A thin record IS the finding — never a blank panel, and
 *  never a chart drawn from three points pretending to be a trend. */
export function Degrade({ n, need, what, children, alt }: {
  n: number; need: number; what: string; children: ReactNode; alt?: ReactNode;
}) {
  if (n >= need) return <>{children}</>;
  return (
    <div className="viz-degrade">
      <TriangleAlert size={16} />
      <b>{n === 0 ? `No ${what} in scope` : `Only ${n} ${what}`}</b>
      <p>{need} are needed before this reads as a trend rather than noise. That thinness is the finding, not a rendering failure.</p>
      {alt}
    </div>
  );
}

/** Every chart ships a table view: it is the relief for the light-mode contrast
 *  warning, the export path and the screen-reader path, all in one toggle. */
export function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      className={'exc-icon-btn' + (open ? ' on' : '')}
      onClick={onToggle}
      aria-pressed={open}
      title="Table view — every chart has one"
      aria-label="Table view"
    ><Table2 size={12} /></button>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="viz-table">
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{typeof c === 'number' ? c.toLocaleString(undefined, { maximumFractionDigits: 2 }) : c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

/** Recessive axis furniture. Hairline grid, horizontal only, muted ink. */
export function AxisY({ ticks, x, w, fmt }: { ticks: { v: number; y: number }[]; x: number; w: number; fmt: (v: number) => string }) {
  return (
    <g className="viz-axis">
      {ticks.map((t) => (
        <g key={t.v} transform={`translate(0,${t.y})`}>
          <line x1={x} x2={x + w} className="viz-grid" />
          <text x={x - 5} dy="0.32em" textAnchor="end">{fmt(t.v)}</text>
        </g>
      ))}
    </g>
  );
}

export function AxisX({ ticks, y, fmt }: { ticks: { v: number; x: number }[]; y: number; fmt: (v: number) => string }) {
  return (
    <g className="viz-axis">
      {ticks.map((t) => (
        <text key={t.v} x={t.x} y={y + 12} textAnchor="middle">{fmt(t.v)}</text>
      ))}
    </g>
  );
}

/** Legend. Present whenever there are ≥2 series; identity is never colour alone,
 *  so the swatch always sits beside a name. */
export function Legend({ items }: { items: { label: string; color: string; pattern?: 'recalled' | 'user' }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="viz-legend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={{ background: i.pattern
            ? `repeating-linear-gradient(${i.pattern === 'recalled' ? 45 : 135}deg, ${i.color} 0 2px, transparent 2px 4px)`
            : i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return <div className="viz-loading"><i /><span>Reading {what}…</span></div>;
}
