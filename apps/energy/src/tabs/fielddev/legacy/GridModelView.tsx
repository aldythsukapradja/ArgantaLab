// GridModelView.tsx (S2) — the geostatistical static model: a REAL 3D GridModel
// (unfaulted, proportional layering) with SIS 2-facies (SAND/SHALE) + SGS porosity,
// conditioned to the upscaled per-well values. 2D layer map + interactive
// cross-section slicer + the HCPV↔deterministic-STOIIP reconciliation banner.
// Upgrades the V1b IDW Property tab to true geostatistics (engine/geostat.ts, S1).
// Per-layer SGS/SIS keeps it interactive; each layer is an independent realization
// conditioned on the same well averages (honest screening — labelled).
import { useMemo, useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { SlidersHorizontal, Box, Square } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from '../hooks';
import { Inspector, InspectorSection, Segmented, Slider, Loading, ErrorBanner, ReadoutBar, roleColor } from '../chrome';
import { NatureBadge } from '../../../components/Provenance';
import { loadIndex, loadSurface, loadPicks } from '../../../wb/load';
import type { WbIndex, PicksJson } from '../../../wb/types';
import type { SurfaceJson } from '../../../engine/grid';
import { gridBounds } from '../../../engine/grid';
import { makeView, padBounds } from '../../../engine/view';
import { cellXY, cellIndex, type GridModel } from '../../../engine/grid3d';
import type { GeostatBuildInput, GeostatBuildOutput } from '../../../engine/geostat-build';
import { loadWellPetro, upscale, type WellPetro } from './fdData';
import { BBL_PER_SM3 } from '../../../engine/volumetrics';

const GridCube3D = lazy(() => import('./GridCube3D'));
const GridVolume = lazy(() => import('./GridVolume')); // G3 GPU-scale shell/section + property texture

type PropKind = 'facies' | 'porosity' | 'perm';
interface WellPt { name: string; x: number; y: number; phie: number; netSand: number; role: 'producer' | 'injector' | 'both' | 'none' }

export function GridModelView() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const picks = useAsync<PicksJson>(loadPicks, []);
  if (idx.loading || picks.loading) return <Loading what="grid model data" />;
  if (idx.error || !idx.data || !picks.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} picks={picks.data} />;
}

