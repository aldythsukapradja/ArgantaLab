// fluids-charts.tsx — the Fluids & Rock stage's plots.
//
// Every chart here draws the PUBLISHED CASE and nothing else: pass it a
// DynamicInitialization and it renders that case's own tables. There is no separate
// "display" data path, so a chart cannot show one thing while the exported deck says
// another — which is the failure mode this whole stage exists to prevent.
//
// Plain SVG with hand-built scales, matching the rest of the suite. Deliberately
// resolution-independent (viewBox + preserveAspectRatio none) so a panel can be any
// size without a resize observer.
import type {
  DynamicInitialization, PressurePoint, PvtModel, ScalEndpoints, ScalRow, WellGradient,
} from './fluid-model';
import { coreyKr, fracFlow, swAtHeight } from './fluid-model';

const W = 640, H = 380;

interface Pad { l: number; r: number; t: number; b: number }
const PAD: Pad = { l: 46, r: 44, t: 12, b: 30 };

/** A linear scale over a range that is never zero-width. */
function scale(min: number, max: number, lo: number, hi: number) {
  const span = max - min || 1;
  return (v: number) => lo + ((v - min) / span) * (hi - lo);
}

function ticks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

const fmt = (v: number, d = 2) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(d));

function Frame({ children, xLabel, yLabel, y2Label }: {
  children: React.ReactNode; xLabel: string; yLabel: string; y2Label?: string;
}) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="none" stroke="var(--line2)" />
      {children}
      <text x={(W - PAD.r + PAD.l) / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--ink3)">{xLabel}</text>
      <text x={12} y={(H - PAD.b + PAD.t) / 2} textAnchor="middle" fontSize={9} fill="var(--ink3)"
        transform={`rotate(-90 12 ${(H - PAD.b + PAD.t) / 2})`}>{yLabel}</text>
      {y2Label && (
        <text x={W - 8} y={(H - PAD.b + PAD.t) / 2} textAnchor="middle" fontSize={9} fill="var(--ink3)"
          transform={`rotate(90 ${W - 8} ${(H - PAD.b + PAD.t) / 2})`}>{y2Label}</text>
      )}
    </svg>
  );
}

function XAxis({ values, x, d = 0 }: { values: number[]; x: (v: number) => number; d?: number }) {
  return (
    <g>
      {values.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line2)" strokeDasharray="2 4" opacity={0.55} />
          <text x={x(v)} y={H - PAD.b + 12} textAnchor="middle" fontSize={8.5} fill="var(--ink3)">{fmt(v, d)}</text>
        </g>
      ))}
    </g>
  );
}

function YAxis({ values, y, d = 2, right = false, color = 'var(--ink3)' }: {
  values: number[]; y: (v: number) => number; d?: number; right?: boolean; color?: string;
}) {
  return (
    <g>
      {values.map((v) => (
        <g key={v}>
          {!right && <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--line2)" strokeDasharray="2 4" opacity={0.55} />}
          <text x={right ? W - PAD.r + 5 : PAD.l - 5} y={y(v) + 3} textAnchor={right ? 'start' : 'end'} fontSize={8.5} fill={color}>{fmt(v, d)}</text>
        </g>
      ))}
    </g>
  );
}

const path = (pts: Array<[number, number]>) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');

// ── PVT: Bo and Rs against pressure ──────────────────────────────────────────

/**
 * The black-oil chart. Two branches meet at the bubble point: below it Rs and Bo both
 * fall with pressure as gas comes out of solution; above it Rs is flat and Bo falls
 * only by compression. The kink at Pb IS the physics, so it is drawn as a kink and
 * marked, never smoothed.
 */
