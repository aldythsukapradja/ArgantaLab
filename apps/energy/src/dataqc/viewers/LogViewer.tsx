// viewers/LogViewer.tsx — industry-standard composite well-log display.
//
// Structural layout (when the curves exist), left to right:
//   GR          — standard 0→150 API, clean/sand at the LEFT, shale at the RIGHT
//   Litho flag  — narrow automated sand/shale screening strip (GR-based)
//   Fluid flag  — narrow automated gas/oil screening strip (resistivity + crossover)
//   RT          — logarithmic (0.2→2000 Ω·m, 4 decades), placed next to GR
//   RHOB/NPHI   — density-neutron overlay on paired industry scales, with the
//                 classic gas "crossover" shaded between the two curves
//   + any other selected curve, each its own track
//
// Scales default to fixed industry-standard ranges per curve family (not the raw
// data min/max) — a single outlier spike no longer stretches a track flat. Every
// track's scale is still editable: click its header to override, or reset.
//
// The litho/fluid classification math lives in ../petro.ts, shared with
// TrajectoryViewer so a wellbore's path colors agree with its own log.
//
// Renderer: a purpose-built canvas track engine, not a generic charting lib.
// @equinor/videx-wellog is installed but was evaluated and rejected earlier in this
// codebase (see legacy/LogsView.tsx) — its imperative D3 lifecycle fights React's
// re-render/theming model.
//
// Depth is normalised to metres on the way in (the Volve bundle has a well in mm)
// and displayed in the PROJECT unit system.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { DigestedCurve, DigestedLog } from '../types.ts';
import { useUnits, depth as depthQ, depthToMetres } from '../../units';
import {
  sampleAt, grEndpoints, classifyLitho, rtBaseline as computeRtBaseline,
  classifyFluid, densityNeutronSeparation, type Fluid, type Litho,
} from '../petro.ts';

export interface PickMarker { surface: string; md: number }

// ── industry-standard default scales, by curve family ───────────────────────
// lo/hi is the LEFT/RIGHT edge value — lo>hi means the track reads reversed.
interface FamilyScale { lo: number; hi: number; log?: boolean }
const FAMILY_SCALE: Record<string, FamilyScale> = {
  GR: { lo: 0, hi: 150 },                  // standard: clean/sand LEFT → shale RIGHT (0–150 API)
  RT: { lo: 0.2, hi: 2000, log: true },    // 4-decade resistivity
  RXO: { lo: 0.2, hi: 2000, log: true },
  RHOB: { lo: 1.95, hi: 2.95 },
  NPHI: { lo: 0.45, hi: -0.15 },           // reversed: high porosity at left, matches RHOB pairing
  DT: { lo: 140, hi: 40 },                 // reversed: matches the porosity-left convention
  CALI: { lo: 6, hi: 16 },
  PEF: { lo: 0, hi: 10 },
  SP: { lo: -80, hi: 20 },
  PHIE: { lo: 0.4, hi: 0 },                // reversed — mirrors SW so pay reads as a matched pair
  SW: { lo: 1, hi: 0 },                    // reversed — high water saturation at left, low (oil) at right
  VSH: { lo: 0, hi: 1 },
  PERM: { lo: 0.01, hi: 10000, log: true },
  // LWD composites — medium resistivity shares RT's log decades so the two plot
  // comparably (their separation IS the invasion signal); ROP/BS are drilling
  // channels that ride along on an LWD run.
  RMED: { lo: 0.2, hi: 2000, log: true },
  ROP: { lo: 0, hi: 120 },
  BS: { lo: 0, hi: 40 },
};

const FLUID_RED = '#e24b4a';   // gas — same red used app-wide (production chart, gate badges)
const FLUID_GREEN = '#16805a'; // oil
const SAND_COLOR = '#dcae55';  // litho: sand
const SHALE_COLOR = '#5c6774'; // litho: shale
const GR_COLOR = '#1a9e4c';   // industry-standard: GR track is green
const RT_COLOR = '#e2352c';   // industry-standard: deep resistivity is red
const RHOB_COLOR = '#df7084';
const NPHI_COLOR = '#62aef7';
const CROSSOVER_FILL = 'rgba(226,75,74,0.16)';
const GENERIC_COLORS = ['#50d0b1', '#e1ae48', '#62aef7', '#b37df0', '#df7084', '#9bd45f'];

