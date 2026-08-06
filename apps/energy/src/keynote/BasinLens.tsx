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
import { useEffect, useMemo, useState } from 'react';
import { loadProvinceGeo, loadScopeFields } from '../tabs/exploration/data';
import { INDONESIA_CODES, KUTEI } from './data';

const VB = 100;

interface Ring { d: string; kutei: boolean }
interface Pt { x: number; y: number; r: number; kutei: boolean }
interface Stop { x: number; y: number; z: number }
interface Lens { rings: Ring[]; fields: Pt[]; stops: [Stop, Stop, Stop] }

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

      setLens({
        rings, fields,
        stops: [{ x: VB / 2, y: VB / 2, z: 1 }, kutei, focus ?? { ...kutei, z: 26 }],
      });
    });
    return () => { live = false; };
  }, []);

  return lens;
}

/** Ease each leg separately so the camera settles at every stop instead of
 *  gliding through them — a fall that never pauses reads as a pan. */
const easeLeg = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export function BasinLens({ depth }: { depth: number }) {
  const lens = useIndonesia();

  const view = useMemo(() => {
    if (!lens) return { x: VB / 2, y: VB / 2, z: 1 };
    // depth 0→1 across three stops = two legs.
    const legs = lens.stops.length - 1;
    const raw = Math.min(0.9999, Math.max(0, depth)) * legs;
    const i = Math.floor(raw);
    const t = easeLeg(raw - i);
    const a = lens.stops[i], b = lens.stops[i + 1] ?? a;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      // Zoom is interpolated in LOG space. Linear interpolation between 1× and
      // 26× spends almost the whole leg already deep, which feels like a jump.
      z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t),
    };
  }, [lens, depth]);

  const { x, y, z } = view;

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
          <g style={{
            transform: `translate(${VB / 2}px, ${VB / 2}px) scale(${z}) translate(${-x}px, ${-y}px)`,
            transformOrigin: '0 0',
          }}>
            {lens?.rings.map((r, i) => (
              <path key={i} d={r.d}
                className={'kn-lens-ring' + (r.kutei ? ' on' : '')}
                /* Divided by the zoom so an outline stays a hairline instead of
                   thickening into a slab as the lens descends. */
                strokeWidth={(r.kutei ? 0.7 : 0.4) / z} />
            ))}
            {lens?.fields.map((f, i) => (
              <circle key={i} className={'kn-lens-field' + (f.kutei ? ' on' : '')}
                cx={f.x} cy={f.y} r={f.r / Math.sqrt(z)} />
            ))}
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
