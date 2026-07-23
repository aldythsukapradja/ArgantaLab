// steerModel.ts — the geosteering earth-model for the Steering cockpit, built the
// StarSteer way: a type-well GR profile, a dipping target zone (with a fault), and
// the lateral wellpath positioned by TVT (true vertical thickness below the top).
// Measured lateral GR is derived from the well's stratigraphic position — climb out
// of the sand and GR rises, exactly as a real azimuthal-GR geosteer reads it.
// Type-well GR texture comes from REAL Volve logs; geometry is scenario-grade.

export interface GrByStrat { s: number; gr: number }        // GR vs stratigraphic depth below top (m TVT)
export interface SteerNode {
  vs: number;            // along-hole horizontal displacement (m)
  md: number;            // measured depth (m)
  tvtActual: number;     // actual TVT below top boundary (m)
  tvtPlan: number;       // planned TVT (mid-zone)
  topTvd: number;        // top-boundary TVD at this VS (m)
  wellTvd: number;       // actual well TVD (m)
  gr: number;            // measured GR (API)
  inZone: boolean;
  dtbUp: number;         // distance to top boundary (m, +down)
  dtbDown: number;       // distance to base boundary (m)
}
export interface SteerModel {
  nodes: SteerNode[];
  grByStrat: GrByStrat[];
  zoneThick: number;
  topTvd0: number;       // top TVD at heel
  dip: number;           // TVD change per metre VS (structural dip, +down)
  faultVs: number | null;
  faultThrow: number;    // m
  vsMax: number;
  tvdMin: number; tvdMax: number;
  grMin: number; grMax: number;
  typeWell: string;
  inZonePct: number;
  landingVs: number;     // where the lateral lands in-zone
  topTvdAt: (vs: number) => number;
  baseTvdAt: (vs: number) => number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Sample a GrByStrat profile at stratigraphic depth s (linear interp, clamped). */
export function grAtStrat(prof: GrByStrat[], s: number): number {
  if (!prof.length) return 75;
  if (s <= prof[0].s) return prof[0].gr;
  if (s >= prof[prof.length - 1].s) return prof[prof.length - 1].gr;
  let lo = 0, hi = prof.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (prof[m].s < s) lo = m; else hi = m; }
  const a = prof[lo], b = prof[hi], t = (s - a.s) / (b.s - a.s || 1);
  return a.gr + (b.gr - a.gr) * t;
}

/**
 * Build the earth model. `realGr` = a slice of REAL Volve GR values (any length),
 * used purely as high-frequency texture on top of a clean sand/shale layer cake so
 * the target reads low-GR and the bounding shales read high-GR.
 */
export function buildSteerModel(opts: {
  typeWell: string; realGr: number[]; zoneThick: number; topTvd0: number; vsMax?: number;
}): SteerModel {
  const { typeWell, realGr, zoneThick } = opts;
  const topTvd0 = opts.topTvd0;
  const vsMax = opts.vsMax ?? 1300;
  const dip = 0.028;                 // ~1.6° structural dip, going deeper along the lateral
  const faultVs = vsMax * 0.62;      // a small normal fault two-thirds along
  const faultThrow = 9;              // m down-to-the-toe

  // real-GR texture: mean-removed, small amplitude
  const rg = realGr.filter((v) => v != null && isFinite(v));
  const rgMean = rg.length ? rg.reduce((a, b) => a + b, 0) / rg.length : 75;
  const tex = (i: number) => (rg.length ? (rg[i % rg.length] - rgMean) : 0) * 0.18;

  // layer cake in stratigraphic space (s = TVT below top): shale · SAND · shale
  const grByStrat: GrByStrat[] = [];
  for (let s = -34; s <= zoneThick + 34; s += 1) {
    const inSand = s >= 0 && s <= zoneThick;
    // smooth boundaries over ~3 m
    const edgeTop = clamp((s - 0) / 3 + 0.5, 0, 1);
    const edgeBase = clamp((zoneThick - s) / 3 + 0.5, 0, 1);
    const sandiness = inSand ? Math.min(edgeTop, edgeBase) : (s < 0 ? clamp(0.5 + s / 3, 0, 1) : clamp(0.5 + (zoneThick - s) / 3, 0, 1));
    const gr = 108 - sandiness * 72 + tex(Math.round((s + 34) * 3));   // shale ~108 → sand ~36
    grByStrat.push({ s, gr: clamp(gr, 12, 150) });
  }

  const topTvdAt = (vs: number) => topTvd0 + dip * vs + (faultVs != null && vs > faultVs ? faultThrow : 0);
  const baseTvdAt = (vs: number) => topTvdAt(vs) + zoneThick;

  // lateral: build a deterministic actual path that lands, holds mid-zone, makes two
  // corrections and briefly exits high near a fault — the classic geosteering story.
  const n = 130;
  const landingVs = vsMax * 0.06;
  const nodes: SteerNode[] = [];
  let inCount = 0;
  for (let i = 0; i <= n; i++) {
    const vs = (vsMax * i) / n;
    const p = i / n;
    const tvtPlan = zoneThick / 2;
    // undulation around mid-zone; excursion up just after the fault
    let tvtActual = zoneThick / 2
      + Math.sin(p * 8.5) * zoneThick * 0.30
      + Math.sin(p * 2.3 + 0.6) * zoneThick * 0.22;
    if (faultVs != null && vs > faultVs && vs < faultVs + vsMax * 0.12) tvtActual -= zoneThick * 0.9; // pop up over the fault
    if (vs < landingVs) tvtActual = zoneThick / 2 - (1 - vs / landingVs) * zoneThick * 2.2;           // landing from above
    const topTvd = topTvdAt(vs);
    const wellTvd = topTvd + tvtActual;
    const md = 3050 + vs / Math.cos(0.5) + i * 2;   // illustrative MD along a near-horizontal lateral
    const inZone = tvtActual >= 0 && tvtActual <= zoneThick;
    if (inZone) inCount++;
    nodes.push({
      vs, md, tvtActual, tvtPlan, topTvd, wellTvd,
      gr: grAtStrat(grByStrat, tvtActual), inZone,
      dtbUp: tvtActual, dtbDown: zoneThick - tvtActual,
    });
  }

  const tvds = nodes.flatMap((d) => [d.topTvd, d.wellTvd, d.topTvd + zoneThick]);
  return {
    nodes, grByStrat, zoneThick, topTvd0, dip, faultVs, faultThrow, vsMax,
    tvdMin: Math.min(...tvds) - 6, tvdMax: Math.max(...tvds) + 6,
    grMin: 10, grMax: 150, typeWell, landingVs,
    inZonePct: Math.round((inCount / nodes.length) * 100),
    topTvdAt, baseTvdAt,
  };
}
