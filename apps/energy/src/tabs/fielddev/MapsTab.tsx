// MapsTab — the modelled field, collapsed to maps you can argue with.
//
// A 3D property field is hard to argue with and easy to admire. A map is the opposite:
// it is the form in which a geologist can say "that thick patch is in the wrong place".
// So this collapses the modelled properties down each column and draws them side by
// side at one shared scale per property.
//
// ── TWO CHOICES THE MAP MUST MAKE EXPLICIT ──────────────────────────────────
//
//  · WHICH ZONE. A field-wide average across a stacked model is a number about no zone
//    in particular — it mixes the reservoir with the overburden and reports whichever
//    has more layers.
//  · WHICH SIDE OF THE CONTACT. An average porosity over the whole column and one over
//    the oil leg are different maps that look identical, and only one of them is about
//    the accumulation.
//
// Both are shown in the caption of every map, so a screenshot cannot be misread later.
//
// ── AVERAGE MAPS AND TOTAL MAPS ARE DIFFERENT ANIMALS ───────────────────────
//
// Porosity, Sw and permeability are INTENSIVE — a thickness-weighted mean is the answer.
// HCPV and net pay are EXTENSIVE — the answer is the column TOTAL, and averaging them
// makes a thick rich column look exactly like a thin one. Structure is neither; it is
// the column's own geometry. All three kinds are here, and each says which it is.
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { averageMap, columnMap, type AverageMap, type ContactFilter } from './grid-props';
import {
  colorTable, normalise, propValueAt, rampColor, styleFor, safeRange, RAMPS,
  type PackedGridLike, type PackedPropLike, type PropertyStyle,
} from './prop-view';

// the derived styles are not in the registry, so they resolve their ramp by hand
const RAMP_OF = (id: string) => RAMPS[id] ?? RAMPS.rainbow;
import { useStatic } from './static-store';

export interface MapsTabProps {
  grid: PackedGridLike & {
    dx: number; dy: number; x0: number; y0: number;
    topZ: ArrayLike<number>; baseZ: ArrayLike<number>;
  };
  /** zone bands from the built grid */
  zones: Array<{ name: string; k0: number; nz: number }>;
  owc?: number;
  wells?: Array<{ name: string; x: number; y: number; producer?: boolean; injector?: boolean }>;
}

type Well = NonNullable<MapsTabProps['wells']>[number];

/** A map's identity: how it was collapsed, and what the number means. */
interface MapSpec {
  key: string;
  style: PropertyStyle;
  /** 'mean' | 'total' | 'geometry' — printed on the caption, because it changes the reading */
  kind: 'mean' | 'total' | 'geometry';
  build: () => AverageMap;
}

// ── the two derived styles the packed grid has no property for ──────────────
//
// Structure is DEPTH: deeper is worse, so the ramp runs the other way from every
// other map here, and saying so on the legend is the only thing that stops it being
// read upside down.
const STRUCTURE_STYLE: PropertyStyle = {
  key: 'structure', label: 'Top structure', unit: 'm TVDSS', decimals: 0,
  categorical: false, highIsGood: false, rampId: 'rainbow',
};
const NETPAY_STYLE: PropertyStyle = {
  key: 'netpay', label: 'Net pay', unit: 'm', decimals: 1,
  categorical: false, highIsGood: true, rampId: 'rainbow',
};

