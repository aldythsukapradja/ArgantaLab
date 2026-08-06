// The descent's single instrument — one circle, three stops.
//
// The first version made two circles: this lens, small and above the copy, plus
// the DepthRail's glowing rings behind it. Two concentric-looking objects in one
// frame at different centres reads as a mistake, because it is one. There is now
// exactly ONE circle on this slide, it is centred, and it is the thing that
// zooms.
//
// Three stops, nothing more:
//   0  the whole archipelago — every Indonesian province, every GOGET field
//   1  Kutei
//   2  one field inside it
//
// Everything drawn is real: province outlines from world/provinces.geojson and
// field points from cockpit-scope-fields.json. The geologist in the room will
// recognise the shape at every stop, which is the entire reason not to fake it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadProvinceGeo, loadScopeFields } from '../tabs/exploration/data';
import { gsap, prefersReducedMotion } from './timeline';
import { INDONESIA_CODES, KUTEI } from './data';

const VB = 100;

interface Ring { d: string; kutei: boolean }
interface Pt { x: number; y: number; r: number; kutei: boolean }
interface Stop { x: number; y: number; z: number }
interface Link { a: Pt; b: Pt }
interface Lens {
  rings: Ring[]; fields: Pt[]; links: Link[];
  /** Province-to-province arcs for the final stop. */
  arcs: string[];
  stops: [Stop, Stop, Stop, Stop];
}

