// viewers/TrajectoryViewer.tsx — well path in map view (N/E) and vertical section,
// with formation picks posted on both. Canvas, DPI-correct, no chart library:
// a trajectory is a polyline with depth-coloured segments, which no generic charting
// lib draws well.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUnits, depth as depthQ } from '../../units';

export interface TrajStation { md: number; tvd: number; incl?: number; azi?: number; dispNs: number; dispEw: number }
export interface TrajPayload { well: string; stations: TrajStation[] }
export interface PickMarker { surface: string; md: number }

export function TrajectoryViewer({ traj, picks }: { traj: TrajPayload; picks?: PickMarker[] }) {
  const { system } = useUnits();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const st = traj.stations ?? [];

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const bounds = useMemo(() => {
    let ns0 = Infinity, ns1 = -Infinity, ew0 = Infinity, ew1 = -Infinity, tvd1 = -Infinity;
    for (const s of st) {
      ns0 = Math.min(ns0, s.dispNs); ns1 = Math.max(ns1, s.dispNs);
      ew0 = Math.min(ew0, s.dispEw); ew1 = Math.max(ew1, s.dispEw);
      tvd1 = Math.max(tvd1, s.tvd);
    }
    if (!Number.isFinite(ns0)) return null;
    return { ns0, ns1, ew0, ew1, tvd1 };
  }, [st]);

  useEffect(() => {
    const cv = cvRef.current; if (!cv || !size.w || !size.h || !bounds || !st.length) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`; cv.style.height = `${size.h}px`;
    const g = cv.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const css = (n: string, f: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    const ink = css('--ink', '#0f172a'), ink3 = css('--ink3', '#94a3b8'), line = css('--line', '#e2e8f0');

    const gap = 14;
    const halfW = (size.w - gap * 3) / 2;
    const padT = 26, padB = 24;
    const plotH = size.h - padT - padB;

    // ── panel 1 · map view (E/W vs N/S) ──
    const spanE = Math.max(1, bounds.ew1 - bounds.ew0), spanN = Math.max(1, bounds.ns1 - bounds.ns0);
    const mapSc = Math.min(halfW / spanE, plotH / spanN) * 0.86;
    const mox = gap + halfW / 2 - (spanE * mapSc) / 2 - bounds.ew0 * mapSc;
    const moy = padT + plotH / 2 + (spanN * mapSc) / 2 + bounds.ns0 * mapSc;
    const mapX = (e: number) => mox + e * mapSc;
    const mapY = (n: number) => moy - n * mapSc;

    g.strokeStyle = line; g.strokeRect(gap, padT, halfW, plotH);
    g.fillStyle = ink3; g.font = '600 10px ui-monospace, monospace'; g.textAlign = 'left';
    g.fillText('MAP VIEW · N/E displacement', gap + 4, padT - 8);

    g.lineWidth = 2; g.lineJoin = 'round';
    for (let i = 1; i < st.length; i++) {
      const t = st[i].tvd / (bounds.tvd1 || 1);
      g.strokeStyle = `hsl(${190 - t * 150}, 72%, ${58 - t * 18}%)`;
      g.beginPath();
      g.moveTo(mapX(st[i - 1].dispEw), mapY(st[i - 1].dispNs));
      g.lineTo(mapX(st[i].dispEw), mapY(st[i].dispNs));
      g.stroke();
    }
    // surface location
    g.fillStyle = '#0FB5A6';
    g.beginPath(); g.arc(mapX(st[0].dispEw), mapY(st[0].dispNs), 4, 0, Math.PI * 2); g.fill();

    // ── panel 2 · vertical section (displacement vs TVD) ──
    const x2 = gap * 2 + halfW;
    const dispOf = (s: TrajStation) => Math.hypot(s.dispNs, s.dispEw);
    let dmax = 0; for (const s of st) dmax = Math.max(dmax, dispOf(s));
    const vsX = (d: number) => x2 + 8 + (d / (dmax || 1)) * (halfW - 18);
    const vsY = (tvd: number) => padT + (tvd / (bounds.tvd1 || 1)) * plotH;

    g.strokeStyle = line; g.strokeRect(x2, padT, halfW, plotH);
    g.fillStyle = ink3; g.fillText('VERTICAL SECTION · TVD vs displacement', x2 + 4, padT - 8);

    g.lineWidth = 2;
    for (let i = 1; i < st.length; i++) {
      const t = st[i].tvd / (bounds.tvd1 || 1);
      g.strokeStyle = `hsl(${190 - t * 150}, 72%, ${58 - t * 18}%)`;
      g.beginPath();
      g.moveTo(vsX(dispOf(st[i - 1])), vsY(st[i - 1].tvd));
      g.lineTo(vsX(dispOf(st[i])), vsY(st[i].tvd));
      g.stroke();
    }

    // depth ticks on the section
    g.font = '9px ui-monospace, monospace'; g.fillStyle = ink3; g.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const tvd = (i / 5) * bounds.tvd1;
      const y = vsY(tvd);
      g.strokeStyle = line; g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(x2, y); g.lineTo(x2 + halfW, y); g.stroke();
      g.globalAlpha = 1;
      g.fillText(depthQ(tvd, system).text, x2 + halfW - 4, y - 3);
    }

    // ── picks posted on both panels, resolved MD → station ──
    if (picks?.length) {
      const atMd = (md: number) => {
        for (let i = 1; i < st.length; i++) {
          if (st[i].md >= md) {
            const a = st[i - 1], b = st[i];
            const f = (md - a.md) / ((b.md - a.md) || 1);
            return {
              ns: a.dispNs + (b.dispNs - a.dispNs) * f,
              ew: a.dispEw + (b.dispEw - a.dispEw) * f,
              tvd: a.tvd + (b.tvd - a.tvd) * f,
            };
          }
        }
        return null;
      };
      for (const p of picks) {
        const at = atMd(p.md); if (!at) continue;
        g.fillStyle = '#e11d74';
        g.beginPath(); g.arc(mapX(at.ew), mapY(at.ns), 3.5, 0, Math.PI * 2); g.fill();
        const vy = vsY(at.tvd), vx = vsX(Math.hypot(at.ns, at.ew));
        g.beginPath(); g.arc(vx, vy, 3.5, 0, Math.PI * 2); g.fill();
        g.font = '600 9px ui-monospace, monospace'; g.textAlign = 'left';
        g.fillText(p.surface, vx + 6, vy + 3);
      }
    }

    g.fillStyle = ink; g.font = '600 10px ui-monospace, monospace'; g.textAlign = 'left';
    g.fillText(`${traj.well} · ${st.length} stations`, gap + 4, size.h - 8);
  }, [st, bounds, size, picks, system, traj.well]);

  if (!st.length) return <div className="dqv-empty">No trajectory stations in this asset.</div>;

  return (
    <div className="dqv-traj">
      <div className="dqv-canvas-wrap" ref={wrapRef}><canvas ref={cvRef} /></div>
    </div>
  );
}
