// SurveillanceCharts.ts — real D3 chart CLASSES for the Reservoir Management Surveillance
// Dossier, built in exactly the same idiom as ProductionChart.ts (1e): each owns an <svg>
// via d3-selection, builds it once with the D3 enter/update join, re-renders efficiently
// on .setData(), animates with d3-transition, and reads CSS custom properties at render
// time so light/dark themes just work. Framework-agnostic — the React wrappers
// (SurveillanceChartViews.tsx) are thin lifecycle shims that own none of the drawing.
import { select, pointer, type Selection } from 'd3-selection';
import { scaleLinear, scaleBand, type ScaleLinear, type ScaleBand } from 'd3-scale';
import { line, curveMonotoneX, arc, pie, type Line } from 'd3-shape';
import { axisBottom, axisLeft, axisRight } from 'd3-axis';

/** d3-array's `max`, inlined. Importing a whole package for one reduce added a
 *  late-discovered entry to Vite's dependency optimizer: because `d3-array` was reached
 *  ONLY from this lazily-loaded chart module, the optimizer never pre-bundled it and the
 *  request 504'd ("Outdated Optimize Dep"), which bricked the whole Reservoir Management
 *  surface. Fewer optimizer entries, fewer ways to fail. Returns undefined when nothing
 *  comparable is present, exactly like d3. */
function max<T>(arr: readonly T[], acc: (d: T) => number | null | undefined): number | undefined {
  let m: number | undefined;
  for (const d of arr) {
    const v = acc(d);
    if (v == null || Number.isNaN(v)) continue;
    if (m === undefined || v > m) m = v;
  }
  return m;
}
import 'd3-transition';

const cssVar = (el: Element, name: string, fallback: string) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
};
const fmtRate = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));

/** A d3 transition only lands on a rAF timer tick — so in a hidden, backgrounded or
 *  non-compositing tab even a zero-duration transition NEVER applies and every element
 *  stays frozen at its enter value (bars stuck at height 0, arcs with no `d`).
 *  Geometry must therefore be applied synchronously whenever we cannot animate. */
const canAnimate = () => typeof document === 'undefined' || document.visibilityState === 'visible';

// ══════════════════════════════════════════════════════════════════════════════
// 1 · VoidageChart — THE signature chart.
//     Production stacked bars (oil + water) rise from the baseline, injection bars
//     mirror below it, and the cumulative VRR rides over the production half on its
//     own right axis with a dashed 1.0 balance target. Shut-in months are hatched.
// ══════════════════════════════════════════════════════════════════════════════
export interface VoidagePoint {
  label: string;                 // e.g. "2011-04"
  oil: number; water: number;    // produced liquids, bbl/d
  gas: number;                   // produced gas, converted to boe/d (5.8 Mscf/boe)
  gasMscf: number;               // the same gas in its native Mscf/d, for the readout
  inj: number;                   // injected water, bbl/d
  vrr: number | null;            // cumulative VRR (dimensionless)
  live: boolean;                 // false = shut in
}
export interface VoidageEvent { id: string; label: string; index: number; note: string }
export interface VoidageOptions {
  margin?: { top: number; right: number; bottom: number; left: number };
  onPickEvent?: (id: string) => void;
  /** Axis captions. Units belong on the axis, never only in a legend. */
  xUnit?: string; yUnit?: string; y2Unit?: string;
}
/** Mscf → boe. The industry standard 5.8 Mscf per barrel of oil equivalent. */
export const MSCF_PER_BOE = 5.8;

export class VoidageChart {
  private root: HTMLElement;
  private m: { top: number; right: number; bottom: number; left: number };
  private onPickEvent: (id: string) => void;
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private gGrid: Selection<SVGGElement, unknown, null, undefined>;
  private gShut: Selection<SVGGElement, unknown, null, undefined>;
  private gBars: Selection<SVGGElement, unknown, null, undefined>;
  private gVrr: Selection<SVGGElement, unknown, null, undefined>;
  private gEvents: Selection<SVGGElement, unknown, null, undefined>;
  private gx: Selection<SVGGElement, unknown, null, undefined>;
  private gy: Selection<SVGGElement, unknown, null, undefined>;
  private gy2: Selection<SVGGElement, unknown, null, undefined>;
  private gLegend: Selection<SVGGElement, unknown, null, undefined>;
  private guide: Selection<SVGLineElement, unknown, null, undefined>;
  private focusDot: Selection<SVGCircleElement, unknown, null, undefined>;
  private brushRect: Selection<SVGRectElement, unknown, null, undefined>;
  private overlay: Selection<SVGRectElement, unknown, null, undefined>;
  private tip: Selection<HTMLDivElement, unknown, null, undefined>;
  private resetBtn: Selection<HTMLButtonElement, unknown, null, undefined>;
  private xTitle: Selection<SVGTextElement, unknown, null, undefined>;
  private yTitle: Selection<SVGTextElement, unknown, null, undefined>;
  private y2Title: Selection<SVGTextElement, unknown, null, undefined>;
  private hint: Selection<SVGTextElement, unknown, null, undefined>;
  private x: ScaleBand<string> = scaleBand();
  private y: ScaleLinear<number, number> = scaleLinear();
  private yv: ScaleLinear<number, number> = scaleLinear();
  private data: VoidagePoint[] = [];
  private events: VoidageEvent[] = [];
  private ro: ResizeObserver;
  private width = 0; private height = 0;
  private first = true;
  // ── interaction state ───────────────────────────────────────────────────────
  private hidden = new Set<string>();                 // legend toggles
  private zoom: [number, number] | null = null;       // index window into `data`
  private brushing: { x0: number; x1: number } | null = null;
  private units: { x: string; y: string; y2: string };

