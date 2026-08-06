// fluids-charts.tsx — the Fluids & Rock stage's plots.
//
// Every chart here draws the PUBLISHED CASE and nothing else: pass it a
// DynamicInitialization and it renders that case's own tables. There is no separate
// "display" data path, so a chart cannot show one thing while the exported deck says
// another — which is the failure mode this whole stage exists to prevent.
//
// All seven share `fluids-chart-kit`: d3 scales, d3-chosen ticks, d3-formatted labels,
// an axis title that always carries its unit, a crosshair, and a hover readout naming
// every series with its own unit. They size themselves to their container rather than
// stretching a fixed viewBox, so a label is the same size on every panel.
import { useMemo } from 'react';
import type {
  DynamicInitialization, PressurePoint, PvtModel, ScalEndpoints, ScalRow, WellGradient,
} from './fluid-model';
import { coreyKr, fracFlow, swAtHeight } from './fluid-model';
import {
  Chart, Legend, useChartSize, nearestProbe, linePath, areaPath,
  xScale, yScale, yScaleDown, yScaleLog, tickText, M, M2,
  type SeriesSpec, type Pt,
} from './fluids-chart-kit';

const C = {
  oil: 'var(--teal)',
  water: 'var(--cblue,#60a5fa)',
  gas: 'var(--amber,#fbbf24)',
  aux: 'var(--purple,#a78bfa)',
  ink: 'var(--ink3)',
};

/** Wrap a chart so it measures its box first — every plot on the stage does this. */
function Sized({ children, minHeight = 180 }: { children: (s: { w: number; h: number }) => React.ReactNode; minHeight?: number }) {
  const [ref, size] = useChartSize<HTMLDivElement>();
  return (
    <div className="frx-chart" ref={ref} style={{ minHeight }}>
      {size.w > 40 && size.h > 40 ? children(size) : null}
    </div>
  );
}

// ── PVT: Bo and Rs against pressure ──────────────────────────────────────────

/**
 * The black-oil chart. Two branches meet at the bubble point: below it Rs and Bo both
 * fall with pressure as gas comes out of solution; above it Rs is flat and Bo falls
 * only by compression. The kink at Pb IS the physics, so it is drawn as a kink and
 * marked, never smoothed.
 */
export function PvtChart({ pvt, pb, pi }: { pvt: PvtModel; pb: number; pi: number }) {
  const rows = useMemo(() => [...pvt.pvto, ...pvt.undersaturated.slice(1)], [pvt]);
  const series: SeriesSpec[] = [
    { key: 'bo', label: 'Bo', color: C.oil, unit: 'rm³/Sm³', width: 2 },
    { key: 'rs', label: 'Rs', color: C.gas, unit: 'Sm³/Sm³', width: 1.8, axis: 'y2' },
  ];
  const probe = useMemo(
    () => nearestProbe(rows, (r) => r.p, [
      { key: 'bo', yOf: (r) => r.bo },
      { key: 'rs', yOf: (r) => r.rs },
    ]),
    [rows],
  );

  return (
    <>
      <Sized>{({ w, h }) => {
        const pMax = Math.max(...rows.map((r) => r.p));
        const boMin = Math.min(...rows.map((r) => r.bo)), boMax = Math.max(...rows.map((r) => r.bo));
        const rsMax = Math.max(...rows.map((r) => r.rs));
        const x = xScale([0, pMax], w, M2);
        const y = yScale([boMin - (boMax - boMin) * 0.12, boMax + (boMax - boMin) * 0.08], h, M2);
        const y2 = yScale([0, rsMax * 1.08], h, M2);
        const T = M2.top, B = h - M2.bottom;
        return (
          <Chart size={{ w, h }} margin={M2} series={series} probe={probe}
            x={{ label: 'Pressure', unit: 'bara', scale: x, ticks: 7 }}
            y={{ label: 'Oil FVF, Bo', unit: 'rm³/Sm³', scale: y, ticks: 6, format: (v) => v.toFixed(3) }}
            y2={{ label: 'Solution GOR, Rs', unit: 'Sm³/Sm³', scale: y2, ticks: 6, color: C.gas, format: (v) => v.toFixed(0) }}>
            {[{ p: pb, c: C.aux, t: `Pb ${pb}` }, { p: pi, c: C.oil, t: `Pi ${pi}` }].map((mk) => (
              <g key={mk.t}>
                <line className="frx-ref" x1={x(mk.p)} x2={x(mk.p)} y1={T} y2={B} stroke={mk.c} />
                <text className="frx-ref-label" x={x(mk.p) + 5} y={T + 11} fill={mk.c}>{mk.t}</text>
              </g>
            ))}
            <path d={linePath(rows.map<Pt>((r) => ({ x: r.p, y: r.rs })), x, y2)} fill="none" stroke={C.gas} strokeWidth={1.8} />
            <path d={linePath(rows.map<Pt>((r) => ({ x: r.p, y: r.bo })), x, y)} fill="none" stroke={C.oil} strokeWidth={2} />
            <circle className="frx-anchor" cx={x(pb)} cy={y2(pvt.pvto[pvt.pvto.length - 1].rs)} r={4} fill={C.gas} />
            <circle className="frx-anchor" cx={x(pb)} cy={y(pvt.bob)} r={4} fill={C.oil} />
          </Chart>
        );
      }}</Sized>
      <Legend series={series} extra={<span><i className="dot" style={{ background: C.oil }} />deck anchors — every other point is correlation</span>} />
    </>
  );
}

