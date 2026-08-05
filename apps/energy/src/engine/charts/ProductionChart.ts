// ProductionChart.ts (1e) — a real D3 chart CLASS (not hand-drawn canvas, not a thin JSX
// wrapper): owns an <svg> via d3-selection, builds it once with the D3 enter/update
// pattern, and re-renders efficiently on `.update()`. Renders oil-rate + water-cut vs PVI
// as two lines (d3-shape) over d3-scale axes (d3-axis), with a scrubbable playhead.
// Theme-aware via CSS custom properties (reads var(--amber)/--blue/--line/--muted/--text
// at render time so light/dark just work). Framework-agnostic: mount() takes any
// HTMLElement, so the React wrapper (ProductionChartView.tsx) is a thin lifecycle shim.
import { select, type Selection } from 'd3-selection';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { line, curveMonotoneX, type Line } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';

/** d3-array's `max`, inlined — see SurveillanceCharts.ts: reaching `d3-array` only from a
 *  lazily-loaded chart module left it un-prebundled by Vite's optimizer, so the request
 *  504'd and took the whole surface down with it. */
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

export interface ProdPoint { pvi: number; oilRate: number; waterCut: number }

export interface ProductionChartOptions {
  onScrub?: (pvi: number) => void; // fires when the user drags/clicks the chart
  margin?: { top: number; right: number; bottom: number; left: number };
}

const cssVar = (el: Element, name: string, fallback: string) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
};

/** A self-contained D3 line chart: oil rate (normalized 0..1) + water cut (0..1) vs PVI. */
export class ProductionChart {
  private root: HTMLElement;
  private opts: Required<ProductionChartOptions>;
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private gx: Selection<SVGGElement, unknown, null, undefined>;
  private gy: Selection<SVGGElement, unknown, null, undefined>;
  private gGrid: Selection<SVGGElement, unknown, null, undefined>;
  private pathOil: Selection<SVGPathElement, unknown, null, undefined>;
  private pathWater: Selection<SVGPathElement, unknown, null, undefined>;
  private playhead: Selection<SVGLineElement, unknown, null, undefined>;
  private legend: Selection<SVGGElement, unknown, null, undefined>;
  private overlay: Selection<SVGRectElement, unknown, null, undefined>;
  private x: ScaleLinear<number, number> = scaleLinear();
  private y: ScaleLinear<number, number> = scaleLinear();
  private data: ProdPoint[] = [];
  private ro: ResizeObserver;
  private width = 0;
  private height = 0;

  constructor(root: HTMLElement, opts: ProductionChartOptions = {}) {
    this.root = root;
    this.opts = { onScrub: opts.onScrub ?? (() => {}), margin: opts.margin ?? { top: 20, right: 14, bottom: 26, left: 34 } };

    this.svg = select(root).append('svg').attr('width', '100%').attr('height', '100%').style('display', 'block').style('overflow', 'visible') as Selection<SVGSVGElement, unknown, null, undefined>;

    this.gGrid = this.svg.append('g').attr('class', 'pc-grid');
    this.gx = this.svg.append('g').attr('class', 'pc-axis-x');
    this.gy = this.svg.append('g').attr('class', 'pc-axis-y');
    this.pathWater = this.svg.append('path').attr('class', 'pc-water').attr('fill', 'none').attr('stroke-width', 1.6);
    this.pathOil = this.svg.append('path').attr('class', 'pc-oil').attr('fill', 'none').attr('stroke-width', 1.6);
    this.playhead = this.svg.append('line').attr('class', 'pc-playhead').attr('stroke-dasharray', '3,3');
    this.legend = this.svg.append('g').attr('class', 'pc-legend');
    this.legend.append('text').attr('class', 'pc-legend-oil').attr('font-size', 9.5).attr('font-family', 'var(--mono, monospace)');
    this.legend.append('text').attr('class', 'pc-legend-water').attr('font-size', 9.5).attr('font-family', 'var(--mono, monospace)');

    // scrub-to-seek: click or drag the plot area to move the sim playhead
    this.overlay = this.svg.append('rect').attr('class', 'pc-overlay').attr('fill', 'transparent').style('cursor', 'crosshair');
    this.overlay.on('pointerdown', (ev: PointerEvent) => this.handleScrub(ev));
    this.overlay.on('pointermove', (ev: PointerEvent) => { if (ev.buttons === 1) this.handleScrub(ev); });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
  }

