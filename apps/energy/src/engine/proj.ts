// proj.ts — projected survey grid → WGS84 lon/lat, for putting an interpreted
// surface on the web map.
//
// The Volve horizon grids are ED50 / UTM 31N (the CRS the bundle declares). The
// cockpit map is WGS84. Two conversions are needed and BOTH matter at field
// scale, so neither is skipped:
//
//   1. inverse UTM on the ellipsoid the grid was actually projected with —
//      ED50 uses International 1924 (Hayford), NOT WGS84's ellipsoid. Using the
//      wrong one puts the grid ~150 m out on its own.
//   2. the ED50 → WGS84 DATUM shift. Same lat/lon numbers on two datums are two
//      different points on the ground; in the North Sea the offset is ~100-200 m,
//      which is several grid cells at 50 m spacing.
//
// Done as a proper 3-parameter Helmert through geocentric XYZ rather than a
// lat/lon fudge. Deliberately dependency-free (no proj4) and pure, so it is
// node-testable against a published control point.
//
// Accuracy: 3-parameter (translation-only) is the standard screening transform
// for ED50→WGS84 in this region and is good to a few metres — appropriate for
// draping a 50 m grid, NOT for survey work. A 7-parameter transform would be
// needed for that, and this module deliberately does not pretend to offer one.

const DEG = Math.PI / 180;

export interface Ellipsoid { a: number; f: number }
/** ED50's ellipsoid — International 1924 / Hayford. */
export const INTL_1924: Ellipsoid = { a: 6378388, f: 1 / 297 };
export const WGS84: Ellipsoid = { a: 6378137, f: 1 / 298.257223563 };

/** ED50 → WGS84, EPSG:1311 (mean for Europe). Sign convention: ADD to ED50. */
export const ED50_TO_WGS84 = { dx: -87, dy: -98, dz: -121 };

const K0 = 0.9996;
const FALSE_EASTING = 500000;

/** Inverse Transverse Mercator (UTM) → geodetic lat/lon ON THE SAME DATUM. */
export function utmToGeodetic(
  easting: number, northing: number, zone: number, el: Ellipsoid = INTL_1924,
): { lat: number; lon: number } {
  const { a, f } = el;
  const e2 = 2 * f - f * f;
  const ep2 = e2 / (1 - e2);
  const lon0 = ((zone - 1) * 6 - 180 + 3) * DEG;

  const M = northing / K0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 = mu
    + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sin1 = Math.sin(phi1), cos1 = Math.cos(phi1), tan1 = Math.tan(phi1);
  const C1 = ep2 * cos1 * cos1;
  const T1 = tan1 * tan1;
  const N1 = a / Math.sqrt(1 - e2 * sin1 * sin1);
  const R1 = (a * (1 - e2)) / (1 - e2 * sin1 * sin1) ** 1.5;
  const D = (easting - FALSE_EASTING) / (N1 * K0);

  const lat = phi1 - ((N1 * tan1) / R1) * (
    (D * D) / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720
  );
  const lon = lon0 + (
    D
    - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120
  ) / cos1;

  return { lat: lat / DEG, lon: lon / DEG };
}

/** Geodetic → geocentric XYZ. */
function toXyz(latDeg: number, lonDeg: number, h: number, el: Ellipsoid) {
  const { a, f } = el;
  const e2 = 2 * f - f * f;
  const lat = latDeg * DEG, lon = lonDeg * DEG;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return {
    x: (N + h) * Math.cos(lat) * Math.cos(lon),
    y: (N + h) * Math.cos(lat) * Math.sin(lon),
    z: (N * (1 - e2) + h) * Math.sin(lat),
  };
}

/** Geocentric XYZ → geodetic, by Bowring's closed-form (no iteration needed). */
function toGeodetic(x: number, y: number, z: number, el: Ellipsoid) {
  const { a, f } = el;
  const b = a * (1 - f);
  const e2 = 2 * f - f * f;
  const ep2 = (a * a - b * b) / (b * b);
  const p = Math.hypot(x, y);
  const th = Math.atan2(a * z, b * p);
  const lat = Math.atan2(z + ep2 * b * Math.sin(th) ** 3, p - e2 * a * Math.cos(th) ** 3);
  const lon = Math.atan2(y, x);
  return { lat: lat / DEG, lon: lon / DEG };
}

/** ED50 lat/lon → WGS84 lat/lon via a 3-parameter geocentric translation. */
export function ed50ToWgs84(latDeg: number, lonDeg: number, h = 0): { lat: number; lon: number } {
  const p = toXyz(latDeg, lonDeg, h, INTL_1924);
  return toGeodetic(p.x + ED50_TO_WGS84.dx, p.y + ED50_TO_WGS84.dy, p.z + ED50_TO_WGS84.dz, WGS84);
}

/** The whole chain: an ED50/UTM grid coordinate → WGS84 lon/lat for the map. */
export function ed50UtmToWgs84(easting: number, northing: number, zone = 31): { lon: number; lat: number } {
  const g = utmToGeodetic(easting, northing, zone, INTL_1924);
  const w = ed50ToWgs84(g.lat, g.lon);
  return { lon: w.lon, lat: w.lat };
}

/** Corner bounds of a regular grid, as WGS84 lon/lat.
 *  Returned SW→NE; a MapLibre image source wants its four corners explicitly, so
 *  all four are given rather than assuming the box stays axis-aligned after
 *  reprojection (it does not, exactly — the rotation is small but real). */
export function gridCornersWgs84(
  x0: number, y0: number, nx: number, ny: number, cell: number, zone = 31,
): { sw: [number, number]; se: [number, number]; ne: [number, number]; nw: [number, number] } {
  const x1 = x0 + (nx - 1) * cell, y1 = y0 + (ny - 1) * cell;
  const pt = (e: number, n: number): [number, number] => {
    const { lon, lat } = ed50UtmToWgs84(e, n, zone);
    return [lon, lat];
  };
  return { sw: pt(x0, y0), se: pt(x1, y0), ne: pt(x1, y1), nw: pt(x0, y1) };
}