export function PvtChart({ pvt, pb, pi }: { pvt: PvtModel; pb: number; pi: number }) {
  const rows = [...pvt.pvto, ...pvt.undersaturated.slice(1)];
  const pMin = 0, pMax = Math.max(...rows.map((r) => r.p));
  const boMin = Math.min(...rows.map((r) => r.bo)), boMax = Math.max(...rows.map((r) => r.bo));
  const rsMax = Math.max(...rows.map((r) => r.rs));
  const x = scale(pMin, pMax, PAD.l, W - PAD.r);
  const yBo = scale(boMin * 0.98, boMax * 1.02, H - PAD.b, PAD.t);
  const yRs = scale(0, rsMax * 1.06, H - PAD.b, PAD.t);

  return (
    <Frame xLabel="pressure (bara)" yLabel="Bo (rm³/Sm³)" y2Label="Rs (Sm³/Sm³)">
      <XAxis values={ticks(pMin, pMax, 6)} x={x} />
      <YAxis values={ticks(boMin * 0.98, boMax * 1.02, 5)} y={yBo} d={3} />
      <YAxis values={ticks(0, rsMax * 1.06, 5)} y={yRs} d={0} right color="var(--amber,#fbbf24)" />
      {/* bubble point and initial pressure */}
      {[{ p: pb, c: 'var(--purple,#a78bfa)', t: `Pb ${pb}` }, { p: pi, c: 'var(--teal)', t: `Pi ${pi}` }].map((m) => (
        <g key={m.t}>
          <line x1={x(m.p)} x2={x(m.p)} y1={PAD.t} y2={H - PAD.b} stroke={m.c} strokeWidth={1} strokeDasharray="4 3" />
          <text x={x(m.p) + 4} y={PAD.t + 11} fontSize={8.5} fill={m.c}>{m.t}</text>
        </g>
      ))}
      <path d={path(rows.map((r) => [x(r.p), yRs(r.rs)]))} fill="none" stroke="var(--amber,#fbbf24)" strokeWidth={1.6} />
      <path d={path(rows.map((r) => [x(r.p), yBo(r.bo)]))} fill="none" stroke="var(--teal)" strokeWidth={1.8} />
      {/* the anchors themselves — the two points that are not correlation */}
      <circle cx={x(pb)} cy={yRs(pvt.pvto[pvt.pvto.length - 1].rs)} r={3.4} fill="var(--amber,#fbbf24)" stroke="var(--panel)" strokeWidth={1.2} />
      <circle cx={x(pi)} cy={yBo(pvt.undersaturated[pvt.undersaturated.length - 1].bo)} r={0} fill="none" />
      <circle cx={x(pb)} cy={yBo(pvt.bob)} r={3.4} fill="var(--teal)" stroke="var(--panel)" strokeWidth={1.2} />
    </Frame>
  );
}

/** Viscosity against pressure, log scale — oil, water and gas differ by an order of
 *  magnitude, and the gas branch is invisible on a linear axis. */
export function ViscosityChart({ pvt, pb, pi }: { pvt: PvtModel; pb: number; pi: number }) {
  const oil = [...pvt.pvto, ...pvt.undersaturated.slice(1)].map((r) => ({ p: r.p, v: r.muo }));
  const water = pvt.pvtw.map((r) => ({ p: r.p, v: r.muw }));
  const gas = pvt.pvdg.map((r) => ({ p: r.p, v: r.mug }));
  const all = [...oil, ...water, ...gas].map((d) => d.v).filter((v) => v > 0);
  const pMax = Math.max(...oil.map((d) => d.p), ...gas.map((d) => d.p));
  const lo = Math.log10(Math.min(...all) * 0.7), hi = Math.log10(Math.max(...all) * 1.4);
  const x = scale(0, pMax, PAD.l, W - PAD.r);
  const y = scale(lo, hi, H - PAD.b, PAD.t);
  const decades: number[] = [];
  for (let d = Math.floor(lo); d <= Math.ceil(hi); d++) decades.push(d);

  const series = [
    { d: oil, c: 'var(--teal)', w: 1.8 },
    { d: water, c: 'var(--cblue,#60a5fa)', w: 1.6 },
    { d: gas, c: 'var(--amber,#fbbf24)', w: 1.4 },
  ];
  return (
    <Frame xLabel="pressure (bara)" yLabel="viscosity (cP)">
      <XAxis values={ticks(0, pMax, 6)} x={x} />
      <g>
        {decades.map((d) => (
          <g key={d}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(d)} y2={y(d)} stroke="var(--line2)" strokeDasharray="2 4" opacity={0.55} />
            <text x={PAD.l - 5} y={y(d) + 3} textAnchor="end" fontSize={8.5} fill="var(--ink3)">{10 ** d < 1 ? (10 ** d).toFixed(Math.max(0, -d)) : String(10 ** d)}</text>
          </g>
        ))}
      </g>
      {[{ p: pb, c: 'var(--purple,#a78bfa)' }, { p: pi, c: 'var(--teal)' }].map((m) => (
        <line key={m.p} x1={x(m.p)} x2={x(m.p)} y1={PAD.t} y2={H - PAD.b} stroke={m.c} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      ))}
      {series.map((s, i) => (
        <path key={i} d={path(s.d.map((d) => [x(d.p), y(Math.log10(Math.max(1e-9, d.v)))]))}
          fill="none" stroke={s.c} strokeWidth={s.w} />
      ))}
    </Frame>
  );
}

