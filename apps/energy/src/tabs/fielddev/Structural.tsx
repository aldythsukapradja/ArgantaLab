// Structural.tsx (V1b) — UNFAULTED screening model. Surface QC, honest well-tie
// mistie table (pickTVDSS − gridSample, no auto-adjust), contact editor (scenario
// when changed), closure derivation view, and the well-log UPSCALING panel
// (raw vs upscaled per well: mean PHIE, net-SAND fraction, majority facies).
import { useMemo, useState, useCallback } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Slider, Segmented, Loading, ErrorBanner, ReadoutBar } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { depthRamp } from './colormap';
import { loadIndex, loadSurface, loadPicks } from '../../wb/load';
import { roleColor } from './chrome';
import type { WbIndex, PicksJson } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { sampleGrid, gridBounds, gridMinMax, cellZ } from '../../engine/grid';
import { makeView, padBounds } from '../../engine/view';
import { contactPolygon } from '../../engine/closure';
import { loadWellPetro, upscale, type WellPetro } from './fdData';

const PICK_SURF: Record<string, RegExp> = {
  hugin_top: /Hugin Fm\. VOLVE Top/i,
  hugin_base: /Hugin Fm\. VOLVE Base/i,
};

export function Structural() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const picks = useAsync<PicksJson>(loadPicks, []);
  if (idx.loading || picks.loading) return <Loading what="structural data" />;
  if (idx.error || !idx.data || !picks.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} picks={picks.data} />;
}