  constructor(root: HTMLElement, opts: VoidageOptions = {}) {
    this.root = root;
    this.m = opts.margin ?? { top: 26, right: 52, bottom: 44, left: 56 };
    this.onPickEvent = opts.onPickEvent ?? (() => {});
    this.units = { x: opts.xUnit ?? 'year', y: opts.yUnit ?? 'rate · boe/d', y2: opts.y2Unit ?? 'VRR (cum, —)' };
    select(root).style('position', 'relative');

    this.svg = select(root).append('svg').attr('width', '100%').attr('height', '100%')
      .style('display', 'block').style('overflow', 'visible') as Selection<SVGSVGElement, unknown, null, undefined>;

    const defs = this.svg.append('defs');
    const grad = (id: string, c: string, from: number, to: number) => {
      const g = defs.append('linearGradient').attr('id', id).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
      g.append('stop').attr('offset', '0%').attr('stop-color', c).attr('stop-opacity', from);
      g.append('stop').attr('offset', '100%').attr('stop-color', c).attr('stop-opacity', to);
    };
    grad('sv-oil', 'var(--green,#10b981)', 0.95, 0.5);
    grad('sv-water', 'var(--blue,#3b82f6)', 0.75, 0.35);
    grad('sv-gas', 'var(--red,#ef4444)', 0.85, 0.4);
    grad('sv-inj', 'var(--cblue,#22d3ee)', 0.7, 0.25);
    const hatch = defs.append('pattern').attr('id', 'sv-shut').attr('width', 6).attr('height', 6)
      .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    hatch.append('rect').attr('width', 6).attr('height', 6).attr('fill', 'transparent');
    hatch.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6)
      .attr('stroke', 'var(--ink3,#7f9299)').attr('stroke-width', 2).attr('stroke-opacity', 0.16);

    this.gGrid = this.svg.append('g').attr('class', 'sv-grid');
    this.gShut = this.svg.append('g').attr('class', 'sv-shut');
    this.gBars = this.svg.append('g').attr('class', 'sv-bars');
    this.gVrr = this.svg.append('g').attr('class', 'sv-vrr');
    this.guide = this.svg.append('line').attr('class', 'sv-guide').attr('opacity', 0).attr('stroke-dasharray', '2,2');
    this.focusDot = this.svg.append('circle').attr('class', 'sv-focus').attr('r', 3.8).attr('opacity', 0).attr('stroke-width', 2);
    this.brushRect = this.svg.append('rect').attr('class', 'sv-brush').attr('opacity', 0).attr('pointer-events', 'none');
    this.gx = this.svg.append('g').attr('class', 'sv-axis-x');
    this.gy = this.svg.append('g').attr('class', 'sv-axis-y');
    this.gy2 = this.svg.append('g').attr('class', 'sv-axis-y2');
    this.xTitle = this.svg.append('text').attr('class', 'sv-axis-title').attr('text-anchor', 'middle');
    this.yTitle = this.svg.append('text').attr('class', 'sv-axis-title').attr('text-anchor', 'middle');
    this.y2Title = this.svg.append('text').attr('class', 'sv-axis-title').attr('text-anchor', 'middle');
    this.gLegend = this.svg.append('g').attr('class', 'sv-legend');
    this.hint = this.svg.append('text').attr('class', 'sv-hint').attr('text-anchor', 'end');
    // The hover/brush surface sits UNDER the event pips (added after it) so pips stay
    // clickable — raising the overlay above them was what killed pip interaction.
    this.overlay = this.svg.append('rect').attr('fill', 'transparent').style('cursor', 'crosshair');
    this.gEvents = this.svg.append('g').attr('class', 'sv-events');

    this.tip = select(root).append('div').attr('class', 'sv-tip')
      .style('position', 'absolute').style('pointer-events', 'none').style('opacity', '0') as Selection<HTMLDivElement, unknown, null, undefined>;

    // Explicit reset — puts the chart back to its default view: full time range AND
    // every stream visible again (double-click only clears the zoom).
    this.resetBtn = select(root).append('button').attr('class', 'sv-reset')
      .attr('type', 'button').attr('title', 'Reset chart to the full range with all streams shown')
      .text('Reset') as Selection<HTMLButtonElement, unknown, null, undefined>;
    this.resetBtn.on('click', (ev: MouseEvent) => {
      ev.stopPropagation();
      this.reset();
    });

