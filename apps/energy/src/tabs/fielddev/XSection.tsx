// XSection.tsx — fully interactive structural cross-section (V1a polish).
// High-DPI canvas with independent distance/depth zoom-to-cursor (wheel),
// drag-pan, dblclick-fit, a hover crosshair readout (distance / TVD / sampled
// horizon depths / fluid zone), draggable A–A′ endpoints that re-sample the
// section live, a flatten-on-surface datum, real gas/oil/water fills clipped by
// contacts, hung real wells with pick ties, and a vertical-exaggeration slider.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { NatureBadge } from '../../components/Provenance';
import { Slider } from './chrome';
import { loadSurface } from '../../wb/load';
import type { WellRow, Pick } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { sampleGrid } from '../../engine/grid';
import { surfaceColor, withAlpha } from './chrome';

type Pt = [number, number];
const TOL = 300; // m perpendicular projection tolerance
const N = 220;   // samples along the section
const STACK = ['seabed', 'shetland_top', 'ty_top', 'bcu', 'hugin_top', 'hugin_base'];

const PAD = { l: 54, r: 16, t: 16, b: 28 };

interface Win { dMin: number; dMax: number; zMin: number; zMax: number }

export function XSection({ line, activeSurface, contactZ, wellPaths, picks, onClose, onUpdateLine }: {
  line: Pt[]; activeSurface: string; contactZ: number;
  wellPaths: Array<{ w: WellRow; path: Pt[] }>; picks: Pick[]; onClose: () => void;
  onUpdateLine?: (end: 0 | 1, world: Pt) => void;
}) {
  const surfRes = useAsync<SurfaceJson[]>(
    () => Promise.all(STACK.map((id) => loadSurface(id).catch(() => null))).then((a) => a.filter(Boolean) as SurfaceJson[]),
    [],
  );
  void activeSurface;

  const a = line[0], b = line[1];
  const lineLen = Math.hypot(b[0] - a[0], b[1] - a[1]);

  const [flatten, setFlatten] = useState<string>('none'); // surface id or 'none'
  const [vExag, setVExag] = useState(1);
  const [win, setWin] = useState<Win | null>(null);
  const [hover, setHover] = useState<{ px: number; py: number; d: number; z: number } | null>(null);
  const geomRef = useRef({ w: 0, h: 0 });
  const dragRef = useRef<{ kind: 'pan' | 'end0' | 'end1'; sx: number; sy: number; win: Win } | null>(null);
  const rafRef = useRef(0);

  // sample horizons along the line (re-runs when endpoints move)
  const traces = useMemo(() => {
    const surfs = surfRes.data ?? [];
    return surfs.map((g) => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const z = sampleGrid(g, x, y);
        pts.push([t * lineLen, z != null ? z : NaN]);
      }
      return { id: g.id, name: g.name, pts };
    });
  }, [surfRes.data, a[0], a[1], b[0], b[1], lineLen]);

  const top = traces.find((t) => t.id === 'hugin_top');
  const base = traces.find((t) => t.id === 'hugin_base');
  const flatTrace = flatten === 'none' ? null : traces.find((t) => t.id === flatten);

  // flatten offset per distance-sample (datum surface → horizontal)
  const flatOffset = useCallback((d: number): number => {
    if (!flatTrace) return 0;
    const i = Math.max(0, Math.min(N, Math.round((d / Math.max(1, lineLen)) * N)));
    const z = flatTrace.pts[i]?.[1];
    return isFinite(z) ? z : 0;
  }, [flatTrace, lineLen]);

  const zApply = useCallback((z: number, d: number) => (flatTrace ? z - flatOffset(d) : z), [flatTrace, flatOffset]);

  // fit window from data
  const fit = useCallback((): Win => {
    let zmin = Infinity, zmax = -Infinity;
    for (const tr of traces) for (const [d, z] of tr.pts) { if (!isFinite(z)) continue; const zz = zApply(z, d); if (zz < zmin) zmin = zz; if (zz > zmax) zmax = zz; }
    if (!isFinite(zmin)) { zmin = flatTrace ? -200 : 2000; zmax = flatTrace ? 200 : 3300; }
    if (!flatTrace) zmax = Math.max(zmax, contactZ + 40);
    const pad = (zmax - zmin) * 0.08 || 40;
    return { dMin: 0, dMax: Math.max(1, lineLen), zMin: zmin - pad, zMax: zmax + pad };
  }, [traces, zApply, flatTrace, contactZ, lineLen]);

  useEffect(() => { setWin(fit()); }, [fit]);

  const view = win ?? fit();

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    geomRef.current = { w, h };
    const plotW = w - PAD.l - PAD.r, plotH = h - PAD.t - PAD.b;
    // vertical exaggeration compresses the shown depth window about its centre
    const zc = (view.zMin + view.zMax) / 2;
    const zHalf = (view.zMax - view.zMin) / 2 / vExag;
    const zMin = zc - zHalf, zMax = zc + zHalf;
    const dx = (d: number) => PAD.l + ((d - view.dMin) / Math.max(1e-6, view.dMax - view.dMin)) * plotW;
    const dy = (z: number) => PAD.t + ((z - zMin) / Math.max(1e-6, zMax - zMin)) * plotH;
    const line0 = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');

    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.l, PAD.t, plotW, plotH); ctx.clip();

    // depth grid
    ctx.strokeStyle = 'rgba(127,146,153,0.14)'; ctx.lineWidth = 0.5;
    const zstep = niceStep(zMax - zMin);
    for (let z = Math.ceil(zMin / zstep) * zstep; z <= zMax; z += zstep) {
      const py = dy(z); ctx.beginPath(); ctx.moveTo(PAD.l, py); ctx.lineTo(w - PAD.r, py); ctx.stroke();
    }

    // fluid fills (top→base clipped by OWC) — datum-aware
    if (top && base && !flatTrace) {
      for (let i = 0; i < top.pts.length - 1; i++) {
        const [d0, zt0] = top.pts[i], [d1, zt1] = top.pts[i + 1];
        const zb0 = base.pts[i]?.[1], zb1 = base.pts[i + 1]?.[1];
        if (![zt0, zt1, zb0, zb1].every((v) => isFinite(v))) continue;
        const grad = ctx.createLinearGradient(0, dy(Math.min(zt0, zt1)), 0, dy(Math.max(zb0, zb1)));
        grad.addColorStop(0, withAlpha(cssVar('--amber'), 0.42)); grad.addColorStop(1, withAlpha(cssVar('--amber'), 0.14));
        band(ctx, dx(d0), dx(d1), dy(zt0), dy(zt1), dy(Math.min(zb0, contactZ)), dy(Math.min(zb1, contactZ)), grad);
        if (zb0 > contactZ || zb1 > contactZ) {
          band(ctx, dx(d0), dx(d1), dy(Math.max(zt0, contactZ)), dy(Math.max(zt1, contactZ)), dy(zb0), dy(zb1), withAlpha(cssVar('--blue'), 0.24));
        }
      }
      ctx.strokeStyle = cssVar('--rose'); ctx.lineWidth = 1.2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(PAD.l, dy(contactZ)); ctx.lineTo(w - PAD.r, dy(contactZ)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = cssVar('--rose'); ctx.textAlign = 'left'; ctx.font = `9px ${cssVar('--mono')}`; ctx.fillText(`OWC ${contactZ}`, PAD.l + 3, dy(contactZ) - 3);
    }

    // horizons
    traces.forEach((tr, i) => {
      const isHug = tr.id === 'hugin_top' || tr.id === 'hugin_base';
      const isDatum = tr.id === flatten;
      ctx.strokeStyle = isDatum ? cssVar('--rose') : isHug ? cssVar('--teal') : surfaceColor(i);
      ctx.lineWidth = isHug ? 1.9 : isDatum ? 1.6 : 1; ctx.setLineDash(isDatum ? [6, 3] : []);
      ctx.beginPath(); let started = false;
      for (const [d, z] of tr.pts) {
        if (!isFinite(z)) { started = false; continue; }
        const px = dx(d), py = dy(zApply(z, d));
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);
      const last = [...tr.pts].reverse().find((p) => isFinite(p[1]));
      if (last) { ctx.fillStyle = ctx.strokeStyle as string; ctx.textAlign = 'right'; ctx.font = `8.5px ${cssVar('--mono')}`; ctx.fillText(tr.name, dx(last[0]) - 2, dy(zApply(last[1], last[0])) - 2); }
    });

    // hung wells + pick ties
    for (const { w: well } of wellPaths) {
      const ax = well.x - a[0], ay = well.y - a[1], bx = b[0] - a[0], by = b[1] - a[1];
      const l2 = bx * bx + by * by || 1; const t = (ax * bx + ay * by) / l2;
      if (t < 0 || t > 1) continue;
      const perp = Math.hypot(well.x - (a[0] + bx * t), well.y - (a[1] + by * t));
      if (perp > TOL) continue;
      const px = dx(t * lineLen);
      ctx.strokeStyle = well.role === 'injector' ? cssVar('--blue') : cssVar('--amber');
      ctx.lineWidth = 1.4; ctx.setLineDash(perp > 60 ? [3, 3] : []);
      ctx.beginPath(); ctx.moveTo(px, PAD.t); ctx.lineTo(px, dy(zApply(Math.min(well.td_tvd, zMax + 1e4), t * lineLen))); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = text; ctx.font = `bold 9px ${cssVar('--mono')}`; ctx.textAlign = 'center'; ctx.fillText(well.name, px, PAD.t + 9);
      for (const pk of picks) {
        if (pk.well !== well.name || pk.tvdss == null) continue;
        const py = dy(zApply(pk.tvdss, t * lineLen)); if (py < PAD.t || py > h - PAD.b) continue;
        ctx.fillStyle = cssVar('--orange'); ctx.beginPath(); ctx.arc(px, py, 2.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // hover crosshair
    if (hover) {
      ctx.strokeStyle = withAlpha(text, 0.5); ctx.lineWidth = 0.6; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(hover.px, PAD.t); ctx.lineTo(hover.px, h - PAD.b); ctx.moveTo(PAD.l, hover.py); ctx.lineTo(w - PAD.r, hover.py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = text; ctx.beginPath(); ctx.arc(hover.px, hover.py, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // depth axis labels (outside clip)
    ctx.fillStyle = muted; ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'right';
    for (let z = Math.ceil(zMin / zstep) * zstep; z <= zMax; z += zstep) { const py = dy(z); if (py < PAD.t - 2 || py > h - PAD.b + 2) continue; ctx.fillText(String(Math.round(flatTrace ? zc + (z - zc) : z)), PAD.l - 4, py + 3); }
    ctx.strokeStyle = line0; ctx.lineWidth = 0.6; ctx.strokeRect(PAD.l, PAD.t, plotW, plotH);
    ctx.fillStyle = text; ctx.textAlign = 'center'; ctx.font = `bold 10px ${cssVar('--mono')}`;
    ctx.fillText('A', PAD.l, h - 8); ctx.fillText("A'", w - PAD.r, h - 8);
    ctx.fillStyle = muted; ctx.font = `9px ${cssVar('--mono')}`;
    ctx.fillText(`${(lineLen / 1000).toFixed(2)} km${vExag > 1 ? ` · V×${vExag}` : ''}${flatTrace ? ` · flattened on ${flatTrace.name}` : ''}`, PAD.l + plotW / 2, h - 8);

    // draggable endpoint handles
    for (const [hxRaw, endLabel] of [[PAD.l, 'A'], [w - PAD.r, "A'"]] as Array<[number, string]>) {
      ctx.fillStyle = cssVar('--violet'); ctx.strokeStyle = cssVar('--bg'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hxRaw, PAD.t + 4, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      void endLabel;
    }
  }, [traces, top, base, view, vExag, flatten, flatTrace, hover, wellPaths, picks, a[0], a[1], b[0], b[1], lineLen, contactZ, zApply]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  // ── interaction helpers ──
  const invX = (px: number): number => {
    const { w } = geomRef.current; const plotW = w - PAD.l - PAD.r;
    return view.dMin + ((px - PAD.l) / Math.max(1, plotW)) * (view.dMax - view.dMin);
  };
  const invY = (py: number): number => {
    const { h } = geomRef.current; const plotH = h - PAD.t - PAD.b;
    const zc = (view.zMin + view.zMax) / 2, zHalf = (view.zMax - view.zMin) / 2 / vExag;
    return (zc - zHalf) + ((py - PAD.t) / Math.max(1, plotH)) * (2 * zHalf);
  };
  const local = (e: React.MouseEvent): Pt => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const [px, py] = local(e);
    const factor = e.deltaY < 0 ? 1 / 1.12 : 1.12;
    const dAt = invX(px), zAt = invY(py);
    setWin((wv) => {
      const v = wv ?? fit();
      const nd0 = dAt - (dAt - v.dMin) * factor, nd1 = dAt + (v.dMax - dAt) * factor;
      const nz0 = zAt - (zAt - v.zMin) * factor, nz1 = zAt + (v.zMax - zAt) * factor;
      return { dMin: nd0, dMax: nd1, zMin: nz0, zMax: nz1 };
    });
  };

  const hitEndpoint = (px: number): 'end0' | 'end1' | null => {
    const { w } = geomRef.current;
    if (Math.abs(px - PAD.l) < 10) return 'end0';
    if (Math.abs(px - (w - PAD.r)) < 10) return 'end1';
    return null;
  };

  const onDown = (e: React.MouseEvent) => {
    const [px] = local(e);
    const ep = hitEndpoint(px);
    dragRef.current = { kind: ep ?? 'pan', sx: e.clientX, sy: e.clientY, win: view };
  };
  const onMove = (e: React.MouseEvent) => {
    const [px, py] = local(e);
    // hover readout
    const d = invX(px), z = invY(py);
    setHover({ px, py, d, z });
    const dg = dragRef.current; if (!dg) return;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const { w, h } = geomRef.current; const plotW = w - PAD.l - PAD.r, plotH = h - PAD.t - PAD.b;
      const ddx = (e.clientX - dg.sx) / Math.max(1, plotW) * (dg.win.dMax - dg.win.dMin);
      if (dg.kind === 'pan') {
        const ddy = (e.clientY - dg.sy) / Math.max(1, plotH) * (dg.win.zMax - dg.win.zMin) / vExag;
        setWin({ dMin: dg.win.dMin - ddx, dMax: dg.win.dMax - ddx, zMin: dg.win.zMin - ddy, zMax: dg.win.zMax - ddy });
      } else if (onUpdateLine) {
        // drag endpoint along the section azimuth in world space → re-sample
        const end = dg.kind === 'end0' ? 0 : 1;
        const ux = lineLen ? (b[0] - a[0]) / lineLen : 1, uy = lineLen ? (b[1] - a[1]) / lineLen : 0;
        const anchor = end === 0 ? a : b;
        const newPt: Pt = [anchor[0] + ux * ddx * (end === 0 ? 1 : 1), anchor[1] + uy * ddx];
        onUpdateLine(end, newPt);
      }
    });
  };
  const onUp = () => { dragRef.current = null; if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; } };
  const onDbl = () => setWin(fit());

  // sampled depths at hover for the readout label
  const hoverSamples = useMemo(() => {
    if (!hover) return [];
    return traces.map((tr) => {
      const i = Math.max(0, Math.min(N, Math.round((hover.d / Math.max(1, lineLen)) * N)));
      return { name: tr.name, id: tr.id, z: tr.pts[i]?.[1] };
    }).filter((s) => isFinite(s.z as number));
  }, [hover, traces, lineLen]);

  const fluidZone = useMemo(() => {
    if (!hover || !top || !base) return null;
    const i = Math.max(0, Math.min(N, Math.round((hover.d / Math.max(1, lineLen)) * N)));
    const zt = top.pts[i]?.[1], zb = base.pts[i]?.[1]; const z = hover.z;
    if (!isFinite(zt) || !isFinite(zb)) return null;
    if (z < zt || z > zb) return 'seal/overburden';
    return z <= contactZ ? 'oil' : 'water';
  }, [hover, top, base, contactZ, lineLen]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>Cross-section · A–A′</span>
        <NatureBadge nature="interpreted" />
        <label style={{ fontSize: 10.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          flatten
          <select value={flatten} onChange={(e) => setFlatten(e.target.value)} style={{ fontSize: 10.5, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--text)', padding: '2px 4px' }}>
            <option value="none">none</option>
            {traces.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div style={{ width: 120 }}><Slider label="V-exag" min={1} max={10} step={0.5} value={vExag} onChange={setVExag} fmt={(v) => `${v}×`} /></div>
        <div style={{ flex: 1 }} />
        <button onClick={onDbl} title="Fit (dblclick)" style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}><Maximize2 size={13} /></button>
        <button onClick={onClose} title="Close section" style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}><X size={14} /></button>
      </div>
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, position: 'relative', cursor: dragRef.current?.kind === 'pan' ? 'grabbing' : 'crosshair' }}>
        <canvas ref={canvasRef} onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { onUp(); setHover(null); }} onDoubleClick={onDbl}
          style={{ display: 'block', width: '100%', height: '100%' }} />
        {hover && (
          <div className="mono" style={{ position: 'absolute', left: 60, top: 8, fontSize: 10, color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 88%, transparent)', border: '1px solid var(--line)', borderRadius: 3, padding: '4px 7px', pointerEvents: 'none', maxWidth: '70%' }}>
            <span style={{ color: 'var(--muted)' }}>dist</span> {hover.d.toFixed(0)}m · <span style={{ color: 'var(--muted)' }}>TVD</span> {hover.z.toFixed(0)}m{fluidZone ? ` · ${fluidZone}` : ''}
            {hoverSamples.length > 0 && <span style={{ color: 'var(--muted)' }}>{'  '}| {hoverSamples.slice(0, 4).map((s) => `${s.name.replace(/ (Fm|Top|Base).*/, '')} ${Math.round(s.z as number)}`).join(' · ')}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function band(ctx: CanvasRenderingContext2D, x0: number, x1: number, t0: number, t1: number, b0: number, b1: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x0, t0); ctx.lineTo(x1, t1); ctx.lineTo(x1, b1); ctx.lineTo(x0, b0); ctx.closePath(); ctx.fill();
}
function niceStep(span: number): number {
  const raw = span / 6; const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw)))); const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
