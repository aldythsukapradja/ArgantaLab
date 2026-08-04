// fielddev/interpret.ts — the things a user DRAWS on the map, and their geometry.
//
// Everything the Data QC pipeline delivers is observed: a survey, a pick, a grid.
// This module is the other kind of object — the ones a person creates. An area of
// interest, a proposed well location, a correlation line, the trace of a section.
// They are interpretation, and the model says so on every record: `origin: 'user'`
// and an ISO timestamp, so a later reader can always separate what was measured
// from what somebody drew.
//
// STORAGE IS LOCAL AND SAYS SO. These persist to localStorage, per field. They are
// NOT written to the OSDU store and are NOT published: an interpretation that has
// not been reviewed has no business entering the system of record, and pretending
// otherwise would put an unreviewed polygon next to a regulator's outline with the
// same apparent authority. Promotion to OSDU is a separate, deliberate step that
// does not exist yet.
//
// Geometry is in LON/LAT, because these are drawn on the map and must survive a
// change of horizon. Area and length convert to metres on the sphere at use.

export type ToolKind = 'select' | 'pan' | 'point' | 'obs' | 'well' | 'polyline' | 'polygon' | 'section';

/** The kinds that produce a persisted object. `select` and `pan` do not. */
export type FeatureKind = Exclude<ToolKind, 'select' | 'pan'>;

export interface LonLat { lon: number; lat: number }

export interface InterpFeature {
  id: string;
  kind: FeatureKind;
  name: string;
  pts: LonLat[];
  /** always 'user' here — the field exists so the value is explicit in the record
   *  rather than implied by which file it came from */
  origin: 'user';
  createdAt: string;
  note?: string;
}

/** How many points a kind needs before it is a finished object. A polygon needs
 *  three: two points is a line pretending to enclose something. */
export const MIN_POINTS: Record<FeatureKind, number> = {
  point: 1, obs: 1, well: 1, polyline: 2, polygon: 3, section: 2,
};

/** Kinds the user builds up click-by-click and finishes explicitly. */
export const MULTI_POINT: FeatureKind[] = ['polyline', 'polygon', 'section'];

export const isComplete = (kind: FeatureKind, n: number) => n >= MIN_POINTS[kind];

const R = 6371008.8;
const rad = Math.PI / 180;

/** Great-circle length of a polyline, metres. */
export function featureLengthM(pts: LonLat[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
    d += Math.hypot(dLat, dLon) * R;
  }
  return d;
}

/** Spherical-excess area of a closed ring, m². Returns 0 for fewer than 3 points
 *  rather than a number that would imply an enclosure that does not exist. */
export function featureAreaM2(pts: LonLat[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += (pts[i].lon * rad - pts[j].lon * rad) * (2 + Math.sin(pts[j].lat * rad) + Math.sin(pts[i].lat * rad));
  }
  return Math.abs((s * R * R) / 2);
}

/** Human label for the list: the measurement that matters for that kind. */
export function featureMeasure(f: InterpFeature): string {
  if (f.kind === 'polygon') {
    const km2 = featureAreaM2(f.pts) / 1e6;
    return `${km2 < 1 ? km2.toFixed(2) : km2.toFixed(1)} km²`;
  }
  if (f.kind === 'polyline' || f.kind === 'section') {
    const m = featureLengthM(f.pts);
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
  }
  const p = f.pts[0];
  return p ? `${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°` : '—';
}

/** Stable-ish id without a clock collision inside one millisecond. */
let seq = 0;
export function newFeature(kind: FeatureKind, pts: LonLat[], existing: InterpFeature[], now = new Date()): InterpFeature {
  const n = existing.filter((f) => f.kind === kind).length + 1;
  const label: Record<FeatureKind, string> = {
    point: 'Point', obs: 'Observation', well: 'Proposed well',
    polyline: 'Line', polygon: 'Polygon', section: 'Section',
  };
  seq += 1;
  return {
    id: `${kind}-${now.getTime()}-${seq}`,
    kind,
    name: `${label[kind]} ${n}`,
    pts: pts.slice(),
    origin: 'user',
    createdAt: now.toISOString(),
  };
}

// ── persistence ───────────────────────────────────────────────────────────────
// Per field, so switching fields does not carry another asset's interpretation.
const key = (fieldId: string) => `arganta:fd:interp:${fieldId}`;

export function loadFeatures(fieldId: string): InterpFeature[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key(fieldId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // a stored record from an older shape is dropped, not coerced — a half-read
    // polygon is worse than none
    return parsed.filter((f): f is InterpFeature => !!f
      && typeof f === 'object'
      && typeof (f as InterpFeature).id === 'string'
      && Array.isArray((f as InterpFeature).pts)
      && (f as InterpFeature).pts.every((p) => Number.isFinite(p?.lon) && Number.isFinite(p?.lat))
      && isComplete((f as InterpFeature).kind, (f as InterpFeature).pts.length));
  } catch { return []; }
}

export function saveFeatures(fieldId: string, features: InterpFeature[]): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key(fieldId), JSON.stringify(features)); } catch { /* quota */ }
}

/** GeoJSON for the map layers. Point-like kinds become Points, the rest lines or
 *  a closed ring. The kind travels in properties so one source can drive several
 *  styled layers. */
export function toGeoJson(features: InterpFeature[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => {
      const coords = f.pts.map((p) => [p.lon, p.lat] as [number, number]);
      const geometry: GeoJSON.Geometry = f.kind === 'polygon'
        ? { type: 'Polygon', coordinates: [[...coords, coords[0]]] }
        : coords.length === 1
          ? { type: 'Point', coordinates: coords[0] }
          : { type: 'LineString', coordinates: coords };
      return {
        type: 'Feature' as const,
        id: f.id,
        properties: { id: f.id, kind: f.kind, name: f.name },
        geometry,
      };
    }),
  };
}