function MapCanvas({ grid, spec, zone, filter, owc, wells, showWells }: {
  grid: MapsTabProps['grid'];
  spec: MapSpec;
  zone: { name: string; k0: number; nz: number } | null;
  filter: ContactFilter;
  owc?: number;
  wells: Well[];
  showWells: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const rampId = useStatic((st) => st.propRamp[spec.key]);
  const pinnedRange = useStatic((st) => st.propRange[spec.key]);
  const setPropRange = useStatic((st) => st.setPropRange);
  const style = useMemo(() => styleFor(spec.style.key, rampId) ?? spec.style, [spec.style, rampId]);
  // a registered property resolves through the registry; a derived one carries its own
  const resolved = useMemo<PropertyStyle>(() => {
    if (spec.style.key === 'structure' || spec.style.key === 'netpay') {
      const id = rampId ?? spec.style.rampId ?? 'rainbow';
      return { ...spec.style, rampId: id, stops: RAMP_OF(id) };
    }
    return style;
  }, [spec.style, style, rampId]);

  const map = useMemo(() => spec.build(), [spec, zone, filter, owc]);

  // ── the scale comes from THIS map ──
  //
  // An average is a different distribution from the cells it averages, and borrowing
  // the cell range would flatten every map into the middle of its own ramp. P2–P98, so
  // one unresolved column does not set the whole scale.
  const auto = useMemo(() => {
    const v: number[] = [];
    for (let i = 0; i < map.values.length; i++) if (Number.isFinite(map.values[i])) v.push(map.values[i]);
    if (!v.length) return null;
    v.sort((a, b) => a - b);
    const at = (fq: number) => v[Math.min(v.length - 1, Math.floor(fq * (v.length - 1)))];
    const lo = at(0.02), hi = at(0.98);
    let clipped = 0;
    for (const x of v) if (x < lo || x > hi) clipped++;
    return { lo, hi: hi > lo ? hi : lo + 1e-6, n: v.length, clipped, dataMin: v[0], dataMax: v[v.length - 1] };
  }, [map]);
  const range = pinnedRange ?? auto;

  // ── hover readout ──
  //
  // A colour is a category; a reader comparing two patches needs the number. The
  // cell under the cursor is the cheapest way to give it without cluttering the map.
  const [hover, setHover] = useState<{ x: number; y: number; i: number; j: number; v: number } | null>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const i = Math.floor(fx * grid.nx), j = grid.ny - 1 - Math.floor(fy * grid.ny);
    if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) { setHover(null); return; }
    const v = map.values[j * grid.nx + i];
    setHover(Number.isFinite(v) ? { x: e.clientX - r.left, y: e.clientY - r.top, i, j, v } : null);
  }, [grid, map]);

  // ── draw at device resolution, sized to the element ──
  //
  // Drawing at `width={grid.nx}` and letting CSS blow a 166 × 131 bitmap up to 400 px
  // is why the maps looked like coarse squares: it is a 3× magnification of one pixel
  // per cell. Measuring the element and filling true cell rectangles gives crisp cells
  // at any size.
  const [box, setBox] = useState({ w: 320, h: 260 });
  useEffect(() => {
    const obs = new ResizeObserver((es) => {
      for (const e of es) setBox({ w: Math.max(80, e.contentRect.width), h: Math.max(80, e.contentRect.height) });
    });
    if (wrap.current) obs.observe(wrap.current);
    return () => obs.disconnect();
  }, []);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!range) return;

    // keep the map's true aspect — a squashed structure map is a lie about the field
    const aspect = (grid.nx * grid.dx) / (grid.ny * grid.dy);
    let mw = W, mh = W / aspect;
    if (mh > H) { mh = H; mw = H * aspect; }
    const ox = (W - mw) / 2, oy = (H - mh) / 2;
    const sx = mw / grid.nx, sy = mh / grid.ny;

    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        const v = map.values[j * grid.nx + i];
        if (!Number.isFinite(v)) continue;
        ctx.fillStyle = resolved.categorical
          ? (resolved.codes?.find((c) => c.code === Math.round(v))?.color ?? '#888')
          : rampColor(resolved.stops ?? [], normalise(resolved, v, range.lo, range.hi));
        // north is UP on screen; +1 on the extent closes the hairline seams that
        // sub-pixel cell widths otherwise leave between neighbouring fills
        ctx.fillRect(ox + i * sx, oy + (grid.ny - 1 - j) * sy, sx + 1, sy + 1);
      }
    }

    if (showWells) {
      for (const w of wells) {
        const px = ox + ((w.x - grid.x0) / (grid.nx * grid.dx)) * mw;
        const py = oy + mh - ((w.y - grid.y0) / (grid.ny * grid.dy)) * mh;
        if (px < ox - 4 || px > ox + mw + 4 || py < oy - 4 || py > oy + mh + 4) continue;
        // a halo, because a 2 px dot vanishes over a mid-ramp colour and the impact
        // point is the one thing on the map that is a measurement rather than a model
        ctx.beginPath(); ctx.arc(px, py, 4.6 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 3 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = w.injector ? '#5ac8fa' : w.producer ? '#ff6b4a' : '#e2e8f0';
        ctx.fill();
        ctx.lineWidth = 1 * dpr; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      }
    }
  }, [map, range, resolved, grid, wells, showWells, box, dpr]);

  const table = range ? colorTable(resolved, range.lo, range.hi, 3) : null;
  const clipPct = auto?.n ? (auto.clipped / auto.n) * 100 : 0;
  const fmt = (v: number) => v.toFixed(resolved.decimals ?? 2);

  return (
    <figure className="mp-fig">
      <div className="mp-canvas" ref={wrap}>
        <canvas ref={ref}
          width={Math.round(box.w * dpr)} height={Math.round(box.h * dpr)}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        {hover && (
          <div className="mp-tip" style={{ left: hover.x, top: hover.y }}>
            <b>{fmt(hover.v)}</b>{resolved.unit ? ` ${resolved.unit}` : ''}
            <em>i {hover.i} · j {hover.j}</em>
          </div>
        )}
      </div>
      <figcaption>
        <b>{resolved.label}</b>
        <span className={`mp-kind mp-kind-${spec.kind}`}>{spec.kind}</span>
        {table && !resolved.categorical && (
          <span className="mp-scale">
            <i style={{ background: table.gradient }} />
            <input type="number" step="any" value={Number(range!.lo.toFixed(4))}
              onChange={(e) => setPropRange(spec.key, safeRange(Number(e.target.value), range!.hi, range!))} />
            <input type="number" step="any" value={Number(range!.hi.toFixed(4))}
              onChange={(e) => setPropRange(spec.key, safeRange(range!.lo, Number(e.target.value), range!))} />
            <button className={pinnedRange ? 'on' : ''} onClick={() => setPropRange(spec.key, null)}
              title={pinnedRange ? 'Pinned — click for auto (P2–P98)' : 'Auto: P2–P98, outliers trimmed'}>
              {pinnedRange ? 'pin' : 'auto'}
            </button>
          </span>
        )}
        {/* the two choices, on the picture itself, so a screenshot cannot be misread */}
        <em>
          {zone ? zone.name : 'all zones'}
          {' · '}
          {filter === 'all' ? 'whole column' : filter === 'above' ? 'above contact' : 'below contact'}
          {map.live ? ` · ${map.live} columns` : ' · no data'}
          {clipPct >= 1 ? ` · ${clipPct.toFixed(0)}% clipped` : ''}
        </em>
      </figcaption>
    </figure>
  );
}

