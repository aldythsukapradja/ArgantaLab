// Volumetrics.tsx (V1c) — STOIIP (oil) / GIIP (gas scenario) with a scope selector
// (closure · polygon · well-drainage), deterministic vs property mode, the
// validation banner (screening 142 vs analogue 67.6 vs dynamic ≈22 —
// compartmentalization), and per-well recoverable = drainage × RF.
import { useMemo, useState, useCallback } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, Slider, Loading, ErrorBanner, ReadoutBar, roleColor } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadSurface, loadPicks } from '../../wb/load';
import { depthRamp } from './colormap';
import type { WbIndex, PicksJson } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { gridBounds, gridMinMax, cellZ } from '../../engine/grid';
import { makeView, padBounds } from '../../engine/view';
import { contactPolygon } from '../../engine/closure';
import { grvClosure, grvWell, grvPolygon, stoiip, giip, solutionGas, BBL_PER_SM3, SCF_PER_SM3 } from '../../engine/volumetrics';
import { loadWellPetro, upscale, type WellPetro } from './fdData';
import { useUnits, oilVol, gasVol } from '../../units';

type Scope = 'closure' | 'polygon' | 'well';
type FillCase = 'oil' | 'gas';
type ModeK = 'deterministic' | 'property';

const fmt = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)}·10⁹` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}·10⁶` : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function Volumetrics() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const picks = useAsync<PicksJson>(loadPicks, []);
  if (idx.loading || picks.loading) return <Loading what="volumetrics data" />;
  if (idx.error || !idx.data || !picks.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} picks={picks.data} />;
}