function useIndonesia(): Lens | null {
  const [lens, setLens] = useState<Lens | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadProvinceGeo(), loadScopeFields()]).then(([geo, scope]) => {
      if (!live) return;
      const codes = new Set<string>(INDONESIA_CODES);
      const feats = geo.features.filter(
        (f) => codes.has(String((f.properties as { prvCode?: string })?.prvCode)));
      if (!feats.length) return;

      // One bbox across the whole archipelago; every stop is expressed inside
      // this single coordinate space, so zooming is a transform rather than a
      // re-projection and nothing can drift between stops.
      const b = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
      const ringsOf = (f: GeoJSON.Feature): number[][][] =>
        f.geometry.type === 'Polygon' ? [(f.geometry.coordinates as number[][][])[0]]
          : f.geometry.type === 'MultiPolygon' ? (f.geometry.coordinates as number[][][][]).map((p) => p[0])
            : [];
      for (const f of feats) {
        for (const ring of ringsOf(f)) {
          for (const [lon, lat] of ring) {
            b.minX = Math.min(b.minX, lon); b.maxX = Math.max(b.maxX, lon);
            b.minY = Math.min(b.minY, lat); b.maxY = Math.max(b.maxY, lat);
          }
        }
      }
      const w = b.maxX - b.minX, h = b.maxY - b.minY;
      const s = (VB * 0.9) / Math.max(w, h);
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      const px = (lon: number, lat: number): [number, number] =>
        [VB / 2 + (lon - cx) * s, VB / 2 - (lat - cy) * s];

      const rings: Ring[] = [];
      let kx = 0, ky = 0, kn = 0;
      for (const f of feats) {
        const isK = String((f.properties as { prvCode?: string })?.prvCode) === KUTEI;
        for (const ring of ringsOf(f)) {
          // Thin dense coastlines — a 2,000-vertex ring inside a 600px circle
          // is pure cost and visually identical.
          const step = Math.max(1, Math.floor(ring.length / 180));
          let d = '';
          for (let i = 0; i < ring.length; i += step) {
            const [x, y] = px(ring[i][0], ring[i][1]);
            d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
            if (isK) { kx += x; ky += y; kn += 1; }
          }
          rings.push({ d: `${d}Z`, kutei: isK });
        }
      }

      const fields: Pt[] = [];
      let focus: Stop | null = null;
      for (const code of INDONESIA_CODES) {
        const isK = code === KUTEI;
        for (const f of scope.provinces[code] ?? []) {
          if (!f.fly) continue;
          const [x, y] = px(f.fly.lon, f.fly.lat);
          fields.push({ x, y, r: 0.42, kutei: isK });
          if (isK && !focus) focus = { x, y, z: 26 };
        }
      }

      const kutei: Stop = kn
        ? { x: kx / kn, y: ky / kn, z: 5.2 }
        : { x: VB / 2, y: VB / 2, z: 5.2 };

      // ── the fourth stop: every province joined to every other ─────────────
      // Quadratic Béziers, not chords. A straight line between two basins
      // reads as a wire; an arc reads as a relationship — and thirteen
      // straight lines through one small circle is a starburst nobody can
      // parse. The control point is pushed PERPENDICULAR to the chord, by an
      // amount proportional to its length, so long links bow more than short
      // ones and no two arcs overlap along their whole run.
      const centres: Array<{ x: number; y: number }> = [];
      for (const code of INDONESIA_CODES) {
        const fs2 = (scope.provinces[code] ?? []).filter((f) => f.fly);
        if (!fs2.length) continue;
        let sx = 0, sy = 0;
        for (const f of fs2) {
          const [x, y] = px(f.fly.lon, f.fly.lat);
          sx += x; sy += y;
        }
        centres.push({ x: sx / fs2.length, y: sy / fs2.length });
      }
      // Nearest three, not all pairs. Thirteen provinces all-to-all is 78 arcs;
      // at the size this renders they overlap into a solid mesh, so the extra
      // fifty cost frames and communicate nothing.
      const arcs: string[] = [];
      const arcSeen = new Set<string>();
      for (let i = 0; i < centres.length; i += 1) {
        const near = centres
          .map((c, j) => ({ j, d: (c.x - centres[i].x) ** 2 + (c.y - centres[i].y) ** 2 }))
          .filter((c) => c.j !== i)
          .sort((u, v) => u.d - v.d)
          .slice(0, 3);
        for (const n of near) {
          const j = n.j;
          const pairKey = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (arcSeen.has(pairKey)) continue;
          arcSeen.add(pairKey);
          const a = centres[i], b2 = centres[j];
          const mx = (a.x + b2.x) / 2, my = (a.y + b2.y) / 2;
          const dx = b2.x - a.x, dy = b2.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          // Perpendicular unit vector, consistently signed so the family of
          // arcs bows the same way and reads as one weave.
          const bow = len * 0.22;
          const cxp = mx + (-dy / len) * bow;
          const cyp = my + (dx / len) * bow;
          arcs.push(`M${a.x.toFixed(2)},${a.y.toFixed(2)} Q${cxp.toFixed(2)},${cyp.toFixed(2)} ${b2.x.toFixed(2)},${b2.y.toFixed(2)}`);
        }
      }

      // Kutei's fields, wired to their nearest neighbours. A basin is not a
      // scatter of dots — it is one connected system, which is the entire
      // premise of the deck, so the picture had better say so. Three links per
      // field: enough to read as a network, few enough to stay legible when
      // the lens is zoomed all the way out.
      const kf = fields.filter((f) => f.kutei);
      const links: Link[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < kf.length; i += 1) {
        const near = kf
          .map((b, j) => ({ b, j, d: (b.x - kf[i].x) ** 2 + (b.y - kf[i].y) ** 2 }))
          .filter((x) => x.j !== i)
          .sort((p, q) => p.d - q.d)
          .slice(0, 3);
        for (const n of near) {
          const key = i < n.j ? `${i}-${n.j}` : `${n.j}-${i}`;
          if (seen.has(key)) continue;
          seen.add(key);
          links.push({ a: kf[i], b: n.b });
        }
      }

      setLens({
        rings, fields, links, arcs,
        stops: [
          { x: VB / 2, y: VB / 2, z: 1 },
          kutei,
          focus ?? { ...kutei, z: 26 },
          // Back out to the whole archipelago, a touch wider than we started,
          // so the last stop is visibly a RETURN rather than the beginning.
          { x: VB / 2, y: VB / 2, z: 0.92 },
        ],
      });
    });
    return () => { live = false; };
  }, []);

  return lens;
}

/** Ease each leg separately so the camera settles at every stop instead of
 *  gliding through them — a fall that never pauses reads as a pan. */
const easeLeg = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Drives ITSELF, and writes the camera straight to the DOM.
 *
 *  The previous version took a `depth` prop that the scene updated on every
 *  GSAP tick — about 660 React renders across an eleven-second fall, each one
 *  reconciling the whole SVG subtree. That, not the geometry, is what made the
 *  zoom-out crawl.
 *
 *  Now the tween lives here and its onUpdate sets `transform` on one node and
 *  `opacity` on one more. React renders only when the STOP changes (four times)
 *  or when the quantised zoom crosses a step, so the dots can be re-sized.
 *  `onStop` lets the scene keep its label in sync without owning the clock. */
