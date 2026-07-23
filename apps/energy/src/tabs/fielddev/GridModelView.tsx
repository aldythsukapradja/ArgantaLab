// GridModelView.tsx (S2) — the geostatistical static model: a REAL 3D GridModel
// (unfaulted, proportional layering) with SIS 2-facies (SAND/SHALE) + SGS porosity,
// conditioned to the upscaled per-well values. 2D layer map + interactive
// cross-section slicer + the HCPV↔deterministic-STOIIP reconciliation banner.
// Upgrades the V1b IDW Property tab to true geostatistics (engine/geostat.ts, S1).
// Per-layer SGS/SIS keeps it interactive; each layer is an independent realization
// conditioned on the same well averages (honest screening — labelled).
import { useMemo, useState, useCallback, Suspense, lazy } from 'react';
import { SlidersHorizontal, Box, Square } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, Slider, Loading, ErrorBanner, ReadoutBar, roleColor } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadSurface, loadPicks } from '../../wb/load';
import type { WbIndex, PicksJson } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { gridBounds } from '../../engine/grid';
import { makeView, padBounds } from '../../engine/view';
import { buildGrid, gridHcpv, cellXY, cellIndex, type GridModel } from '../../engine/grid3d';
import { sgs, sis, type Pt, type FaciesPt, type Vario } from '../../engine/geostat';
import { phiToK } from '../../engine/perm';
import { loadWellPetro, upscale, type WellPetro } from './fdData';
import { BBL_PER_SM3 } from '../../engine/volumetrics';

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
  const [view3d, setView3d] = useState(false);
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

  // ── build the coarse GridModel + populate facies/φ/perm via SIS/SGS per layer ──
  const model = useMemo(() => {
    if (!top.data || !base.data) return null;
    const g = top.data, b = base.data;
    // coarsen the fine Hugin grid to ≤ res in the larger dimension
    const factor = Math.max(1, Math.ceil(Math.max(g.nx, g.ny) / res));
    const nx = Math.ceil(g.nx / factor), ny = Math.ceil(g.ny / factor), dx = g.cell * factor;
    const topZ = new Float64Array(nx * ny), baseZ = new Float64Array(nx * ny);
    const sample = (s: SurfaceJson, ci: number, ck: number): number => {
      const fi = Math.min(s.nx - 1, ci * factor), fk = Math.min(s.ny - 1, ck * factor);
      const v = s.z[fk * s.nx + fi]; return v == null ? NaN : (v as number);
    };
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) { topZ[k * nx + i] = sample(g, i, k); baseZ[k * nx + i] = sample(b, i, k); }
    // closure mask on the coarse top (crest-connected flood-fill to OWC)
    const activeCol = new Uint8Array(nx * ny);
    let crest = -1, cz = Infinity;
    for (let c = 0; c < nx * ny; c++) { const z = topZ[c]; if (isFinite(z) && z < cz) { cz = z; crest = c; } }
    if (crest >= 0) { const st = [crest]; activeCol[crest] = 1; while (st.length) { const ci = st.pop()!; const i = ci % nx, k = (ci / nx) | 0; for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const ni = i + di, nk = k + dk; if (ni < 0 || nk < 0 || ni >= nx || nk >= ny) continue; const n = nk * nx + ni; if (activeCol[n]) continue; const z = topZ[n]; if (isFinite(z) && z < owc) { activeCol[n] = 1; st.push(n); } } } }

    const grid = buildGrid({ nx, ny, nz, dx, dy: dx, x0: g.x0, y0: g.y0, topZ, baseZ, activeCol });

    // conditioning data (well x/y → world coords). SGS on porosity, SIS on facies.
    const phiCond: Pt[] = wellPts.map((w) => ({ x: w.x, y: w.y, v: w.phie }));
    const facCond: FaciesPt[] = wellPts.map((w) => ({ x: w.x, y: w.y, f: w.netSand >= 0.5 ? 1 : 0 }));
    // active column centres = simulation targets
    const cols: Array<{ i: number; k: number; x: number; y: number }> = [];
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) if (activeCol[k * nx + i]) { const p = cellXY(grid, i, k); cols.push({ i, k, x: p.x, y: p.y }); }
    const targets = cols.map((c) => ({ x: c.x, y: c.y }));
    const vario: Vario = { model: 'spherical', nugget: nugget, sill: 1, range };
    // per-layer independent realizations (same conditioning) → vertical variation
    for (let l = 0; l < nz; l++) {
      const phi = phiCond.length ? sgs(phiCond, targets, vario, seed + l * 7919) : targets.map(() => d.phi);
      const fac = facCond.length ? sis(facCond, targets, vario, seed + l * 104729, d.ntg) : targets.map(() => 1);
      cols.forEach((c, ti) => {
        const ci = cellIndex(grid, c.i, c.k, l);
        grid.phi[ci] = Math.max(0.03, Math.min(0.35, phi[ti]));
        grid.facies[ci] = fac[ti];
        grid.ntg[ci] = fac[ti] ? 1 : 0;         // facies IS the net/gross (SAND=net)
        grid.sw[ci] = d.sw;
      });
    }
    // declustering / global-mean control (Petrel "target distribution"): the wells
    // are spatially clustered, so the naive SGS mean is biased — rescale the field
    // to the deck declustered field mean, preserving the geostatistical texture.
    let rawSum = 0, rawN = 0; for (let c = 0; c < grid.active.length; c++) if (grid.active[c]) { rawSum += grid.phi[c]; rawN++; }
    const rawMean = rawN ? rawSum / rawN : d.phi;
    const gf = rawMean > 1e-6 ? d.phi / rawMean : 1;
    for (let c = 0; c < grid.active.length; c++) if (grid.active[c]) {
      grid.phi[c] = Math.max(0.03, Math.min(0.35, grid.phi[c] * gf));
      grid.perm[c] = grid.facies[c] ? phiToK(grid.phi[c]) : phiToK(grid.phi[c]) * 0.01;
    }
    // reconciliation
    const hc = gridHcpv(grid);
    const stoiipGrid = hc / d.bo / 1e6;
    let sand = 0, tot = 0, phiSum = 0;
    for (let c = 0; c < grid.active.length; c++) if (grid.active[c]) { tot++; if (grid.facies[c]) sand++; phiSum += grid.phi[c]; }
    return { grid, nx, ny, stoiipGrid, sandFrac: tot ? sand / tot : 0, phiMean: tot ? phiSum / tot : 0, nCells: tot, bounds: padBounds(gridBounds(g), 0.05) };
  }, [top.data, base.data, nz, res, range, nugget, seed, wellPts, owc, d.phi, d.ntg, d.sw, d.bo]);

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
                  ? <GridVolume model={model.grid} />
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