function Inner({ index, picks }: { index: WbIndex; picks: PicksJson }) {
  const { system } = useUnits();
  const d = index.defaults;
  const owc = index.contacts[0]?.tvdss ?? 3200;
  const bo = index.pvt.Bo, rs = index.pvt.Rs;
  const [scope, setScope] = useState<Scope>('closure');
  const [fill, setFill] = useState<FillCase>('oil');
  const [mode, setMode] = useState<ModeK>('deterministic');
  const [rf, setRf] = useState(0.50);
  const [polyR, setPolyR] = useState(2000); // polygon half-size (m) centred on crest
  const [wellR, setWellR] = useState(1500);  // drainage radius (m)
  const [drainWell, setDrainWell] = useState('F-12');
  const [inspOpen, setInspOpen] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const bg = 0.0040;

  const top = useAsync<SurfaceJson>(() => loadSurface('hugin_top'), []);
  const base = useAsync<SurfaceJson>(() => loadSurface('hugin_base'), []);
  const producers = useMemo(() => index.wells.filter((w) => w.role === 'producer' || w.role === 'both'), [index]);

  // property-mode field averages from upscaled wells
  const wellSet = useMemo(() => index.wells.filter((w) => w.has.logs && w.has.picks), [index]);
  const wpRes = useAsync<WellPetro[]>(() => Promise.all(wellSet.map((w) => loadWellPetro(w, picks).catch(() => null))).then((a) => a.filter(Boolean) as WellPetro[]), [wellSet]);
  const propAvg = useMemo(() => {
    const us = (wpRes.data ?? []).map((wp) => upscale(wp)).filter(Boolean) as NonNullable<ReturnType<typeof upscale>>[];
    if (!us.length) return { phie: d.phi, ntg: d.ntg };
    const phie = us.reduce((a, u) => a + (u.phieUp ?? d.phi), 0) / us.length;
    const ntg = us.reduce((a, u) => a + u.netSand, 0) / us.length;
    return { phie, ntg };
  }, [wpRes.data, d]);

  const params = mode === 'property' ? { ntg: propAvg.ntg, phie: propAvg.phie, sw: d.sw } : { ntg: d.ntg, phie: d.phi, sw: d.sw };

  const crest = useMemo(() => {
    if (!top.data) return null;
    let ci = -1, cz = Infinity; for (let i = 0; i < top.data.z.length; i++) { const z = top.data.z[i]; if (z != null && (z as number) < cz) { cz = z as number; ci = i; } }
    if (ci < 0) return null; const g = top.data; return { x: g.x0 + (ci % g.nx) * g.cell, y: g.y0 + ((ci / g.nx) | 0) * g.cell, z: cz };
  }, [top.data]);

  const drainWR = producers.find((w) => w.name === drainWell) ?? producers[0];

  const grvRes = useMemo(() => {
    if (!top.data || !base.data) return null;
    const g = top.data, b = base.data;
    if (scope === 'closure') return grvClosure(g, b, owc, g.cell);
    if (scope === 'well' && drainWR) return grvWell(g, b, owc, g.cell, drainWR.x, drainWR.y, wellR);
    if (scope === 'polygon' && crest) {
      const poly: Array<[number, number]> = [[crest.x - polyR, crest.y - polyR], [crest.x + polyR, crest.y - polyR], [crest.x + polyR, crest.y + polyR], [crest.x - polyR, crest.y + polyR]];
      return grvPolygon(g, b, owc, g.cell, poly);
    }
    return grvClosure(g, b, owc, g.cell);
  }, [top.data, base.data, scope, owc, drainWR, wellR, crest, polyR]);

  const grv = grvRes?.grv ?? 0;
  const stoiipSm3 = stoiip(grv, params.ntg, params.phie, params.sw, bo);
  const giipSm3 = giip(grv, params.ntg, params.phie, params.sw, bg);
  const solGasSm3 = solutionGas(stoiipSm3, rs);

  const bounds = useMemo(() => top.data ? padBounds(gridBounds(top.data), 0.05) : { minX: 0, minY: 0, maxX: 1, maxY: 1 }, [top.data]);
  const minmax = useMemo(() => top.data ? gridMinMax(top.data) : { min: 2700, max: 3400 }, [top.data]);
  const closureRing = useMemo(() => top.data ? (() => { try { return contactPolygon(top.data!, owc); } catch { return null; } })() : null, [top.data, owc]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!top.data) return;
    const g = top.data; const view = makeView(bounds, w, h, 26); const ramp = depthRamp();
    const span = Math.max(1e-6, minmax.max - minmax.min); const px = Math.max(1, view.s * g.cell * 1.03);
    for (let k = 0; k < g.ny; k++) for (let i = 0; i < g.nx; i++) { const z = cellZ(g, i, k); if (z == null) continue; const wx = g.x0 + i * g.cell, wy = g.y0 + k * g.cell; const inTrap = z < owc; ctx.globalAlpha = inTrap ? 1 : 0.25; ctx.fillStyle = ramp((z - minmax.min) / span); ctx.fillRect(view.toX(wx) - px / 2, view.toY(wy) - px / 2, px, px); }
    ctx.globalAlpha = 1;
    if (closureRing) { ctx.strokeStyle = cssVar('--rose'); ctx.lineWidth = 1.5; ctx.beginPath(); closureRing.ring.forEach(([x, y], i) => { const sx = view.toX(x), sy = view.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); }
    // scope overlay
    ctx.strokeStyle = cssVar('--teal'); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    if (scope === 'well' && drainWR) { const sx = view.toX(drainWR.x), sy = view.toY(drainWR.y); ctx.beginPath(); ctx.arc(sx, sy, wellR * view.s, 0, Math.PI * 2); ctx.stroke(); }
    else if (scope === 'polygon' && crest) { const x0 = view.toX(crest.x - polyR), y0 = view.toY(crest.y + polyR); ctx.strokeRect(x0, y0, polyR * 2 * view.s, polyR * 2 * view.s); }
    ctx.setLineDash([]);
    for (const wr of producers) { const sx = view.toX(wr.x), sy = view.toY(wr.y); ctx.fillStyle = roleColor(wr.role); ctx.strokeStyle = cssVar('--bg'); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, wr.name === drainWell ? 5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (hover) { const sx = view.toX(hover.x), sy = view.toY(hover.y); ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(sx-8,sy);ctx.lineTo(sx+8,sy);ctx.moveTo(sx,sy-8);ctx.lineTo(sx,sy+8); ctx.stroke(); }
  }, [top.data, bounds, minmax, owc, closureRing, scope, drainWR, wellR, crest, polyR, producers, hover, drainWell]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);
  const onMove = (e: React.MouseEvent) => { if (!top.data) return; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const view = makeView(bounds, rect.width, rect.height, 26); setHover(view.inv(e.clientX - rect.left, e.clientY - rect.top)); };

  const Card = ({ title, big, sub, nature }: { title: string; big: string; sub: string; nature: 'scenario' | 'derived' }) => (
    <div className="panel" style={{ padding: '10px 14px', minWidth: 150, flex: 1 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{big}</div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      <div style={{ marginTop: 6 }}><NatureBadge nature={nature} /></div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={[{ id: 'closure' as const, label: 'Closure' }, { id: 'polygon' as const, label: 'Polygon' }, { id: 'well' as const, label: 'Well drainage' }]} value={scope} onChange={setScope} accent="--blue" />
          <Segmented options={[{ id: 'deterministic' as const, label: 'Deterministic' }, { id: 'property' as const, label: 'Property' }]} value={mode} onChange={setMode} accent="--violet" />
          <Segmented options={[{ id: 'oil' as const, label: 'Oil STOIIP' }, { id: 'gas' as const, label: 'Gas GIIP' }]} value={fill} onChange={setFill} accent="--amber" />
          <div style={{ flex: 1 }} />
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}><SlidersHorizontal size={15} /></button>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
          {top.loading || base.loading ? <Loading what="Hugin grids" /> : top.error ? <ErrorBanner msg={top.error} /> : (
            <><canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', width: '100%', height: '100%' }} />
            <ReadoutBar left={`GRV ${fmt(grv)} m³ · ${grvRes?.cells ?? 0} cells · ${scope} · ${mode}`} /></>
          )}
        </div>
        {/* cards */}
        <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          {fill === 'oil'
            ? <Card title="STOIIP (oil)" big={oilVol(stoiipSm3, system).text} sub={`${oilVol(stoiipSm3, system === 'field' ? 'metric' : 'field').text} · Bo ${bo}`} nature="derived" />
            : <Card title="GIIP (gas · what-if)" big={gasVol(giipSm3, system).text} sub={`${gasVol(giipSm3, system === 'field' ? 'metric' : 'field').text} · Bg ${bg}`} nature="scenario" />}
          <Card title="Solution gas (assoc.)" big={gasVol(solGasSm3, system).text} sub={`STOIIP × Rs ${rs}`} nature="derived" />
          <Card title={`Recoverable @ RF ${(rf * 100).toFixed(0)}%`} big={oilVol(stoiipSm3 * rf, system).text} sub={`${oilVol(stoiipSm3 * rf, system === 'field' ? 'metric' : 'field').text}`} nature="scenario" />
        </div>
      </div>

      <Inspector title="Volumetrics inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Validation">
          <div style={{ fontSize: 10.5, lineHeight: 1.5, color: 'var(--muted)', border: '1px solid var(--amber)', borderRadius: 4, padding: 8 }}>
            <div>Screening STOIIP <b style={{ color: 'var(--text)' }}>{oilVol(stoiipSm3, system).text}</b> (blanket OWC over unfaulted closure — upper bound).</div>
            <div style={{ marginTop: 4 }}>Published volumetric analogue <b style={{ color: 'var(--text)' }}>67.6</b> [PEER Metsebo].</div>
            <div style={{ marginTop: 4 }}>Faulted dynamic model <b style={{ color: 'var(--text)' }}>≈22</b> [PEER]. The ~3–6× gap is 29-fault compartmentalization the unfaulted screening model cannot see.</div>
          </div>
        </InspectorSection>
        <InspectorSection title="Parameters">
          <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {[['NTG', params.ntg.toFixed(3)], ['PHIE', params.phie.toFixed(3)], ['SW', params.sw.toFixed(3)], ['Bo', String(bo)], ['Rs', String(rs)], ['mode', mode]].map(([k, v]) => <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{v}</td></tr>)}
          </tbody></table>
        </InspectorSection>
        <InspectorSection title="Scope controls">
          {scope === 'well' && <><select value={drainWell} onChange={(e) => setDrainWell(e.target.value)} style={{ width: '100%', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--text)', marginBottom: 8 }}>{producers.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}</select><Slider label="Drainage radius" min={500} max={4000} step={100} value={wellR} onChange={setWellR} fmt={(v) => `${v} m`} /></>}
          {scope === 'polygon' && <Slider label="Polygon half-size" min={500} max={4000} step={100} value={polyR} onChange={setPolyR} fmt={(v) => `${v} m`} />}
          {scope === 'closure' && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Crest-connected flood-fill to the deck OWC {owc} m.</div>}
        </InspectorSection>
        <InspectorSection title="Recovery factor">
          <Slider label="RF (published 0.46–0.54)" min={0.30} max={0.70} step={0.01} value={rf} onChange={setRf} fmt={(v) => `${(v * 100).toFixed(0)}%`} />
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>bbl ×{BBL_PER_SM3} · scf ×{SCF_PER_SM3}. Gas case badged scenario.</div>
      </Inspector>
    </div>
  );
}
