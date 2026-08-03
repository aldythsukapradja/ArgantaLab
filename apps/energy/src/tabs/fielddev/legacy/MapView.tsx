// MapView.tsx — the structural map workspace (V1a). 2D structural map + custom
// isometric 3D projection, layer tree, d3-contour isolines, derived OWC closure,
// drawing tools, well designer, and an interactive structural cross-section.
// All geoscience canvases are hand-drawn 2D; the "3D" view is an honestly
// labelled isometric projection (no WebGL, no fake-3D claims).
import { useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react';
import {
  MousePointer2, Hand, Hexagon, Slice, MapPin, Ruler, Layers,
} from 'lucide-react';

// three.js scene is code-split — only fetched when the 3D branch mounts.
const Map3D = lazy(() => import('./Map3D'));
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
import { useAsync, useCanvas, usePersist, cssVar } from '../hooks';
import {
  Inspector, InspectorSection, LayerRow, ToolButton, Segmented, Slider, Field,
  ReadoutBar, Loading, ErrorBanner, inputStyle, withAlpha,
} from '../chrome';
import { NatureBadge } from '../../../components/Provenance';
import { depthRamp } from '../colormap';
import { loadIndex, loadSurface, loadTraj, loadPicks } from '../../../wb/load';
import type { WbIndex, WellRow, Pick, TrajJson } from '../../../wb/types';
import type { SurfaceJson } from '../../../engine/grid';
import { sampleGrid, gridMinMax, gridBounds } from '../../../engine/grid';
import { makeView, padBounds, type View, type Bounds } from '../../../engine/view';
import { contourGrid, niceLevels } from '../../../engine/contour';
import { contactPolygon } from '../../../engine/closure';
import { XSection } from './XSection';

type Tool = 'select' | 'pan' | 'polygon' | 'section' | 'well' | 'measure';
type Mode = '2d' | '3d';
type Pt = [number, number];

interface UserShape {
  id: string;
  kind: 'polygon' | 'section' | 'measure' | 'well';
  cls: 'user' | 'scenario';
  pts: Pt[];
  // well-only:
  design?: WellDesign;
  landingTVD?: number | null;
}
interface WellDesign {
  name: string;
  kind: 'vertical' | 'deviated' | 'horizontal';
  target: string;         // surface id
  kickoff: number;        // mTVD
  lateralLen: number;     // m (horizontal)
  azimuth: number;        // deg
}

const TOOLS: Array<{ id: Tool; icon: typeof MousePointer2; label: string }> = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'pan', icon: Hand, label: 'Pan' },
  { id: 'polygon', icon: Hexagon, label: 'Polygon (click vertices, double-click to close)' },
  { id: 'section', icon: Slice, label: 'Section line (2 clicks)' },
  { id: 'well', icon: MapPin, label: 'Place well' },
  { id: 'measure', icon: Ruler, label: 'Measure distance' },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const wellPathWorld = (w: WellRow, stations: Array<{ dispEw: number; dispNs: number }>): Pt[] =>
  stations.map((s) => [w.x + s.dispEw, w.y + s.dispNs]);

export function MapView() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  if (idx.loading) return <Loading what="workbench index" />;
  if (idx.error || !idx.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <MapInner index={idx.data} />;
}