export function MapsTab({ grid, zones, owc, wells = [] }: MapsTabProps) {
  const [zoneIx, setZoneIx] = useState<number>(zones.length ? zones.length - 1 : -1);
  const [filter, setFilter] = useState<ContactFilter>(owc != null ? 'above' : 'all');
  const [showWells, setShowWells] = useState(true);

  const zone = zoneIx >= 0 && zones[zoneIx] ? zones[zoneIx] : null;
  const layers = zone ? { k0: zone.k0, nz: zone.nz } : undefined;

  const specs = useMemo<MapSpec[]>(() => {
    const out: MapSpec[] = [];
    const cellOf = (prop: PackedPropLike) => (col: number, l: number) => {
      const i = col % grid.nx, j = (col - (col % grid.nx)) / grid.nx;
      return propValueAt(grid, prop, i, j, l);
    };

    // ── STRUCTURE first: every other map is read against where the rock is ──
    out.push({
      key: 'structure', style: STRUCTURE_STYLE, kind: 'geometry',
      build: () => columnMap(grid, (zt) => zt, layers),
    });

    // the intensive properties, averaged
    for (const prop of grid.props) {
      if (prop.name === 'hcpv') continue;             // extensive — handled below
      out.push({
        key: prop.name, style: styleFor(prop.name), kind: 'mean',
        build: () => averageMap(grid, cellOf(prop), { owc, filter, layers }),
      });
    }

    // ── NET PAY: metres, not a fraction ──
    //
    // Σ (layer thickness × NTG) over the band. A net-to-gross MAP already exists above;
    // this is the quantity a well plan is actually sized on, and the two look nothing
    // alike wherever the gross thickness varies — which is the point.
    const ntg = grid.props.find((p) => p.name === 'ntg');
    if (ntg) {
      out.push({
        key: 'netpay', style: NETPAY_STYLE, kind: 'total',
        build: () => averageMap(grid, cellOf(ntg), { owc, filter, layers, mode: 'sum' }),
      });
    }

    // ── HCPV: the column total, in reservoir m³ ──
    //
    // Deliberately NOT an average. A mean hydrocarbon pore volume per cell is a number
    // nobody reasons with; the total is the map that adds up to the volumetrics.
    const hcpv = grid.props.find((p) => p.name === 'hcpv');
    if (hcpv) {
      out.push({
        key: 'hcpv', style: styleFor('hcpv'), kind: 'total',
        build: () => averageMap(grid, cellOf(hcpv), { owc, filter, layers, mode: 'sum' }),
      });
    }
    return out;
  }, [grid, zone, filter, owc, layers]);

  if (!grid.props.length) {
    return <div className="mp-empty">Model a property first — there is nothing to average yet.</div>;
  }

  return (
    <div className="mp">
      <div className="mp-bar">
        <label>
          Zone
          <select value={zoneIx} onChange={(e) => setZoneIx(Number(e.target.value))}>
            <option value={-1}>all zones</option>
            {zones.map((z, i) => <option key={z.name} value={i}>{z.name}</option>)}
          </select>
        </label>
        <div className="mp-seg">
          {(['all', 'above', 'below'] as ContactFilter[]).map((fx) => (
            <button key={fx}
              className={filter === fx ? 'on' : ''}
              disabled={fx !== 'all' && owc == null}
              title={owc == null && fx !== 'all' ? 'No fluid contact is defined' : undefined}
              onClick={() => setFilter(fx)}>
              {fx === 'all' ? 'whole column' : `${fx} contact`}
            </button>
          ))}
        </div>
        <label className="mp-chk">
          <input type="checkbox" checked={showWells} onChange={(e) => setShowWells(e.target.checked)} />
          well impact points
        </label>
        {owc != null && <span className="mp-owc">contact {Math.abs(owc).toFixed(0)} m</span>}
        <span className="mp-sp" />
        <span className="mp-count">{specs.length} maps · {wells.length} wells</span>
      </div>

      <div className="mp-grid">
        {specs.map((spec) => (
          <MapCanvas key={spec.key} grid={grid} spec={spec} zone={zone}
            filter={filter} owc={owc} wells={wells} showWells={showWells} />
        ))}
      </div>
    </div>
  );
}
