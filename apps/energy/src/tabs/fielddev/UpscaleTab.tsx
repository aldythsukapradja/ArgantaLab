// UpscaleTab — the raw log against the cells it was blocked into.
//
// Upscaling is the step where a 15 cm log sample becomes a 7 m cell, and it is the step
// nobody checks. The check is visual and it is simple: draw the log as a curve and the
// blocked cells as a step trace over it. If the steps do not sit in the middle of the
// curve, the averaging moved the model.
//
// ── WHY A STEP TRACE AND NOT A SECOND CURVE ─────────────────────────────────
//
// A cell is a constant over its whole thickness. Drawing it as a line joining cell
// centres implies a gradient the model does not have, and hides exactly the thing being
// inspected: how much of the log's variation the cell threw away. The step is the
// honest shape.
//
// ── WHY THE SCALES RUN BACKWARDS ────────────────────────────────────────────
//
// This is a composite log, and a composite log has conventions older than any of us.
// Vsh, PHIE and Sw all read RIGHT-to-LEFT: clean rock, good porosity and low water all
// push to the right. Read together, a good reservoir is the interval where all three
// tracks bulge the same way, and that visual rhyme is the entire reason for the
// convention — it is not decoration and it is not reversible per-taste.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeInk } from './theme-ink';

export interface UpscaleSample { md: number; tvdss: number; phie: number | null; vsh: number | null; sw: number | null; net: boolean | null }
export interface UpscaleCellRow { k: number; top: number; base: number; phie: number; sw: number; ntg: number; nSamples: number }
/** a formation pick — the thing that tells you WHICH rock the curve is describing */
export interface UpscaleMarker { name: string; tvdss: number }

export interface UpscaleTabProps {
  wells: string[];
  well: string | null;
  onWell: (w: string) => void;
  samples: UpscaleSample[];
  cells: UpscaleCellRow[];
  markers?: UpscaleMarker[];
  /** blocked vs log means over the shown interval, for the header */
  bias?: { log: number; blocked: number } | null;
  loading?: boolean;
}

type TrackKey = 'vsh' | 'phie' | 'sw';
type Track = {
  key: TrackKey; label: string;
  color: string; fill: string; lo: number; hi: number;
  /** the value at the LEFT edge and at the RIGHT edge — reversed when lo > hi */
  reversed: boolean;
};

/**
 * The tracks, in the order a petrophysicist reads them: lithology, then storage, then
 * fluid. Each is FILLED rather than drawn as a bare line, because the eye reads area
 * far faster than it reads a wiggle — which is the whole reason a composite log looks
 * the way it does.
 *
 * All three are REVERSED, so on every track "further right is better rock". The fill
 * therefore always grows from the LEFT edge, and a good interval is three bulges that
 * line up.
 */
const TRACKS: Track[] = [
  { key: 'vsh', label: 'Vsh', color: '#a3855f', fill: 'rgba(163,133,95,0.32)', lo: 1, hi: 0, reversed: true },
  { key: 'phie', label: 'PHIE', color: '#e0a800', fill: 'rgba(245,212,66,0.34)', lo: 0.4, hi: 0, reversed: true },
  { key: 'sw', label: 'Sw', color: '#2a7fc0', fill: 'rgba(124,196,236,0.34)', lo: 1, hi: 0, reversed: true },
];

