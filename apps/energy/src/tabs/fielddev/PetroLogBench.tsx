// PetroLogBench — the Single Well interpretation bench (P4).
//
// Learned from dataqc/viewers/LogViewer.tsx — the same purpose-built canvas track
// engine, the same industry scales, the same crossover shading — and then taken
// where a log VIEWER cannot go:
//
//   · ZONES.     Pick surfaces from the workspace become filled bands across every
//                track, with the interval name in the depth column. A log viewer
//                shows depth; a bench shows which rock you are in.
//   · COMPUTED.  Vsh · PHIE · Sw are recomputed from petro-compute.ts on every
//                parameter change, in their own tracks, with the cutoff drawn as a
//                line so you can see the cutoff doing its work.
//   · THEIRS vs OURS. Where the delivery ships an interpreted curve it is drawn
//                dashed over ours. Never averaged, never merged — the comparison IS
//                the point, and the misfit is reported in the header.
//   · NET/PAY.   The flag the cutoffs produce, as a ribbon, because net is the
//                answer the rest of the suite consumes.
//   · OVERVIEW.  A full-well minimap beside the depth axis showing the zoom window,
//                so a 3,000 m well zoomed to 40 m never loses its place.
//
// And it is WIRED TO THE INPUT TREE, both directions:
//
//   tree → bench    well:NAME · wlog:NAME · traj:NAME      open that bore
//                   wcurve:WELL:KEY · log:KEY              focus that curve track
//                   wpick:WELL:SURFACE · top:SURFACE       zoom to that pick
//                   the eye on any of those                hide the track / the pick
//   bench → tree    clicking a track header, a zone band or a pick label sets the
//                   tree's selection, so the two panes are never out of step
//
// Nothing is fabricated. A bore with no RT gets no Sw track and the header says which
// curve is missing; a bore with no picks gets no zones rather than invented ones.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Maximize2, Waves, ZoomIn, ZoomOut } from 'lucide-react';
import type { DigestedCurve } from '../../dataqc/types';
import { useUnits, depth as depthQ } from '../../units';
import { useScene, isVisible } from './scene';
import { useWorkspace } from './workspace';
import type { PetroParams } from './petro-compute';
import type { PetroWell } from './petro-well';

// ── scales, colours, geometry (LogViewer's, kept identical on purpose so the two
//    surfaces read the same way) ───────────────────────────────────────────────
interface Scale { lo: number; hi: number; log?: boolean }
const SCALE: Record<string, Scale> = {
  GR: { lo: 0, hi: 150 },
  RT: { lo: 0.2, hi: 2000, log: true },
  RHOB: { lo: 1.95, hi: 2.95 },
  NPHI: { lo: 0.45, hi: -0.15 },
  DT: { lo: 140, hi: 40 },
  VSH: { lo: 0, hi: 1 },
  PHIE: { lo: 0.4, hi: 0 },
  SW: { lo: 1, hi: 0 },
};

const GR_COLOR = '#1a9e4c';
const RT_COLOR = '#e2352c';
const RHOB_COLOR = '#df7084';
const NPHI_COLOR = '#62aef7';
const CROSSOVER_FILL = 'rgba(226,75,74,0.16)';
const VSH_COLOR = '#8b7355';
const PHIE_COLOR = '#d99a00';   // porosity: gold — contrasts against Sw's blue
const SW_COLOR = '#3f6fd8';     // saturation: blue, deliberately unchanged
const NET_COLOR = '#16805a';
const PAY_COLOR = '#c2410c';    // pay: burnt orange — distinct from the gold PHIE curve
const REF_COLOR = '#a78bfa';       // Equinor's interpreted curves — always dashed
const PICK_COLOR = '#e11d74';
const AXIS_W = 58;
const MINI_W = 26;
const RIBBON_W = 40;
const GAP = 1;
const PAD_T = 20;
const PAD_B = 18;
const ZOOM_STEP = 1.4;

type TrackKey = 'GR' | 'RT' | 'RHOB-NPHI' | 'VSH' | 'PHIE' | 'SW';

interface Track {
  key: TrackKey;
  label: string;
  weight: number;
  /** the Input-tree node id this track answers to, for the two-way link */
  nodeKey: string;
  /** null when the bore lacks what the track needs — the reason is shown instead */
  missing?: string;
}

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
const mapOf = (s: Scale) => (s.log ? mapLog : mapLin);
const fmtVal = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));