// ── SCAL ─────────────────────────────────────────────────────────────────────

/**
 * Relative permeability and fractional flow, with the Welge tangent drawn.
 *
 * The tangent from connate water to the fw curve is the Buckley–Leverett shock
 * construction: where it touches is the front saturation, and where it reaches fw = 1
 * is the average saturation behind the front. Both are the recovery numbers this
 * stage hands to the forecast, so they are drawn rather than only tabulated.
 */
export function KrChart({ scal, muw, muo, welge }: {
  scal: ScalEndpoints; muw: number; muo: number; welge: DynamicInitialization['welge'];
}) {
  const x = scale(0, 1, PAD.l, W - PAD.r);
  const y = scale(0, 1, H - PAD.b, PAD.t);
  const n = 120;
  const pts: Array<{ sw: number; krw: number; kro: number; fw: number }> = [];
  for (let i = 0; i <= n; i++) {
    const sw = scal.swc + (1 - scal.sor - scal.swc) * (i / n);
    const { krw, kro } = coreyKr(sw, scal);
    pts.push({ sw, krw, kro, fw: fracFlow(sw, scal, muw, muo) });
  }
  const swAvg = welge.swAvgBt;
  return (
    <Frame xLabel="water saturation" yLabel="kr  ·  fw">
      <XAxis values={[0, 0.2, 0.4, 0.6, 0.8, 1]} x={x} d={1} />
      <YAxis values={[0, 0.2, 0.4, 0.6, 0.8, 1]} y={y} d={1} />
      {/* immobile bands — where nothing flows */}
      <rect x={x(0)} y={PAD.t} width={x(scal.swc) - x(0)} height={H - PAD.t - PAD.b} fill="var(--cblue,#60a5fa)" opacity={0.07} />
      <rect x={x(1 - scal.sor)} y={PAD.t} width={x(1) - x(1 - scal.sor)} height={H - PAD.t - PAD.b} fill="var(--teal)" opacity={0.07} />
      <text x={x(scal.swc / 2)} y={H - PAD.b - 6} textAnchor="middle" fontSize={8} fill="var(--ink3)">Swc</text>
      <text x={(x(1 - scal.sor) + x(1)) / 2} y={H - PAD.b - 6} textAnchor="middle" fontSize={8} fill="var(--ink3)">Sor</text>
      {/* the Welge tangent */}
      <line x1={x(scal.swc)} y1={y(0)} x2={x(swAvg)} y2={y(1)} stroke="var(--purple,#a78bfa)" strokeWidth={1.1} strokeDasharray="4 3" />
      <circle cx={x(welge.swf)} cy={y(welge.fwf)} r={3.6} fill="var(--purple,#a78bfa)" stroke="var(--panel)" strokeWidth={1.2} />
      <text x={x(welge.swf) + 6} y={y(welge.fwf) - 5} fontSize={8.5} fill="var(--purple,#a78bfa)">Swf {welge.swf.toFixed(3)}</text>
      <circle cx={x(swAvg)} cy={y(1)} r={3} fill="none" stroke="var(--purple,#a78bfa)" strokeWidth={1.3} />
      <text x={x(swAvg) + 6} y={y(1) + 11} fontSize={8.5} fill="var(--purple,#a78bfa)">S̄w {swAvg.toFixed(3)}</text>
      <path d={path(pts.map((p) => [x(p.sw), y(p.fw)]))} fill="none" stroke="var(--purple,#a78bfa)" strokeWidth={1.4} opacity={0.85} />
      <path d={path(pts.map((p) => [x(p.sw), y(p.kro)]))} fill="none" stroke="var(--teal)" strokeWidth={1.9} />
      <path d={path(pts.map((p) => [x(p.sw), y(p.krw)]))} fill="none" stroke="var(--cblue,#60a5fa)" strokeWidth={1.9} />
    </Frame>
  );
}