/** Viscosity against pressure, log scale — oil, water and gas differ by an order of
 *  magnitude, and the gas branch is invisible on a linear axis. */
export function ViscosityChart({ pvt, pb, pi }: { pvt: PvtModel; pb: number; pi: number }) {
  const rows = useMemo(() => {
    const oil = [...pvt.pvto, ...pvt.undersaturated.slice(1)];
    const byP = new Map<number, { p: number; muo?: number; muw?: number; mug?: number }>();
    const put = (p: number, k: 'muo' | 'muw' | 'mug', v: number) => {
      const r = byP.get(p) ?? { p };
      r[k] = v; byP.set(p, r);
    };
    for (const r of oil) put(r.p, 'muo', r.muo);
    for (const r of pvt.pvtw) put(r.p, 'muw', r.muw);
    for (const r of pvt.pvdg) put(r.p, 'mug', r.mug);
    return [...byP.values()].sort((a, b) => a.p - b.p);
  }, [pvt]);

  const series: SeriesSpec[] = [
    { key: 'muo', label: 'Oil, μo', color: C.oil, unit: 'cP' },
    { key: 'muw', label: 'Water, μw', color: C.water, unit: 'cP' },
    { key: 'mug', label: 'Gas, μg', color: C.gas, unit: 'cP' },
  ];
  const probe = useMemo(() => nearestProbe(rows, (r) => r.p, [
    { key: 'muo', yOf: (r) => r.muo ?? null },
    { key: 'muw', yOf: (r) => r.muw ?? null },
    { key: 'mug', yOf: (r) => r.mug ?? null },
  ]), [rows]);

  return (
    <>
      <Sized>{({ w, h }) => {
        const all = rows.flatMap((r) => [r.muo, r.muw, r.mug]).filter((v): v is number => !!v && v > 0);
        const pMax = Math.max(...rows.map((r) => r.p));
        const x = xScale([0, pMax], w);
        const y = yScaleLog([Math.min(...all) * 0.6, Math.max(...all) * 1.6], h);
        const T = M.top, B = h - M.bottom;
        const draw = (k: 'muo' | 'muw' | 'mug') =>
          linePath(rows.filter((r) => r[k] != null).map<Pt>((r) => ({ x: r.p, y: r[k] as number })), x, y);
        return (
          <Chart size={{ w, h }} series={series} probe={probe}
            x={{ label: 'Pressure', unit: 'bara', scale: x, ticks: 6 }}
            y={{ label: 'Viscosity', unit: 'cP', scale: y, log: true, ticks: 5, format: tickText }}>
            {[{ p: pb, c: C.aux }, { p: pi, c: C.oil }].map((mk) => (
              <line key={mk.p} className="frx-ref" x1={x(mk.p)} x2={x(mk.p)} y1={T} y2={B} stroke={mk.c} />
            ))}
            <path d={draw('mug')} fill="none" stroke={C.gas} strokeWidth={1.6} />
            <path d={draw('muw')} fill="none" stroke={C.water} strokeWidth={1.8} />
            <path d={draw('muo')} fill="none" stroke={C.oil} strokeWidth={2} />
          </Chart>
        );
      }}</Sized>
      <Legend series={series} />
    </>
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
  const rows = useMemo(() => {
    const out: Array<{ sw: number; krw: number; kro: number; fw: number }> = [];
    for (let i = 0; i <= 160; i++) {
      const sw = scal.swc + (1 - scal.sor - scal.swc) * (i / 160);
      const { krw, kro } = coreyKr(sw, scal);
      out.push({ sw, krw, kro, fw: fracFlow(sw, scal, muw, muo) });
    }
    return out;
  }, [scal, muw, muo]);

  const series: SeriesSpec[] = [
    { key: 'krw', label: 'krw', color: C.water, unit: 'fraction' },
    { key: 'kro', label: 'kro', color: C.oil, unit: 'fraction' },
    { key: 'fw', label: 'fw', color: C.aux, unit: 'fraction' },
  ];
  const probe = useMemo(() => nearestProbe(rows, (r) => r.sw, [
    { key: 'krw', yOf: (r) => r.krw }, { key: 'kro', yOf: (r) => r.kro }, { key: 'fw', yOf: (r) => r.fw },
  ]), [rows]);

  return (
    <>
      <Sized>{({ w, h }) => {
        const x = xScale([0, 1], w), y = yScale([0, 1], h);
        const T = M.top, B = h - M.bottom;
        return (
          <Chart size={{ w, h }} series={series} probe={probe}
            x={{ label: 'Water saturation, Sw', unit: 'fraction', scale: x, tickValues: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => v.toFixed(1) }}
            y={{ label: 'kr  ·  fw', unit: 'fraction', scale: y, tickValues: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => v.toFixed(1) }}>
            {/* immobile bands — where nothing flows */}
            <rect className="frx-band w" x={x(0)} y={T} width={x(scal.swc) - x(0)} height={B - T} />
            <rect className="frx-band o" x={x(1 - scal.sor)} y={T} width={x(1) - x(1 - scal.sor)} height={B - T} />
            <text className="frx-band-label" x={(x(0) + x(scal.swc)) / 2} y={B - 7} textAnchor="middle">Swc {scal.swc.toFixed(2)}</text>
            <text className="frx-band-label" x={(x(1 - scal.sor) + x(1)) / 2} y={B - 7} textAnchor="middle">Sor {scal.sor.toFixed(2)}</text>
            {/* the Welge tangent */}
            <line className="frx-ref" x1={x(scal.swc)} y1={y(0)} x2={x(welge.swAvgBt)} y2={y(1)} stroke={C.aux} />
            <path d={linePath(rows.map<Pt>((r) => ({ x: r.sw, y: r.fw })), x, y)} fill="none" stroke={C.aux} strokeWidth={1.6} opacity={0.9} />
            <path d={linePath(rows.map<Pt>((r) => ({ x: r.sw, y: r.kro })), x, y)} fill="none" stroke={C.oil} strokeWidth={2} />
            <path d={linePath(rows.map<Pt>((r) => ({ x: r.sw, y: r.krw })), x, y)} fill="none" stroke={C.water} strokeWidth={2} />
            <circle className="frx-anchor" cx={x(welge.swf)} cy={y(welge.fwf)} r={4} fill={C.aux} />
            <text className="frx-mark" x={x(welge.swf) + 7} y={y(welge.fwf) - 6} fill={C.aux}>Swf {welge.swf.toFixed(3)}</text>
            <circle cx={x(welge.swAvgBt)} cy={y(1)} r={3.5} fill="none" stroke={C.aux} strokeWidth={1.4} />
            <text className="frx-mark" x={x(welge.swAvgBt) + 7} y={y(1) + 12} fill={C.aux}>S̄w {welge.swAvgBt.toFixed(3)}</text>
          </Chart>
        );
      }}</Sized>
      <Legend series={series} extra={<span style={{ color: C.aux }}><i className="dash" />Welge tangent</span>} />
    </>
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
  const hMax = 160;
  const rows = useMemo(() => {
    const out: Array<{ h: number; sw: number }> = [];
    for (let i = 0; i <= 160; i++) {
      const hh = (hMax * i) / 160;
      out.push({ h: hh, sw: swAtHeight(hh, scal, dRho, phi, kMd) });
    }
    return out;
  }, [scal, dRho, phi, kMd]);

  const series: SeriesSpec[] = [{ key: 'sw', label: 'Sw', color: C.water, unit: 'fraction' }];
  const probe = useMemo(() => nearestProbe(rows, (r) => r.h, [{ key: 'sw', yOf: (r) => r.sw }]), [rows]);

  return (
    <>
      <Sized>{({ w, h }) => {
        const x = xScale([0, 1], w);
        // height grows UPWARD from the contact, so the axis is inverted: 0 at the base
        const y = yScale([0, hMax], h);
        const L = M.left, R = w - M.right;
        return (
          <Chart size={{ w, h }} series={series} probe={probe} orient="y"
            x={{ label: 'Water saturation, Sw', unit: 'fraction', scale: x, tickValues: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => v.toFixed(1) }}
            y={{ label: 'Height above free-water level', unit: 'm', scale: y, ticks: 6, format: (v) => v.toFixed(0) }}>
            <path d={areaPath(rows.map<Pt>((r) => ({ x: r.sw, y: r.h })), x, y, 0)} className="frx-fill w" />
            <line className="frx-ref" x1={x(scal.swc)} x2={x(scal.swc)} y1={M.top} y2={h - M.bottom} stroke={C.ink} />
            <text className="frx-ref-label" x={x(scal.swc) + 5} y={M.top + 11} fill={C.ink}>Swc</text>
            {owc != null && fwl != null && fwl - owc <= hMax && (
              <g>
                <line className="frx-ref" x1={L} x2={R} y1={y(fwl - owc)} y2={y(fwl - owc)} stroke={C.gas} />
                <text className="frx-ref-label" x={R - 4} y={y(fwl - owc) - 5} textAnchor="end" fill={C.gas}>
                  OWC {owc.toFixed(0)} m TVDSS
                </text>
              </g>
            )}
            <path d={linePath(rows.map<Pt>((r) => ({ x: r.sw, y: r.h })), x, y)} fill="none" stroke={C.water} strokeWidth={2} />
          </Chart>
        );
      }}</Sized>
      <Legend series={series} extra={<span>hover reads Sw at a height</span>} />
    </>
  );
}

/** The SWOF table's Pc column, drawn — so the number the simulator reads and the
 *  transition zone the geologist sees are visibly the same curve. */
export function PcChart({ swof, scal }: { swof: ScalRow[]; scal: ScalEndpoints }) {
  const series: SeriesSpec[] = [{ key: 'pc', label: 'Pc', color: C.gas, unit: 'bar' }];
  const probe = useMemo(() => nearestProbe(swof, (r) => r.sw, [{ key: 'pc', yOf: (r) => r.pc }]), [swof]);
  return (
    <>
      <Sized minHeight={120}>{({ w, h }) => {
        const pcMax = Math.max(...swof.map((r) => r.pc)) || 1;
        const x = xScale([0, 1], w), y = yScale([0, pcMax * 1.05], h);
        return (
          <Chart size={{ w, h }} series={series} probe={probe}
            x={{ label: 'Water saturation, Sw', unit: 'fraction', scale: x, tickValues: [0, 0.25, 0.5, 0.75, 1], format: (v) => v.toFixed(2) }}
            y={{ label: 'Capillary pressure, Pc', unit: 'bar', scale: y, ticks: 4, format: (v) => v.toFixed(2) }}>
            <line className="frx-ref" x1={x(scal.swc)} x2={x(scal.swc)} y1={M.top} y2={h - M.bottom} stroke={C.ink} />
            <path d={linePath(swof.map<Pt>((r) => ({ x: r.sw, y: r.pc })), x, y)} fill="none" stroke={C.gas} strokeWidth={2} />
          </Chart>
        );
      }}</Sized>
      <Legend series={series} />
    </>
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
 * excluded from every fit. Hovering a station names its well and reads its pressure.
 */
export function PressureDepthChart({ init, points, wells }: {
  init: DynamicInitialization; points: PressurePoint[]; wells: WellGradient[];
}) {
  const eq = init.equil;
  const colorOf = useMemo(() => new Map(wells.map((wg, i) => [wg.well, WELL_COLORS[i % WELL_COLORS.length]])), [wells]);
  const series: SeriesSpec[] = [
    { key: 'oil', label: 'Modelled oil gradient', color: C.oil, unit: 'bara' },
    { key: 'water', label: 'Modelled water gradient', color: C.water, unit: 'bara' },
  ];
  const probe = useMemo(() => (z: number) => [
    { key: 'oil', value: eq.datumPressure + eq.oilGradient * (z - eq.datumTvdss) },
    { key: 'water', value: eq.owc == null ? null : (eq.contactPressure ?? eq.datumPressure) + eq.waterGradient * (z - eq.owc) },
  ], [eq]);

  return (
    <>
      <Sized minHeight={240}>{({ w, h }) => {
        const zs = points.map((p) => p.tvdss);
        const zMin = Math.min(eq.datumTvdss - 180, ...(zs.length ? zs : [eq.datumTvdss]), eq.owc ?? eq.datumTvdss) - 30;
        const zMax = Math.max(eq.datumTvdss + 180, ...(zs.length ? zs : [eq.datumTvdss]), eq.owc ?? eq.datumTvdss) + 30;
        const modelP = [
          eq.datumPressure + eq.oilGradient * (zMin - eq.datumTvdss),
          eq.datumPressure + eq.waterGradient * (zMax - eq.datumTvdss),
        ];
        const ps = points.map((p) => p.pressure);
        const pMin = Math.min(...(ps.length ? ps : modelP), ...modelP) - 12;
        const pMax = Math.max(...(ps.length ? ps : modelP), ...modelP) + 12;
        const x = xScale([pMin, pMax], w);
        const y = yScaleDown([zMin, zMax], h);   // depth increases downward
        const L = M.left, R = w - M.right;
        const oilTop = eq.owc ?? zMax;
        return (
          <Chart size={{ w, h }} series={series} probe={probe} orient="y"
            x={{ label: 'Pressure', unit: 'bara', scale: x, ticks: 6, format: (v) => v.toFixed(0) }}
            y={{ label: 'True vertical depth subsea', unit: 'm TVDSS', scale: y, ticks: 7, format: (v) => v.toFixed(0) }}>
            {/* modelled legs */}
            <line x1={x(eq.datumPressure + eq.oilGradient * (zMin - eq.datumTvdss))} y1={y(zMin)}
              x2={x(eq.datumPressure + eq.oilGradient * (oilTop - eq.datumTvdss))} y2={y(oilTop)}
              stroke={C.oil} strokeWidth={2.2} />
            {eq.owc != null && (
              <line x1={x(eq.contactPressure ?? eq.datumPressure)} y1={y(eq.owc)}
                x2={x((eq.contactPressure ?? eq.datumPressure) + eq.waterGradient * (zMax - eq.owc))} y2={y(zMax)}
                stroke={C.water} strokeWidth={2.2} />
            )}
            {/* datum and contact */}
            <line className="frx-ref" x1={L} x2={R} y1={y(eq.datumTvdss)} y2={y(eq.datumTvdss)} stroke={C.ink} />
            <text className="frx-ref-label" x={L + 5} y={y(eq.datumTvdss) - 5} fill={C.ink}>
              datum {eq.datumTvdss} m · {eq.datumPressure} bara
            </text>
            {eq.owc != null && (
              <>
                <line className="frx-ref" x1={L} x2={R} y1={y(eq.owc)} y2={y(eq.owc)} stroke={C.gas} strokeWidth={1.3} />
                <text className="frx-ref-label" x={L + 5} y={y(eq.owc) + 12} fill={C.gas}>OWC {eq.owc} m</text>
              </>
            )}
            {/* each well's own fitted gradient, where one resolved */}
            {wells.filter((g) => g.resolved && g.fit).map((g) => {
              const f = g.fit!;
              const z0 = Math.min(...g.points.map((p) => p.tvdss)), z1 = Math.max(...g.points.map((p) => p.tvdss));
              return (
                <line key={g.well} className="frx-ref" x1={x(f.intercept + f.slope * z0)} y1={y(z0)}
                  x2={x(f.intercept + f.slope * z1)} y2={y(z1)} stroke={colorOf.get(g.well)} strokeWidth={1.4} />
              );
            })}
            {/* the measurements */}
            {points.map((p, i) => (
              <circle key={i} className="frx-pt" cx={x(p.pressure)} cy={y(p.tvdss)} r={3.4}
                fill={p.quality === 'column' ? 'none' : (colorOf.get(p.well) ?? C.ink)}
                stroke={colorOf.get(p.well) ?? C.ink} strokeWidth={1.3}
                opacity={p.quality === 'column' ? 0.55 : 1}>
                <title>{`${p.well}\n${p.pressure.toFixed(1)} bara at ${p.tvdss.toFixed(1)} m TVDSS${p.md != null ? `\n${p.md.toFixed(0)} m MD` : ''}${p.quality === 'column' ? '\nmud column — excluded from every fit' : ' — formation buildup'}`}</title>
              </circle>
            ))}
          </Chart>
        );
      }}</Sized>
      <Legend series={series} extra={<>
        <span><i className="dot" style={{ background: C.ink }} />measured buildup</span>
        <span><i className="dot" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1.3px currentColor' }} />mud column — excluded</span>
        <span><i className="dash" />per-well fitted gradient</span>
      </>} />
    </>
  );
}

/** Initial water saturation against depth — the equilibration's own saturation
 *  profile, from the same Pc curve the SWOF table carries. */
export function InitSwChart({ init }: { init: DynamicInitialization }) {
  const eq = init.equil;
  const dRho = init.pvt.rhoWaterRes - init.pvt.rhoOilRes;
  const rows = useMemo(() => {
    if (eq.fwl == null) return [];
    const zTop = eq.fwl - 170, zBot = eq.fwl + 25;
    const out: Array<{ z: number; sw: number }> = [];
    for (let i = 0; i <= 170; i++) {
      const z = zTop + ((zBot - zTop) * i) / 170;
      out.push({ z, sw: swAtHeight(eq.fwl - z, init.scal, dRho, init.rock.phi, init.rock.kMd) });
    }
    return out;
  }, [eq.fwl, init.scal, init.rock.phi, init.rock.kMd, dRho]);

  const series: SeriesSpec[] = [{ key: 'sw', label: 'Initial Sw', color: C.water, unit: 'fraction' }];
  const probe = useMemo(() => nearestProbe(rows, (r) => r.z, [{ key: 'sw', yOf: (r) => r.sw }]), [rows]);
  if (eq.fwl == null || !rows.length) return null;

  return (
    <>
      <Sized minHeight={200}>{({ w, h }) => {
        const x = xScale([0, 1], w);
        const y = yScaleDown([rows[0].z, rows[rows.length - 1].z], h);
        const L = M.left, R = w - M.right;
        return (
          <Chart size={{ w, h }} series={series} probe={probe} orient="y"
            x={{ label: 'Initial water saturation, Sw', unit: 'fraction', scale: x, tickValues: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => v.toFixed(1) }}
            y={{ label: 'True vertical depth subsea', unit: 'm TVDSS', scale: y, ticks: 6, format: (v) => v.toFixed(0) }}>
            <path d={areaPath(rows.map<Pt>((r) => ({ x: r.sw, y: r.z })), x, y, rows[0].z)} className="frx-fill w" />
            {eq.owc != null && (
              <>
                <line className="frx-ref" x1={L} x2={R} y1={y(eq.owc)} y2={y(eq.owc)} stroke={C.gas} strokeWidth={1.3} />
                <text className="frx-ref-label" x={L + 5} y={y(eq.owc) - 5} fill={C.gas}>OWC {eq.owc.toFixed(0)}</text>
              </>
            )}
            <line className="frx-ref" x1={L} x2={R} y1={y(eq.fwl!)} y2={y(eq.fwl!)} stroke={C.water} />
            <text className="frx-ref-label" x={L + 5} y={y(eq.fwl!) + 12} fill={C.water}>FWL {eq.fwl!.toFixed(1)}</text>
            <line className="frx-ref" x1={x(init.rock.sw)} x2={x(init.rock.sw)} y1={M.top} y2={h - M.bottom} stroke={C.oil} />
            <text className="frx-ref-label" x={x(init.rock.sw) + 5} y={M.top + 11} fill={C.oil}>
              Sw {init.rock.sw.toFixed(2)} used for in-place
            </text>
            <path d={linePath(rows.map<Pt>((r) => ({ x: r.sw, y: r.z })), x, y)} fill="none" stroke={C.water} strokeWidth={2} />
          </Chart>
        );
      }}</Sized>
      <Legend series={series} />
    </>
  );
}