const DEPTH_AXIS_W = 62;
const FLAG_W = 20;
const TRACK_GAP = 1;
const PAD_T = 22;
const PAD_B = 22;
const ZOOM_STEP = 1.4;

type FlagKey = 'litho' | 'fluid';

type Track =
  | { kind: 'gr'; key: string; curve: DigestedCurve; scale: FamilyScale }
  | { kind: 'rt'; key: string; curve: DigestedCurve; scale: FamilyScale }
  | { kind: 'rhob-nphi'; key: string; rhob: DigestedCurve; nphi: DigestedCurve; rhobScale: FamilyScale; nphiScale: FamilyScale }
  | { kind: 'generic'; key: string; curve: DigestedCurve; scale: FamilyScale; color: string };

// clamps to the track's own pixel bounds — an out-of-range spike (a GR shale
// peak above 150 API, say) draws flush against the track edge instead of
// bleeding into the neighboring track.
const mapLin = (v: number, lo: number, hi: number, x0: number, w: number) => {
  const x = x0 + ((v - lo) / ((hi - lo) || 1)) * w;
  return Math.min(x0 + w, Math.max(x0, x));
};
const mapLog = (v: number, lo: number, hi: number, x0: number, w: number) => {
  const a = Math.log10(Math.max(1e-6, Math.min(lo, hi)));
  const b = Math.log10(Math.max(1e-6, Math.max(lo, hi)));
  const vc = Math.max(Math.min(lo, hi), Math.min(v, Math.max(lo, hi)));
  const t = (Math.log10(vc) - a) / ((b - a) || 1);
  return lo <= hi ? x0 + t * w : x0 + (1 - t) * w;
};
const mapOf = (s: FamilyScale) => (s.log ? mapLog : mapLin);
const fmtCurveVal = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));