/**
 * The capillary transition zone: water saturation against height above the
 * free-water level, on a depth-down axis so it reads like the reservoir.
 *
 * This is where the SCAL curve stops being an abstraction — the height at which Sw
 * reaches connate water is the height above the contact where the rock is finally at
 * full oil saturation, and everything between is partially watered pay that the
 * volumetrics have to count correctly.
 */
export function TransitionChart({ scal, dRho, phi, kMd, owc, fwl }: {
  scal: ScalEndpoints; dRho: number; phi: number; kMd: number; owc: number | null; fwl: number | null;
}) {
  const hMax = 140;
  const x = scale(0, 1, PAD.l, W - PAD.r);
  const y = scale(hMax, 0, PAD.t, H - PAD.b); // height above FWL, 0 at the bottom
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 140; i++) {
    const h = (hMax * i) / 140;
    pts.push([x(swAtHeight(h, scal, dRho, phi, kMd)), y(h)]);
  }
  // the height at which Sw is within 1% of connate — the top of the transition zone
  let hTop = hMax;
  for (let h = 0; h <= hMax; h += 0.5) {
    if (swAtHeight(h, scal, dRho, phi, kMd) <= scal.swc * 1.01) { hTop = h; break; }
  }
  const label = (h: number, text: string, c: string) => (
    <g>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(h)} y2={y(h)} stroke={c} strokeWidth={1} strokeDasharray="4 3" />
      <text x={W - PAD.r - 4} y={y(h) - 4} textAnchor="end" fontSize={8.5} fill={c}>{text}</text>
    </g>
  );
  return (
    <Frame xLabel="water saturation" yLabel="height above free-water level (m)">
      <XAxis values={[0, 0.2, 0.4, 0.6, 0.8, 1]} x={x} d={1} />
      <YAxis values={ticks(0, hMax, 5)} y={y} d={0} />
      <path d={`${path(pts)} L${x(1)} ${y(0)} Z`} fill="var(--cblue,#60a5fa)" opacity={0.1} />
      {label(hTop, `full oil column at +${hTop.toFixed(0)} m`, 'var(--teal)')}
      {owc != null && fwl != null && label(fwl - owc, `OWC ${owc.toFixed(0)} m TVDSS`, 'var(--amber,#fbbf24)')}
      <path d={path(pts)} fill="none" stroke="var(--cblue,#60a5fa)" strokeWidth={1.9} />
      <line x1={x(scal.swc)} x2={x(scal.swc)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink3)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
      <text x={x(scal.swc) + 4} y={PAD.t + 11} fontSize={8.5} fill="var(--ink3)">Swc</text>
    </Frame>
  );
}

// ── initialization ───────────────────────────────────────────────────────────

const WELL_COLORS = ['#22d3ee', '#f59e0b', '#a78bfa', '#4ade80', '#f472b6', '#60a5fa', '#fb923c', '#34d399'];

/**
 * Pressure against true vertical depth — the equilibration, checked.
 *
 * The two straight lines are the MODEL: the oil and water phase gradients walked out
 * from the deck datum along the reservoir-condition densities the PVT produced. The
 * points are MEASUREMENT: real gauge stations, coloured by well. If the model is
 * right, a well's points lie on a line parallel to the modelled leg they sit in — and
 * that agreement, or its absence, is the honest verdict on the initialization.
 *
 * Stations that never left the mud column are drawn hollow: present, visible, and
 * excluded from every fit.
 */