function Inner({ index, picks }: { index: WbIndex; picks: PicksJson }) {
  const d = index.defaults;
  const owc = index.contacts[0]?.tvdss ?? 3200;
  const [kind, setKind] = useState<PropKind>('facies');
  const [view3d, setView3d] = useState(true); // 3D-first (2a) — 2D layer map is now the toggle
  const [gpu, setGpu] = useState(true); // 3D render path: GPU volume (default) vs legacy boxes
  const [nz, setNz] = useState(8);
  const [res, setRes] = useState(28);          // max areal dimension (coarsening)
  const [range, setRange] = useState(1200);    // variogram range (m)
  const [nugget, setNugget] = useState(0.1);   // relative nugget (0..0.5)
  const [seed, setSeed] = useState(20260722);
  const [layer, setLayer] = useState(0);
  const [sectionJ, setSectionJ] = useState(0.5); // fractional row for the cross-section
  const [inspOpen, setInspOpen] = useState(true);
  const [hover, setHover] = useState<{ i: number; k: number } | null>(null);

  const top = useAsync<SurfaceJson>(() => loadSurface('hugin_top'), []);
  const base = useAsync<SurfaceJson>(() => loadSurface('hugin_base'), []);

  const wellSet = useMemo(() => index.wells.filter((w) => w.has.logs && w.has.picks), [index]);
  const wpRes = useAsync<WellPetro[]>(
    () => Promise.all(wellSet.map((w) => loadWellPetro(w, picks).catch(() => null))).then((a) => a.filter(Boolean) as WellPetro[]),
    [wellSet],
  );
  const wellPts = useMemo<WellPt[]>(() => {
    const out: WellPt[] = [];
    for (const wp of wpRes.data ?? []) { const u = upscale(wp); if (!u) continue; out.push({ name: wp.well.name, x: wp.well.x, y: wp.well.y, phie: u.phieUp ?? d.phi, netSand: u.netSand, role: wp.well.role }); }
    return out;
  }, [wpRes.data, d.phi]);

  // ── build the coarse GridModel (SIS/SGS per layer) OFF the main thread (worker) so
  //    the 3D-default Static Model tab paints instantly. Cheap input built here; the
  //    heavy build runs in workers/geostat.worker.ts (engine/geostat-build.ts). ──
  const buildInput = useMemo<GeostatBuildInput | null>(() => {
    if (!top.data || !base.data) return null;
    return { top: top.data, base: base.data, wellPts, res, nz, range, nugget, seed, owc, phi: d.phi, ntg: d.ntg, sw: d.sw, bo: d.bo };
  }, [top.data, base.data, wellPts, res, nz, range, nugget, seed, owc, d.phi, d.ntg, d.sw, d.bo]);

  const [modelCore, setModelCore] = useState<GeostatBuildOutput | null>(null);
  useEffect(() => {
    if (!buildInput) { setModelCore(null); return; }
    setModelCore(null);
    const w = new Worker(new URL('../../../workers/geostat.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ ok: boolean; out?: GeostatBuildOutput }>) => { if (e.data.ok && e.data.out) setModelCore(e.data.out); w.terminate(); };
    w.postMessage(buildInput);
    return () => w.terminate();
  }, [buildInput]);

  const model = useMemo(() => (modelCore && top.data ? { ...modelCore, bounds: padBounds(gridBounds(top.data), 0.05) } : null), [modelCore, top.data]);

  const detStoiip = (index.validation as { stoiip?: { stoiipMMSm3?: number } })?.stoiip?.stoiipMMSm3 ?? 142.3;
  const delta = model ? 100 * (model.stoiipGrid - detStoiip) / detStoiip : 0;
  const clampLayer = model ? Math.min(layer, nz - 1) : 0;

  // ── colour ramps ──
  const phiCol = (t: number) => { const tt = Math.max(0, Math.min(1, t)); return `rgb(${(20 + tt * 40) | 0},${(60 + tt * 150) | 0},${(120 + tt * 90) | 0})`; };
  const permCol = (k: number) => { const t = Math.max(0, Math.min(1, Math.log10(Math.max(1, k)) / 4)); return `rgb(${(30 + t * 200) | 0},${(30 + t * 120) | 0},${(80 - t * 40) | 0})`; };
  const cellColor = (g: GridModel, ci: number): string => {
    if (kind === 'facies') return g.facies[ci] ? cssVar('--amber') : cssVar('--muted');
    if (kind === 'perm') return permCol(g.perm[ci]);
    return phiCol((g.phi[ci] - 0.05) / 0.25);
  };

  // ── 2D layer map ──
  const drawMap = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!model || !top.data) return;
    const { grid, nx, ny } = model;
    const view = makeView(model.bounds, w, h, 22);
    const px = Math.max(1, view.s * grid.dx * 1.04);
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
      const ci = cellIndex(grid, i, k, clampLayer); if (!grid.active[ci]) continue;
      const p = cellXY(grid, i, k);
      ctx.fillStyle = cellColor(grid, ci);
      ctx.fillRect(view.toX(p.x) - px / 2, view.toY(p.y) - px / 2, px, px);
    }
    // section line
    const jRow = Math.round(sectionJ * (ny - 1));
    const ySec = view.toY(grid.y0 + (jRow + 0.5) * grid.dy);
    ctx.strokeStyle = cssVar('--teal'); ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(view.toX(model.bounds.minX), ySec); ctx.lineTo(view.toX(model.bounds.maxX), ySec); ctx.stroke(); ctx.setLineDash([]);
    // wells
    for (const wp of wellPts) { const sx = view.toX(wp.x), sy = view.toY(wp.y); ctx.fillStyle = roleColor(wp.role); ctx.strokeStyle = cssVar('--bg'); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (hover) { const p = cellXY(grid, hover.i, hover.k); const sx = view.toX(p.x), sy = view.toY(p.y); ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 1; ctx.strokeRect(sx - px / 2, sy - px / 2, px, px); }
  }, [model, top.data, kind, clampLayer, sectionJ, wellPts, hover]);

  // ── cross-section along the section row (all layers stacked, true vertical) ──
  const drawSection = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!model) return;
    const { grid, nx, ny } = model;
    const jRow = Math.round(sectionJ * (ny - 1));
    // z-extent along the row
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < nx; i++) { const col = jRow * nx + i; const t = grid.topZ[col], b = grid.baseZ[col]; if (isFinite(t)) zMin = Math.min(zMin, t); if (isFinite(b)) zMax = Math.max(zMax, b); }
    if (!isFinite(zMin)) { ctx.fillStyle = cssVar('--muted'); ctx.font = `11px ${cssVar('--mono')}`; ctx.fillText('no active cells on this section', 12, 20); return; }
    const padL = 44, padB = 18, padT = 10, padR = 10;
    const pw = w - padL - padR, ph = h - padB - padT;
    const zpad = (zMax - zMin) * 0.08 || 1;
    const zx = (i: number) => padL + (i / Math.max(1, nx - 1)) * pw;
    const zy = (z: number) => padT + ((z - (zMin - zpad)) / ((zMax + zpad) - (zMin - zpad))) * ph;
    const cw = pw / Math.max(1, nx);
    for (let i = 0; i < nx; i++) {
      const col = jRow * nx + i; const t = grid.topZ[col], b = grid.baseZ[col]; if (!isFinite(t) || !isFinite(b)) continue;
      const thk = (b - t) / nz;
      for (let l = 0; l < nz; l++) {
        const ci = cellIndex(grid, i, jRow, l); if (!grid.active[ci]) continue;
        const z0 = t + l * thk, z1 = t + (l + 1) * thk;
        ctx.fillStyle = cellColor(grid, ci);
        ctx.fillRect(zx(i) - cw / 2, zy(z0), cw + 0.5, zy(z1) - zy(z0));
      }
    }
    // depth axis
    ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 0.5; ctx.fillStyle = cssVar('--muted'); ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'right';
    for (let t = 0; t <= 3; t++) { const z = (zMin - zpad) + ((zMax + zpad) - (zMin - zpad)) * t / 3; const yy = zy(z); ctx.fillText(z.toFixed(0), padL - 4, yy + 3); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; }
    // OWC line
    if (owc >= zMin - zpad && owc <= zMax + zpad) { ctx.strokeStyle = cssVar('--blue'); ctx.setLineDash([4, 3]); ctx.lineWidth = 1; const yy = zy(owc); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke(); ctx.setLineDash([]); ctx.textAlign = 'left'; ctx.fillStyle = cssVar('--blue'); ctx.fillText(`OWC ${owc}`, padL + 2, yy - 2); }
    ctx.textAlign = 'left'; ctx.fillStyle = cssVar('--muted'); ctx.fillText(`section J=${(sectionJ * 100).toFixed(0)}% · ${nz} layers · TVDSS m`, padL, h - 5);
  }, [model, sectionJ, kind, nz, owc]);

  const mapC = useCanvas(drawMap, [drawMap]);
  const secC = useCanvas(drawSection, [drawSection]);
  const onMapMove = (e: React.MouseEvent) => {
    if (!model) return; const { grid, nx, ny } = model;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const view = makeView(model.bounds, rect.width, rect.height, 22);
    const wpt = view.inv(e.clientX - rect.left, e.clientY - rect.top);
    const i = Math.round((wpt.x - grid.x0) / grid.dx - 0.5), k = Math.round((wpt.y - grid.y0) / grid.dy - 0.5);
    if (i >= 0 && k >= 0 && i < nx && k < ny) setHover({ i, k }); else setHover(null);
  };

  const hoverCell = hover && model ? cellIndex(model.grid, hover.i, hover.k, clampLayer) : -1;
  const hoverTxt = model && hoverCell >= 0 && model.grid.active[hoverCell]
    ? `[${hover!.i},${hover!.k},L${clampLayer}] ${model.grid.facies[hoverCell] ? 'SAND' : 'SHALE'} · φ ${model.grid.phi[hoverCell].toFixed(3)} · k ${model.grid.perm[hoverCell].toFixed(0)}mD`
    : `${kind} · layer ${clampLayer + 1}/${nz} · SIS+SGS`;

  const legend = kind === 'facies'
    ? [['SAND', cssVar('--amber')], ['SHALE', cssVar('--muted')]] as const
    : kind === 'perm'
      ? [['low', 'rgb(30,30,80)'], ['high', 'rgb(230,150,40)']] as const
      : [['low φ', 'rgb(20,60,120)'], ['high φ', 'rgb(60,210,210)']] as const;

  const reconciled = Math.abs(delta) <= 5;

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={[{ id: 'facies' as const, label: 'Facies (SIS)' }, { id: 'porosity' as const, label: 'Porosity (SGS)' }, { id: 'perm' as const, label: 'Perm' }]} value={kind} onChange={setKind} accent="--teal" />
          <div style={{ flex: 1 }} />
          <span className="chip" style={{ color: reconciled ? 'var(--teal)' : 'var(--amber)', borderColor: reconciled ? 'var(--teal)' : 'var(--amber)' }}>
            HCPV recon: grid {model ? model.stoiipGrid.toFixed(1) : '–'} vs det {detStoiip} MMSm³ ({delta >= 0 ? '+' : ''}{delta.toFixed(1)}%)
          </span>
          <NatureBadge nature="derived" />
          <button onClick={() => setView3d((v) => !v)} title={view3d ? '2D map + section' : '3D cube (WebGL)'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 9px', borderRadius: 4, border: `1px solid ${view3d ? 'var(--teal)' : 'var(--line)'}`, background: 'var(--panel-2)', color: view3d ? 'var(--teal)' : 'var(--muted)', fontSize: 11 }}>
            {view3d ? <Box size={14} /> : <Square size={14} />}<span className="mono">{view3d ? '3D' : '2D'}</span>
          </button>
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>
            <SlidersHorizontal size={15} />
          </button>
        </div>

        {/* 3D view (WebGL) — replaces the 2D map+section when toggled on. GPU volume
            (shell/section + property Data3DTexture, GPU-scale) or the legacy box cube. */}
        {view3d ? (
          <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 5, display: 'flex', gap: 2, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 5, padding: 2 }}>
              {(['volume', 'boxes'] as const).map((m) => (
                <button key={m} onClick={() => setGpu(m === 'volume')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 10, background: (gpu ? 'volume' : 'boxes') === m ? 'var(--teal)' : 'transparent', color: (gpu ? 'volume' : 'boxes') === m ? '#04120f' : 'var(--muted)' }}>{m}</button>
              ))}
            </div>
            {!model ? <Loading what="building grid model (SIS+SGS)" /> : (
              <Suspense fallback={<Loading what={gpu ? 'GPU volume' : 'WebGL cube'} />}>
                {gpu
                  ? <GridVolume model={model.grid} wells={index.wells.filter((w) => isFinite(w.x) && isFinite(w.y)).map((w) => ({ name: w.name, x: w.x, y: w.y, role: w.role }))} />
                  : <GridCube3D grid={model.grid} kind={kind} owc={owc} wells={wellPts}
                      reducedMotion={typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches} />}
              </Suspense>
            )}
          </div>
        ) : (
        /* canvas wrappers stay mounted (so useCanvas can attach its observer);
           loading/error render as overlays. */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* layer slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', borderBottom: '1px solid var(--line)', fontSize: 10.5, color: 'var(--muted)' }}>
            <span className="mono">Layer</span>
            <input type="range" min={0} max={Math.max(1, nz - 1)} step={1} value={clampLayer} onChange={(e) => setLayer(parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--teal)' }} />
            <span className="mono" style={{ color: 'var(--text)' }}>{clampLayer + 1}/{nz}</span>
          </div>
          {/* map */}
          <div ref={mapC.wrapRef} style={{ flex: 1.4, minHeight: 80, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
            <canvas ref={mapC.canvasRef} onMouseMove={onMapMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', width: '100%', height: '100%' }} />
            {(top.loading || base.loading) ? <div style={{ position: 'absolute', inset: 0 }}><Loading what="Hugin grids" /></div>
              : top.error ? <div style={{ position: 'absolute', inset: 0 }}><ErrorBanner msg={top.error} /></div>
              : !model ? <div style={{ position: 'absolute', inset: 0 }}><Loading what="building grid model (SIS+SGS)" /></div>
              : <>
                <ReadoutBar left={hoverTxt} />
                <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 8, alignItems: 'center', background: 'color-mix(in srgb, var(--panel) 80%, transparent)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--line)' }}>
                  {legend.map(([l, c]) => <span key={l} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />{l}</span>)}
                </div>
              </>}
          </div>
          {/* cross-section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px', borderTop: '1px solid var(--line)', fontSize: 10.5, color: 'var(--muted)' }}>
            <span className="mono">Section J</span>
            <input type="range" min={0} max={1} step={0.02} value={sectionJ} onChange={(e) => setSectionJ(parseFloat(e.target.value))} style={{ flex: 1, accentColor: 'var(--teal)' }} />
            <span className="mono" style={{ color: 'var(--text)' }}>{(sectionJ * 100).toFixed(0)}%</span>
          </div>
          <div ref={secC.wrapRef} style={{ flex: 1, minHeight: 90, position: 'relative', overflow: 'hidden', borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
            <canvas ref={secC.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
        </div>
        )}
      </div>

      <Inspector title="Grid model inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Reconciliation">
          <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {[['STOIIP (grid)', `${model ? model.stoiipGrid.toFixed(1) : '–'} MMSm³`], ['STOIIP (det)', `${detStoiip} MMSm³`], ['Δ', `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`], ['sand fraction', model ? `${(model.sandFrac * 100).toFixed(0)}%` : '–'], ['φ mean', model ? model.phiMean.toFixed(3) : '–'], ['active cells', model ? model.nCells.toLocaleString() : '–']].map(([k, v]) => (
              <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: k === 'Δ' ? (reconciled ? 'var(--teal)' : 'var(--amber)') : 'var(--text)' }}>{v}</td></tr>
            ))}
          </tbody></table>
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4 }}>SIS proportion locked to deck NTG {d.ntg}; SGS porosity declustered to the deck field mean ⇒ HCPV reconciles to the deterministic STOIIP within ±5%.</div>
        </InspectorSection>
        <InspectorSection title="Grid geometry">
          <Slider label="Layers (nz)" min={4} max={16} step={1} value={nz} onChange={(v) => { setNz(v); setLayer((l) => Math.min(l, v - 1)); }} fmt={(v) => `${v}`} />
          <Slider label="Areal resolution" min={16} max={40} step={2} value={res} onChange={setRes} fmt={(v) => `≤${v} cells`} />
          <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Coarsened from the fine Hugin grid; proportional layering, vertical pillars (unfaulted).</div>
        </InspectorSection>
        <InspectorSection title="Variogram (spherical)">
          <Slider label="Range" min={300} max={3000} step={100} value={range} onChange={setRange} fmt={(v) => `${v} m`} />
          <Slider label="Nugget" min={0} max={0.5} step={0.05} value={nugget} onChange={setNugget} fmt={(v) => v.toFixed(2)} />
          <Slider label="Seed" min={1} max={99999} step={1} value={seed} onChange={setSeed} fmt={(v) => `${v}`} />
          <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Fixed seed → reproducible realization. Per-layer independent SGS/SIS (screening).</div>
        </InspectorSection>
        <InspectorSection title={`Wells (${wellPts.length})`}>
          <table className="mono" style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>well</th><th>φe</th><th>SAND</th></tr></thead>
            <tbody>{wellPts.map((w) => <tr key={w.name} style={{ textAlign: 'right' }}><td style={{ textAlign: 'left', color: 'var(--text)' }}>{w.name}</td><td style={{ color: 'var(--teal)' }}>{w.phie.toFixed(3)}</td><td style={{ color: 'var(--amber)' }}>{(w.netSand * 100).toFixed(0)}%</td></tr>)}</tbody>
          </table>
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>bbl ×{BBL_PER_SM3}. Facies (SIS, discrete) · porosity (SGS, continuous) · perm φ→k. Feeds Volumetrics + the dynamic simulator.</div>
      </Inspector>
    </div>
  );
}
