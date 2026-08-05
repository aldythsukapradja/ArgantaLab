// viewers/DrillingViewer.tsx — the DRILLING record, read against depth.
//
// Mud logs are the only place the Volve delivery carries what actually happened while
// the hole was being made: mud weight in/out, ECD, ROP, WOB, RPM, standpipe pressure,
// hookload, torque, flow and the pore-pressure indicators (DXC, FPPG). Those channels
// were being dropped on the floor — the log pass only scored petrophysical curves —
// so this viewer is the first time they reach the screen.
//
// Track grouping follows how a drilling engineer reads a morning report, not the file
// order: the MUD WINDOW first (MW in · ECD · pore-pressure gradient on ONE track, the
// classic well-control picture), then the mechanical drilling response, then hydraulics.
//
// Same canvas engine conventions as LogViewer: depth down the y-axis, fixed physical
// scales per channel (not data min/max, so one spike can't flatten a track), values
// screened to null upstream render as GAPS — never as zero.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { fmtIn, type HoleSection } from './casing.ts';

export interface DrillCurve { source?: string; unit?: string; values: (number | null)[]; screened?: number; allNull?: boolean }
export type DrillSection = HoleSection;
export interface DrillPayload {
  well: string; run?: string; folder?: string; format?: string;
  dataNature?: string; source_id?: string; depth_unit?: string;
  md: number[];
  curves: Record<string, DrillCurve>;
  sections?: DrillSection[];
  qc?: { screenedOutOfRange?: Record<string, number>; allNullCurves?: string[]; note?: string | null };
}

/** Fixed physical display scales. A track is drawn on its channel's real operating
 *  range so two wells are visually comparable — never on the data's own min/max. */
const SCALE: Record<string, [number, number]> = {
  MWIN: [0.8, 2.2], MWOUT: [0.8, 2.2], ECD: [0.8, 2.2], PPG: [0.8, 2.2],
  DXC: [0, 2],
  ROP: [0, 120], WOB: [0, 30], RPM: [0, 250], TORQUE: [0, 50],
  SPP: [0, 400], HOOKLOAD: [0, 300],
  FLOWIN: [0, 5000], FLOWOUT: [0, 5000],
  TEMPIN: [0, 100], TEMPOUT: [0, 100],
  PITVOL: [0, 400], GASTOT: [0, 100],
  BITSIZE: [0, 40], BITDEPTH: [0, 6000], TVD: [0, 6000],
};
const COLOR: Record<string, string> = {
  MWIN: '#2563eb',   // mud weight in — the control number, strongest colour
  MWOUT: '#7c3aed',
  ECD: '#e2352c',    // ECD rides above MW; red because exceeding frac gradient is the risk
  PPG: '#f59e0b',    // pore pressure gradient — the lower bound of the window
  DXC: '#0891b2',
  ROP: '#1a9e4c', WOB: '#b45309', RPM: '#6366f1', TORQUE: '#db2777',
  SPP: '#0d9488', HOOKLOAD: '#78716c',
  FLOWIN: '#0284c7', FLOWOUT: '#38bdf8',
  TEMPIN: '#f97316', TEMPOUT: '#ea580c',
  PITVOL: '#65a30d', GASTOT: '#dc2626',
};
const CASING_COLOR = '#7c3aed';
const PICK_COLOR = '#e11d74';
const LABEL: Record<string, string> = {
  MWIN: 'MW in', MWOUT: 'MW out', ECD: 'ECD', PPG: 'Pore grad', DXC: 'DXC',
  ROP: 'ROP', WOB: 'WOB', RPM: 'RPM', TORQUE: 'Torque', SPP: 'SPP',
  HOOKLOAD: 'Hookload', FLOWIN: 'Flow in', FLOWOUT: 'Flow out',
  TEMPIN: 'Temp in', TEMPOUT: 'Temp out', PITVOL: 'Pit vol', GASTOT: 'Gas',
  BITSIZE: 'Bit size', BITDEPTH: 'Bit depth', TVD: 'TVD',
};