export function PressureDepthChart({ init, points, wells }: {
  init: DynamicInitialization; points: PressurePoint[]; wells: WellGradient[];
}) {
  const eq = init.equil;
  const zs = points.map((p) => p.tvdss);
  const ps = points.map((p) => p.pressure);
  const zMin = Math.min(eq.datumTvdss - 200, ...(zs.length ? zs : [eq.datumTvdss]), eq.owc ?? eq.datumTvdss) - 40;
  const zMax = Math.max(eq.datumTvdss + 200, ...(zs.length ? zs : [eq.datumTvdss]), eq.owc ?? eq.datumTvdss) + 40;
  const modelP = [
    eq.datumPressure + eq.oilGradient * (zMin - eq.datumTvdss),
    eq.datumPressure + eq.waterGradient * (zMax - eq.datumTvdss),
  ];
  const pMin = Math.min(...(ps.length ? ps : modelP), ...modelP) - 15;
  const pMax = Math.max(...(ps.length ? ps : modelP), ...modelP) + 15;
  const x = scale(pMin, pMax, PAD.l, W - PAD.r);
  const y = scale(zMin, zMax, PAD.t, H - PAD.b);

  const colorOf = new Map(wells.map((w, i) => [w.well, WELL_COLORS[i % WELL_COLORS.length]]));
  const oilTop = eq.owc ?? zMax;

  return (
    <Frame xLabel="pressure (bara)" yLabel="TVDSS (m)">
      <XAxis values={ticks(pMin, pMax, 6)} x={x} d={0} />
      <YAxis values={ticks(zMin, zMax, 6)} y={y} d={0} />
      {/* the modelled legs */}
      <line x1={x(eq.datumPressure + eq.oilGradient * (zMin - eq.datumTvdss))} y1={y(zMin)}
        x2={x(eq.datumPressure + eq.oilGradient * (oilTop - eq.datumTvdss))} y2={y(oilTop)}
        stroke="var(--teal)" strokeWidth={2} />
      {eq.owc != null && (
        <line x1={x(eq.contactPressure ?? eq.datumPressure)} y1={y(eq.owc)}
          x2={x((eq.contactPressure ?? eq.datumPressure) + eq.waterGradient * (zMax - eq.owc))} y2={y(zMax)}
          stroke="var(--cblue,#60a5fa)" strokeWidth={2} />
      )}
      {/* datum and contact */}
      <g>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(eq.datumTvdss)} y2={y(eq.datumTvdss)} stroke="var(--ink3)" strokeDasharray="3 3" opacity={0.8} />
        <text x={PAD.l + 4} y={y(eq.datumTvdss) - 4} fontSize={8.5} fill="var(--ink3)">datum {eq.datumTvdss} m · {eq.datumPressure} bara</text>
      </g>
      {eq.owc != null && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(eq.owc)} y2={y(eq.owc)} stroke="var(--amber,#fbbf24)" strokeWidth={1.2} strokeDasharray="5 3" />
          <text x={PAD.l + 4} y={y(eq.owc) + 11} fontSize={8.5} fill="var(--amber,#fbbf24)">OWC {eq.owc} m</text>
        </g>
      )}
      {/* each well's own fitted gradient, where one resolved */}
      {wells.filter((w) => w.resolved && w.fit).map((w) => {
        const f = w.fit!;
        const z0 = Math.min(...w.points.map((p) => p.tvdss)), z1 = Math.max(...w.points.map((p) => p.tvdss));
        return (
          <line key={w.well} x1={x(f.intercept + f.slope * z0)} y1={y(z0)} x2={x(f.intercept + f.slope * z1)} y2={y(z1)}
            stroke={colorOf.get(w.well)} strokeWidth={1.2} strokeDasharray="5 3" opacity={0.95} />
        );
      })}
      {/* the measurements */}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.pressure)} cy={y(p.tvdss)} r={3}
          fill={p.quality === 'column' ? 'none' : (colorOf.get(p.well) ?? 'var(--ink3)')}
          stroke={colorOf.get(p.well) ?? 'var(--ink3)'} strokeWidth={1.2}
          opacity={p.quality === 'column' ? 0.55 : 1}>
          <title>{`${p.well} — ${p.pressure.toFixed(1)} bara at ${p.tvdss.toFixed(1)} m TVDSS${p.quality === 'column' ? ' (mud column — excluded)' : ''}`}</title>
        </circle>
      ))}
    </Frame>
  );
}