export function BasinLens({
  duration = 11, delay = 1.1, onStop,
}: { duration?: number; delay?: number; onStop?: (i: number) => void }) {
  const lens = useIndonesia();
  const camRef = useRef<SVGGElement>(null);
  const weaveRef = useRef<SVGGElement>(null);
  const stopRef = useRef(-1);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;
  // Quantised zoom, the ONLY per-frame value allowed to reach React — and only
  // when it crosses a step, which is roughly twenty times, not 660.
  const [zq, setZq] = useState(1);

  useEffect(() => {
    if (!lens) return;
    const stops = lens.stops;
    const legs = stops.length - 1;

    const apply = (d: number) => {
      const raw = Math.min(0.9999, Math.max(0, d)) * legs;
      const i = Math.floor(raw);
      const t = easeLeg(raw - i);
      const a = stops[i], b = stops[i + 1] ?? a;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      // Zoom interpolates in LOG space. Linear between 1× and 26× spends
      // almost the whole leg already deep, which reads as a jump.
      const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t);

      if (camRef.current) {
        camRef.current.style.transform =
          `translate(${VB / 2}px, ${VB / 2}px) scale(${z}) translate(${-x}px, ${-y}px)`;
      }
      // The weave belongs to the final leg only.
      const woven = Math.max(0, Math.min(1, d * legs - (legs - 1)));
      if (weaveRef.current) {
        weaveRef.current.style.opacity = String(woven * 0.62);
        weaveRef.current.style.visibility = woven > 0 ? 'visible' : 'hidden';
      }

      const q = Math.max(0.5, Math.round(z * 3) / 3);
      setZq((prev) => (prev === q ? prev : q));

      if (i !== stopRef.current) {
        stopRef.current = i;
        onStopRef.current?.(i);
      }
    };

    if (prefersReducedMotion()) { apply(1); return; }
    apply(0);
    const o = { d: 0 };
    const tw = gsap.to(o, { d: 1, duration, delay, ease: 'none', onUpdate: () => apply(o.d) });
    return () => { tw.kill(); };
  }, [lens, duration, delay]);

  const shapes = useMemo(() => (
    <>
      {lens?.rings.map((r, i) => (
        <path key={`r${i}`} d={r.d} className={'kn-lens-ring' + (r.kutei ? ' on' : '')} />
      ))}
      {/* Links under the dots, so a dot is never cut by its own edge. */}
      {lens?.links.map((l, i) => (
        <line key={`l${i}`} className="kn-lens-link"
          x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y}
          style={{ animationDelay: `${(i % 9) * 0.34}s` }} />
      ))}
    </>
  ), [lens]);

  const dots = useMemo(() => lens?.fields.map((f, i) => (
    <circle key={`f${i}`} className={'kn-lens-field' + (f.kutei ? ' on' : '')}
      cx={f.x} cy={f.y} r={f.r / Math.sqrt(zq)}
      style={f.kutei ? { animationDelay: `${(i % 7) * 0.29}s` } : undefined} />
  )), [lens, zq]);

  const arcs = useMemo(() => lens?.arcs.map((d, i) => (
    <path key={`a${i}`} className="kn-lens-arc" d={d}
      style={{ animationDelay: `${(i % 11) * 0.21}s` }} />
  )), [lens]);

  return (
    <div className="kn-lens" aria-hidden>
      <svg viewBox={`0 0 ${VB} ${VB}`}>
        <defs>
          <clipPath id="kn-lens-clip">
            <circle cx={VB / 2} cy={VB / 2} r={VB / 2 - 0.5} />
          </clipPath>
          <radialGradient id="kn-lens-glow">
            <stop offset="55%" stopColor="#69D6FF" stopOpacity="0" />
            <stop offset="100%" stopColor="#69D6FF" stopOpacity="0.22" />
          </radialGradient>
        </defs>

        <circle cx={VB / 2} cy={VB / 2} r={VB / 2 - 0.5} fill="url(#kn-lens-glow)" />

        <g clipPath="url(#kn-lens-clip)">
          <g ref={camRef} style={{ transformOrigin: '0 0' }}>
            {/* The weave: every province joined to every other, on the last leg
                only. One opacity on the group, not one per arc. */}
            {/* Always mounted, faded by the group. Mounting these DURING the
                final transform was a visible hitch at the worst moment. */}
            <g ref={weaveRef} style={{ opacity: 0, visibility: 'hidden' }}>
              {arcs}
            </g>
            {shapes}
            {dots}
          </g>
        </g>

        <circle className="kn-lens-rim" cx={VB / 2} cy={VB / 2} r={VB / 2 - 0.5} />
        {/* Crosshair — the lens reads as an instrument, not a sticker. */}
        <g className="kn-lens-cross">
          <line x1={VB / 2} y1="1" x2={VB / 2} y2="6" />
          <line x1={VB / 2} y1={VB - 6} x2={VB / 2} y2={VB - 1} />
          <line x1="1" y1={VB / 2} x2="6" y2={VB / 2} />
          <line x1={VB - 6} y1={VB / 2} x2={VB - 1} y2={VB / 2} />
        </g>
      </svg>
    </div>
  );
}