  private handleScrub(ev: PointerEvent) {
    const rect = this.root.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const pvi = this.x.invert(px);
    const maxPvi = this.data.length ? this.data[this.data.length - 1].pvi : 1;
    this.opts.onScrub(Math.max(0, Math.min(maxPvi, pvi)));
  }

  private resize() {
    const rect = this.root.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this.render();
  }

  /** Replace the data series. Call once per sim result (cheap — O(nFrames)). */
  setData(data: ProdPoint[]) {
    this.data = data;
    this.render();
  }

  /** Move the playhead to a PVI value (called every animation tick — no re-layout). */
  setPlayheadPvi(pvi: number | null) {
    const m = this.opts.margin;
    const innerH = this.height - m.top - m.bottom;
    if (pvi == null || !this.data.length) { this.playhead.attr('opacity', 0); return; }
    const px = this.x(pvi);
    this.playhead.attr('opacity', 1).attr('x1', px).attr('x2', px).attr('y1', m.top).attr('y2', m.top + innerH);
  }

  private render() {
    const m = this.opts.margin;
    const innerW = Math.max(1, this.width - m.left - m.right);
    const innerH = Math.max(1, this.height - m.top - m.bottom);
    const el = this.root;

    const lineCol = cssVar(el, '--line', '#2a3a40');
    const mutedCol = cssVar(el, '--muted', '#7f9299');
    const amberCol = cssVar(el, '--amber', '#e0a640');
    const blueCol = cssVar(el, '--blue', '#4a9fd8');
    const textCol = cssVar(el, '--text', '#e5eef0');

    const maxPvi = this.data.length ? this.data[this.data.length - 1].pvi || 1 : 1;
    const maxOil = Math.max(max(this.data, (d) => d.oilRate) ?? 1e-9, 1e-9);

    this.x = scaleLinear().domain([0, maxPvi]).range([0, innerW]);
    this.y = scaleLinear().domain([0, 1]).range([innerH, 0]);

    // position each element individually (simpler than nesting a <g> per shape)
    this.gGrid.attr('transform', `translate(${m.left},${m.top})`);
    this.gx.attr('transform', `translate(${m.left},${m.top + innerH})`);
    this.gy.attr('transform', `translate(${m.left},${m.top})`);
    this.pathOil.attr('transform', `translate(${m.left},${m.top})`);
    this.pathWater.attr('transform', `translate(${m.left},${m.top})`);
    this.overlay.attr('x', m.left).attr('y', m.top).attr('width', innerW).attr('height', innerH);

    // axes
    this.gx.call(axisBottom(this.x).ticks(5).tickSize(4) as never)
      .call((s) => s.selectAll('text').attr('fill', mutedCol).attr('font-size', 9).attr('font-family', 'var(--mono, monospace)'))
      .call((s) => s.selectAll('line,path').attr('stroke', lineCol));
    this.gy.call(axisLeft(this.y).ticks(4).tickFormat((v) => `${Math.round(Number(v) * 100)}%`).tickSize(4) as never)
      .call((s) => s.selectAll('text').attr('fill', mutedCol).attr('font-size', 9).attr('font-family', 'var(--mono, monospace)'))
      .call((s) => s.selectAll('line,path').attr('stroke', lineCol));

    // faint horizontal gridlines
    this.gGrid.selectAll<SVGLineElement, number>('line.grid')
      .data(this.y.ticks(4))
      .join('line')
      .attr('class', 'grid')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => this.y(d)).attr('y2', (d) => this.y(d))
      .attr('stroke', lineCol).attr('stroke-opacity', 0.35);

    const oilLine: Line<ProdPoint> = line<ProdPoint>().curve(curveMonotoneX).x((d) => this.x(d.pvi)).y((d) => this.y(d.oilRate / maxOil));
    const waterLine: Line<ProdPoint> = line<ProdPoint>().curve(curveMonotoneX).x((d) => this.x(d.pvi)).y((d) => this.y(d.waterCut));

    this.pathOil.datum(this.data).attr('stroke', amberCol).attr('d', oilLine);
    this.pathWater.datum(this.data).attr('stroke', blueCol).attr('d', waterLine);

    this.playhead.attr('stroke', textCol).attr('stroke-width', 1);

    this.legend.attr('transform', `translate(${m.left + 4},${m.top - 8})`);
    this.legend.select('.pc-legend-oil').attr('fill', amberCol).attr('x', 0).text('oil rate');
    this.legend.select('.pc-legend-water').attr('fill', blueCol).attr('x', 58).text('water cut');
  }

  destroy() {
    this.ro.disconnect();
    this.svg.remove();
  }
}
