// DrillingFieldMap — canvas field map over REAL Volve surface locations (wb index
// x/y) + optional trajectories (traj-*.json, reused loader). Pan/zoom/hover +
// bidirectional crossfilter with the Gantt (click well ↔ activeFilter='well:…').
// Volve geometry always loads from the repo, so no "not loaded" fallback needed —
// but a guard is kept for wells lacking coordinates.
import { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { DrillingSchedule, WellGeo } from './schedule-model';
import { RESERVOIR_COLOR } from './schedule-model';
import { loadTraj } from '../../../wb/load';
import { parseFilter } from './filters';

interface Props {
  schedule: DrillingSchedule;
  open: boolean;
  onClose: () => void;
  activeFilter: string | null;
  onPickWell: (well: string) => void;
  windowWells: Set<string>;
}

interface VP { sc: number; ox: number; oy: number; }
type TrajXY = Record<string, [number, number][]>;

const WT_COLOR = { OP: '#10b981', WI: '#2563eb', WD: '#78909c' } as const;

export function DrillingFieldMap({ schedule, open, onClose, activeFilter, onPickWell, windowWells }: Props) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<VP>({ sc: 1, ox: 0, oy: 0 });
  const [trajs, setTrajs] = useState<TrajXY>({});
  const [layers, setLayers] = useState({ trajectories: true, labels: true, wells: true });
  const wells = schedule.wells.filter((w) => Number.isFinite(w.x) && Number.isFinite(w.y));

  // bbox of all wells
  const bbox = useRef({ x0: 0, x1: 1, y0: 0, y1: 1 });
  useEffect(() => {
    if (!wells.length) return;
    const xs = wells.map((w) => w.x), ys = wells.map((w) => w.y);
    const pad = 400;
    bbox.current = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
  }, [wells.length]);

  // Load trajectories for wells that have them (lazy, once, when opened).
  useEffect(() => {
    if (!open || Object.keys(trajs).length) return;
    let alive = true;
    (async () => {
      const out: TrajXY = {};
      await Promise.all(wells.map(async (w) => {
        try {
          const t = await loadTraj(w.name);
          // Project station N/E displacement onto surface x/y (E=+x, N=+y).
          out[w.name] = t.stations.map((s) => [w.x + s.dispEw, w.y + s.dispNs]);
        } catch { /* no traj for this well */ }
      }));
      if (alive) setTrajs(out);
    })();
    return () => { alive = false; };
  }, [open, wells]);

  const world2screen = useCallback((mw: number, mh: number, x: number, y: number): [number, number] => {
    const b = bbox.current;
    const spanX = b.x1 - b.x0, spanY = b.y1 - b.y0;
    const fit = Math.min(mw / spanX, mh / spanY) * vp.sc;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const sx = mw / 2 + (x - cx) * fit + vp.ox;
    const sy = mh / 2 - (y - cy) * fit + vp.oy; // Y flipped
    return [sx, sy];
  }, [vp]);

  const draw = useCallback(() => {
    const cv = cvRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const mw = wrap.clientWidth, mh = wrap.clientHeight;
    cv.width = mw * dpr; cv.height = mh * dpr;
    cv.style.width = mw + 'px'; cv.style.height = mh + 'px';
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, mw, mh);

    const filter = parseFilter(activeFilter);
    const filterWells = new Set<string>();
    if (filter?.kind === 'well') filterWells.add(filter.value);

    const show = (w: WellGeo): boolean => {
      if (filterWells.size) return filterWells.has(w.name);
      return true;
    };

    // trajectories
    if (layers.trajectories) {
      for (const w of wells) {
        const path = trajs[w.name];
        if (!path || path.length < 2) continue;
        const dim = !show(w);
        ctx.beginPath();
        path.forEach((p, i) => {
          const [sx, sy] = world2screen(mw, mh, p[0], p[1]);
          i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
        });
        ctx.strokeStyle = dim ? 'rgba(148,163,184,.25)' : (WT_COLOR[w.wellType ?? 'OP'] + 'cc');
        ctx.lineWidth = dim ? 0.7 : 1.3;
        ctx.stroke();
      }
    }

    // well dots
    if (layers.wells) {
      for (const w of wells) {
        const [sx, sy] = world2screen(mw, mh, w.x, w.y);
        const dim = !show(w);
        const inWin = windowWells.has(w.name);
        ctx.beginPath();
        ctx.arc(sx, sy, dim ? 2.5 : inWin ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = dim ? 'rgba(148,163,184,.5)' : WT_COLOR[w.wellType ?? 'OP'];
        ctx.fill();
        if (inWin && !dim) {
          ctx.strokeStyle = '#e11d74'; ctx.lineWidth = 1.5; ctx.stroke();
        } else if (!dim && w.reservoir) {
          ctx.strokeStyle = RESERVOIR_COLOR[w.reservoir]; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }

    // labels
    if (layers.labels) {
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink2') || '#475569';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = ink.trim() || '#475569';
      for (const w of wells) {
        if (!show(w)) continue;
        const [sx, sy] = world2screen(mw, mh, w.x, w.y);
        ctx.fillText(w.name, sx + 6, sy - 5);
      }
    }
  }, [wells, trajs, layers, world2screen, activeFilter, windowWells]);

  useEffect(() => { if (open) draw(); }, [open, draw, vp]);
  useEffect(() => {
    if (!open) return;
    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    // re-fit after the drawer's width transition settles
    const t = setTimeout(draw, 320);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [open, draw]);

  // interaction — Pointer Events unify mouse/touch/pen (one code path for pan +
  // tap-to-select); a 2nd simultaneous pointer switches to pinch-to-zoom.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const findWell = (mx: number, my: number): WellGeo | null => {
    const wrap = wrapRef.current!; const mw = wrap.clientWidth, mh = wrap.clientHeight;
    let best: WellGeo | null = null, bestD = 12;
    for (const w of wells) {
      const [sx, sy] = world2screen(mw, mh, w.x, w.y);
      const d = Math.hypot(sx - mx, sy - my);
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      drag.current = null;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: vp.sc };
    } else if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / (pinch.current.dist || 1);
      const baseScale = pinch.current.scale;
      setVp((v) => ({ ...v, sc: Math.max(0.4, Math.min(12, baseScale * ratio)) }));
      return;
    }
    const wrap = wrapRef.current!; const r = wrap.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag.current) {
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        drag.current.moved = true;
        setVp((v) => ({ ...v, ox: v.ox + dx, oy: v.oy + dy }));
        drag.current.x = e.clientX; drag.current.y = e.clientY;
      }
      return;
    }
    const w = findWell(mx, my);
    const tip = tipRef.current!;
    if (w) {
      tip.style.display = 'block';
      tip.style.left = Math.min(mx + 12, wrap.clientWidth - 180) + 'px';
      tip.style.top = (my + 12) + 'px';
      tip.innerHTML = `<b>${w.name}</b><br>${w.wellType === 'WI' ? 'Injector' : w.role === 'none' ? 'Exploration' : 'Producer'} · ${w.reservoir ?? '—'}<br>TD ${w.tdMd.toFixed(0)} m MD${w.firstProd ? ` · first oil ${w.firstProd}` : ''}`;
    } else { tip.style.display = 'none'; }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      if (drag.current && !drag.current.moved) {
        const wrap = wrapRef.current!; const r = wrap.getBoundingClientRect();
        const w = findWell(e.clientX - r.left, e.clientY - r.top);
        if (w) onPickWell(w.name);
      }
      drag.current = null;
    }
  };
  const onPointerLeaveMap = () => {
    drag.current = null;
    pointers.current.clear();
    pinch.current = null;
    if (tipRef.current) tipRef.current.style.display = 'none';
  };
  const onWheel = (e: React.WheelEvent) => {
    const f = e.deltaY < 0 ? 1.18 : 0.85;
    setVp((v) => ({ ...v, sc: Math.max(0.4, Math.min(12, v.sc * f)) }));
  };
  const fit = () => setVp({ sc: 1, ox: 0, oy: 0 });

  return (
    <div className={`dmap${open ? ' open' : ''}`}>
      <div className="dmap-bar">
        <span className="t">FIELD MAP · VOLVE</span>
        <span className="sp" />
        <button className="dbtn" onClick={() => setVp((v) => ({ ...v, sc: Math.min(12, v.sc * 1.3) }))}>+</button>
        <button className="dbtn" onClick={() => setVp((v) => ({ ...v, sc: Math.max(0.4, v.sc * 0.77) }))}>−</button>
        <button className="dbtn" onClick={fit}>FIT</button>
        <button className="dbtn" onClick={onClose}><X size={12} /></button>
      </div>
      <div className="dmap-layers">
        {(['wells', 'trajectories', 'labels'] as const).map((k) => (
          <label key={k}>
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
            {k}
          </label>
        ))}
      </div>
      <div ref={wrapRef} className={`dmap-cv${drag.current ? ' grab' : ''}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp} onPointerLeave={onPointerLeaveMap}
        onWheel={onWheel} onDoubleClick={fit}>
        <canvas ref={cvRef} />
        <div ref={tipRef} className="dmap-tip" />
      </div>
      <div className="dmap-stat">
        {activeFilter?.startsWith('well:') ? `Selected: ${activeFilter.slice(5)}` : `${wells.length} wells · ${windowWells.size} in window · drag to pan · scroll to zoom`}
      </div>
    </div>
  );
}