/** Initial water saturation against depth — the equilibration's own saturation
 *  profile, from the same Pc curve the SWOF table carries. */
export function InitSwChart({ init }: { init: DynamicInitialization }) {
  const eq = init.equil;
  if (eq.fwl == null) return null;
  const dRho = init.pvt.rhoWaterRes - init.pvt.rhoOilRes;
  const zTop = eq.fwl - 160, zBot = eq.fwl + 25;
  const x = scale(0, 1, PAD.l, W - PAD.r);
  const y = scale(zTop, zBot, PAD.t, H - PAD.b);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 160; i++) {
    const z = zTop + ((zBot - zTop) * i) / 160;
    pts.push([x(swAtHeight(eq.fwl - z, init.scal, dRho, init.rock.phi, init.rock.kMd)), y(z)]);
  }
  return (
    <Frame xLabel="initial water saturation" yLabel="TVDSS (m)">
      <XAxis values={[0, 0.2, 0.4, 0.6, 0.8, 1]} x={x} d={1} />
      <YAxis values={ticks(zTop, zBot, 6)} y={y} d={0} />
      <path d={`${path(pts)} L${x(1)} ${y(zBot)} L${x(1)} ${y(zTop)} Z`} fill="var(--cblue,#60a5fa)" opacity={0.1} />
      <path d={path(pts)} fill="none" stroke="var(--cblue,#60a5fa)" strokeWidth={1.9} />
      {eq.owc != null && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(eq.owc)} y2={y(eq.owc)} stroke="var(--amber,#fbbf24)" strokeWidth={1.2} strokeDasharray="5 3" />
          <text x={PAD.l + 4} y={y(eq.owc) - 4} fontSize={8.5} fill="var(--amber,#fbbf24)">OWC {eq.owc.toFixed(0)}</text>
        </g>
      )}
      <g>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(eq.fwl)} y2={y(eq.fwl)} stroke="var(--cblue,#60a5fa)" strokeWidth={1} strokeDasharray="3 3" />
        <text x={PAD.l + 4} y={y(eq.fwl) + 11} fontSize={8.5} fill="var(--cblue,#60a5fa)">FWL {eq.fwl.toFixed(1)}</text>
      </g>
      <line x1={x(init.rock.sw)} x2={x(init.rock.sw)} y1={PAD.t} y2={H - PAD.b} stroke="var(--teal)" strokeWidth={1} strokeDasharray="2 3" />
      <text x={x(init.rock.sw) + 4} y={PAD.t + 11} fontSize={8.5} fill="var(--teal)">Sw used for in-place {init.rock.sw.toFixed(2)}</text>
    </Frame>
  );
}

/** The SWOF table's Pc column, drawn — so the number the simulator reads and the
 *  transition zone the geologist sees are visibly the same curve. */
export function PcChart({ swof, scal }: { swof: ScalRow[]; scal: ScalEndpoints }) {
  const pcs = swof.map((r) => r.pc).filter((v) => Number.isFinite(v));
  const x = scale(0, 1, PAD.l, W - PAD.r);
  const y = scale(0, Math.max(...pcs) * 1.05 || 1, H - PAD.b, PAD.t);
  return (
    <Frame xLabel="water saturation" yLabel="capillary pressure (bar)">
      <XAxis values={[0, 0.2, 0.4, 0.6, 0.8, 1]} x={x} d={1} />
      <YAxis values={ticks(0, Math.max(...pcs) * 1.05 || 1, 5)} y={y} d={2} />
      <path d={path(swof.map((r) => [x(r.sw), y(r.pc)]))} fill="none" stroke="var(--amber,#fbbf24)" strokeWidth={1.9} />
      <line x1={x(scal.swc)} x2={x(scal.swc)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink3)" strokeDasharray="2 3" opacity={0.7} />
    </Frame>
  );
}