/** Tracks, in reading order. `keys` share one track (overlay). */
const TRACKS: Array<{ id: string; title: string; keys: string[] }> = [
  { id: 'window', title: 'Mud window', keys: ['PPG', 'MWIN', 'ECD', 'MWOUT'] },
  { id: 'dxc', title: 'DXC', keys: ['DXC'] },
  { id: 'rop', title: 'ROP', keys: ['ROP'] },
  { id: 'wob', title: 'WOB · Torque', keys: ['WOB', 'TORQUE'] },
  { id: 'rpm', title: 'RPM', keys: ['RPM'] },
  { id: 'hyd', title: 'SPP · Flow', keys: ['SPP', 'FLOWIN', 'FLOWOUT'] },
  { id: 'hook', title: 'Hookload', keys: ['HOOKLOAD'] },
  { id: 'pit', title: 'Pit vol · Gas', keys: ['PITVOL', 'GASTOT'] },
  { id: 'temp', title: 'Mud temp', keys: ['TEMPIN', 'TEMPOUT'] },
];

const cssVar = (el: HTMLElement, n: string, fb: string) =>
  getComputedStyle(el).getPropertyValue(n).trim() || fb;

export function DrillingViewer({ drill, picks }: {
  drill: DrillPayload;
  /** formation tops for THIS wellbore — the drilling record only means something
   *  against the rock it was drilled through */
  picks?: Array<{ surface: string; md: number }>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, r.width), h: Math.max(240, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // only tracks whose channels actually carry live data are drawn — an absent
  // channel is left out rather than shown as an empty labelled column
  const tracks = useMemo(
    () => TRACKS
      .map((t) => ({ ...t, keys: t.keys.filter((k) => drill.curves[k] && !drill.curves[k].allNull) }))
      .filter((t) => t.keys.length > 0),
    [drill],
  );

  const mdRange = useMemo(() => {
    const md = drill.md.filter((v) => Number.isFinite(v));
    return md.length ? [Math.min(...md), Math.max(...md)] as const : [0, 1] as const;
  }, [drill.md]);

  useEffect(() => {
    const cv = cvRef.current, host = wrapRef.current;
    if (!cv || !host) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`; cv.style.height = `${size.h}px`;
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const ink = cssVar(host, '--ink', '#0f172a');
    const ink3 = cssVar(host, '--ink3', '#64748b');
    const line = cssVar(host, '--line', '#e2e8f0');
    const panel2 = cssVar(host, '--panel2', '#f8fafc');

    const padL = 58, padT = 40, padB = 18, gap = 8;
    const plotH = size.h - padT - padB;
    const availW = size.w - padL - 10;
    const tw = tracks.length ? (availW - gap * (tracks.length - 1)) / tracks.length : availW;

    const [md0, md1] = mdRange;
    const yOf = (md: number) => padT + ((md - md0) / (md1 - md0 || 1)) * plotH;

    // depth axis
    g.fillStyle = panel2; g.fillRect(0, padT, padL - 6, plotH);
    g.strokeStyle = line; g.lineWidth = 1;
    g.beginPath(); g.moveTo(padL - 6, padT); g.lineTo(padL - 6, padT + plotH); g.stroke();
    g.fillStyle = ink3; g.font = '9px ui-monospace, monospace'; g.textAlign = 'right';
    const nTicks = 8;
    for (let i = 0; i <= nTicks; i++) {
      const md = md0 + ((md1 - md0) * i) / nTicks;
      const y = yOf(md);
      g.fillText(md.toFixed(0), padL - 10, y + 3);
      g.strokeStyle = line; g.globalAlpha = 0.35;
      g.beginPath(); g.moveTo(padL - 6, y); g.lineTo(size.w - 10, y); g.stroke();
      g.globalAlpha = 1;
    }
    g.textAlign = 'left';
    g.fillStyle = ink3; g.font = '8px ui-monospace, monospace';
    g.fillText(`MD (${drill.depth_unit ?? 'm'})`, 6, padT - 6);

    tracks.forEach((t, ti) => {
      const x0 = padL + ti * (tw + gap);
      // frame
      g.strokeStyle = line; g.globalAlpha = 0.8;
      g.strokeRect(x0, padT, tw, plotH);
      g.globalAlpha = 1;
      // header
      g.fillStyle = ink; g.font = '600 9.5px system-ui, sans-serif';
      g.fillText(t.title, x0 + 3, padT - 22);
      // per-channel legend + scale
      g.font = '8px ui-monospace, monospace';
      t.keys.forEach((k, ki) => {
        const c = drill.curves[k];
        const [lo, hi] = SCALE[k] ?? [0, 1];
        g.fillStyle = COLOR[k] ?? ink3;
        g.fillText(`${LABEL[k] ?? k}${c.unit ? ` ${c.unit}` : ''}`, x0 + 3 + ki * 0, padT - 12 + ki * 0);
        if (ki === 0) {
          g.fillStyle = ink3;
          g.fillText(`${lo}`, x0 + 2, padT + plotH + 12);
          g.textAlign = 'right';
          g.fillText(`${hi}`, x0 + tw - 2, padT + plotH + 12);
          g.textAlign = 'left';
        }
      });

      // traces
      for (const k of t.keys) {
        const c = drill.curves[k];
        const [lo, hi] = SCALE[k] ?? [0, 1];
        g.strokeStyle = COLOR[k] ?? ink3;
        g.lineWidth = k === 'MWIN' || k === 'ECD' ? 1.5 : 1.05;
        g.beginPath();
        let started = false;
        for (let i = 0; i < c.values.length; i++) {
          const v = c.values[i], md = drill.md[i];
          // a screened/absent sample BREAKS the line — it is a gap in knowledge,
          // and drawing through it would invent a measurement
          if (v == null || !Number.isFinite(v) || !Number.isFinite(md)) { started = false; continue; }
          const x = x0 + ((v - lo) / (hi - lo || 1)) * tw;
          const y = yOf(md);
          const xc = Math.max(x0, Math.min(x0 + tw, x));
          if (!started) { g.moveTo(xc, y); started = true; } else g.lineTo(xc, y);
        }
        g.stroke();
      }
    });

    // ── FORMATION TOPS across every track ────────────────────────────────────
    // The drilling response only means something against the rock: an ROP break or a
    // gas peak IS a formation top until proven otherwise. Same markers as the log and
    // trajectory viewers, so the three read as one document.
    if (picks?.length) {
      const LAB_H = 10;
      const placed = picks
        .map((p) => ({ p, y: yOf(p.md) }))
        .filter((x) => x.y >= padT && x.y <= padT + plotH)
        .sort((a, b) => a.y - b.y)
        .map((x) => ({ ...x, ly: x.y }));
      for (let i = 1; i < placed.length; i++) {
        if (placed[i].ly - placed[i - 1].ly < LAB_H) placed[i].ly = placed[i - 1].ly + LAB_H;
      }
      for (const { p, y, ly } of placed) {
        g.strokeStyle = PICK_COLOR; g.lineWidth = 1; g.globalAlpha = 0.7; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(padL, y); g.lineTo(size.w - 10, y); g.stroke();
        g.setLineDash([]); g.globalAlpha = 1;
        g.fillStyle = PICK_COLOR; g.font = '600 8px ui-monospace, monospace'; g.textAlign = 'right';
        g.fillText(p.surface, size.w - 12, ly - 2);
      }
    }

    // ── HOLE SECTIONS / CASING POINTS across every track ─────────────────────
    // A casing point is the single most important depth on an operations-geology
    // plot: it is where the mud window is bounded by steel instead of by rock, so
    // it belongs on the MUD WINDOW track, not tucked away in a schematic.
    if (drill.sections?.length) {
      for (const s of drill.sections) {
        if (s.casingPointMd == null) continue;
        const y = yOf(s.casingPointMd);
        if (y < padT || y > padT + plotH) continue;
        g.strokeStyle = CASING_COLOR; g.lineWidth = 1.4; g.setLineDash([5, 3]);
        g.beginPath(); g.moveTo(padL, y); g.lineTo(size.w - 10, y); g.stroke();
        g.setLineDash([]);
        g.fillStyle = CASING_COLOR; g.font = '600 8px ui-monospace, monospace'; g.textAlign = 'left';
        g.fillText(s.casingIn ? `${fmtIn(s.casingIn)}" csg @ ${s.casingPointMd.toFixed(0)}` : `${s.bitSizeIn}" TD`, padL + 3, y - 2);
      }
    }

    // hover crosshair
    if (hover && hover.y >= padT && hover.y <= padT + plotH) {
      g.strokeStyle = ink3; g.globalAlpha = 0.5; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(padL - 6, hover.y); g.lineTo(size.w - 10, hover.y); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }
  }, [drill, size, tracks, mdRange, hover, picks]);

  // readout at the hovered depth
  const readout = useMemo(() => {
    if (!hover) return null;
    const padT = 40, padB = 18;
    const plotH = size.h - padT - padB;
    const [md0, md1] = mdRange;
    const md = md0 + ((hover.y - padT) / (plotH || 1)) * (md1 - md0);
    if (md < md0 || md > md1) return null;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < drill.md.length; i++) {
      const d = Math.abs(drill.md[i] - md);
      if (d < bd) { bd = d; bi = i; }
    }
    const mdAt = drill.md[bi];
    // the section and the nearest top ABOVE this depth — what an ops geologist reads
    const section = (drill.sections ?? []).find((s) => mdAt >= s.topMd && mdAt <= s.baseMd) ?? null;
    let pick: { surface: string; md: number } | null = null;
    for (const p of picks ?? []) {
      if (p.md <= mdAt && (!pick || p.md > pick.md)) pick = p;
    }
    return { md: mdAt, i: bi, section, pick };
  }, [hover, size, mdRange, drill.md, drill.sections, picks]);

  const screenedTotal = Object.values(drill.qc?.screenedOutOfRange ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="dqv-drill">
      <div className="dqv-bar">
        <span className="dqv-chip on">{drill.well}</span>
        <span className="dqv-chip">{drill.md.length.toLocaleString()} samples</span>
        <span className="dqv-chip">{Object.keys(drill.curves).length} channels</span>
        {drill.curves.MWIN && <span className="dqv-chip">MW {drill.curves.MWIN.unit ?? 'sg'}</span>}
        {drill.sections?.length ? (
          <span className="dqv-chip" title={drill.sections.map((x) => `${x.bitSizeIn}" ${x.topMd.toFixed(0)}-${x.baseMd.toFixed(0)} m`).join(' · ')}>
            {drill.sections.length} hole section{drill.sections.length === 1 ? '' : 's'}
          </span>
        ) : null}
        {screenedTotal > 0 && (
          <span className="dqv-chip warn" title={drill.qc?.note ?? undefined}>
            <AlertTriangle size={10} /> {screenedTotal.toLocaleString()} screened
          </span>
        )}
        {readout && <span className="dqv-meta">MD {readout.md.toFixed(1)} {drill.depth_unit ?? 'm'}</span>}
      </div>

      <div
        className="dqv-canvas-wrap" ref={wrapRef}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseLeave={() => setHover(null)}
      >
        <canvas ref={cvRef} />
        {/* HOVER CARD. This used to be an in-flow row under the canvas, so it appeared
            on hover and squeezed every track upward — the plot moved while you were
            reading it. It is now absolutely positioned over the canvas and flips side
            near the right edge, so hovering never changes the layout. */}
        {readout && hover && (
          <div
            className="dqv-hovercard"
            style={{
              left: hover.x > size.w * 0.6 ? undefined : hover.x + 16,
              right: hover.x > size.w * 0.6 ? size.w - hover.x + 16 : undefined,
              top: Math.min(Math.max(8, hover.y - 12), Math.max(8, size.h - 220)),
            }}
          >
            <b>MD {readout.md.toFixed(1)} {drill.depth_unit ?? 'm'}</b>
            {readout.section && (
              <span className="dqv-hovercard-sec">
                {readout.section.bitSizeIn}&quot; hole
                {readout.section.casingIn ? ` · ${fmtIn(readout.section.casingIn)}" csg @ ${readout.section.baseMd.toFixed(0)}` : ''}
              </span>
            )}
            {readout.pick && <span className="dqv-hovercard-pick">{readout.pick.surface}</span>}
            {tracks.flatMap((t) => t.keys).map((k) => {
              const v = drill.curves[k]?.values[readout.i];
              return (
                <span key={k}>
                  <i style={{ background: COLOR[k] ?? 'var(--ink3)' }} />
                  {LABEL[k] ?? k}
                  <b>{v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(2)}</b>
                  <em>{drill.curves[k]?.unit}</em>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="dqv-drill-foot">
        <span>{drill.dataNature ?? 'measured'} · run {drill.run ?? '—'} · {drill.format ?? ''}</span>
        {drill.source_id && <code>{drill.source_id}</code>}
      </div>
    </div>
  );
}