    this.overlay.on('pointermove', (ev: PointerEvent) => {
      if (this.brushing) { this.brushing.x1 = pointer(ev, this.svg.node()!)[0]; this.drawBrush(); this.clearHover(); }
      else this.hover(ev);
    });
    this.overlay.on('pointerleave', () => { this.clearHover(); });
    this.overlay.on('pointerdown', (ev: PointerEvent) => {
      const [px] = pointer(ev, this.svg.node()!);
      this.brushing = { x0: px, x1: px };
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    });
    this.overlay.on('pointerup', () => this.endBrush());
    // double-click anywhere resets the zoom
    select(root).on('dblclick', () => { if (this.zoom) { this.zoom = null; this.render(); } });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
  }

  setData(data: VoidagePoint[], events: VoidageEvent[] = []) {
    this.data = data; this.events = events; this.zoom = null; this.render();
  }

  /** The slice currently on screen (the whole series unless the user brushed a window). */
  private view(): VoidagePoint[] {
    return this.zoom ? this.data.slice(this.zoom[0], this.zoom[1] + 1) : this.data;
  }
  /** True when the user has changed anything away from the default view. */
  private dirty(): boolean { return this.zoom != null || this.hidden.size > 0; }
  /** Back to default: full time range, every stream visible. */
  reset() { this.zoom = null; this.hidden.clear(); this.clearHover(); this.render(); }
  private clearHover() { this.guide.attr('opacity', 0); this.focusDot.attr('opacity', 0); this.tip.style('opacity', '0'); }

  private drawBrush() {
    if (!this.brushing) return;
    const innerH = Math.max(1, this.height - this.m.top - this.m.bottom);
    const a = Math.min(this.brushing.x0, this.brushing.x1), b = Math.max(this.brushing.x0, this.brushing.x1);
    this.brushRect.attr('opacity', 1).attr('x', a).attr('y', this.m.top).attr('width', Math.max(0, b - a)).attr('height', innerH)
      .attr('fill', cssVar(this.root, '--purple', '#7c3aed')).attr('fill-opacity', 0.14)
      .attr('stroke', cssVar(this.root, '--purple', '#7c3aed')).attr('stroke-opacity', 0.45);
  }
  private endBrush() {
    const br = this.brushing;
    this.brushing = null;
    this.brushRect.attr('opacity', 0);
    if (!br || Math.abs(br.x1 - br.x0) < 10) return;      // a click, not a drag
    const v = this.view();
    const step = this.x.step() || 1;
    const idx = (px: number) => Math.max(0, Math.min(v.length - 1, Math.floor((px - this.m.left) / step)));
    const i0 = idx(Math.min(br.x0, br.x1)), i1 = idx(Math.max(br.x0, br.x1));
    if (i1 - i0 < 1) return;
    const base = this.zoom ? this.zoom[0] : 0;
    this.zoom = [base + i0, base + i1];
    this.render();
  }

  private hover(ev: PointerEvent) {
    const v = this.view();
    if (!v.length) return;
    const [px] = pointer(ev, this.svg.node()!);
    const step = this.x.step() || 1;
    const i = Math.max(0, Math.min(v.length - 1, Math.floor((px - this.m.left) / step)));
    const d = v[i];
    const cx = (this.x(d.label) ?? 0) + this.x.bandwidth() / 2;
    const innerH = Math.max(1, this.height - this.m.top - this.m.bottom);
    this.guide.attr('opacity', 1).attr('x1', cx).attr('x2', cx).attr('y1', this.m.top).attr('y2', this.m.top + innerH)
      .attr('stroke', cssVar(this.root, '--ink3', '#7f9299'));
    if (d.vrr != null && !this.hidden.has('VRR')) {
      this.focusDot.attr('opacity', 1).attr('cx', cx).attr('cy', this.yv(d.vrr))
        .attr('fill', cssVar(this.root, '--purple', '#7c3aed')).attr('stroke', cssVar(this.root, '--panel', '#0b1020'));
    } else this.focusDot.attr('opacity', 0);
    const row = (c: string, k: string, val: string) => `<i style="--c:${c}"></i>${k} <s>${val}</s>`;
    this.tip.style('opacity', '1')
      .style('left', `${Math.min(cx + 10, Math.max(4, this.width - 148))}px`).style('top', `${this.m.top + 2}px`)
      .html(
        `<b>${d.label}${d.live ? '' : ' · shut in'}</b>` +
        (this.hidden.has('oil') ? '' : row('var(--green,#10b981)', 'oil', `${fmtRate(d.oil)} bbl/d`)) +
        (this.hidden.has('water') ? '' : row('var(--blue,#3b82f6)', 'water', `${fmtRate(d.water)} bbl/d`)) +
        (this.hidden.has('gas') ? '' : row('var(--red,#ef4444)', 'gas', `${fmtRate(d.gasMscf)} Mscf/d`)) +
        (this.hidden.has('injection') ? '' : row('var(--cblue,#22d3ee)', 'inj', `${fmtRate(d.inj)} bbl/d`)) +
        (d.vrr != null && !this.hidden.has('VRR') ? row('var(--purple,#7c3aed)', 'VRR', d.vrr.toFixed(2)) : ''),
      );
  }

  private resize() {
    const r = this.root.getBoundingClientRect();
    this.width = Math.max(1, r.width); this.height = Math.max(1, r.height);
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this.render();
  }

  private render() {
    const m = this.m, el = this.root;
    const innerW = Math.max(1, this.width - m.left - m.right);
    const innerH = Math.max(1, this.height - m.top - m.bottom);
    const lineCol = cssVar(el, '--line', '#2a3a40');
    const mutedCol = cssVar(el, '--ink3', '#7f9299');
    const orange = cssVar(el, '--orange', '#f59e0b');
    const purple = cssVar(el, '--purple', '#7c3aed');
    const blue = cssVar(el, '--blue', '#3b82f6');
    const red = cssVar(el, '--red', '#ef4444');
    const cyan = cssVar(el, '--cblue', '#22d3ee');
    const v = this.view();
    if (!v.length) { this.gBars.selectAll('*').remove(); this.gVrr.selectAll('*').remove(); return; }

    const vis = (k: string) => !this.hidden.has(k);
    // stacked production top per point, counting only the visible streams
    const stackTop = (d: VoidagePoint) => (vis('oil') ? d.oil : 0) + (vis('water') ? d.water : 0) + (vis('gas') ? d.gas : 0);
    const maxProd = Math.max(max(v, stackTop) ?? 1, 1);
    const maxInj = Math.max(vis('injection') ? (max(v, (d) => d.inj) ?? 1) : 1, 1);
    const maxVrr = Math.max(1.6, Math.ceil((max(v, (d) => d.vrr ?? 0) ?? 1) * 10) / 10);

    this.x = scaleBand<string>().domain(v.map((d) => d.label)).range([m.left, m.left + innerW]).paddingInner(0.12);
    this.y = scaleLinear().domain([-maxInj * 1.08, maxProd * 1.08]).range([m.top + innerH, m.top]);
    const zero = this.y(0);
    this.yv = scaleLinear().domain([0, maxVrr]).range([zero, m.top]);

    // gridlines (the zero line reads heavier — it is the production/injection mirror)
    this.gGrid.selectAll<SVGLineElement, number>('line')
      .data(this.y.ticks(5))
      .join('line')
      .attr('x1', m.left).attr('x2', m.left + innerW)
      .attr('y1', (d) => this.y(d)).attr('y2', (d) => this.y(d))
      .attr('stroke', lineCol).attr('stroke-opacity', (d) => (d === 0 ? 0.9 : 0.28))
      .attr('stroke-width', (d) => (d === 0 ? 1.2 : 1));

    // shut-in region
    const firstDead = v.findIndex((d, i) => !d.live && v.slice(i).every((q) => !q.live));
    this.gShut.selectAll<SVGRectElement, number>('rect')
      .data(firstDead > 0 ? [firstDead] : [])
      .join('rect')
      .attr('x', (i) => this.x(v[i].label) ?? 0)
      .attr('y', m.top)
      .attr('width', (i) => m.left + innerW - (this.x(v[i].label) ?? 0))
      .attr('height', innerH)
      .attr('fill', 'url(#sv-shut)');

    // ── bars: oil + water + gas stacked UP, injection mirrored DOWN ────────────
    const bw = Math.max(1.2, this.x.bandwidth());
    const t = this.first || !canAnimate() ? 0 : 420;
    const drawBars = (cls: string, fill: string, show: boolean,
      y0: (d: VoidagePoint) => number, y1: (d: VoidagePoint) => number) => {
      const fy = (d: VoidagePoint) => Math.min(y0(d), y1(d));
      const fh = (d: VoidagePoint) => Math.max(0, Math.abs(y1(d) - y0(d)));
      const sel = this.gBars.selectAll<SVGRectElement, VoidagePoint>(`rect.${cls}`)
        .data(show ? v : [], (d) => d.label)
        .join((enter) => enter.append('rect').attr('class', cls).attr('y', zero).attr('height', 0))
        .attr('x', (d) => this.x(d.label) ?? 0)
        .attr('width', bw)
        .attr('fill', fill);
      if (t > 0) sel.transition().duration(t).attr('y', fy).attr('height', fh);
      else sel.attr('y', fy).attr('height', fh);
    };
    // Stack order bottom→top: OIL, then GAS directly above it (the two hydrocarbon
    // streams read together), then WATER on top. Injection mirrors below the baseline.
    const oilOf = (d: VoidagePoint) => (vis('oil') ? d.oil : 0);
    const gasOf = (d: VoidagePoint) => (vis('gas') ? d.gas : 0);
    drawBars('sv-b-oil', 'url(#sv-oil)', vis('oil'), () => zero, (d) => this.y(d.oil));
    drawBars('sv-b-gas', 'url(#sv-gas)', vis('gas'), (d) => this.y(oilOf(d)), (d) => this.y(oilOf(d) + d.gas));
    drawBars('sv-b-water', 'url(#sv-water)', vis('water'), (d) => this.y(oilOf(d) + gasOf(d)), (d) => this.y(oilOf(d) + gasOf(d) + d.water));
    drawBars('sv-b-inj', 'url(#sv-inj)', vis('injection'), () => zero, (d) => this.y(-d.inj));

    // ── VRR overlay line + its 1.0 balance target ──────────────────────────────
    const pts = vis('VRR') ? v.filter((d) => d.vrr != null) : [];
    const vrrLine: Line<VoidagePoint> = line<VoidagePoint>().curve(curveMonotoneX)
      .x((d) => (this.x(d.label) ?? 0) + bw / 2).y((d) => this.yv(d.vrr ?? 0));
    this.gVrr.selectAll<SVGLineElement, number>('line.sv-target')
      .data(pts.length ? [1] : [])
      .join('line').attr('class', 'sv-target')
      .attr('x1', m.left).attr('x2', m.left + innerW)
      .attr('y1', this.yv(1)).attr('y2', this.yv(1))
      .attr('stroke', orange).attr('stroke-width', 1.2).attr('stroke-dasharray', '5,3').attr('stroke-opacity', 0.85);
    this.gVrr.selectAll<SVGPathElement, VoidagePoint[]>('path.sv-vrr-line')
      .data(pts.length ? [pts] : [])
      .join('path').attr('class', 'sv-vrr-line')
      .attr('fill', 'none').attr('stroke', purple).attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
      .attr('d', (d) => vrrLine(d));

    // ── dated event pips (clickable — they sit ABOVE the hover surface) ────────
    const base = this.zoom ? this.zoom[0] : 0;
    const inView = this.events
      .map((e) => ({ e, i: e.index - base }))
      .filter((x) => x.i >= 0 && x.i < v.length);
    const pip = this.gEvents.selectAll<SVGGElement, { e: VoidageEvent; i: number }>('g.sv-pip')
      .data(inView, (x) => x.e.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', (x) => `sv-pip sv-pip-${x.e.id}`).style('cursor', 'pointer');
        g.append('line');
        g.append('circle').attr('r', 4).attr('stroke-width', 1.6);
        g.append('title');
        return g;
      });
    const pipCol = (id: string) => (id === 'breakthrough' ? blue : id === 'first-injection' ? cyan : purple);
    pip.attr('transform', (x) => `translate(${(this.x(v[x.i].label) ?? 0) + bw / 2},0)`)
      .on('click', (_ev, x) => this.onPickEvent(x.e.id));
    pip.select('line').attr('x1', 0).attr('x2', 0).attr('y1', m.top).attr('y2', m.top + innerH)
      .attr('stroke', (x) => pipCol(x.e.id)).attr('stroke-opacity', 0.32).attr('stroke-width', 1);
    pip.select('circle').attr('cx', 0).attr('cy', m.top)
      .attr('fill', (x) => pipCol(x.e.id)).attr('stroke', cssVar(el, '--panel', '#0b1020'));
    pip.select('title').text((x) => `${x.e.label} · ${v[x.i].label} — ${x.e.note}`);

    // ── axes (units live on the axis, not only in the legend) ─────────────────
    const tickEvery = Math.max(1, Math.ceil(v.length / 8));
    const styleAxis = (g: Selection<SVGGElement, unknown, null, undefined>) => g
      .call((s) => s.selectAll('text').attr('fill', mutedCol).attr('font-size', 8.5).attr('font-family', 'var(--mono, monospace)'))
      .call((s) => s.selectAll('line,path').attr('stroke', lineCol));
    this.gx.attr('transform', `translate(0,${m.top + innerH})`)
      .call(axisBottom(this.x).tickValues(v.filter((_, i) => i % tickEvery === 0).map((d) => d.label))
        .tickFormat((s) => (v.length > 26 ? String(s).slice(0, 4) : String(s))).tickSize(4) as never)
      .call(styleAxis);
    this.gy.attr('transform', `translate(${m.left},0)`)
      .call(axisLeft(this.y).ticks(5).tickFormat((n) => fmtRate(Math.abs(Number(n)))).tickSize(4) as never)
      .call(styleAxis);
    this.gy2.attr('transform', `translate(${m.left + innerW},0)`)
      .call(axisRight(this.yv).ticks(3).tickFormat((n) => Number(n).toFixed(1)).tickSize(4) as never)
      .call(styleAxis)
      .call((s) => s.selectAll('text').attr('fill', purple));

    const titleStyle = (s: Selection<SVGTextElement, unknown, null, undefined>) => s
      .attr('font-size', 8).attr('font-family', 'var(--mono, monospace)')
      .attr('letter-spacing', '0.07em').attr('fill', mutedCol);
    this.xTitle.attr('x', m.left + innerW / 2).attr('y', this.height - 6)
      .call(titleStyle).text(this.units.x.toUpperCase());
    this.yTitle.attr('transform', `translate(11,${m.top + innerH / 2}) rotate(-90)`)
      .call(titleStyle).text(this.units.y.toUpperCase());
    this.y2Title.attr('transform', `translate(${this.width - 8},${m.top + innerH / 2}) rotate(90)`)
      .call(titleStyle).attr('fill', purple).text(this.units.y2.toUpperCase());

    // ── legend — click a key to show/hide that stream ─────────────────────────
    // legend order mirrors the stack order (oil → gas → water) so the key reads
    // bottom-up exactly as the bars are drawn
    const items: Array<[string, string]> = [
      ['oil', 'var(--green,#10b981)'], ['gas', red], ['water', 'var(--blue,#3b82f6)'],
      ['injection', cyan], ['VRR', purple],
    ];
    this.gLegend.attr('transform', `translate(${m.left},${m.top - 10})`);
    const lg = this.gLegend.selectAll<SVGGElement, [string, string]>('g').data(items, (d) => d[0])
      .join((enter) => {
        const g = enter.append('g').style('cursor', 'pointer');
        g.append('rect').attr('class', 'sv-lg-sw').attr('width', 9).attr('height', 3).attr('rx', 1.5).attr('y', -3);
        g.append('text').attr('class', 'sv-lg-t').attr('x', 13).attr('font-size', 8.5).attr('font-family', 'var(--mono, monospace)');
        g.append('title').text('click to show / hide');
        return g;
      });
    let ox = 0;
    lg.attr('transform', (d) => { const tr = `translate(${ox},0)`; ox += 26 + d[0].length * 5.4; return tr; })
      .on('click', (_ev, d) => {
        if (this.hidden.has(d[0])) this.hidden.delete(d[0]); else this.hidden.add(d[0]);
        this.render();
      });
    lg.select('.sv-lg-sw').attr('fill', (d) => d[1]).attr('opacity', (d) => (vis(d[0]) ? 1 : 0.25));
    lg.select('.sv-lg-t').attr('fill', (d) => (vis(d[0]) ? mutedCol : lineCol))
      .attr('text-decoration', (d) => (vis(d[0]) ? 'none' : 'line-through')).text((d) => d[0]);

    const dirty = this.dirty();
    this.hint.attr('x', m.left + innerW - (dirty ? 44 : 0)).attr('y', m.top - 10).attr('font-size', 7.5)
      .attr('font-family', 'var(--mono, monospace)').attr('fill', mutedCol).attr('opacity', 0.75)
      .text(this.zoom ? 'double-click or Reset to restore' : 'drag to zoom · click a key to toggle');
    // the reset control lights up only when there is something to undo
    this.resetBtn.classed('on', dirty).attr('aria-disabled', dirty ? null : 'true');

    // hover surface sits under the pips so both stay live
    this.overlay.attr('x', m.left).attr('y', m.top).attr('width', innerW).attr('height', innerH);
    this.first = false;
  }

  destroy() { this.ro.disconnect(); this.tip.remove(); this.resetBtn.remove(); this.svg.remove(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2 · DonutChart — d3-shape pie/arc with an animated sweep and a centre readout.
// ══════════════════════════════════════════════════════════════════════════════
export interface DonutSlice { key: string; value: number; color: string }

export class DonutChart {
  private root: HTMLElement;
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private g: Selection<SVGGElement, unknown, null, undefined>;
  private centre: Selection<SVGTextElement, unknown, null, undefined>;
  private sub: Selection<SVGTextElement, unknown, null, undefined>;
  private data: DonutSlice[] = [];
  private centreText = ''; private subText = '';
  private ro: ResizeObserver;
  private size = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.svg = select(root).append('svg').attr('width', '100%').attr('height', '100%').style('display', 'block') as Selection<SVGSVGElement, unknown, null, undefined>;
    this.g = this.svg.append('g');
    this.centre = this.svg.append('text').attr('text-anchor', 'middle').attr('font-family', 'var(--mono, monospace)').attr('font-weight', 700);
    this.sub = this.svg.append('text').attr('text-anchor', 'middle').attr('font-family', 'var(--mono, monospace)');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
  }
  setData(d: DonutSlice[], centre = '', sub = '') { this.data = d; this.centreText = centre; this.subText = sub; this.render(); }
  private resize() {
    const r = this.root.getBoundingClientRect();
    this.size = Math.max(1, Math.min(r.width, r.height));
    this.svg.attr('viewBox', `0 0 ${Math.max(1, r.width)} ${Math.max(1, r.height)}`);
    this.render();
  }
  private render() {
    const r = this.root.getBoundingClientRect();
    const cx = Math.max(1, r.width) / 2, cy = Math.max(1, r.height) / 2;
    const R = Math.max(6, this.size / 2 - 3), R0 = R * 0.62;
    this.g.attr('transform', `translate(${cx},${cy})`);
    const total = this.data.reduce((s, d) => s + d.value, 0);
    const layout = pie<DonutSlice>().value((d) => d.value).sort(null).padAngle(0.02);
    const a = arc<{ startAngle: number; endAngle: number; padAngle: number }>().innerRadius(R0).outerRadius(R).cornerRadius(2);
    const shape = (d: { startAngle: number; endAngle: number; padAngle: number }) =>
      a({ startAngle: d.startAngle, endAngle: d.endAngle, padAngle: d.padAngle }) as string;
    const paths = this.g.selectAll<SVGPathElement, ReturnType<typeof layout>[number]>('path')
      .data(total > 0 ? layout(this.data) : [], (d) => d.data.key)
      .join('path')
      .attr('fill', (d) => d.data.color);
    paths.selectAll('title').data((d) => [d]).join('title')
      .text((d) => `${d.data.key} · ${Math.round((d.data.value / total) * 100)}%`);
    // `d` must land even when no timer ticks, else the donut renders as nothing
    if (canAnimate()) paths.transition().duration(500).attrTween('d', function (d) {
      const self = this as SVGPathElement & { _cur?: typeof d };
      const from = self._cur ?? { ...d, endAngle: d.startAngle };
      self._cur = d;
      const iS = from.startAngle, iE = from.endAngle;
      return (k: number) => shape({ startAngle: iS + (d.startAngle - iS) * k, endAngle: iE + (d.endAngle - iE) * k, padAngle: d.padAngle });
    });
    else paths.attr('d', shape);
    this.centre.attr('x', cx).attr('y', cy + 1).attr('font-size', Math.max(9, R * 0.42))
      .attr('fill', cssVar(this.root, '--ink', '#e5eef0')).text(this.centreText);
    this.sub.attr('x', cx).attr('y', cy + Math.max(9, R * 0.42) * 0.78 + 3).attr('font-size', Math.max(6, R * 0.22))
      .attr('fill', cssVar(this.root, '--ink3', '#7f9299')).text(this.subText);
  }
  destroy() { this.ro.disconnect(); this.svg.remove(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3 · BenchmarkChart — a class band on a real d3 axis with an animated marker.
// ══════════════════════════════════════════════════════════════════════════════
export interface BenchmarkSpec { low: number; mid: number; high: number; observed: number | null; scaleMax: number }

export class BenchmarkChart {
  private root: HTMLElement;
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private band: Selection<SVGRectElement, unknown, null, undefined>;
  private midL: Selection<SVGLineElement, unknown, null, undefined>;
  private obs: Selection<SVGGElement, unknown, null, undefined>;
  private gx: Selection<SVGGElement, unknown, null, undefined>;
  private track: Selection<SVGRectElement, unknown, null, undefined>;
  private spec: BenchmarkSpec = { low: 0, mid: 0, high: 0, observed: null, scaleMax: 0.7 };
  private ro: ResizeObserver;
  private width = 0; private height = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.svg = select(root).append('svg').attr('width', '100%').attr('height', '100%').style('display', 'block').style('overflow', 'visible') as Selection<SVGSVGElement, unknown, null, undefined>;
    this.track = this.svg.append('rect').attr('rx', 6);
    this.band = this.svg.append('rect').attr('rx', 6);
    this.midL = this.svg.append('line').attr('stroke-dasharray', '3,2');
    this.obs = this.svg.append('g');
    this.obs.append('circle').attr('r', 6).attr('stroke-width', 2);
    this.gx = this.svg.append('g');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
  }
  setData(spec: BenchmarkSpec) { this.spec = spec; this.render(); }
  private resize() {
    const r = this.root.getBoundingClientRect();
    this.width = Math.max(1, r.width); this.height = Math.max(1, r.height);
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this.render();
  }
  private render() {
    const el = this.root, L = 4, R = 10, H = 13;
    const x = scaleLinear().domain([0, this.spec.scaleMax]).range([L, Math.max(L + 1, this.width - R)]);
    const teal = cssVar(el, '--teal', '#0FB5A6'), purple = cssVar(el, '--purple', '#7c3aed');
    const lineCol = cssVar(el, '--line', '#2a3a40'), muted = cssVar(el, '--ink3', '#7f9299');
    this.track.attr('x', L).attr('y', 2).attr('width', Math.max(1, x.range()[1] - L)).attr('height', H).attr('fill', lineCol).attr('fill-opacity', 0.55);
    const anim = canAnimate();
    const bandX = x(this.spec.low), bandW = Math.max(1, x(this.spec.high) - x(this.spec.low));
    const midX = x(this.spec.mid), obsT = `translate(${x(this.spec.observed ?? 0)},${2 + H / 2})`;
    const b = this.band.attr('y', 2).attr('height', H).attr('fill', teal).attr('fill-opacity', 0.42);
    if (anim) b.transition().duration(480).attr('x', bandX).attr('width', bandW);
    else b.attr('x', bandX).attr('width', bandW);
    const ml = this.midL.attr('y1', 0).attr('y2', H + 4).attr('stroke', teal).attr('stroke-width', 1.4);
    if (anim) ml.transition().duration(480).attr('x1', midX).attr('x2', midX);
    else ml.attr('x1', midX).attr('x2', midX);
    const ob = this.obs.attr('opacity', this.spec.observed == null ? 0 : 1);
    if (anim) ob.transition().duration(480).attr('transform', obsT);
    else ob.attr('transform', obsT);
    this.obs.select('circle').attr('fill', purple).attr('stroke', cssVar(el, '--panel', '#0b1020'));
    this.gx.attr('transform', `translate(0,${H + 4})`)
      .call(axisBottom(x).ticks(4).tickFormat((v) => `${Math.round(Number(v) * 100)}%`).tickSize(3) as never)
      .call((s) => s.selectAll('text').attr('fill', muted).attr('font-size', 8).attr('font-family', 'var(--mono, monospace)'))
      .call((s) => s.selectAll('line,path').attr('stroke', lineCol));
  }
  destroy() { this.ro.disconnect(); this.svg.remove(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4 · WellBarChart — ranked horizontal health bars with hover + click.
// ══════════════════════════════════════════════════════════════════════════════
export interface WellBar { well: string; health: number; wct: number; flag: string | null }

export class WellBarChart {
  private root: HTMLElement;
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private g: Selection<SVGGElement, unknown, null, undefined>;
  private onPick: (well: string) => void;
  private data: WellBar[] = [];
  private ro: ResizeObserver;
  private width = 0; private height = 0;

  constructor(root: HTMLElement, onPick: (well: string) => void = () => {}) {
    this.root = root; this.onPick = onPick;
    this.svg = select(root).append('svg').attr('width', '100%').attr('height', '100%').style('display', 'block') as Selection<SVGSVGElement, unknown, null, undefined>;
    this.g = this.svg.append('g');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
  }
  setData(d: WellBar[]) { this.data = d; this.render(); }
  private resize() {
    const r = this.root.getBoundingClientRect();
    this.width = Math.max(1, r.width); this.height = Math.max(1, r.height);
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this.render();
  }
  private render() {
    const el = this.root, L = 50, R = 96;
    const green = cssVar(el, '--green', '#10b981'), orange = cssVar(el, '--orange', '#f59e0b'), red = cssVar(el, '--red', '#ef4444');
    const ink = cssVar(el, '--ink', '#e5eef0'), muted = cssVar(el, '--ink3', '#7f9299'), lineCol = cssVar(el, '--line', '#2a3a40');
    const y = scaleBand<string>().domain(this.data.map((d) => d.well)).range([2, Math.max(3, this.height - 2)]).padding(0.28);
    const x = scaleLinear().domain([0, 100]).range([L, Math.max(L + 1, this.width - R)]);
    const col = (h: number) => (h > 66 ? green : h > 40 ? orange : red);

    const row = this.g.selectAll<SVGGElement, WellBar>('g.wb').data(this.data, (d) => d.well)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'wb').style('cursor', 'pointer');
        g.append('text').attr('class', 'wb-name').attr('x', 2).attr('font-size', 9).attr('font-family', 'var(--mono, monospace)');
        g.append('rect').attr('class', 'wb-track').attr('rx', 3);
        g.append('rect').attr('class', 'wb-fill').attr('rx', 3).attr('width', 0);
        g.append('text').attr('class', 'wb-flag').attr('font-size', 7.5).attr('font-family', 'var(--mono, monospace)');
        g.append('title');
        return g;
      });
    row.attr('transform', (d) => `translate(0,${y(d.well) ?? 0})`).on('click', (_e, d) => this.onPick(d.well));
    const bh = Math.max(4, y.bandwidth());
    row.select('.wb-name').attr('y', bh * 0.75).attr('fill', ink).text((d) => d.well);
    row.select('.wb-track').attr('x', L).attr('y', bh * 0.28).attr('height', bh * 0.46)
      .attr('width', Math.max(1, x(100) - L)).attr('fill', lineCol).attr('fill-opacity', 0.5);
    const fillW = (d: WellBar) => Math.max(2, x(d.health) - L);
    const wf = row.select<SVGRectElement>('.wb-fill').attr('x', L).attr('y', bh * 0.28).attr('height', bh * 0.46)
      .attr('fill', (d) => col(d.health));
    if (canAnimate()) wf.transition().duration(520).attr('width', fillW);
    else wf.attr('width', fillW);
    row.select('.wb-flag').attr('x', Math.max(L + 2, x(100) + 6)).attr('y', bh * 0.75)
      .attr('fill', (d) => (d.flag ? orange : muted)).attr('opacity', (d) => (d.flag ? 1 : 0.55))
      .text((d) => (d.flag ? d.flag : `${Math.round(d.wct)}% wct`));
    row.select('title').text((d) => `${d.well} · health ${Math.round(d.health)} · ${Math.round(d.wct)}% water cut${d.flag ? ` · ${d.flag}` : ''}`);
  }
  destroy() { this.ro.disconnect(); this.svg.remove(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5 · StageChart — the depletion stage track: a real scale with a gradient fill.
// ══════════════════════════════════════════════════════════════════════════════
export class StageChart {
  private root: HTMLElement;
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private track: Selection<SVGRectElement, unknown, null, undefined>;
  private fill: Selection<SVGRectElement, unknown, null, undefined>;
  private g: Selection<SVGGElement, unknown, null, undefined>;
  private steps: Array<{ key: string; at: number }> = [];
  private at = 0; private ceased = false;
  private ro: ResizeObserver;
  private width = 0; private height = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.svg = select(root).append('svg').attr('width', '100%').attr('height', '100%').style('display', 'block').style('overflow', 'visible') as Selection<SVGSVGElement, unknown, null, undefined>;
    const defs = this.svg.append('defs');
    const g = defs.append('linearGradient').attr('id', 'sv-stage').attr('x1', '0').attr('x2', '1');
    g.append('stop').attr('offset', '0%').attr('stop-color', 'var(--teal,#0FB5A6)');
    g.append('stop').attr('offset', '100%').attr('stop-color', 'var(--purple,#7c3aed)');
    const gc = defs.append('linearGradient').attr('id', 'sv-stage-ceased').attr('x1', '0').attr('x2', '1');
    gc.append('stop').attr('offset', '0%').attr('stop-color', 'var(--orange,#f59e0b)');
    gc.append('stop').attr('offset', '100%').attr('stop-color', 'var(--red,#ef4444)');
    this.track = this.svg.append('rect').attr('rx', 3);
    this.fill = this.svg.append('rect').attr('rx', 3).attr('width', 0);
    this.g = this.svg.append('g');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
  }
  setData(steps: Array<{ key: string; at: number }>, at: number, ceased = false) {
    this.steps = steps; this.at = at; this.ceased = ceased; this.render();
  }
  private resize() {
    const r = this.root.getBoundingClientRect();
    this.width = Math.max(1, r.width); this.height = Math.max(1, r.height);
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this.render();
  }
  private render() {
    const el = this.root, H = 5;
    const x = scaleLinear().domain([0, 1]).range([0, this.width]);
    this.track.attr('x', 0).attr('y', 0).attr('width', this.width).attr('height', H)
      .attr('fill', cssVar(el, '--line', '#2a3a40'));
    const w = Math.max(0, x(this.at));
    const f = this.fill.attr('x', 0).attr('y', 0).attr('height', H)
      .attr('fill', this.ceased ? 'url(#sv-stage-ceased)' : 'url(#sv-stage)');
    if (canAnimate()) f.transition().duration(560).attr('width', w);
    else f.attr('width', w);
    const purple = cssVar(el, '--purple', '#7c3aed'), lineCol = cssVar(el, '--line', '#2a3a40');
    this.g.selectAll<SVGCircleElement, { key: string; at: number }>('circle')
      .data(this.steps, (d) => d.key)
      .join('circle')
      .attr('cy', H / 2).attr('r', 2.6)
      .attr('cx', (d) => x(d.at))
      .attr('fill', (d) => (d.at <= this.at + 1e-6 && this.at > 0 ? purple : lineCol))
      .append('title').text((d) => d.key);
  }
  destroy() { this.ro.disconnect(); this.svg.remove(); }
}