export function PetroLogBench({ well, params, onBore }: {
  /** the interpretation, computed once by the pane and shared with the zone strip */
  well: PetroWell;
  params: PetroParams;
  onBore: (name: string) => void;
}) {
  const { bore, log, loading, mdM, fam, result, zones, range, fit } = well;
  const { system } = useUnits();
  const { ws } = useWorkspace();
  const sel = useScene((s) => s.sel);
  const setSel = useScene((s) => s.setSel);
  const vis = useScene((s) => s.vis);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<{ lo: number; hi: number } | null>(null);
  const dragRef = useRef<{ y: number; lo: number; hi: number } | null>(null);

  // a new bore resets the zoom — carrying 3,100–3,140 m onto a well that stops at
  // 2,800 m would open on an empty window
  useEffect(() => { setView(null); }, [bore?.name]);

  const eff = view ?? range;

  // ── the Input tree drives the bench ────────────────────────────────────────
  // A selection made in the left rail is an instruction here: open this bore, focus
  // this curve, go to this pick. Without it the two panes are two apps.
  const [focusTrack, setFocusTrack] = useState<string | null>(null);
  useEffect(() => {
    if (!sel) return;
    const [kind, ...rest] = sel.split(':');
    const arg = rest.join(':');
    if (kind === 'well' || kind === 'wlog' || kind === 'traj' || kind === 'wtop') {
      if (arg && arg !== bore?.name) onBore(arg);
      return;
    }
    if (kind === 'wcurve') {
      const [w, curve] = rest;
      if (w && w !== bore?.name) onBore(w);
      setFocusTrack(curve ?? null);
      return;
    }
    if (kind === 'log') { setFocusTrack(arg); return; }
    if (kind === 'wpick' || kind === 'top') {
      const [a, b] = kind === 'wpick' ? rest : [null, arg];
      if (kind === 'wpick' && a && a !== bore?.name) onBore(a);
      const surface = kind === 'wpick' ? b : arg;
      const z = zones.find((zz) => zz.name === surface);
      if (z) {
        // frame the interval with a margin, so the pick has context around it
        const span = Math.max(30, (z.base - z.top) * 1.6);
        const mid = (z.top + z.base) / 2;
        setView({ lo: Math.max(range.lo, mid - span / 2), hi: Math.min(range.hi, mid + span / 2) });
      }
      setFocusTrack(null);
    }
  }, [sel, zones, range.lo, range.hi, bore?.name, onBore]);

  // ── which tracks exist, and why one does not ───────────────────────────────
  const tracks: Track[] = useMemo(() => {
    const out: Track[] = [];
    if (fam.gr) out.push({ key: 'GR', label: 'GR', weight: 1, nodeKey: 'GR' });
    if (fam.rt) out.push({ key: 'RT', label: `${fam.rt.mnemonic} (log)`, weight: 1, nodeKey: 'RT' });
    if (fam.rhob && fam.nphi) out.push({ key: 'RHOB-NPHI', label: 'RHOB · NPHI', weight: 1.3, nodeKey: 'RHOB' });
    out.push({ key: 'VSH', label: 'Vsh', weight: 0.85, nodeKey: 'VSH', missing: result?.missing.vsh });
    out.push({ key: 'PHIE', label: 'PHIE', weight: 0.85, nodeKey: 'PHIE', missing: result?.missing.phie });
    out.push({ key: 'SW', label: 'Sw', weight: 0.85, nodeKey: 'SW', missing: result?.missing.sw });
    // the eye in the Input tree hides a curve TYPE — honour it here so the tree's
    // visibility control reaches this canvas exactly as it reaches the map
    return out.filter((t) => isVisible(vis, 'log:' + t.nodeKey));
  }, [fam, result, vis]);

  const layout = useMemo(() => {
    const avail = Math.max(120, size.w - AXIS_W - MINI_W - RIBBON_W - 12);
    const total = tracks.reduce((n, t) => n + t.weight, 0) || 1;
    let x = AXIS_W + MINI_W;
    const cols = tracks.map((t) => {
      const w = (t.weight / total) * avail;
      const col = { track: t, x0: x, w: w - GAP };
      x += w;
      return col;
    });
    return { cols, ribbonX: x };
  }, [tracks, size.w]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const zoomBy = (factor: number, aroundM?: number) => {
    const cur = view ?? range;
    const span = cur.hi - cur.lo;
    const full = range.hi - range.lo || 1;
    const minSpan = Math.max(2, full * 0.004);
    const next = Math.min(full, Math.max(minSpan, span * factor));
    const center = aroundM ?? (cur.lo + cur.hi) / 2;
    const t = span > 0 ? (center - cur.lo) / span : 0.5;
    let lo = center - t * next;
    let hi = lo + next;
    if (lo < range.lo) { hi += range.lo - lo; lo = range.lo; }
    if (hi > range.hi) { lo -= hi - range.hi; hi = range.hi; }
    setView(next >= full - 1e-6 ? null : { lo, hi });
  };

  // ── draw ───────────────────────────────────────────────────────────────────
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
    if (!log || !mdM.length) return;

    const css = (n: string, f: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    const ink3 = css('--ink3', '#94a3b8'), line = css('--line', '#e2e8f0');

    const plotH = size.h - PAD_T - PAD_B;
    const yOf = (m: number) => PAD_T + ((m - eff.lo) / (eff.hi - eff.lo || 1)) * plotH;
    const mOfY = (y: number) => eff.lo + ((y - PAD_T) / plotH) * (eff.hi - eff.lo);
    const plotX0 = AXIS_W + MINI_W;
    const plotW = layout.ribbonX - plotX0;

    // ── zone bands, under everything ──
    for (const z of zones) {
      if (!isVisible(vis, 'top:' + z.name)) continue;
      const y0 = Math.max(PAD_T, yOf(z.top));
      const y1 = Math.min(PAD_T + plotH, yOf(z.base));
      if (y1 <= PAD_T || y0 >= PAD_T + plotH) continue;
      g.fillStyle = z.tint; g.globalAlpha = 0.07;
      g.fillRect(plotX0, y0, plotW, y1 - y0);
      g.globalAlpha = 1;
    }

    // ── depth axis ──
    g.strokeStyle = line; g.lineWidth = 1;
    g.beginPath(); g.moveTo(AXIS_W, PAD_T); g.lineTo(AXIS_W, PAD_T + plotH); g.stroke();
    g.font = '9px ui-monospace, monospace'; g.fillStyle = ink3; g.textAlign = 'right';
    for (let i = 0; i <= 8; i++) {
      const m = eff.lo + (i / 8) * (eff.hi - eff.lo);
      const y = yOf(m);
      g.fillText(depthQ(m, system).text, AXIS_W - 5, y + 3);
      g.strokeStyle = line; g.globalAlpha = 0.3;
      g.beginPath(); g.moveTo(plotX0, y); g.lineTo(layout.ribbonX + RIBBON_W, y); g.stroke();
      g.globalAlpha = 1;
    }

    // ── the overview minimap: the whole well, the zones, and where you are ──
    {
      const mx = AXIS_W + 3, mw = MINI_W - 6;
      g.fillStyle = css('--panel2', '#f1f5f9');
      g.fillRect(mx, PAD_T, mw, plotH);
      const yFull = (m: number) => PAD_T + ((m - range.lo) / (range.hi - range.lo || 1)) * plotH;
      for (const z of zones) {
        g.fillStyle = z.tint; g.globalAlpha = 0.5;
        g.fillRect(mx, yFull(z.top), mw, Math.max(1, yFull(z.base) - yFull(z.top)));
        g.globalAlpha = 1;
      }
      // net flag on the overview — where the pay is, at a glance, over the whole bore
      if (result) {
        g.fillStyle = NET_COLOR; g.globalAlpha = 0.85;
        for (let i = 0; i < result.net.length; i++) {
          if (result.net[i] !== true) continue;
          g.fillRect(mx + mw - 4, yFull(mdM[i]), 4, 1.2);
        }
        g.globalAlpha = 1;
      }
      g.strokeStyle = ink3; g.lineWidth = 1;
      g.strokeRect(mx, yFull(eff.lo), mw, Math.max(2, yFull(eff.hi) - yFull(eff.lo)));
      g.strokeStyle = line; g.strokeRect(mx, PAD_T, mw, plotH);
    }

    // ── per-track ──
    const drawCurve = (
      values: (number | null)[], scale: Scale, x0: number, w: number, color: string, dash?: number[],
    ) => {
      const map = mapOf(scale);
      g.strokeStyle = color; g.lineWidth = dash ? 1 : 1.15;
      if (dash) g.setLineDash(dash);
      g.beginPath();
      let started = false;
      for (let i = 0; i < values.length; i++) {
        const v = values[i], m = mdM[i];
        if (v == null || !Number.isFinite(v) || !Number.isFinite(m)) { started = false; continue; }
        const y = yOf(m);
        if (y < PAD_T - 40 || y > PAD_T + plotH + 40) { started = false; continue; }
        const x = map(v, scale.lo, scale.hi, x0, w);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke();
      if (dash) g.setLineDash([]);
    };

    const grid = (scale: Scale, x0: number, w: number) => {
      g.strokeStyle = line; g.globalAlpha = 0.28; g.lineWidth = 1;
      if (scale.log) {
        const a = Math.floor(Math.log10(Math.min(scale.lo, scale.hi)));
        const b = Math.ceil(Math.log10(Math.max(scale.lo, scale.hi)));
        for (let d = a; d <= b; d++) {
          const x = mapLog(10 ** d, scale.lo, scale.hi, x0, w);
          g.beginPath(); g.moveTo(x, PAD_T); g.lineTo(x, PAD_T + plotH); g.stroke();
        }
      } else {
        for (let i = 1; i < 4; i++) {
          const x = x0 + (i / 4) * w;
          g.beginPath(); g.moveTo(x, PAD_T); g.lineTo(x, PAD_T + plotH); g.stroke();
        }
      }
      g.globalAlpha = 1;
    };

    const cutoffLine = (value: number, scale: Scale, x0: number, w: number, color: string) => {
      const x = mapOf(scale)(value, scale.lo, scale.hi, x0, w);
      g.strokeStyle = color; g.globalAlpha = 0.85; g.lineWidth = 1; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(x, PAD_T); g.lineTo(x, PAD_T + plotH); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    };

    for (const { track, x0, w } of layout.cols) {
      g.strokeStyle = line; g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(x0, PAD_T); g.lineTo(x0, PAD_T + plotH); g.stroke();
      g.globalAlpha = 1;

      // a focused track (selected in the tree) gets a tinted backing so the link
      // between the two panes is visible rather than merely functional
      if (focusTrack && (track.nodeKey === focusTrack || track.key === focusTrack)) {
        g.fillStyle = css('--teal', '#14b8a6'); g.globalAlpha = 0.07;
        g.fillRect(x0, PAD_T, w, plotH); g.globalAlpha = 1;
      }

      if (track.missing) continue;

      if (track.key === 'GR' && fam.gr) {
        grid(SCALE.GR, x0, w);
        // the resolved endpoints, drawn where they act
        if (result?.endpoints) {
          for (const [v, c] of [[result.endpoints.clean, '#4ade80'], [result.endpoints.shale, '#94a3b8']] as const) {
            const x = mapLin(v, SCALE.GR.lo, SCALE.GR.hi, x0, w);
            g.strokeStyle = c; g.globalAlpha = 0.9; g.lineWidth = 1; g.setLineDash([2, 3]);
            g.beginPath(); g.moveTo(x, PAD_T); g.lineTo(x, PAD_T + plotH); g.stroke();
            g.setLineDash([]); g.globalAlpha = 1;
          }
        }
        drawCurve(fam.gr.values, SCALE.GR, x0, w, GR_COLOR);
      } else if (track.key === 'RT' && fam.rt) {
        grid(SCALE.RT, x0, w);
        drawCurve(fam.rt.values, SCALE.RT, x0, w, RT_COLOR);
      } else if (track.key === 'RHOB-NPHI' && fam.rhob && fam.nphi) {
        grid(SCALE.RHOB, x0, w);
        // crossover shading first, under the curves
        const step = Math.max(1, Math.floor(plotH / 400));
        g.fillStyle = CROSSOVER_FILL;
        for (let y = PAD_T; y < PAD_T + plotH; y += step) {
          const m = mOfY(y);
          const rv = sample(mdM, fam.rhob.values, m), nv = sample(mdM, fam.nphi.values, m);
          if (!Number.isFinite(rv) || !Number.isFinite(nv)) continue;
          const phiD = (2.65 - rv) / 1.65;
          if (phiD - nv <= 0.08) continue;
          const rx = mapLin(rv, SCALE.RHOB.lo, SCALE.RHOB.hi, x0, w);
          const nx = mapLin(nv, SCALE.NPHI.lo, SCALE.NPHI.hi, x0, w);
          if (nx > rx) g.fillRect(rx, y, nx - rx, step + 0.5);
        }
        drawCurve(fam.rhob.values, SCALE.RHOB, x0, w, RHOB_COLOR);
        drawCurve(fam.nphi.values, SCALE.NPHI, x0, w, NPHI_COLOR);
      } else if (result && (track.key === 'VSH' || track.key === 'PHIE' || track.key === 'SW')) {
        const scale = SCALE[track.key];
        grid(scale, x0, w);
        const ours = track.key === 'VSH' ? result.vsh : track.key === 'PHIE' ? result.phie : result.sw;
        const theirs = track.key === 'VSH' ? fam.refVsh : track.key === 'PHIE' ? fam.refPhie : fam.refSw;
        const color = track.key === 'VSH' ? VSH_COLOR : track.key === 'PHIE' ? PHIE_COLOR : SW_COLOR;
        const cut = track.key === 'VSH' ? params.cutoffs.vsh
          : track.key === 'PHIE' ? params.cutoffs.phie : params.cutoffs.sw;
        cutoffLine(cut, scale, x0, w, color);
        // theirs UNDER ours and dashed — ours is the thing being judged
        if (theirs) drawCurve(theirs.values, scale, x0, w, REF_COLOR, [3, 2]);
        drawCurve(ours, scale, x0, w, color);
      }
    }

    // ── net / pay ribbon ──
    if (result) {
      const rx = layout.ribbonX + 2, rw = RIBBON_W - 4;
      g.fillStyle = css('--panel2', '#f1f5f9');
      g.fillRect(rx, PAD_T, rw, plotH);
      for (let i = 0; i < result.net.length; i++) {
        if (result.net[i] !== true) continue;
        const y = yOf(mdM[i]);
        if (y < PAD_T || y > PAD_T + plotH) continue;
        // pay = net AND hydrocarbon-bearing by the Sw cutoff; net alone is reservoir
        const swv = result.sw[i];
        g.fillStyle = swv != null && swv <= params.cutoffs.sw * 0.75 ? PAY_COLOR : NET_COLOR;
        g.globalAlpha = 0.85;
        g.fillRect(rx, y, rw, Math.max(1.2, plotH / Math.max(1, result.net.length) + 0.5));
        g.globalAlpha = 1;
      }
      g.strokeStyle = line; g.strokeRect(rx, PAD_T, rw, plotH);
    }

    // ── pick lines + labels ──
    g.setLineDash([4, 3]);
    for (const z of zones) {
      if (!isVisible(vis, 'top:' + z.name)) continue;
      const y = yOf(z.top);
      if (y < PAD_T || y > PAD_T + plotH) continue;
      const on = sel === 'top:' + z.name || sel === `wpick:${bore?.name}:${z.name}`;
      g.strokeStyle = on ? PICK_COLOR : z.tint;
      g.lineWidth = on ? 1.8 : 1.1;
      g.beginPath(); g.moveTo(plotX0, y); g.lineTo(layout.ribbonX + RIBBON_W, y); g.stroke();
      g.fillStyle = on ? PICK_COLOR : z.tint;
      g.font = `${on ? '700' : '600'} 9px ui-monospace, monospace`;
      g.textAlign = 'left';
      g.fillText(z.name, plotX0 + 4, y - 3);
    }
    g.setLineDash([]);

    if (hover && hover.y > PAD_T && hover.y < PAD_T + plotH) {
      g.strokeStyle = ink3; g.globalAlpha = 0.7; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(plotX0, hover.y); g.lineTo(layout.ribbonX + RIBBON_W, hover.y); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }
  }, [log, mdM, eff, size, system, zones, vis, result, layout, fam, params, hover, sel, bore?.name, focusTrack, range]);

  // ── hover readout ──────────────────────────────────────────────────────────
  const tip = useMemo(() => {
    if (!hover || !log || !result) return null;
    const plotH = size.h - PAD_T - PAD_B;
    if (hover.y < PAD_T || hover.y > PAD_T + plotH) return null;
    const m = eff.lo + ((hover.y - PAD_T) / plotH) * (eff.hi - eff.lo);
    const rows: Array<{ label: string; text: string; ref?: string }> = [];
    const push = (c: DigestedCurve | undefined) => {
      if (!c) return;
      const v = sample(mdM, c.values, m);
      if (Number.isFinite(v)) rows.push({ label: c.mnemonic, text: `${fmtVal(v)}${c.unit ? ` ${c.unit}` : ''}` });
    };
    push(fam.gr); push(fam.rt); push(fam.rhob); push(fam.nphi);
    const computed: Array<{ label: string; ours: (number | null)[]; theirs?: DigestedCurve }> = [
      { label: 'Vsh', ours: result.vsh, theirs: fam.refVsh },
      { label: 'PHIE', ours: result.phie, theirs: fam.refPhie },
      { label: 'Sw', ours: result.sw, theirs: fam.refSw },
    ];
    for (const c of computed) {
      const v = sample(mdM, c.ours, m);
      if (!Number.isFinite(v)) continue;
      const t = c.theirs ? sample(mdM, c.theirs.values, m) : NaN;
      rows.push({ label: c.label, text: fmtVal(v), ref: Number.isFinite(t) ? fmtVal(t) : undefined });
    }
    const zone = zones.find((z) => m >= z.top && m < z.base);
    const i = nearestIndex(mdM, m);
    return { m, rows, zone: zone?.name ?? null, net: i >= 0 ? result.net[i] : null };
  }, [hover, log, result, size.h, eff, mdM, fam, zones]);

  // ── bores that can actually be opened here ─────────────────────────────────
  const logged = useMemo(() => ws.bores.filter((b) => b.hasLogs), [ws.bores]);

  if (!bore) {
    return <div className="plb-empty"><Waves size={20} /><b>No wellbore with logs</b><span>The delivery carries no log asset to interpret.</span></div>;
  }

  return (
    <div className="plb">
      {/* well strip — the bench's own selector, mirrored by the Input tree */}
      <div className="plb-wells">
        {logged.map((b) => (
          <button key={b.key} className={'plb-well' + (b.key === bore.key ? ' on' : '')}
            title={`${b.curves.length} curve types · ${b.tops.length} picks · ${b.role}`}
            onClick={() => { onBore(b.name); setSel('well:' + b.name); }}>
            {b.name}
            {b.curves.includes('PHIE') && <i title="carries an interpreted answer — a calibration bore">★</i>}
          </button>
        ))}
      </div>

      <div className="plb-bar">
        <button title="Zoom in" onClick={() => zoomBy(1 / ZOOM_STEP)}><ZoomIn size={12} /></button>
        <button title="Zoom out" onClick={() => zoomBy(ZOOM_STEP)}><ZoomOut size={12} /></button>
        <button title="Whole well" disabled={!view} onClick={() => setView(null)}><Maximize2 size={12} /> Full</button>
        <span className="plb-range">
          {depthQ(eff.lo, system).text} – {depthQ(eff.hi, system).text} · scroll to zoom · drag to pan
        </span>
        {/* Samples the delivery declared as data but that cannot be measurements —
            on Volve, unresolved -999.25 sentinels in the LWD composites. Screening
            them is right; hiding the screening would hide a delivery defect. */}
        {result?.screened?.length ? (
          <span className="plb-screened"
            title={`Physically impossible samples, excluded from the interpretation:\n${
              result.screened.map((s) => `${s.curve}: ${s.rejected.toLocaleString('en-US')} of ${s.of.toLocaleString('en-US')}`).join('\n')
            }\n\nThese are almost always unresolved null sentinels in the source log.`}>
            <AlertTriangle size={10} />
            {result.screened.reduce((n, s) => n + s.rejected, 0).toLocaleString('en-US')} screened
          </span>
        ) : null}
        {result?.endpoints && (
          <span className="plb-chip" title={`GR endpoints (${result.endpoints.nature})`}>
            GR {Math.round(result.endpoints.clean)}→{Math.round(result.endpoints.shale)}
            <i className={'n-' + result.endpoints.nature}>{result.endpoints.nature}</i>
          </span>
        )}
        {/* the calibration readout: how well our recompute reproduces theirs */}
        {fit && (fit.phie || fit.sw || fit.vsh) && (
          <span className="plb-fit" title="Our recompute vs the delivery’s own interpreted curves, over the overlapping samples">
            vs interpreted:
            {(['vsh', 'phie', 'sw'] as const).map((k) => fit[k] && (
              <b key={k}>{k.toUpperCase()} RMS {fit[k]!.rms.toFixed(3)} <i>n={fit[k]!.n}</i></b>
            ))}
          </span>
        )}
      </div>

      <div className="plb-headers" style={{ paddingLeft: AXIS_W + MINI_W }}>
        {layout.cols.map(({ track, w }) => {
          const s = SCALE[track.key === 'RHOB-NPHI' ? 'RHOB' : track.key];
          const on = focusTrack === track.nodeKey;
          return (
            <Fragment key={track.key}>
              <div className={'plb-hdr' + (on ? ' on' : '') + (track.missing ? ' gone' : '')}
                style={{ width: w, flex: 'none' }}
                title={track.missing ?? 'Click to select this curve type in the Input tree'}
                onClick={() => { setFocusTrack(track.nodeKey); setSel('log:' + track.nodeKey); }}>
                <b>{track.label}</b>
                {track.missing
                  ? <em className="plb-gone"><AlertTriangle size={9} /> {track.missing}</em>
                  : <em>{fmtScale(s.lo)}{s.log ? ' log' : ''} → {fmtScale(s.hi)}</em>}
              </div>
            </Fragment>
          );
        })}
        {/* the ribbon's header carries a legend, not just a label — two colours in a
            22px column with the word "N/P" over them was unreadable */}
        <div className="plb-hdr ribbon" style={{ width: RIBBON_W, flex: 'none' }}
          title="Net (reservoir: passes all three cutoffs) and pay (net AND clearly hydrocarbon-bearing)">
          <b>NET</b>
          <span className="plb-legend">
            <i style={{ background: NET_COLOR }} title="net" />
            <i style={{ background: PAY_COLOR }} title="pay" />
          </span>
        </div>
      </div>

      <div className="plb-canvas" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onWheel={(e) => {
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - r.top;
            if (y < PAD_T || y > size.h - PAD_B) return;
            const plotH = size.h - PAD_T - PAD_B;
            const cur = view ?? range;
            zoomBy(e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, cur.lo + ((y - PAD_T) / plotH) * (cur.hi - cur.lo));
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
              const st = dragRef.current;
              const span = st.hi - st.lo;
              const d = -((e.clientY - st.y) / plotH) * span;
              let lo = st.lo + d, hi = st.hi + d;
              if (lo < range.lo) { hi += range.lo - lo; lo = range.lo; }
              if (hi > range.hi) { lo -= hi - range.hi; hi = range.hi; }
              setView({ lo, hi });
            }
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { setHover(null); dragRef.current = null; }}
          onClick={(e) => {
            // clicking a zone band tells the Input tree which horizon you are on
            if (dragRef.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            const plotH = size.h - PAD_T - PAD_B;
            const m = eff.lo + ((e.clientY - r.top - PAD_T) / plotH) * (eff.hi - eff.lo);
            const z = zones.find((zz) => m >= zz.top && m < zz.base);
            if (z) setSel(`wpick:${bore.name}:${z.name}`);
          }}
        />
        {loading && <div className="plb-loading">reading the log digest…</div>}
        {tip && hover && (
          <div className="plb-tip" style={{
            left: Math.min(hover.x + 14, size.w - 200),
            top: Math.max(4, Math.min(hover.y - 10, size.h - 40 - tip.rows.length * 15)),
          }}>
            <b>{depthQ(tip.m, system).text}{tip.zone && <span className="plb-tip-zone">{tip.zone}</span>}</b>
            {tip.rows.map((r) => (
              <span key={r.label}>
                {r.label}<em>{r.text}</em>
                {r.ref && <u title="the delivery’s own interpreted value">{r.ref}</u>}
              </span>
            ))}
            {tip.net != null && <i className={'plb-tip-net ' + (tip.net ? 'yes' : 'no')}>{tip.net ? 'net' : 'non-net'}</i>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── small helpers ────────────────────────────────────────────────────────────

/** Linear sample at a depth; never interpolates across a null gap. */
function sample(md: number[], values: (number | null)[], m: number): number {
  const n = md.length;
  if (!n) return NaN;
  if (m <= md[0]) return values[0] ?? NaN;
  if (m >= md[n - 1]) return values[n - 1] ?? NaN;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (md[mid] <= m) lo = mid; else hi = mid; }
  const a = values[lo], b = values[hi];
  if (a == null || b == null) return NaN;
  const t = (m - md[lo]) / ((md[hi] - md[lo]) || 1);
  return a + (b - a) * t;
}

function nearestIndex(md: number[], m: number): number {
  const n = md.length;
  if (!n) return -1;
  if (m <= md[0]) return 0;
  if (m >= md[n - 1]) return n - 1;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (md[mid] <= m) lo = mid; else hi = mid; }
  return m - md[lo] <= md[hi] - m ? lo : hi;
}

const fmtScale = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2));