function Inner({ index, picks }: { index: WbIndex; picks: PicksJson }) {
  const structSurfaces = index.surfaces.filter((s) => /hugin/.test(s.id));
  const [activeSurface, setActiveSurface] = useState('hugin_top');
  const [contactZ, setContactZ] = useState(index.contacts[0]?.tvdss ?? 3200);
  const defOwc = index.contacts[0]?.tvdss ?? 3200;
  const [showClosure, setShowClosure] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; z: number | null } | null>(null);

  const surf = useAsync<SurfaceJson>(() => loadSurface(activeSurface), [activeSurface]);

  // wells with logs + Hugin picks → upscaling + mistie
  const wellSet = useMemo(() => index.wells.filter((w) => w.has.logs && w.has.picks), [index]);
  const wpRes = useAsync<WellPetro[]>(
    () => Promise.all(wellSet.map((w) => loadWellPetro(w, picks).catch(() => null))).then((a) => a.filter(Boolean) as WellPetro[]),
    [wellSet],
  );

  const surfInfo = index.surfaces.find((s) => s.id === activeSurface)!;
  const bounds = useMemo(() => surf.data ? padBounds(gridBounds(surf.data), 0.05) : padBounds({ minX: surfInfo.x0, minY: surfInfo.y0, maxX: surfInfo.x0 + surfInfo.nx * surfInfo.cell, maxY: surfInfo.y0 + surfInfo.ny * surfInfo.cell }, 0.05), [surf.data, surfInfo]);
  const minmax = useMemo(() => surf.data ? gridMinMax(surf.data) : { min: surfInfo.zmin, max: surfInfo.zmax }, [surf.data, surfInfo]);

  const qc = useMemo(() => {
    if (!surf.data) return null;
    let filled = 0, nul = 0;
    for (const v of surf.data.z) (v == null || !isFinite(v)) ? nul++ : filled++;
    const areaKm2 = (filled * surf.data.cell * surf.data.cell) / 1e6;
    return { filled, nul, total: surf.data.z.length, areaKm2, cell: surf.data.cell, zmin: minmax.min, zmax: minmax.max };
  }, [surf.data, minmax]);

  const closure = useMemo(() => {
    if (!surf.data || !showClosure) return null;
    try { return contactPolygon(surf.data, contactZ); } catch { return null; }
  }, [surf.data, contactZ, showClosure]);

  // mistie: pick TVDSS (stored negative-down → negate) − grid sample at well x/y
  const mistie = useMemo(() => {
    if (!surf.data) return [];
    const re = PICK_SURF[activeSurface];
    const rows: Array<{ well: string; pick: number; grid: number | null; resid: number | null }> = [];
    for (const w of index.wells) {
      const p = picks.picks.find((pk) => pk.well === w.name && re?.test(pk.surface) && pk.tvdss != null);
      if (!p) continue;
      const pickT = Math.abs(p.tvdss as number);
      const g = sampleGrid(surf.data, w.x, w.y);
      rows.push({ well: w.name, pick: pickT, grid: g, resid: g != null ? pickT - g : null });
    }
    return rows;
  }, [surf.data, picks, index, activeSurface]);

  const upRows = useMemo(() => {
    const rows: Array<{ well: string; phieRaw: number | null; phieUp: number | null; netSand: number; facies: string; n: number }> = [];
    for (const wp of wpRes.data ?? []) {
      const u = upscale(wp); if (!u) continue;
      rows.push({ well: wp.well.name, phieRaw: u.phieRaw, phieUp: u.phieUp, netSand: u.netSand, facies: u.facies, n: u.nSamples });
    }
    return rows;
  }, [wpRes.data]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!surf.data) return;
    const g = surf.data;
    const view = makeView(bounds, w, h, 26);
    const ramp = depthRamp();
    const span = Math.max(1e-6, minmax.max - minmax.min);
    // surface cells
    const px = Math.max(1, view.s * g.cell * 1.03);
    for (let iy = 0; iy < g.ny; iy++) for (let ix = 0; ix < g.nx; ix++) {
      const z = cellZ(g, ix, iy); if (z == null) continue;
      const wx = g.x0 + ix * g.cell, wy = g.y0 + iy * g.cell;
      ctx.fillStyle = ramp((z - minmax.min) / span);
      ctx.fillRect(view.toX(wx) - px / 2, view.toY(wy) - px / 2, px, px);
    }
    // closure ring
    if (closure) {
      ctx.strokeStyle = cssVar('--rose'); ctx.lineWidth = 2; ctx.beginPath();
      closure.ring.forEach(([x, y], i) => { const sx = view.toX(x), sy = view.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
      ctx.fillStyle = cssVar('--rose'); const cs = view.toX(closure.crest.x), cy = view.toY(closure.crest.y);
      ctx.beginPath(); ctx.arc(cs, cy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // wells
    for (const wr of index.wells) {
      if (wr.x < bounds.minX || wr.x > bounds.maxX) continue;
      const sx = view.toX(wr.x), sy = view.toY(wr.y);
      ctx.fillStyle = roleColor(wr.role); ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // hover
    if (hover) {
      const sx = view.toX(hover.x), sy = view.toY(hover.y);
      ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(sx - 8, sy); ctx.lineTo(sx + 8, sy); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 8); ctx.stroke();
    }
  }, [surf.data, bounds, minmax, closure, hover, index]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);
  const onMove = (e: React.MouseEvent) => {
    if (!surf.data) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const view = makeView(bounds, rect.width, rect.height, 26);
    const wpt = view.inv(e.clientX - rect.left, e.clientY - rect.top);
    setHover({ x: wpt.x, y: wpt.y, z: sampleGrid(surf.data, wpt.x, wpt.y) });
  };

  const scenario = contactZ !== defOwc;

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={structSurfaces.map((s) => ({ id: s.id, label: s.name.replace(' Fm', '') }))} value={activeSurface} onChange={setActiveSurface} accent="--blue" />
          <span className="chip" style={{ color: 'var(--muted)' }}>unfaulted screening model</span>
          <div style={{ flex: 1 }} />
          <NatureBadge nature="interpreted" />
          {scenario && <NatureBadge nature="scenario" />}
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>
            <SlidersHorizontal size={15} />
          </button>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
          {surf.loading ? <Loading what={`${activeSurface} grid`} /> : surf.error ? <ErrorBanner msg={surf.error} /> : (
            <>
              <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', width: '100%', height: '100%' }} />
              <ReadoutBar left={hover ? `x ${hover.x.toFixed(0)}  y ${hover.y.toFixed(0)}  z ${hover.z != null ? hover.z.toFixed(1) + ' m' : '–'}` : `${surfInfo.name} · closure @ ${contactZ} m`} />
            </>
          )}
        </div>
      </div>

      <Inspector title="Structural inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Surface QC">
          {qc && (
            <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
              {[['filled', qc.filled.toLocaleString()], ['null', qc.nul.toLocaleString()], ['cell', `${qc.cell} m`], ['z range', `${qc.zmin.toFixed(0)}–${qc.zmax.toFixed(0)} m`], ['area', `${qc.areaKm2.toFixed(1)} km²`]].map(([k, v]) => (
                <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{v}</td></tr>
              ))}
            </tbody></table>
          )}
        </InspectorSection>
        <InspectorSection title="Contact editor">
          <Slider label={`OWC (default ${defOwc})`} min={3000} max={3400} step={5} value={contactZ} onChange={setContactZ} fmt={(v) => `${v} m`} />
          {scenario && <div style={{ fontSize: 9.5, color: 'var(--rose)' }}>Changed from deck OWC → scenario.</div>}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 6 }}>
            <input type="checkbox" checked={showClosure} onChange={(e) => setShowClosure(e.target.checked)} /> show closure
          </label>
          {closure && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{closure.cells.toLocaleString()} cells · crest {closure.crest.z.toFixed(0)} m</div>}
        </InspectorSection>
        <InspectorSection title="Well-tie mistie (pick − grid)">
          <table className="mono" style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>well</th><th>pick</th><th>grid</th><th>Δ</th></tr></thead>
            <tbody>
              {mistie.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>no picks on this surface</td></tr>}
              {mistie.map((r) => (
                <tr key={r.well} style={{ textAlign: 'right' }}>
                  <td style={{ textAlign: 'left', color: 'var(--text)' }}>{r.well}</td>
                  <td>{r.pick.toFixed(0)}</td>
                  <td>{r.grid != null ? r.grid.toFixed(0) : '–'}</td>
                  <td style={{ color: r.resid != null && Math.abs(r.resid) > 25 ? 'var(--rose)' : 'var(--teal)' }}>{r.resid != null ? r.resid.toFixed(0) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>Honest residuals — no auto-adjustment. Picks from offset/exploration wells.</div>
        </InspectorSection>
        <InspectorSection title="Log upscaling (raw → upscaled)">
          {wpRes.loading && <div style={{ fontSize: 11, color: 'var(--muted)' }}>loading wells…</div>}
          <table className="mono" style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>well</th><th>φe</th><th>netSAND</th><th>facies</th></tr></thead>
            <tbody>
              {upRows.length === 0 && !wpRes.loading && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>no upscalable wells</td></tr>}
              {upRows.map((r) => (
                <tr key={r.well} style={{ textAlign: 'right' }}>
                  <td style={{ textAlign: 'left', color: 'var(--text)' }}>{r.well}</td>
                  <td style={{ color: 'var(--teal)' }}>{r.phieUp != null ? r.phieUp.toFixed(3) : '–'}</td>
                  <td style={{ color: 'var(--amber)' }}>{(r.netSand * 100).toFixed(0)}%</td>
                  <td style={{ color: r.facies === 'SAND' ? 'var(--amber)' : 'var(--muted)' }}>{r.facies}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>Arithmetic-mean φe · net-fraction SAND · majority facies over the Hugin interval.</div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}