export function UpscaleTab({ wells, well, onWell, samples, cells, markers = [], bias, loading }: UpscaleTabProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [showNet, setShowNet] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const ink = useThemeInk();

  const full = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const s of samples) {
      if (!Number.isFinite(s.tvdss)) continue;
      if (s.tvdss < lo) lo = s.tvdss;
      if (s.tvdss > hi) hi = s.tvdss;
    }
    // the cells define the interval that matters; the log usually runs far beyond it
    for (const c of cells) { if (c.top < lo) lo = c.top; if (c.base > hi) hi = c.base; }
    return Number.isFinite(lo) && hi > lo ? { lo, hi } : null;
  }, [samples, cells]);

  // ── depth zoom and pan, like any other log viewer ──
  //
  // A 400 m window at pane height puts ~0.4 m in a pixel; the blocked-cell step and the
  // curve it is meant to sit inside are then the same line. Being able to get down to a
  // few metres is the difference between looking at the QC and doing it.
  const [win, setWin] = useState<{ lo: number; hi: number } | null>(null);
  useEffect(() => { setWin(null); }, [well]);
  const depth = win ?? full;

  const wrap = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 900, h: 620 });
  useEffect(() => {
    const obs = new ResizeObserver((es) => {
      for (const e of es) setBox({ w: Math.max(240, e.contentRect.width), h: Math.max(240, e.contentRect.height) });
    });
    if (wrap.current) obs.observe(wrap.current);
    return () => obs.disconnect();
  }, []);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);

  // ── the cursor: a shared depth across every track ──
  const [cursor, setCursor] = useState<{ py: number; z: number } | null>(null);
  const geom = useRef({ padT: 34, padB: 18, padL: 52, ih: 1 });

  const zAt = useCallback((clientY: number) => {
    const cv = ref.current; if (!cv || !depth) return null;
    const r = cv.getBoundingClientRect();
    const py = (clientY - r.top) / r.height * (box.h);
    const { padT, padB } = geom.current;
    const ih = box.h - padT - padB;
    const f = (py - padT) / ih;
    if (f < -0.02 || f > 1.02) return null;
    return { py, z: depth.lo + Math.min(1, Math.max(0, f)) * (depth.hi - depth.lo) };
  }, [depth, box.h]);

  const onMove = useCallback((e: React.MouseEvent) => setCursor(zAt(e.clientY)), [zAt]);

  // wheel = zoom about the cursor depth, the interaction every log viewer has
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!depth || !full) return;
    e.preventDefault();
    const at = zAt(e.clientY);
    const anchor = at?.z ?? (depth.lo + depth.hi) / 2;
    const span = depth.hi - depth.lo;
    const next = Math.min(full.hi - full.lo, Math.max(3, span * (e.deltaY > 0 ? 1.22 : 1 / 1.22)));
    const f = (anchor - depth.lo) / span;
    let lo = anchor - f * next, hi = lo + next;
    if (lo < full.lo) { lo = full.lo; hi = lo + next; }
    if (hi > full.hi) { hi = full.hi; lo = hi - next; }
    setWin(next >= full.hi - full.lo - 1e-6 ? null : { lo, hi });
  }, [depth, full, zAt]);

  // drag = pan
  const drag = useRef<{ y: number; lo: number; hi: number } | null>(null);
  const onDown = useCallback((e: React.MouseEvent) => {
    if (!depth) return;
    drag.current = { y: e.clientY, lo: depth.lo, hi: depth.hi };
  }, [depth]);
  const onUp = useCallback(() => { drag.current = null; }, []);
  const onDrag = useCallback((e: React.MouseEvent) => {
    const d = drag.current;
    if (!d || !full) { onMove(e); return; }
    const cv = ref.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    const span = d.hi - d.lo;
    const dz = ((e.clientY - d.y) / r.height) * span;
    let lo = d.lo - dz, hi = d.hi - dz;
    if (lo < full.lo) { lo = full.lo; hi = lo + span; }
    if (hi > full.hi) { hi = full.hi; lo = hi - span; }
    setWin({ lo, hi });
    setCursor(zAt(e.clientY));
  }, [full, onMove, zAt]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!depth) {
      ctx.fillStyle = ink.axis; ctx.font = `${12 * dpr}px system-ui`;
      ctx.fillText(loading ? 'reading the log…' : 'No blocked cells for this well.', 16 * dpr, 26 * dpr);
      return;
    }

    const padT = 34 * dpr, padB = 18 * dpr, padL = 52 * dpr, gap = 10 * dpr;
    geom.current = { padT: padT / dpr, padB: padB / dpr, padL: padL / dpr, ih: (H - padT - padB) / dpr };
    const tw = (W - padL - 10 * dpr - gap * (TRACKS.length - 1)) / TRACKS.length;
    const ih = H - padT - padB;
    const y = (z: number) => padT + ((z - depth.lo) / (depth.hi - depth.lo)) * ih;
    const inWin = (z: number) => z >= depth.lo - 1 && z <= depth.hi + 1;

    // a labelled depth grid — a log without depth lines is a picture, not a log
    ctx.strokeStyle = ink.grid; ctx.lineWidth = 1;
    ctx.fillStyle = ink.axis; ctx.font = `${9 * dpr}px ui-monospace,monospace`;
    const span = depth.hi - depth.lo;
    const stepM = span > 400 ? 100 : span > 150 ? 50 : span > 60 ? 20 : span > 25 ? 10 : 5;
    for (let z = Math.ceil(depth.lo / stepM) * stepM; z <= depth.hi; z += stepM) {
      const py = y(z);
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(W - 10 * dpr, py); ctx.stroke();
      ctx.fillText(z.toFixed(0), 4 * dpr, py + 3 * dpr);
    }

    TRACKS.forEach((tr, ti) => {
      const x0 = padL + ti * (tw + gap);
      // lo is the LEFT edge value and hi the RIGHT — reversing a track is a property of
      // these two numbers, so nothing downstream needs to know which way round it is
      const x = (v: number) => x0 + ((v - tr.lo) / (tr.hi - tr.lo)) * tw;

      ctx.fillStyle = ink.panel;
      ctx.fillRect(x0, padT, tw, ih);
      ctx.strokeStyle = ink.frame; ctx.lineWidth = 1;
      ctx.strokeRect(x0, padT, tw, ih);
      ctx.fillStyle = tr.color; ctx.font = `bold ${10 * dpr}px system-ui`;
      ctx.fillText(tr.label, x0 + 3 * dpr, padT - 18 * dpr);
      ctx.fillStyle = ink.axis; ctx.font = `${8.5 * dpr}px ui-monospace,monospace`;
      ctx.fillText(String(tr.lo), x0 + 2 * dpr, padT - 6 * dpr);
      const hiTxt = String(tr.hi);
      ctx.fillText(hiTxt, x0 + tw - ctx.measureText(hiTxt).width - 2 * dpr, padT - 6 * dpr);

      if (showNet) {
        ctx.fillStyle = 'rgba(34,197,94,0.30)';
        for (const sm of samples) {
          if (!sm.net || !Number.isFinite(sm.tvdss) || !inWin(sm.tvdss)) continue;
          ctx.fillRect(x0, y(sm.tvdss), 5 * dpr, 1.4 * dpr);
        }
      }

      // FILLED curve. Every track is reversed, so the fill grows from the LEFT edge and
      // a good interval is three bulges that line up.
      const base = x0;
      ctx.fillStyle = tr.fill;
      ctx.beginPath();
      let open = false;
      let lastY = padT;
      for (const sm of samples) {
        const v = sm[tr.key];
        if (v == null || !Number.isFinite(v) || !Number.isFinite(sm.tvdss) || !inWin(sm.tvdss)) {
          if (open) { ctx.lineTo(base, lastY); ctx.closePath(); ctx.fill(); ctx.beginPath(); open = false; }
          continue;
        }
        const px = Math.max(x0, Math.min(x0 + tw, x(v)));
        lastY = y(sm.tvdss);
        if (!open) { ctx.moveTo(base, lastY); open = true; }
        ctx.lineTo(px, lastY);
      }
      if (open) { ctx.lineTo(base, lastY); ctx.closePath(); ctx.fill(); }

      ctx.strokeStyle = tr.color; ctx.lineWidth = 0.9 * dpr; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      let started = false;
      for (const sm of samples) {
        const v = sm[tr.key];
        if (v == null || !Number.isFinite(v) || !Number.isFinite(sm.tvdss) || !inWin(sm.tvdss)) { started = false; continue; }
        const px = Math.max(x0, Math.min(x0 + tw, x(v))), py = y(sm.tvdss);
        if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
      }
      ctx.stroke(); ctx.globalAlpha = 1;

      // THE BLOCKED CELLS, AS STEPS.
      //
      // A cell is a CONSTANT over its thickness. Joining cell centres would draw a
      // gradient the model does not have, and hide the very thing being inspected:
      // how much of the log the average threw away. Haloed so it reads over the fill
      // in either theme — the halo and the line swap colours with it.
      if (tr.key !== 'vsh') {
        for (const pass of [{ c: ink.stepHalo, w: 3.4 }, { c: ink.step, w: 1.7 }]) {
          ctx.strokeStyle = pass.c; ctx.lineWidth = pass.w * dpr;
          for (const c of cells) {
            const v = tr.key === 'phie' ? c.phie : c.sw;
            if (!Number.isFinite(v) || (!inWin(c.top) && !inWin(c.base))) continue;
            const px = Math.max(x0, Math.min(x0 + tw, x(v)));
            ctx.beginPath(); ctx.moveTo(px, y(c.top)); ctx.lineTo(px, y(c.base)); ctx.stroke();
          }
        }
        // the cell boundaries, so the blocking interval is readable
        ctx.strokeStyle = ink.dark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.45)';
        ctx.lineWidth = 1;
        for (const c of cells) {
          if (!inWin(c.top)) continue;
          ctx.beginPath();
          ctx.moveTo(x0, y(c.top)); ctx.lineTo(x0 + 7 * dpr, y(c.top));
          ctx.stroke();
        }
      }

      // a cell averaged over fewer than three samples is not an average
      ctx.fillStyle = '#f59e0b';
      for (const c of cells) {
        if (c.nSamples >= 3 || (!inWin(c.top) && !inWin(c.base))) continue;
        ctx.fillRect(x0 + tw - 5 * dpr, y(c.top), 5 * dpr, Math.max(2 * dpr, y(c.base) - y(c.top)));
      }
    });

    // ── MARKERS, across every track ──
    //
    // A curve with no pick on it describes rock nobody has named. The line runs the
    // full width because the whole point of a marker is that it is the same depth in
    // every track.
    if (showMarkers) {
      const right = W - 10 * dpr;
      ctx.font = `bold ${9 * dpr}px system-ui`;
      for (const mk of markers) {
        if (!Number.isFinite(mk.tvdss) || !inWin(mk.tvdss)) continue;
        const py = y(mk.tvdss);
        ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 1.2 * dpr;
        ctx.setLineDash([5 * dpr, 3 * dpr]);
        ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(right, py); ctx.stroke();
        ctx.setLineDash([]);
        const label = mk.name;
        const wLab = ctx.measureText(label).width;
        ctx.fillStyle = ink.tipBg;
        ctx.fillRect(right - wLab - 8 * dpr, py - 10 * dpr, wLab + 6 * dpr, 12 * dpr);
        ctx.fillStyle = '#c084fc';
        ctx.fillText(label, right - wLab - 5 * dpr, py - 1 * dpr);
      }
    }

    // ── the cursor, and the value it reads on every track ──
    if (cursor) {
      const py = cursor.py * dpr;
      ctx.strokeStyle = ink.cross; ctx.lineWidth = 1;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(W - 10 * dpr, py); ctx.stroke();
      ctx.setLineDash([]);

      // nearest sample by depth — a log is irregularly spaced, so nearest, not indexed
      let best: UpscaleSample | null = null, bd = Infinity;
      for (const sm of samples) {
        const d = Math.abs(sm.tvdss - cursor.z);
        if (d < bd) { bd = d; best = sm; }
      }
      ctx.font = `${9 * dpr}px ui-monospace,monospace`;
      const txt = best && bd < 2
        ? `${cursor.z.toFixed(1)} m   Vsh ${fmtN(best.vsh)}   PHIE ${fmtN(best.phie)}   Sw ${fmtN(best.sw)}`
        : `${cursor.z.toFixed(1)} m`;
      const w2 = ctx.measureText(txt).width;
      ctx.fillStyle = ink.tipBg;
      ctx.fillRect(padL + 4 * dpr, py - 15 * dpr, w2 + 10 * dpr, 14 * dpr);
      ctx.strokeStyle = ink.frame; ctx.strokeRect(padL + 4 * dpr, py - 15 * dpr, w2 + 10 * dpr, 14 * dpr);
      ctx.fillStyle = ink.tipInk;
      ctx.fillText(txt, padL + 9 * dpr, py - 5 * dpr);
    }
  }, [samples, cells, depth, showNet, showMarkers, markers, loading, dpr, box, ink, cursor]);

  const drift = bias && Number.isFinite(bias.log) && Number.isFinite(bias.blocked)
    ? bias.blocked - bias.log : null;
  const zoomed = !!win && !!full && (win.hi - win.lo) < (full.hi - full.lo) - 1e-6;

  return (
    <div className="up">
      <div className="up-bar">
        <label>
          Well
          <select value={well ?? ''} onChange={(e) => onWell(e.target.value)}>
            {wells.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="up-chk">
          <input type="checkbox" checked={showNet} onChange={(e) => setShowNet(e.target.checked)} />
          net flag
        </label>
        <label className="up-chk">
          <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} />
          markers ({markers.length})
        </label>
        <span className="up-legend"><i className="up-l-log" /> log</span>
        <span className="up-legend"><i className="up-l-cell" /> blocked cell</span>
        <span className="up-legend"><i className="up-l-thin" /> &lt;3 samples</span>
        <button className="up-zoom" disabled={!zoomed} onClick={() => setWin(null)}>
          {zoomed ? `${(depth!.hi - depth!.lo).toFixed(0)} m — reset` : 'full interval'}
        </button>
        <span className="up-sp" />
        {drift != null && (
          <span className={`up-bias${Math.abs(drift) > 0.02 ? ' warn' : ''}`}>
            blocking bias {drift >= 0 ? '+' : ''}{drift.toFixed(4)} φ
          </span>
        )}
        <span className="up-count">{cells.length} cells · {samples.length} samples</span>
      </div>
      <div className="up-canvas" ref={wrap}>
        <canvas ref={ref}
          width={Math.round(box.w * dpr)} height={Math.round(box.h * dpr)}
          onMouseMove={onDrag} onMouseLeave={() => { setCursor(null); drag.current = null; }}
          onMouseDown={onDown} onMouseUp={onUp} onWheel={onWheel} />
      </div>
      <p className="up-note">
        The step trace is the cell. If the steps do not sit through the middle of the
        curve, the averaging has moved the model — which is the one thing upscaling is
        not allowed to do. Scroll to zoom on depth, drag to pan.
      </p>
    </div>
  );
}

const fmtN = (v: number | null) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(3));
