// sim/streamline.ts (S6) — the streamline twin. Reuses the SAME pressure/flux
// field the FV sim solves (S4 kernel), then decouples transport: trace streamlines
// with Pollock's semi-analytic method, accumulate time-of-flight (TOF), and derive
// the flux diagnostics a cell field can't show — injector→producer allocation and
// swept volumes. Pure TS. Validated in scripts/test-sim.mjs (homogeneous
// TOF = PV/Q; five-spot allocation → the single producer).
//
// Flux field is per-face TOTAL flux (from fv.solvePressureMob / pressure.solvePressure):
// fluxX[(nx-1)*ny] sign +i, fluxY[nx*(ny-1)] sign +j.

export interface StreamGeom { nx: number; ny: number; dx: number; dy: number; dz: number; phi: ArrayLike<number>; x0?: number; y0?: number }
export interface WellCell { i: number; j: number; name: string; kind: 'inj' | 'prod' }
export interface Streamline { pts: Array<[number, number]>; totalTof: number; fromWell: string; toWell: string | null }
export interface StreamResult {
  lines: Streamline[];
  allocation: Record<string, number>;   // "INJ→PROD" → fraction of that injector's streamlines
  maxTof: number;
}

/** Pollock exit time along one axis: v(s) = v0 + (v1−v0)·s/ds from face 0→ds, particle
 * at s. Returns {t, face} (0 or 1) or t=Infinity if it can't exit this axis. */
function axisExit(v0: number, v1: number, s: number, ds: number): { t: number; face: 0 | 1 } {
  const g = (v1 - v0) / ds, vs = v0 + g * s, TINY = 1e-30;
  if (Math.abs(g) < TINY) {
    if (vs > TINY) return { t: (ds - s) / vs, face: 1 };
    if (vs < -TINY) return { t: s / -vs, face: 0 };
    return { t: Infinity, face: 1 };
  }
  if (vs > TINY && v1 > TINY) return { t: (1 / g) * Math.log(v1 / vs), face: 1 };
  if (vs < -TINY && v0 < -TINY) return { t: (1 / g) * Math.log(v0 / vs), face: 0 };
  return { t: Infinity, face: 1 };
}
/** Advance a local coordinate by time dt through the linear velocity field. */
function advance(v0: number, v1: number, s: number, ds: number, dt: number): number {
  const g = (v1 - v0) / ds, vs = v0 + g * s;
  if (Math.abs(g) < 1e-30) return s + vs * dt;
  return s + (vs * (Math.exp(g * dt) - 1)) / g;
}

function traceOne(
  g: StreamGeom, startX: number, startY: number,
  fluxX: ArrayLike<number>, fluxY: ArrayLike<number>, wellAt: (i: number, j: number) => WellCell | undefined,
  fromWell: string, maxCells: number,
): Streamline {
  const { nx, ny, dx, dy, dz } = g; const ax = dy * dz, ay = dx * dz;
  const ox = g.x0 ?? 0, oy = g.y0 ?? 0;
  let i = Math.max(0, Math.min(nx - 1, Math.floor((startX - ox) / dx)));
  let j = Math.max(0, Math.min(ny - 1, Math.floor((startY - oy) / dy)));
  let px = startX - (ox + i * dx), py = startY - (oy + j * dy);   // local [0,dx]×[0,dy]
  const pts: Array<[number, number]> = [[startX, startY]];
  let t = 0, toWell: string | null = null;
  for (let step = 0; step < maxCells; step++) {
    const phi = g.phi[j * nx + i] || 1e-6;
    const vxL = (i > 0 ? fluxX[j * (nx - 1) + (i - 1)] : 0) / (phi * ax);
    const vxR = (i < nx - 1 ? fluxX[j * (nx - 1) + i] : 0) / (phi * ax);
    const vyB = (j > 0 ? fluxY[(j - 1) * nx + i] : 0) / (phi * ay);
    const vyT = (j < ny - 1 ? fluxY[j * nx + i] : 0) / (phi * ay);
    const ex = axisExit(vxL, vxR, px, dx), ey = axisExit(vyB, vyT, py, dy);
    const dt = Math.min(ex.t, ey.t);
    if (!isFinite(dt) || dt <= 0) break;
    px = advance(vxL, vxR, px, dx, dt); py = advance(vyB, vyT, py, dy, dt); t += dt;
    // snap to the crossed face, step to the neighbour
    let ni = i, nj = j;
    if (ex.t <= ey.t) { if (ex.face === 1) { px = dx; ni = i + 1; } else { px = 0; ni = i - 1; } }
    else { if (ey.face === 1) { py = dy; nj = j + 1; } else { py = 0; nj = j - 1; } }
    pts.push([ox + i * dx + px, oy + j * dy + py]);
    if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) break;
    i = ni; j = nj; px = ex.t <= ey.t ? (ex.face === 1 ? 0 : dx) : px; py = ex.t <= ey.t ? py : (ey.face === 1 ? 0 : dy);
    const w = wellAt(i, j);
    if (w && w.kind === 'prod') { toWell = w.name; pts.push([ox + (i + 0.5) * dx, oy + (j + 0.5) * dy]); break; }
  }
  return { pts, totalTof: t, fromWell, toWell };
}

/** Trace `perInjector` streamlines from each injector cell through the flux field. */
export function traceStreamlines(
  g: StreamGeom, fluxX: ArrayLike<number>, fluxY: ArrayLike<number>, wells: WellCell[],
  opts: { perInjector?: number; maxCells?: number } = {},
): StreamResult {
  const per = opts.perInjector ?? 24, maxCells = opts.maxCells ?? (g.nx + g.ny) * 4;
  const ox = g.x0 ?? 0, oy = g.y0 ?? 0;
  const wellAt = (i: number, j: number) => wells.find((w) => w.i === i && w.j === j);
  const injectors = wells.filter((w) => w.kind === 'inj');
  const lines: Streamline[] = [];
  const tally: Record<string, { hit: number; tot: number }> = {};
  for (const inj of injectors) {
    const ccx = ox + (inj.i + 0.5) * g.dx, ccy = oy + (inj.j + 0.5) * g.dy;
    const r = 0.3 * Math.min(g.dx, g.dy);
    for (let s = 0; s < per; s++) {
      const ang = (2 * Math.PI * s) / per;
      const sl = traceOne(g, ccx + r * Math.cos(ang), ccy + r * Math.sin(ang), fluxX, fluxY, wellAt, inj.name, maxCells);
      lines.push(sl);
      tally[inj.name] = tally[inj.name] ?? { hit: 0, tot: 0 }; tally[inj.name].tot++;
      if (sl.toWell) { const k = `${inj.name}→${sl.toWell}`; tally[k] = tally[k] ?? { hit: 0, tot: 0 }; tally[k].hit++; }
    }
  }
  const allocation: Record<string, number> = {};
  for (const [k, v] of Object.entries(tally)) if (k.includes('→')) { const inj = k.split('→')[0]; allocation[k] = v.hit / (tally[inj]?.tot || 1); }
  let maxTof = 0; for (const sl of lines) maxTof = Math.max(maxTof, sl.totalTof);
  return { lines, allocation, maxTof };
}