export function LogViewer({ log, picks }: { log: DigestedLog; picks?: PickMarker[] }) {
  const { system } = useUnits();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, FamilyScale>>({});
  const [view, setView] = useState<{ lo: number; hi: number } | null>(null); // null = full depth range
  const dragRef = useRef<{ y: number; lo: number; hi: number } | null>(null);

  const byMnem = useMemo(() => new Map(log.curves.map((c) => [c.mnemonic.toUpperCase(), c])), [log.curves]);
  const findFamily = (fam: string) => log.curves.find((c) => c.family === fam);
  const gr = findFamily('GR');
  const rt = findFamily('RT') ?? findFamily('RXO');
  const rhob = findFamily('RHOB');
  const nphi = findFamily('NPHI');
  const structuralMnems = new Set([gr, rt, rhob, nphi].filter(Boolean).map((c) => c!.mnemonic));
  const optional = log.curves.filter((c) => !structuralMnems.has(c.mnemonic));

  const [extra, setExtra] = useState<string[]>([]);

  const scaleFor = (key: string, fallback: FamilyScale): FamilyScale => override[key] ?? fallback;

  const tracks: Track[] = useMemo(() => {
    const out: Track[] = [];
    if (gr) out.push({ kind: 'gr', key: 'GR', curve: gr, scale: scaleFor('GR', FAMILY_SCALE.GR) });
    if (rt) out.push({ kind: 'rt', key: rt.mnemonic, curve: rt, scale: scaleFor(rt.mnemonic, FAMILY_SCALE.RT) });
    if (rhob && nphi) {
      out.push({
        kind: 'rhob-nphi', key: 'RHOB-NPHI', rhob, nphi,
        rhobScale: scaleFor('RHOB', FAMILY_SCALE.RHOB), nphiScale: scaleFor('NPHI', FAMILY_SCALE.NPHI),
      });
    }
    extra.forEach((mnem, i) => {
      const c = byMnem.get(mnem.toUpperCase());
      if (!c) return;
      const fam = c.family && FAMILY_SCALE[c.family];
      let auto: FamilyScale;
      if (fam) auto = fam;
      else {
        let lo = Infinity, hi = -Infinity;
        for (const v of c.values) { if (v == null || !Number.isFinite(v)) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
        auto = Number.isFinite(lo) ? { lo, hi: lo === hi ? lo + 1 : hi } : { lo: 0, hi: 1 };
      }
      out.push({ kind: 'generic', key: c.mnemonic, curve: c, scale: scaleFor(c.mnemonic, auto), color: GENERIC_COLORS[i % GENERIC_COLORS.length] });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gr, rt, rhob, nphi, extra, override, byMnem]);

  // depth in METRES regardless of what the file declared
  const mdM = useMemo(() => {
    const f = depthToMetres(1, log.depthUnit) ?? 1;
    return log.md.map((v) => v * f);
  }, [log.md, log.depthUnit]);

  const range = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const v of mdM) { if (!Number.isFinite(v)) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
    return Number.isFinite(lo) ? { lo, hi } : { lo: 0, hi: 1 };
  }, [mdM]);
  const effRange = view ?? range;

  // a new log (well) resets any zoom/pan from the previous one
  useEffect(() => { setView(null); }, [log.well]);

  const zoomBy = (factor: number, aroundM?: number) => {
    const cur = view ?? range;
    const span = cur.hi - cur.lo;
    const fullSpan = range.hi - range.lo || 1;
    const minSpan = Math.max(2, fullSpan * 0.01);
    const newSpan = Math.min(fullSpan, Math.max(minSpan, span * factor));
    const center = aroundM ?? (cur.lo + cur.hi) / 2;
    const t = span > 0 ? (center - cur.lo) / span : 0.5;
    let newLo = center - t * newSpan;
    let newHi = newLo + newSpan;
    if (newLo < range.lo) { newHi += range.lo - newLo; newLo = range.lo; }
    if (newHi > range.hi) { newLo -= newHi - range.hi; newHi = range.hi; }
    setView(newSpan >= fullSpan - 1e-6 ? null : { lo: newLo, hi: newHi });
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // this well's own GR endpoints (litho) and Rt baseline (fluid) — both
  // heuristics calibrate to the well they're looking at, not a fixed number
  const grEnd = useMemo(() => (gr ? grEndpoints(gr.values) : null), [gr]);
  const rtBase = useMemo(() => (rt ? computeRtBaseline(rt.values) : null), [rt]);

  // layout: up to two fixed-width flag columns (litho, then fluid) sit
  // between GR and RT (or before RT if there's no GR track); remaining
  // tracks share the rest — RHOB/NPHI gets 1.3x weight (two curves + shading
  // + legend need the room)
  const layout = useMemo(() => {
    const hasLitho = !!(gr && grEnd);
    const hasFlag = !!(rhob && nphi && rt);
    const flagCols: { key: FlagKey; w: number }[] = [];
    if (hasLitho) flagCols.push({ key: 'litho', w: FLAG_W });
    if (hasFlag) flagCols.push({ key: 'fluid', w: FLAG_W });
    const flagsSpace = flagCols.reduce((n, f) => n + f.w + TRACK_GAP, 0);
    const avail = Math.max(80, size.w - DEPTH_AXIS_W - 10 - flagsSpace);
    const weight = (t: Track) => (t.kind === 'rhob-nphi' ? 1.3 : 1);
    const totalW = tracks.reduce((n, t) => n + weight(t), 0) || 1;
    const grIdx = tracks.findIndex((t) => t.kind === 'gr');
    const flagAfterCol = flagCols.length ? grIdx : -1; // -1 = before every track

    let x = DEPTH_AXIS_W;
    const flagX0s: Partial<Record<FlagKey, number>> = {};
    const placeFlags = () => { for (const f of flagCols) { flagX0s[f.key] = x; x += f.w + TRACK_GAP; } };
    if (flagCols.length && flagAfterCol === -1) placeFlags();
    const cols = tracks.map((t, i) => {
      const w = (weight(t) / totalW) * avail;
      const col = { track: t, x0: x, w: w - TRACK_GAP };
      x += w;
      if (flagCols.length && i === flagAfterCol) placeFlags();
      return col;
    });
    return { hasLitho, hasFlag, flagCols, flagX0s, flagAfterCol, cols };
  }, [tracks, size.w, gr, grEnd, rhob, nphi, rt]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`; cv.style.height = `${size.h}px`;
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const css = (n: string, f: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    const ink3 = css('--ink3', '#94a3b8'), line = css('--line', '#e2e8f0');

    const padT = PAD_T, padB = PAD_B;
    const plotH = size.h - padT - padB;
    const yOf = (m: number) => padT + ((m - effRange.lo) / (effRange.hi - effRange.lo || 1)) * plotH;
    const mOfY = (y: number) => effRange.lo + ((y - padT) / plotH) * (effRange.hi - effRange.lo);

    // depth axis — ticks track whatever window is currently zoomed/panned into
    g.strokeStyle = line; g.lineWidth = 1;
    g.beginPath(); g.moveTo(DEPTH_AXIS_W, padT); g.lineTo(DEPTH_AXIS_W, padT + plotH); g.stroke();
    g.font = '10px ui-monospace, monospace'; g.fillStyle = ink3; g.textAlign = 'right';
    const depthTicks = 8;
    for (let i = 0; i <= depthTicks; i++) {
      const m = effRange.lo + (i / depthTicks) * (effRange.hi - effRange.lo);
      const y = yOf(m);
      g.fillText(depthQ(m, system).text, DEPTH_AXIS_W - 6, y + 3);
      g.strokeStyle = line; g.globalAlpha = 0.35;
      g.beginPath(); g.moveTo(DEPTH_AXIS_W, y); g.lineTo(size.w - 6, y); g.stroke();
      g.globalAlpha = 1;
    }

    // ── litho flag column (automated screening, not a lithology model) ──
    if (layout.hasLitho && gr && grEnd) {
      const lx = layout.flagX0s.litho!;
      const step = Math.max(1, Math.floor(plotH / 300));
      for (let y = padT; y < padT + plotH; y += step) {
        const litho: Litho = classifyLitho(sampleAt(mdM, gr.values, mOfY(y)), grEnd);
        if (!litho) continue;
        g.fillStyle = litho === 'sand' ? SAND_COLOR : SHALE_COLOR;
        g.globalAlpha = 0.8;
        g.fillRect(lx, y, FLAG_W, step + 0.5);
        g.globalAlpha = 1;
      }
      g.strokeStyle = line; g.strokeRect(lx, padT, FLAG_W, plotH);
    }

    // ── fluid flag column (automated screening, not a saturation model) ──
    if (layout.hasFlag && rt && rhob && nphi && rtBase != null) {
      const fx = layout.flagX0s.fluid!;
      const step = Math.max(1, Math.floor(plotH / 300)); // cap draw work on tall logs
      for (let y = padT; y < padT + plotH; y += step) {
        const m = mOfY(y);
        const fluid: Fluid = classifyFluid(
          sampleAt(mdM, rhob.values, m), sampleAt(mdM, nphi.values, m), sampleAt(mdM, rt.values, m), rtBase,
        );
        if (!fluid) continue;
        g.fillStyle = fluid === 'gas' ? FLUID_RED : FLUID_GREEN;
        g.globalAlpha = 0.75;
        g.fillRect(fx, y, FLAG_W, step + 0.5);
        g.globalAlpha = 1;
      }
      g.strokeStyle = line; g.strokeRect(fx, padT, FLAG_W, plotH);
    }

    // ── per-track bodies ──
    for (const { track, x0, w } of layout.cols) {
      g.strokeStyle = line; g.globalAlpha = 0.6;
      g.beginPath(); g.moveTo(x0, padT); g.lineTo(x0, padT + plotH); g.stroke();
      g.globalAlpha = 1;

      if (track.kind === 'gr' || track.kind === 'rt' || track.kind === 'generic') {
        const curve = track.curve;
        const scale = track.scale;
        const map = mapOf(scale);
        const color = track.kind === 'gr' ? GR_COLOR : track.kind === 'rt' ? RT_COLOR
          : (track as { color: string }).color;

        // grid: log tracks get decade lines, linear tracks get 4 even divisions
        g.strokeStyle = line; g.globalAlpha = 0.3; g.lineWidth = 1;
        if (scale.log) {
          const a = Math.floor(Math.log10(Math.min(scale.lo, scale.hi)));
          const b = Math.ceil(Math.log10(Math.max(scale.lo, scale.hi)));
          for (let d = a; d <= b; d++) {
            const x = map(10 ** d, scale.lo, scale.hi, x0, w);
            g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + plotH); g.stroke();
          }
        } else {
          for (let i = 1; i < 4; i++) {
            const x = x0 + (i / 4) * w;
            g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + plotH); g.stroke();
          }
        }
        g.globalAlpha = 1;

        g.strokeStyle = color; g.lineWidth = 1.1;
        g.beginPath();
        let started = false;
        for (let i = 0; i < curve.values.length; i++) {
          const v = curve.values[i], m = mdM[i];
          if (v == null || !Number.isFinite(v) || !Number.isFinite(m)) { started = false; continue; }
          const x = map(v, scale.lo, scale.hi, x0, w);
          const y = yOf(m);
          if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
        }
        g.stroke();
      }

      if (track.kind === 'rhob-nphi') {
        // shaded crossover FIRST (under the curves) — same porosity-unit
        // separation test the automated fluid flag uses, so the visual and
        // the flag never disagree with each other
        const step = Math.max(1, Math.floor(plotH / 400));
        g.fillStyle = CROSSOVER_FILL;
        for (let y = padT; y < padT + plotH; y += step) {
          const m = mOfY(y);
          const rv = sampleAt(mdM, track.rhob.values, m), nv = sampleAt(mdM, track.nphi.values, m);
          if (!Number.isFinite(rv) || !Number.isFinite(nv)) continue;
          if (densityNeutronSeparation(rv, nv) <= 0.08) continue;
          const rx = mapLin(rv, track.rhobScale.lo, track.rhobScale.hi, x0, w);
          const nx = mapLin(nv, track.nphiScale.lo, track.nphiScale.hi, x0, w);
          if (nx > rx) g.fillRect(rx, y, nx - rx, step + 0.5);
        }

        g.strokeStyle = RHOB_COLOR; g.lineWidth = 1.1; g.beginPath();
        let s1 = false;
        for (let i = 0; i < track.rhob.values.length; i++) {
          const v = track.rhob.values[i], m = mdM[i];
          if (v == null || !Number.isFinite(v) || !Number.isFinite(m)) { s1 = false; continue; }
          const x = mapLin(v, track.rhobScale.lo, track.rhobScale.hi, x0, w), y = yOf(m);
          if (!s1) { g.moveTo(x, y); s1 = true; } else g.lineTo(x, y);
        }
        g.stroke();

        g.strokeStyle = NPHI_COLOR; g.lineWidth = 1.1; g.beginPath();
        let s2 = false;
        for (let i = 0; i < track.nphi.values.length; i++) {
          const v = track.nphi.values[i], m = mdM[i];
          if (v == null || !Number.isFinite(v) || !Number.isFinite(m)) { s2 = false; continue; }
          const x = mapLin(v, track.nphiScale.lo, track.nphiScale.hi, x0, w), y = yOf(m);
          if (!s2) { g.moveTo(x, y); s2 = true; } else g.lineTo(x, y);
        }
        g.stroke();
      }
    }

    // formation picks across every track — dashed line + label
    if (picks?.length) {
      g.setLineDash([4, 3]);
      for (const p of picks) {
        const y = yOf(p.md);
        if (y < padT || y > padT + plotH) continue;
        g.strokeStyle = '#e11d74'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(DEPTH_AXIS_W, y); g.lineTo(size.w - 6, y); g.stroke();
        g.fillStyle = '#e11d74'; g.font = '600 9px ui-monospace, monospace'; g.textAlign = 'left';
        g.fillText(p.surface, DEPTH_AXIS_W + 4, y - 3);
      }
      g.setLineDash([]);
    }

    if (hover && hover.y > padT && hover.y < padT + plotH) {
      g.strokeStyle = ink3; g.globalAlpha = 0.7; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(DEPTH_AXIS_W, hover.y); g.lineTo(size.w - 6, hover.y); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }
  }, [layout, mdM, effRange, size, system, picks, hover, rt, rhob, nphi, rtBase, gr, grEnd]);

  // hover readout: depth + every visible curve's value + litho/fluid classification —
  // rendered as a DOM tooltip (crisper text than canvas, and free text wrapping)
  const hoverInfo = useMemo(() => {
    if (!hover) return null;
    const plotH = size.h - PAD_T - PAD_B;
    if (hover.y < PAD_T || hover.y > PAD_T + plotH) return null;
    const m = effRange.lo + ((hover.y - PAD_T) / plotH) * (effRange.hi - effRange.lo);
    const rows: { label: string; text: string }[] = [];
    const pushCurve = (c: DigestedCurve | undefined) => {
      if (!c) return;
      const v = sampleAt(mdM, c.values, m);
      if (!Number.isFinite(v)) return;
      rows.push({ label: c.mnemonic, text: `${fmtCurveVal(v)}${c.unit ? ` ${c.unit}` : ''}` });
    };
    pushCurve(gr); pushCurve(rt); pushCurve(rhob); pushCurve(nphi);
    extra.forEach((mnem) => pushCurve(byMnem.get(mnem.toUpperCase())));

    const litho: Litho = gr && grEnd ? classifyLitho(sampleAt(mdM, gr.values, m), grEnd) : null;
    const fluid: Fluid = (rhob && nphi && rt && rtBase != null)
      ? classifyFluid(sampleAt(mdM, rhob.values, m), sampleAt(mdM, nphi.values, m), sampleAt(mdM, rt.values, m), rtBase)
      : null;
    return { m, rows, litho, fluid };
  }, [hover, effRange, size.h, mdM, gr, rt, rhob, nphi, extra, byMnem, grEnd, rtBase]);

  const fmtScaleVal = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2));

  const ScaleEdit = ({ trackKey, scale, fallback }: { trackKey: string; scale: FamilyScale; fallback: FamilyScale }) => (
    <div className="dqv-scaleedit" onClick={(e) => e.stopPropagation()}>
      <label>Left
        <input type="number" defaultValue={scale.lo}
          onBlur={(e) => setOverride((o) => ({ ...o, [trackKey]: { ...scale, lo: Number(e.target.value) } }))} />
      </label>
      <label>Right
        <input type="number" defaultValue={scale.hi}
          onBlur={(e) => setOverride((o) => ({ ...o, [trackKey]: { ...scale, hi: Number(e.target.value) } }))} />
      </label>
      <button title="Reset to industry-standard default" onClick={() => { setOverride((o) => { const n = { ...o }; delete n[trackKey]; return n; }); }}>
        <RotateCcw size={11} /> {fallback.lo}→{fallback.hi}
      </button>
    </div>
  );

  const FlagHeaderPlaceholders = () => (
    <>
      {layout.flagCols.map((f) => <div key={f.key} className="dqv-track-hdr" style={{ width: f.w, flex: 'none' }} />)}
    </>
  );

  return (
    <div className="dqv-log">
      <div className="dqv-curves">
        {optional.map((c, i) => {
          const on = extra.includes(c.mnemonic);
          const col = GENERIC_COLORS[i % GENERIC_COLORS.length];
          return (
            <button
              key={c.mnemonic}
              className={'dqv-curve' + (on ? ' on' : '')}
              style={on ? { borderColor: col, color: col } : undefined}
              onClick={() => setExtra((s) => (on ? s.filter((x) => x !== c.mnemonic) : [...s, c.mnemonic]))}
            >
              {c.mnemonic}
            </button>
          );
        })}
        {layout.hasLitho && (
          <span className="dqv-flag-legend">
            <i style={{ background: SAND_COLOR }} /> sand <i style={{ background: SHALE_COLOR }} /> shale
            <em>— screening flag (linear GR index vs this well's own P10/P90), not a lithology model</em>
          </span>
        )}
        {layout.hasFlag && (
          <span className="dqv-flag-legend">
            <i style={{ background: FLUID_RED }} /> gas <i style={{ background: FLUID_GREEN }} /> oil
            <em>— screening flag (Rt vs P20 baseline + density-neutron crossover &gt;8 p.u.), not a saturation model</em>
          </span>
        )}
      </div>

      <div className="dqv-zoom-bar">
        <button title="Zoom in" onClick={() => zoomBy(1 / ZOOM_STEP)}><ZoomIn size={12} /></button>
        <button title="Zoom out" onClick={() => zoomBy(ZOOM_STEP)}><ZoomOut size={12} /></button>
        <button title="Reset zoom" disabled={!view} onClick={() => setView(null)}><Maximize2 size={12} /> Reset</button>
        <span className="dqv-zoom-range">
          {depthQ(effRange.lo, system).text} – {depthQ(effRange.hi, system).text} · scroll to zoom · drag to pan
        </span>
      </div>

      <div className="dqv-track-headers" style={{ paddingLeft: DEPTH_AXIS_W }}>
        {layout.flagCols.length > 0 && layout.flagAfterCol === -1 && <FlagHeaderPlaceholders />}
        {layout.cols.map(({ track, w }, i) => {
          const label = track.kind === 'rhob-nphi' ? 'RHOB · NPHI'
            : `${track.curve.mnemonic}${track.kind === 'rt' ? ' (log)' : ''}`;
          const scale = track.kind === 'rhob-nphi' ? track.rhobScale : track.scale;
          const fallback = track.kind === 'gr' ? FAMILY_SCALE.GR
            : track.kind === 'rt' ? FAMILY_SCALE.RT
            : track.kind === 'rhob-nphi' ? FAMILY_SCALE.RHOB
            : (FAMILY_SCALE[track.curve.family ?? ''] ?? scale);
          const key = track.kind === 'rhob-nphi' ? 'RHOB' : track.key;
          return (
            <Fragment key={track.key}>
              <div className="dqv-track-hdr" style={{ width: w, flex: 'none' }}>
                <button className="dqv-track-title" onClick={() => setEditing((k) => (k === key ? null : key))}>
                  {label}
                </button>
                <span className="dqv-track-range">
                  {fmtScaleVal(scale.lo)}{scale.log ? ' log' : ''} → {fmtScaleVal(scale.hi)}
                </span>
                {editing === key && <ScaleEdit trackKey={key} scale={scale} fallback={fallback} />}
              </div>
              {layout.flagCols.length > 0 && layout.flagAfterCol === i && <FlagHeaderPlaceholders />}
            </Fragment>
          );
        })}
      </div>

      <div className="dqv-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onWheel={(e) => {
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - r.top;
            if (y < PAD_T || y > size.h - PAD_B) return;
            const plotH = size.h - PAD_T - PAD_B;
            const cur = view ?? range;
            const aroundM = cur.lo + ((y - PAD_T) / plotH) * (cur.hi - cur.lo);
            zoomBy(e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, aroundM);
          }}
          onMouseDown={(e) => {
            const cur = view ?? range;
            dragRef.current = { y: e.clientY, lo: cur.lo, hi: cur.hi };
          }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover({ x: e.clientX - r.left, y: e.clientY - r.top });
            if (dragRef.current) {
              const plotH = size.h - PAD_T - PAD_B;
              const start = dragRef.current;
              const span = start.hi - start.lo;
              const deltaM = -((e.clientY - start.y) / plotH) * span;
              let newLo = start.lo + deltaM, newHi = start.hi + deltaM;
              if (newLo < range.lo) { newHi += range.lo - newLo; newLo = range.lo; }
              if (newHi > range.hi) { newLo -= newHi - range.hi; newHi = range.hi; }
              setView({ lo: newLo, hi: newHi });
            }
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { setHover(null); dragRef.current = null; }}
        />
        {hoverInfo && hover && (
          <div
            className="dqv-log-tip"
            style={{ left: Math.min(hover.x + 14, size.w - 190), top: Math.max(4, Math.min(hover.y - 10, size.h - 24 - hoverInfo.rows.length * 15)) }}
          >
            <b>{depthQ(hoverInfo.m, system).text}</b>
            {hoverInfo.rows.map((r) => (
              <span key={r.label}>{r.label}<em>{r.text}</em></span>
            ))}
            {(hoverInfo.litho || hoverInfo.fluid) && (
              <div className="dqv-log-tip-tags">
                {hoverInfo.litho && (
                  <i className={'dqv-tag litho-' + hoverInfo.litho}>{hoverInfo.litho}</i>
                )}
                {hoverInfo.fluid && (
                  <i className={'dqv-tag fluid-' + hoverInfo.fluid}>{hoverInfo.fluid}</i>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