function MapInner({ index }: { index: WbIndex }) {
  const [mode, setMode] = useState<Mode>('2d');
  const [tool, setTool] = useState<Tool>('select');
  const [activeSurface, setActiveSurface] = useState('hugin_top');
  const [inspOpen, setInspOpen] = useState(true);
  const [vExag, setVExag] = useState(6);
  const [contourN, setContourN] = useState(12);
  const [contactZ, setContactZ] = useState(index.contacts[0]?.tvdss ?? 3120);
  const [showClosure, setShowClosure] = useState(true);
  const [hillshade, setHillshade] = useState(true);

  const [layers, setLayers] = usePersist('ae_wb_layers', {
    surface: true, wells: true, picks: true, contact: true, polygons: true, sections: true, grat: true,
  });
  const toggle = (k: keyof typeof layers) => setLayers((p) => ({ ...p, [k]: !p[k] }));

  const [shapes, setShapes] = usePersist<UserShape[]>('ae_wb_shapes', []);
  const [draft, setDraft] = useState<Pt[]>([]);        // in-progress polygon/section pts
  const [hover, setHover] = useState<{ x: number; y: number; z: number | null } | null>(null);
  const [selSection, setSelSection] = useState<string | null>(null);
  const [pendingWell, setPendingWell] = useState<{ pt: Pt; design: WellDesign } | null>(null);

  // pan/zoom state
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<{ cx: number; cy: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const dragEndRef = useRef<{ shapeId: string; end: 0 | 1 } | null>(null);

  const surf = useAsync<SurfaceJson>(() => loadSurface(activeSurface), [activeSurface]);
  const picksRes = useAsync(loadPicks, []);
  const trajWells = useMemo(() => index.wells.filter((w) => w.has.traj), [index]);
  const trajRes = useAsync(
    () => Promise.all(trajWells.map((w) => loadTraj(w.name).then((t) => ({ w, t })).catch(() => null))),
    [trajWells],
  );

  const surfInfo = index.surfaces.find((s) => s.id === activeSurface)!;
  const bounds: Bounds = useMemo(() => {
    if (surf.data) return padBounds(gridBounds(surf.data), 0.06);
    return padBounds({ minX: surfInfo.x0, minY: surfInfo.y0, maxX: surfInfo.x0 + surfInfo.nx * surfInfo.cell, maxY: surfInfo.y0 + surfInfo.ny * surfInfo.cell }, 0.06);
  }, [surf.data, surfInfo]);

  const minmax = useMemo(() => (surf.data ? gridMinMax(surf.data) : { min: surfInfo.zmin, max: surfInfo.zmax }), [surf.data, surfInfo]);

  const closure = useMemo(() => {
    if (!surf.data || !showClosure) return null;
    try { return contactPolygon(surf.data, contactZ); } catch { return null; }
  }, [surf.data, contactZ, showClosure]);

  const isolines = useMemo(() => {
    if (!surf.data) return [];
    return contourGrid(surf.data, niceLevels(minmax.min, minmax.max, contourN));
  }, [surf.data, minmax.min, minmax.max, contourN]);

  const picksForMap: Pick[] = useMemo(() => {
    const p = picksRes.data?.picks ?? [];
    // post only Hugin picks that carry a real well with surface coords
    return p.filter((x) => x.well && /Hugin/i.test(x.surface));
  }, [picksRes.data]);

  const wellPaths = useMemo(() => {
    const out: Array<{ w: WellRow; path: Pt[] }> = [];
    for (const r of trajRes.data ?? []) {
      if (!r) continue;
      out.push({ w: r.w, path: wellPathWorld(r.w, r.t.stations) });
    }
    return out;
  }, [trajRes.data]);

  // 3D scene inputs (real trajectories + planned scenario wells)
  const trajFor3D = useMemo(() => (trajRes.data ?? []).filter((r): r is { w: WellRow; t: TrajJson } => !!r), [trajRes.data]);
  const planned3D = useMemo(() => shapes.filter((s) => s.kind === 'well').map((s) => ({
    name: s.design?.name ?? 'PLAN', role: 'none' as WellRow['role'], pts: s.pts, landingTVD: s.landingTVD ?? null,
  })), [shapes]);
  const reduced = useMemo(prefersReducedMotion, []);

  // ---- draw ----
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const view = makeView(bounds, w, h, 28, zoom, center?.cx, center?.cy);
    const ramp = depthRamp();
    const line = cssVar('--line');
    const text = cssVar('--text');
    const muted = cssVar('--muted');

    if (mode === '3d') return; // real WebGL scene mounts as an overlay
    if (surf.data && layers.surface) drawHeatmap(ctx, view, surf.data, minmax, ramp, hillshade);
    if (layers.grat) drawGraticule(ctx, view, bounds, line, muted);
    if (surf.data && layers.surface) drawContours(ctx, view, isolines, text, muted);
    if (closure && layers.contact) drawClosure(ctx, view, closure.ring, cssVar('--rose'));

    // wells + paths (2D only for clarity)
    if (mode === '2d' && layers.wells) {
      for (const { w: well, path } of wellPaths) {
        drawWellPath(ctx, view, well, path, roleColorHex(well.role));
      }
      for (const well of index.wells) {
        if (well.has.traj) continue; // already drawn as path start
        drawWellPost(ctx, view, well, roleColorHex(well.role));
      }
    }
    if (mode === '2d' && layers.picks) {
      for (const p of picksForMap) {
        const wl = index.wells.find((x) => x.name === p.well);
        if (!wl) continue;
        drawPost(ctx, view.toX(wl.x), view.toY(wl.y), cssVar('--orange'), '△');
      }
    }

    // user shapes
    if (mode === '2d') {
      for (const s of shapes) {
        if (s.kind === 'polygon' && layers.polygons) drawPoly(ctx, view, s.pts, cssVar('--teal'), s.id === selSection);
        else if (s.kind === 'section' && layers.sections) drawSection(ctx, view, s.pts, cssVar('--violet'), s.id === selSection);
        else if (s.kind === 'measure') drawMeasure(ctx, view, s.pts, cssVar('--amber'));
        else if (s.kind === 'well') drawPlannedWell(ctx, view, s, cssVar('--rose'));
      }
      // draft
      if (draft.length) {
        const col = tool === 'section' ? cssVar('--violet') : tool === 'measure' ? cssVar('--amber') : cssVar('--teal');
        drawPoly(ctx, view, draft, col, true, true);
      }
      if (pendingWell) drawPlannedWell(ctx, view, { id: 'pending', kind: 'well', cls: 'scenario', pts: [pendingWell.pt], design: pendingWell.design, landingTVD: surf.data ? sampleGrid(surf.data, pendingWell.pt[0], pendingWell.pt[1]) : null }, cssVar('--rose'));
    }
  }, [bounds, zoom, center, mode, surf.data, minmax, layers, hillshade, isolines, closure, wellPaths, picksForMap, shapes, draft, tool, selSection, pendingWell, index.wells, vExag]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  // ---- interaction ----
  const screenToWorld = (e: React.MouseEvent): Pt => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const view = makeView(bounds, rect.width, rect.height, 28, zoom, center?.cx, center?.cy);
    const p = view.inv(e.clientX - rect.left, e.clientY - rect.top);
    return [p.x, p.y];
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const view = makeView(bounds, rect.width, rect.height, 28, zoom, center?.cx, center?.cy);
    const before = view.inv(e.clientX - rect.left, e.clientY - rect.top);
    const nz = Math.max(0.4, Math.min(12, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    // keep cursor world point fixed: adjust center
    const v2 = makeView(bounds, rect.width, rect.height, 28, nz, center?.cx ?? (bounds.minX + bounds.maxX) / 2, center?.cy ?? (bounds.minY + bounds.maxY) / 2);
    const after = v2.inv(e.clientX - rect.left, e.clientY - rect.top);
    setCenter((c) => {
      const cx = (c?.cx ?? (bounds.minX + bounds.maxX) / 2) + (before.x - after.x);
      const cy = (c?.cy ?? (bounds.minY + bounds.maxY) / 2) + (before.y - after.y);
      return { cx, cy };
    });
    setZoom(nz);
  };

  const onDown = (e: React.MouseEvent) => {
    const [wx, wy] = screenToWorld(e);
    // section endpoint drag?
    if (tool === 'select') {
      const hit = hitSectionEndpoint(shapes, [wx, wy], bounds, zoom, center, e);
      if (hit) { dragEndRef.current = hit; setSelSection(hit.shapeId); return; }
      const sec = hitShape(shapes, [wx, wy], 'section');
      setSelSection(sec ?? null);
    }
    if (tool === 'pan' || tool === 'select') {
      dragRef.current = { sx: e.clientX, sy: e.clientY, cx: center?.cx ?? (bounds.minX + bounds.maxX) / 2, cy: center?.cy ?? (bounds.minY + bounds.maxY) / 2 };
    }
  };
  const onMove = (e: React.MouseEvent) => {
    const [wx, wy] = screenToWorld(e);
    setHover({ x: wx, y: wy, z: surf.data ? sampleGrid(surf.data, wx, wy) : null });
    if (dragEndRef.current) {
      const { shapeId, end } = dragEndRef.current;
      setShapes((prev) => prev.map((s) => s.id === shapeId ? { ...s, pts: end === 0 ? [[wx, wy], s.pts[1]] : [s.pts[0], [wx, wy]] } : s));
      return;
    }
    if (dragRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const view = makeView(bounds, rect.width, rect.height, 28, zoom);
      const dx = (e.clientX - dragRef.current.sx) / view.s;
      const dy = (e.clientY - dragRef.current.sy) / view.s;
      setCenter({ cx: dragRef.current.cx - dx, cy: dragRef.current.cy + dy });
    }
  };
  const onUp = () => { dragRef.current = null; dragEndRef.current = null; };

  const onClick = (e: React.MouseEvent) => {
    if (dragRef.current && (e.clientX !== dragRef.current.sx || e.clientY !== dragRef.current.sy)) return; // was a drag
    const pt = screenToWorld(e);
    if (tool === 'polygon' || tool === 'section' || tool === 'measure') {
      setDraft((d) => {
        const nd = [...d, pt];
        if (tool === 'section' && nd.length === 2) { commitDraft(nd); return []; }
        if (tool === 'measure' && nd.length === 2) { commitDraft(nd); return []; }
        return nd;
      });
    } else if (tool === 'well') {
      const design: WellDesign = { name: `PL-${shapes.filter((s) => s.kind === 'well').length + 1}`, kind: 'vertical', target: activeSurface, kickoff: 300, lateralLen: 800, azimuth: 90 };
      setPendingWell({ pt, design });
      setInspOpen(true);
    }
  };
  const onDbl = (e: React.MouseEvent) => {
    if ((tool === 'polygon') && draft.length >= 3) { commitDraft(draft); setDraft([]); return; }
    if (tool === 'select' || tool === 'pan') { setZoom(1); setCenter(null); }
    else { setDraft([]); }
    e.preventDefault();
  };

  const commitDraft = (pts: Pt[]) => {
    const kind: UserShape['kind'] = tool === 'section' ? 'section' : tool === 'measure' ? 'measure' : 'polygon';
    const s: UserShape = { id: uid(), kind, cls: 'user', pts };
    setShapes((prev) => [...prev, s]);
    if (kind === 'section') setSelSection(s.id);
  };

  const placePlanned = () => {
    if (!pendingWell) return;
    const plan = buildWellPlan(pendingWell.pt, pendingWell.design);
    const s: UserShape = { id: uid(), kind: 'well', cls: 'scenario', pts: plan, design: pendingWell.design, landingTVD: surf.data ? sampleGrid(surf.data, pendingWell.pt[0], pendingWell.pt[1]) : null };
    setShapes((prev) => [...prev, s]);
    setPendingWell(null);
    setTool('select');
  };

  const clearShapes = () => { setShapes([]); setSelSection(null); };

  const sectionShape = shapes.find((s) => s.id === selSection && s.kind === 'section');

  const readout = hover
    ? `X ${hover.x.toFixed(0)}  Y ${hover.y.toFixed(0)}  ${hover.z != null ? `Z ${hover.z.toFixed(1)} m` : 'Z —'}`
    : `${surfInfo.name} · ${surfInfo.nx}×${surfInfo.ny} · ${surfInfo.cell} m`;
  const scaleBar = useMemo(() => {
    // 1000 m bar at current scale
    const v = makeView(bounds, 800, 500, 28, zoom);
    const px = 1000 * v.s;
    return px > 20 && px < 400 ? { px, label: '1 km' } : { px: Math.max(30, Math.min(300, 500 * v.s)), label: '500 m' };
  }, [bounds, zoom]);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={[{ id: '2d' as Mode, label: '2D' }, { id: '3d' as Mode, label: '3D · WebGL' }]} value={mode} onChange={setMode} />
          <div style={{ width: 1, height: 20, background: 'var(--line)' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {TOOLS.map((t) => (
              <ToolButton key={t.id} active={tool === t.id} title={t.label} onClick={() => { setTool(t.id); setDraft([]); }}>
                <t.icon size={15} strokeWidth={1.7} />
              </ToolButton>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <NatureBadge nature="interpreted" />
          <button onClick={() => setInspOpen((o) => !o)} title="Toggle inspector"
            style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>
            <Layers size={15} />
          </button>
        </div>

        {/* canvas + optional x-section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div ref={wrapRef} style={{ flex: sectionShape ? '1 1 55%' : 1, position: 'relative', minHeight: 0, cursor: tool === 'pan' ? 'grab' : tool === 'well' ? 'crosshair' : 'default' }}>
            <canvas ref={canvasRef}
              onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              onClick={onClick} onDoubleClick={onDbl} style={{ display: mode === '3d' ? 'none' : 'block', width: '100%', height: '100%' }} />
            {mode === '2d' && <ReadoutBar left={readout} scale={scaleBar} />}
            {mode === '3d' && surf.data && (
              <Suspense fallback={<div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12 }}>Compiling WebGL scene…</div>}>
                <Map3D grid={surf.data} minmax={minmax} activeSurfaceId={activeSurface} vExag={vExag}
                  trajectories={trajFor3D} planned={planned3D} reducedMotion={reduced} />
              </Suspense>
            )}
          </div>
          {sectionShape && (
            <div style={{ flex: '1 1 45%', minHeight: 160, borderTop: '1px solid var(--line)' }}>
              <XSection line={sectionShape.pts} activeSurface={activeSurface} contactZ={contactZ} wellPaths={wellPaths} picks={picksRes.data?.picks ?? []} onClose={() => setSelSection(null)}
                onUpdateLine={(end, world) => setShapes((prev) => prev.map((s) => s.id === sectionShape.id ? { ...s, pts: end === 0 ? [world, s.pts[1]] : [s.pts[0], world] } : s))} />
            </div>
          )}
        </div>
      </div>

      <Inspector title={pendingWell ? 'Well designer' : 'Map inspector'} open={inspOpen} onToggle={() => setInspOpen(false)}>
        {pendingWell ? (
          <WellDesigner pending={pendingWell} setPending={setPendingWell} surfaces={index.surfaces} landing={surf.data ? sampleGrid(surf.data, pendingWell.pt[0], pendingWell.pt[1]) : null} onPlace={placePlanned} onCancel={() => { setPendingWell(null); setTool('select'); }} />
        ) : (
          <>
            <InspectorSection title="Layers">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <LayerRow on={layers.surface} onToggle={() => toggle('surface')} label="Structure + isolines" swatch={cssVar('--teal')} />
                <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 1, margin: '2px 0' }}>
                  {index.surfaces.map((s) => (
                    <LayerRow key={s.id} indent={0} on={s.id === activeSurface} onToggle={() => setActiveSurface(s.id)} active={s.id === activeSurface}
                      onClick={() => setActiveSurface(s.id)} label={s.name} swatch={s.id === activeSurface ? cssVar('--teal') : 'transparent'} />
                  ))}
                </div>
                <LayerRow on={layers.wells} onToggle={() => toggle('wells')} label="Wells + paths" swatch={cssVar('--amber')} />
                <LayerRow on={layers.picks} onToggle={() => toggle('picks')} label="Formation picks" swatch={cssVar('--orange')} />
                <LayerRow on={layers.contact} onToggle={() => toggle('contact')} label={`OWC closure @ ${contactZ}m`} swatch={cssVar('--rose')} />
                <LayerRow on={layers.polygons} onToggle={() => toggle('polygons')} label="User polygons" swatch={cssVar('--teal')} />
                <LayerRow on={layers.sections} onToggle={() => toggle('sections')} label="Section lines" swatch={cssVar('--violet')} />
                <LayerRow on={layers.grat} onToggle={() => toggle('grat')} label="Graticule" swatch={cssVar('--line')} />
              </div>
            </InspectorSection>

            {mode === '3d' && (
              <InspectorSection title="3D · WebGL scene">
                <Slider label="Vertical exaggeration" min={1} max={20} step={1} value={vExag} onChange={setVExag} fmt={(v) => `${v}×`} />
                <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: 0 }}>Real react-three-fiber scene over the 50 m grid: lit BufferGeometry surface, orbit/pan/zoom, stackable horizons + 3D well tubes. Use the on-canvas cluster for reset/top/wireframe/stack.</p>
              </InspectorSection>
            )}

            <InspectorSection title="Structure">
              <Slider label="Contour density" min={5} max={30} step={1} value={contourN} onChange={setContourN} fmt={(v) => `~${v}`} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, marginBottom: 8 }}>
                <input type="checkbox" checked={hillshade} onChange={(e) => setHillshade(e.target.checked)} /> Hillshade (∂z)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--muted)' }}>
                <span style={{ width: 60, height: 8, borderRadius: 2, background: `linear-gradient(90deg, ${depthRamp()(0)}, ${depthRamp()(0.5)}, ${depthRamp()(1)})` }} />
                {minmax.min.toFixed(0)}–{minmax.max.toFixed(0)} m
              </div>
            </InspectorSection>

            <InspectorSection title="Fluid contact">
              <Slider label="OWC (mTVDSS)" min={2900} max={3300} step={5} value={contactZ} onChange={setContactZ} fmt={(v) => `${v} m`} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
                <input type="checkbox" checked={showClosure} onChange={(e) => setShowClosure(e.target.checked)} /> Derive closure ring
              </label>
              {closure && <p className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', margin: '6px 0 0' }}>crest {closure.crest.z.toFixed(0)}m · {closure.cells} cells · <NatureBadge nature="derived" /></p>}
            </InspectorSection>

            <InspectorSection title="Drawn objects">
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{shapes.length} shape(s) · localStorage ae_wb_shapes</div>
              {shapes.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 0' }}>
                  <span style={{ color: s.cls === 'scenario' ? 'var(--rose)' : 'var(--teal)' }}>{s.kind === 'well' ? '⚑' : s.kind === 'section' ? '╱' : s.kind === 'measure' ? '↔' : '◇'}</span>
                  <span style={{ flex: 1 }}>{s.kind === 'well' ? s.design?.name : s.kind}</span>
                  {s.kind === 'section' && <button onClick={() => setSelSection(s.id)} style={{ color: 'var(--violet)', fontSize: 10 }}>x-sect</button>}
                  <button onClick={() => setShapes((p) => p.filter((x) => x.id !== s.id))} style={{ color: 'var(--rose)', fontSize: 12 }}>×</button>
                </div>
              ))}
              {shapes.length > 0 && <button onClick={clearShapes} style={{ marginTop: 8, ...inputStyle, cursor: 'pointer', color: 'var(--rose)', width: 'auto', padding: '4px 10px' }}>Clear all</button>}
            </InspectorSection>
          </>
        )}
      </Inspector>
    </div>
  );
}

// ── Well designer form ──────────────────────────────────────────────
function WellDesigner({ pending, setPending, surfaces, landing, onPlace, onCancel }: {
  pending: { pt: Pt; design: WellDesign }; setPending: (p: { pt: Pt; design: WellDesign }) => void;
  surfaces: WbIndex['surfaces']; landing: number | null; onPlace: () => void; onCancel: () => void;
}) {
  const d = pending.design;
  const set = (patch: Partial<WellDesign>) => setPending({ pt: pending.pt, design: { ...d, ...patch } });
  return (
    <>
      <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--muted)' }}>
        Surface @ X {pending.pt[0].toFixed(0)} · Y {pending.pt[1].toFixed(0)} — <NatureBadge nature="scenario" />
      </div>
      <Field label="Well name"><input style={inputStyle} value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Kind">
        <Segmented options={[{ id: 'vertical', label: 'Vert' }, { id: 'deviated', label: 'Dev' }, { id: 'horizontal', label: 'Horiz' }]} value={d.kind} onChange={(v) => set({ kind: v as WellDesign['kind'] })} accent="--rose" />
      </Field>
      <Field label="Target surface">
        <select style={inputStyle} value={d.target} onChange={(e) => set({ target: e.target.value })}>
          {surfaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Landing depth (grid-sampled): <span className="mono" style={{ color: 'var(--text)' }}>{landing != null ? `${landing.toFixed(1)} mTVDSS` : '—'}</span></div>
      {d.kind !== 'vertical' && <Field label="Kickoff (mTVD)"><input type="number" style={inputStyle} value={d.kickoff} onChange={(e) => set({ kickoff: +e.target.value })} /></Field>}
      {d.kind === 'horizontal' && <>
        <Field label="Lateral length (m)"><input type="number" style={inputStyle} value={d.lateralLen} onChange={(e) => set({ lateralLen: +e.target.value })} /></Field>
        <Field label="Azimuth (°)"><input type="number" style={inputStyle} value={d.azimuth} onChange={(e) => set({ azimuth: +e.target.value })} /></Field>
      </>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onPlace} style={{ ...inputStyle, width: 'auto', flex: 1, cursor: 'pointer', color: 'var(--text)', background: 'var(--sel)', borderColor: 'var(--rose)' }}>Place planned well</button>
        <button onClick={onCancel} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 10 }}>Planned wells are dashed and badged SCENARIO — never mixed with real wells.</p>
    </>
  );
}

// ── planned trajectory (map plan geometry) ──────────────────────────
function buildWellPlan(surface: Pt, d: WellDesign): Pt[] {
  if (d.kind === 'vertical') return [surface];
  const azRad = (d.azimuth * Math.PI) / 180;
  const dir: Pt = [Math.sin(azRad), Math.cos(azRad)];
  // drift proportional to build below kickoff (map-plan approximation, scenario)
  const drift = Math.max(120, (3100 - d.kickoff) * Math.tan((30 * Math.PI) / 180) * 0.15);
  const heel: Pt = [surface[0] + dir[0] * drift, surface[1] + dir[1] * drift];
  if (d.kind === 'deviated') return [surface, heel];
  const toe: Pt = [heel[0] + dir[0] * d.lateralLen, heel[1] + dir[1] * d.lateralLen];
  return [surface, heel, toe];
}

// ── draw helpers ────────────────────────────────────────────────────
function roleColorHex(role: WellRow['role']): string {
  const map: Record<string, string> = { producer: cssVar('--amber'), injector: cssVar('--blue'), both: cssVar('--teal'), none: cssVar('--muted') };
  return map[role];
}

function drawHeatmap(ctx: CanvasRenderingContext2D, v: View, g: SurfaceJson, mm: { min: number; max: number }, ramp: (t: number) => string, hill: boolean) {
  const span = Math.max(1e-6, mm.max - mm.min);
  const px = Math.abs(v.toX(g.x0 + g.cell) - v.toX(g.x0)) + 1;
  for (let iy = 0; iy < g.ny; iy++) {
    for (let ix = 0; ix < g.nx; ix++) {
      const z = g.z[iy * g.nx + ix];
      if (z == null) continue;
      const t = (z - mm.min) / span;
      let shade = 1;
      if (hill) {
        const zl = g.z[iy * g.nx + Math.max(0, ix - 1)];
        const zu = g.z[Math.max(0, iy - 1) * g.nx + ix];
        const dzx = zl == null ? 0 : z - zl;
        const dzy = zu == null ? 0 : z - zu;
        shade = Math.max(0.6, Math.min(1.25, 1 - (dzx + dzy) * 0.012));
      }
      const sx = v.toX(g.x0 + ix * g.cell);
      const sy = v.toY(g.y0 + iy * g.cell);
      ctx.fillStyle = shade === 1 ? ramp(t) : shadeColor(ramp(t), shade);
      ctx.fillRect(sx - px / 2, sy - px / 2, px, px);
    }
  }
}
function shadeColor(rgb: string, f: number): string {
  const m = rgb.match(/\d+/g); if (!m) return rgb;
  return `rgb(${Math.min(255, +m[0] * f) | 0},${Math.min(255, +m[1] * f) | 0},${Math.min(255, +m[2] * f) | 0})`;
}

function drawContours(ctx: CanvasRenderingContext2D, v: View, lines: ReturnType<typeof contourGrid>, text: string, muted: string) {
  ctx.lineWidth = 0.8; ctx.strokeStyle = muted;
  for (const iso of lines) {
    for (const ring of iso.rings) {
      ctx.beginPath();
      ring.forEach(([x, y], i) => { const sx = v.toX(x), sy = v.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    // inline label on the longest ring
    const ring = iso.rings.reduce((a, b) => (b.length > a.length ? b : a), iso.rings[0]);
    if (ring && ring.length > 12) {
      const mid = ring[Math.floor(ring.length / 2)];
      ctx.fillStyle = text; ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(iso.z)), v.toX(mid[0]), v.toY(mid[1]));
    }
  }
}

function drawClosure(ctx: CanvasRenderingContext2D, v: View, ring: Pt[], col: string) {
  if (ring.length < 3) return;
  ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.fillStyle = withAlpha(col, 0.10);
  ctx.beginPath(); ring.forEach(([x, y], i) => { const sx = v.toX(x), sy = v.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawGraticule(ctx: CanvasRenderingContext2D, v: View, b: Bounds, line: string, muted: string) {
  const stepFor = (span: number) => { const raw = span / 6; const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; };
  const sx = stepFor(b.maxX - b.minX);
  ctx.strokeStyle = line; ctx.lineWidth = 0.5; ctx.fillStyle = muted; ctx.font = `9px ${cssVar('--mono')}`;
  for (let x = Math.ceil(b.minX / sx) * sx; x <= b.maxX; x += sx) {
    const px = v.toX(x); ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, v.h); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillText(String(Math.round(x)), px + 2, 11);
  }
  for (let y = Math.ceil(b.minY / sx) * sx; y <= b.maxY; y += sx) {
    const py = v.toY(y); ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(v.w, py); ctx.stroke();
    ctx.fillText(String(Math.round(y)), 2, py - 2);
  }
}

function drawWellPath(ctx: CanvasRenderingContext2D, v: View, w: WellRow, path: Pt[], col: string) {
  if (path.length > 1) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.setLineDash([]);
    ctx.beginPath(); path.forEach(([x, y], i) => { const sx = v.toX(x), sy = v.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke();
  }
  drawWellPost(ctx, v, w, col);
}
function drawWellPost(ctx: CanvasRenderingContext2D, v: View, w: WellRow, col: string) {
  const sx = v.toX(w.x), sy = v.toY(w.y);
  drawPost(ctx, sx, sy, col, w.role === 'injector' ? '▽' : '◯');
  ctx.fillStyle = cssVar('--text'); ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'left';
  ctx.fillText(w.name, sx + 6, sy - 4);
}
function drawPost(ctx: CanvasRenderingContext2D, sx: number, sy: number, col: string, glyph: string) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
  if (glyph === '▽' || glyph === '△') { ctx.fill(); } else { ctx.stroke(); ctx.fillStyle = cssVar('--bg'); ctx.fill(); ctx.strokeStyle = col; ctx.stroke(); }
}

function drawPoly(ctx: CanvasRenderingContext2D, v: View, pts: Pt[], col: string, sel = false, open = false) {
  if (!pts.length) return;
  ctx.strokeStyle = col; ctx.lineWidth = sel ? 2 : 1.4; ctx.setLineDash(open ? [4, 3] : []);
  ctx.fillStyle = withAlpha(col, 0.10);
  ctx.beginPath(); pts.forEach(([x, y], i) => { const sx = v.toX(x), sy = v.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
  if (!open) { ctx.closePath(); ctx.fill(); }
  ctx.stroke(); ctx.setLineDash([]);
  for (const [x, y] of pts) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(v.toX(x), v.toY(y), 3, 0, Math.PI * 2); ctx.fill(); }
}
function drawSection(ctx: CanvasRenderingContext2D, v: View, pts: Pt[], col: string, sel: boolean) {
  if (pts.length < 2) return;
  ctx.strokeStyle = col; ctx.lineWidth = sel ? 2.4 : 1.6; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(v.toX(pts[0][0]), v.toY(pts[0][1])); ctx.lineTo(v.toX(pts[1][0]), v.toY(pts[1][1])); ctx.stroke();
  ['A', "A'"].forEach((lab, i) => {
    const sx = v.toX(pts[i][0]), sy = v.toY(pts[i][1]);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, sel ? 5 : 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cssVar('--text'); ctx.font = `bold 10px ${cssVar('--mono')}`; ctx.textAlign = 'center'; ctx.fillText(lab, sx, sy - 8);
  });
}
function drawMeasure(ctx: CanvasRenderingContext2D, v: View, pts: Pt[], col: string) {
  if (pts.length < 2) return;
  drawSection(ctx, v, pts, col, false);
  const d = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const mx = v.toX((pts[0][0] + pts[1][0]) / 2), my = v.toY((pts[0][1] + pts[1][1]) / 2);
  ctx.fillStyle = col; ctx.font = `10px ${cssVar('--mono')}`; ctx.textAlign = 'center'; ctx.fillText(`${d.toFixed(0)} m`, mx, my - 6);
}
function drawPlannedWell(ctx: CanvasRenderingContext2D, v: View, s: UserShape, col: string) {
  const pts = s.pts;
  ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
  if (pts.length > 1) { ctx.beginPath(); pts.forEach(([x, y], i) => { const sx = v.toX(x), sy = v.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); }
  ctx.setLineDash([]);
  const [hx, hy] = pts[0];
  const sx = v.toX(hx), sy = v.toY(hy);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 5, sy + 4); ctx.lineTo(sx - 5, sy + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.font = `bold 9px ${cssVar('--mono')}`; ctx.textAlign = 'left';
  ctx.fillText(`${s.design?.name ?? 'PLAN'} ⚑`, sx + 7, sy - 4);
}

// ── hit tests ───────────────────────────────────────────────────────
function hitShape(shapes: UserShape[], p: Pt, kind: UserShape['kind']): string | null {
  for (const s of shapes) {
    if (s.kind !== kind) continue;
    if (s.pts.length >= 2) {
      const d = distToSeg(p, s.pts[0], s.pts[1]);
      if (d < 40) return s.id;
    }
  }
  return null;
}
function hitSectionEndpoint(shapes: UserShape[], p: Pt, bounds: Bounds, zoom: number, center: { cx: number; cy: number } | null, e: React.MouseEvent): { shapeId: string; end: 0 | 1 } | null {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const view = makeView(bounds, rect.width, rect.height, 28, zoom, center?.cx, center?.cy);
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  void p;
  for (const s of shapes) {
    if (s.kind !== 'section') continue;
    for (let i = 0; i < 2; i++) {
      const sx = view.toX(s.pts[i][0]), sy = view.toY(s.pts[i][1]);
      if (Math.hypot(sx - px, sy - py) < 9) return { shapeId: s.id, end: i as 0 | 1 };
    }
  }
  return null;
}
function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

