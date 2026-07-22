// XSection.tsx — interactive structural cross-section along a drawn section line.
// Distance-vs-TVD with bilinear-sampled horizons, gas/oil/water fills clipped by
// the OWC, real well paths projected within tolerance, and posted picks.
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { NatureBadge } from '../../components/Provenance';
import { loadSurface } from '../../wb/load';
import type { WellRow, Pick } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { sampleGrid } from '../../engine/grid';
import { surfaceColor, withAlpha } from './chrome';

type Pt = [number, number];
const TOL = 300; // m perpendicular projection tolerance

// surfaces to draw top→bottom (reservoir pair last so fills read correctly)
const STACK = ['seabed', 'shetland_top', 'ty_top', 'bcu', 'hugin_top', 'hugin_base'];

export function XSection({ line, activeSurface, contactZ, wellPaths, picks, onClose }: {
  line: Pt[]; activeSurface: string; contactZ: number;
  wellPaths: Array<{ w: WellRow; path: Pt[] }>; picks: Pick[]; onClose: () => void;
}) {
  const surfRes = useAsync<SurfaceJson[]>(
    () => Promise.all(STACK.map((id) => loadSurface(id).catch(() => null))).then((a) => a.filter(Boolean) as SurfaceJson[]),
    [],
  );
  void activeSurface;

  const a = line[0], b = line[1];
  const lineLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const N = 160;

  // sample horizons along the line
  const traces = useMemo(() => {
    const surfs = surfRes.data ?? [];
    return surfs.map((g) => {
      const pts: Array<[number, number]> = []; // [distance, tvd]
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const z = sampleGrid(g, x, y);
        if (z != null) pts.push([t * lineLen, z]);
        else pts.push([t * lineLen, NaN]);
      }
      return { id: g.id, name: g.name, pts };
    });
  }, [surfRes.data, a, b, lineLen]);

  // projected wells
  const hung = useMemo(() => {
    const out: Array<{ w: WellRow; dist: number; perp: number }> = [];
    for (const { w } of wellPaths) {
      const ax = w.x - a[0], ay = w.y - a[1];
      const bx = b[0] - a[0], by = b[1] - a[1];
      const l2 = bx * bx + by * by || 1;
      const t = (ax * bx + ay * by) / l2;
      if (t < 0 || t > 1) continue;
      const projX = a[0] + bx * t, projY = a[1] + by * t;
      const perp = Math.hypot(w.x - projX, w.y - projY);
      if (perp <= TOL) out.push({ w, dist: t * lineLen, perp });
    }
    return out;
  }, [wellPaths, a, b, lineLen]);

  const zRange = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const tr of traces) for (const [, z] of tr.pts) { if (!isFinite(z)) continue; if (z < min) min = z; if (z > max) max = z; }
    max = Math.max(max, contactZ + 40);
    if (!isFinite(min)) { min = 2000; max = 3300; }
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }, [traces, contactZ]);

  const top = traces.find((t) => t.id === 'hugin_top');
  const base = traces.find((t) => t.id === 'hugin_base');

  const draw = useMemo(() => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 52, padR = 14, padT = 14, padB = 26;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const dx = (d: number) => padL + (d / Math.max(1, lineLen)) * plotW;
    const dy = (z: number) => padT + ((z - zRange.min) / Math.max(1, zRange.max - zRange.min)) * plotH;
    const line0 = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');

    // axes / depth grid
    ctx.strokeStyle = line0; ctx.fillStyle = muted; ctx.font = '9px var(--mono)'; ctx.lineWidth = 0.5;
    const zstep = niceStep(zRange.max - zRange.min);
    for (let z = Math.ceil(zRange.min / zstep) * zstep; z <= zRange.max; z += zstep) {
      const py = dy(z); ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(String(Math.round(z)), padL - 4, py + 3);
    }
    ctx.textAlign = 'center';
    ctx.fillText('A', padL, h - 8); ctx.fillText("A'", w - padR, h - 8);
    ctx.fillText(`${(lineLen / 1000).toFixed(2)} km`, padL + plotW / 2, h - 8);

    // fluid fills between hugin top/base, clipped by OWC (no gas: undersaturated)
    if (top && base) {
      for (let i = 0; i < top.pts.length - 1; i++) {
        const [d0, zt0] = top.pts[i], [d1, zt1] = top.pts[i + 1];
        const zb0 = base.pts[i]?.[1], zb1 = base.pts[i + 1]?.[1];
        if (![zt0, zt1, zb0, zb1].every((v) => isFinite(v))) continue;
        // oil: top→min(base,owc); water: max(top,owc)→base
        band(ctx, dx(d0), dx(d1), dy(zt0), dy(zt1), dy(Math.min(zb0, contactZ)), dy(Math.min(zb1, contactZ)), withAlpha(cssVar('--amber'), 0.32));
        if (zb0 > contactZ || zb1 > contactZ) {
          band(ctx, dx(d0), dx(d1), dy(Math.max(zt0, contactZ)), dy(Math.max(zt1, contactZ)), dy(zb0), dy(zb1), withAlpha(cssVar('--blue'), 0.26));
        }
      }
      // OWC line
      ctx.strokeStyle = cssVar('--rose'); ctx.lineWidth = 1.2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(padL, dy(contactZ)); ctx.lineTo(w - padR, dy(contactZ)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = cssVar('--rose'); ctx.textAlign = 'left'; ctx.fillText(`OWC ${contactZ}`, padL + 3, dy(contactZ) - 3);
    }

    // horizon lines
    traces.forEach((tr, i) => {
      ctx.strokeStyle = tr.id === 'hugin_top' || tr.id === 'hugin_base' ? cssVar('--teal') : surfaceColor(i);
      ctx.lineWidth = tr.id.startsWith('hugin') ? 1.8 : 1; ctx.beginPath();
      let started = false;
      for (const [d, z] of tr.pts) {
        if (!isFinite(z)) { started = false; continue; }
        const px = dx(d), py = dy(z);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // label at right end
      const last = [...tr.pts].reverse().find((p) => isFinite(p[1]));
      if (last) { ctx.fillStyle = ctx.strokeStyle as string; ctx.textAlign = 'left'; ctx.font = '8.5px var(--mono)'; ctx.fillText(tr.name, dx(last[0]) + 2, dy(last[1]) - 1); }
    });

    // hung wells + picks
    for (const { w: well, dist, perp } of hung) {
      const px = dx(dist);
      ctx.strokeStyle = well.role === 'injector' ? cssVar('--blue') : cssVar('--amber');
      ctx.lineWidth = 1.4; ctx.setLineDash(perp > 1 ? [] : []);
      ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, dy(Math.min(well.td_tvd, zRange.max))); ctx.stroke();
      ctx.fillStyle = text; ctx.font = 'bold 9px var(--mono)'; ctx.textAlign = 'center'; ctx.fillText(well.name, px, padT - 2 < 8 ? 10 : padT + 8);
      ctx.fillStyle = muted; ctx.font = '8px var(--mono)'; ctx.fillText(`⟂${Math.round(perp)}m`, px, dy(Math.min(well.td_tvd, zRange.max)) + 10);
      // picks for this well
      for (const pk of picks) {
        if (pk.well !== well.name || pk.tvdss == null) continue;
        const py = dy(pk.tvdss); if (py < padT || py > h - padB) continue;
        ctx.fillStyle = cssVar('--orange'); ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, [traces, top, base, hung, picks, lineLen, zRange, contactZ]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>
        <span className="eyebrow" style={{ flex: 1 }}>Structural cross-section · A–A′</span>
        <NatureBadge nature="interpreted" />
        <span className="chip mono" style={{ color: 'var(--muted)' }}>{hung.length} well(s) hung · ±{TOL}m</span>
        <button onClick={onClose} title="Close section" style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}><X size={14} /></button>
      </div>
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

function band(ctx: CanvasRenderingContext2D, x0: number, x1: number, t0: number, t1: number, b0: number, b1: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x0, t0); ctx.lineTo(x1, t1); ctx.lineTo(x1, b1); ctx.lineTo(x0, b0); ctx.closePath(); ctx.fill();
}
function niceStep(span: number): number {
  const raw = span / 6; const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
