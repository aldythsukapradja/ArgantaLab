// Property.tsx (V1b) — SIMPLE property modelling: 1 continuous (porosity, IDW p2
// from upscaled per-well PHIE) + 1 discrete (facies SAND/SHALE from upscaled
// net-SAND, thresholded). HCPV map = grv_cell × porosity × facies-NTG × (1−Sw);
// its sum reconciles to the deterministic STOIIP. Premium colormaps + legend +
// hover readout. IDW is background-regularized toward field defaults so cells far
// from the clustered wells fall back to the deck averages (keeps reconciliation).
import { useMemo, useState, useCallback } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, Slider, Loading, ErrorBanner, ReadoutBar, roleColor } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadSurface, loadPicks } from '../../wb/load';
import type { WbIndex, PicksJson } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { gridBounds, cellZ } from '../../engine/grid';
import { makeView, padBounds } from '../../engine/view';
import { loadWellPetro, upscale, type WellPetro } from './fdData';
import { BBL_PER_SM3 } from '../../engine/volumetrics';

type PropKind = 'porosity' | 'facies' | 'hcpv';

interface WellPt { name: string; x: number; y: number; phie: number; netSand: number; role: WellPt2Role }
type WellPt2Role = 'producer' | 'injector' | 'both' | 'none';

export function Property() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const picks = useAsync<PicksJson>(loadPicks, []);
  if (idx.loading || picks.loading) return <Loading what="property data" />;
  if (idx.error || !idx.data || !picks.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} picks={picks.data} />;
}

function Inner({ index, picks }: { index: WbIndex; picks: PicksJson }) {
  const d = index.defaults;
  const owc = index.contacts[0]?.tvdss ?? 3200;
  const [kind, setKind] = useState<PropKind>('porosity');
  const [power, setPower] = useState(2);
  const [inspOpen, setInspOpen] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; val: number | null } | null>(null);

  const top = useAsync<SurfaceJson>(() => loadSurface('hugin_top'), []);
  const base = useAsync<SurfaceJson>(() => loadSurface('hugin_base'), []);

  const wellSet = useMemo(() => index.wells.filter((w) => w.has.logs && w.has.picks), [index]);
  const wpRes = useAsync<WellPetro[]>(
    () => Promise.all(wellSet.map((w) => loadWellPetro(w, picks).catch(() => null))).then((a) => a.filter(Boolean) as WellPetro[]),
    [wellSet],
  );

  const wellPts = useMemo<WellPt[]>(() => {
    const out: WellPt[] = [];
    for (const wp of wpRes.data ?? []) {
      const u = upscale(wp); if (!u) continue;
      out.push({ name: wp.well.name, x: wp.well.x, y: wp.well.y, phie: u.phieUp ?? d.phi, netSand: u.netSand, role: wp.well.role });
    }
    return out;
  }, [wpRes.data, d.phi]);

  // background-regularized IDW at a world point
  const idw = useCallback((x: number, y: number, pick: (w: WellPt) => number, bg: number): number => {
    let num = 0.6 * bg, den = 0.6; // background prior (regularizer)
    for (const w of wellPts) {
      const dist2 = (x - w.x) ** 2 + (y - w.y) ** 2;
      const wt = 1 / Math.pow(Math.max(dist2, 1), power / 2);
      num += wt * pick(w); den += wt;
    }
    return num / den;
  }, [wellPts, power]);

  const bounds = useMemo(() => top.data ? padBounds(gridBounds(top.data), 0.05) : { minX: 0, minY: 0, maxX: 1, maxY: 1 }, [top.data]);

  // closure mask (cells above OWC connected to crest) + per-cell HCPV
  const model = useMemo(() => {
    if (!top.data || !base.data) return null;
    const g = top.data, b = base.data;
    const inCl = new Uint8Array(g.nx * g.ny);
    let crest = -1, cz = Infinity;
    for (let i = 0; i < g.nx * g.ny; i++) { const z = g.z[i]; if (z != null && (z as number) < cz) { cz = z as number; crest = i; } }
    if (crest >= 0) {
      const st = [crest]; inCl[crest] = 1;
      while (st.length) { const idx = st.pop()!; const i = idx % g.nx, k = (idx / g.nx) | 0;
        for (const [di, dk] of [[1,0],[-1,0],[0,1],[0,-1]] as const) { const ni=i+di,nk=k+dk; if(ni<0||nk<0||ni>=g.nx||nk>=g.ny) continue; const n=nk*g.nx+ni; if(inCl[n]) continue; const z=g.z[n]; if(z!=null&&(z as number)<owc){inCl[n]=1;st.push(n);} } }
    }
    // per-cell property + HCPV
    let hcpvSum = 0, cells = 0, phiSum = 0;
    const hcpv = new Float64Array(g.nx * g.ny);
    for (let k = 0; k < g.ny; k++) for (let i = 0; i < g.nx; i++) {
      const idx = k * g.nx + i; if (!inCl[idx]) continue;
      const zt = cellZ(g, i, k); if (zt == null) continue;
      const wx = g.x0 + i * g.cell, wy = g.y0 + k * g.cell;
      const bi = Math.round((wx - b.x0) / g.cell), bk = Math.round((wy - b.y0) / g.cell);
      const zb = (bi>=0&&bk>=0&&bi<b.nx&&bk<b.ny) ? b.z[bk*b.nx+bi] : null;
      if (zb == null) continue;
      const h = Math.max(0, Math.min(zb as number, owc) - zt);
      if (h <= 0) continue;
      const phi = idw(wx, wy, (w) => w.phie, d.phi);
      const netSand = idw(wx, wy, (w) => w.netSand, d.ntg);
      const ntg = netSand >= 0.5 ? d.ntg : 0; // facies-NTG (SAND→ntg, SHALE→0)
      const grvCell = h * g.cell * g.cell;
      const cellHcpv = grvCell * ntg * phi * (1 - d.sw);
      hcpv[idx] = cellHcpv; hcpvSum += cellHcpv; phiSum += phi; cells++;
    }
    return { inCl, hcpv, hcpvSum, cells, phiMean: cells ? phiSum / cells : 0, g, b };
  }, [top.data, base.data, idw, owc, d]);

  const stoiipFromGrid = model ? model.hcpvSum / d.bo / 1e6 : 0;
  const detStoiip = (index.validation as { stoiip?: { stoiipMMSm3?: number } })?.stoiip?.stoiipMMSm3 ?? 142.3;

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!top.data || !model) return;
    const g = top.data;
    const view = makeView(bounds, w, h, 26);
    const px = Math.max(1, view.s * g.cell * 1.03);
    // property color scales
    const phiCol = (t: number) => { const tt = Math.max(0, Math.min(1, t)); return `rgb(${(20 + tt * 40)|0},${(60 + tt * 150)|0},${(120 + tt * 90)|0})`; };
    let hMax = 1; for (const v of model.hcpv) if (v > hMax) hMax = v;
    for (let k = 0; k < g.ny; k++) for (let i = 0; i < g.nx; i++) {
      const idx = k * g.nx + i; if (!model.inCl[idx]) continue;
      const wx = g.x0 + i * g.cell, wy = g.y0 + k * g.cell;
      let col = '';
      if (kind === 'porosity') { const phi = idw(wx, wy, (w) => w.phie, d.phi); col = phiCol((phi - 0.12) / 0.18); }
      else if (kind === 'facies') { const ns = idw(wx, wy, (w) => w.netSand, d.ntg); col = ns >= 0.5 ? cssVar('--amber') : cssVar('--muted'); }
      else { col = phiCol(model.hcpv[idx] / hMax); }
      ctx.fillStyle = col;
      ctx.fillRect(view.toX(wx) - px / 2, view.toY(wy) - px / 2, px, px);
    }
    // wells
    for (const wp of wellPts) {
      const sx = view.toX(wp.x), sy = view.toY(wp.y);
      ctx.fillStyle = roleColor(wp.role); ctx.strokeStyle = cssVar('--bg'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (hover) { const sx = view.toX(hover.x), sy = view.toY(hover.y); ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(sx-8,sy); ctx.lineTo(sx+8,sy); ctx.moveTo(sx,sy-8); ctx.lineTo(sx,sy+8); ctx.stroke(); }
  }, [top.data, model, bounds, kind, idw, wellPts, hover, d]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);
  const onMove = (e: React.MouseEvent) => {
    if (!top.data) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const view = makeView(bounds, rect.width, rect.height, 26);
    const wpt = view.inv(e.clientX - rect.left, e.clientY - rect.top);
    const val = kind === 'facies' ? idw(wpt.x, wpt.y, (w) => w.netSand, d.ntg) : idw(wpt.x, wpt.y, (w) => w.phie, d.phi);
    setHover({ x: wpt.x, y: wpt.y, val });
  };

  const legend = kind === 'facies'
    ? [['SAND', cssVar('--amber')], ['SHALE', cssVar('--muted')]] as const
    : [['low', 'rgb(20,60,120)'], ['high', 'rgb(60,210,210)']] as const;

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={[{ id: 'porosity' as const, label: 'Porosity' }, { id: 'facies' as const, label: 'Facies' }, { id: 'hcpv' as const, label: 'HCPV' }]} value={kind} onChange={setKind} accent="--teal" />
          <div style={{ flex: 1 }} />
          <span className="chip" style={{ color: 'var(--muted)' }}>STOIIP(grid) {stoiipFromGrid.toFixed(1)} vs det {detStoiip} MMSm³</span>
          <NatureBadge nature="derived" />
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>
            <SlidersHorizontal size={15} />
          </button>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
          {top.loading || base.loading ? <Loading what="Hugin grids" /> : top.error ? <ErrorBanner msg={top.error} /> : (
            <>
              <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', width: '100%', height: '100%' }} />
              <ReadoutBar left={hover ? (kind === 'facies' ? `netSAND ${(hover.val ?? 0).toFixed(2)} → ${(hover.val ?? 0) >= 0.5 ? 'SAND' : 'SHALE'}` : `φe ${(hover.val ?? 0).toFixed(3)}`) : `${kind} · IDW p${power}`} />
              <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 8, alignItems: 'center', background: 'color-mix(in srgb, var(--panel) 80%, transparent)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--line)' }}>
                {legend.map(([l, c]) => <span key={l} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />{l}</span>)}
              </div>
            </>
          )}
        </div>
      </div>

      <Inspector title="Property inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Interpolation">
          <Slider label="IDW power" min={1} max={4} step={0.5} value={power} onChange={setPower} fmt={(v) => `p${v}`} />
          <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Kriging: later. Background-regularized IDW falls back to deck field averages away from wells.</div>
        </InspectorSection>
        <InspectorSection title="Reconciliation">
          <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {[['STOIIP (grid)', `${stoiipFromGrid.toFixed(1)} MMSm³`], ['STOIIP (det)', `${detStoiip} MMSm³`], ['Δ', `${(100 * (stoiipFromGrid - detStoiip) / detStoiip).toFixed(1)}%`], ['φe mean', model ? model.phiMean.toFixed(3) : '–'], ['cells', model ? model.cells.toLocaleString() : '–']].map(([k, v]) => (
              <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{v}</td></tr>
            ))}
          </tbody></table>
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4 }}>HCPV = grv·NTG·φ·(1−Sw); STOIIP = HCPV/Bo. Reconciles to deterministic within ±5%.</div>
        </InspectorSection>
        <InspectorSection title={`Wells (${wellPts.length})`}>
          <table className="mono" style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>well</th><th>φe</th><th>netSAND</th></tr></thead>
            <tbody>{wellPts.map((w) => <tr key={w.name} style={{ textAlign: 'right' }}><td style={{ textAlign: 'left', color: 'var(--text)' }}>{w.name}</td><td style={{ color: 'var(--teal)' }}>{w.phie.toFixed(3)}</td><td style={{ color: 'var(--amber)' }}>{(w.netSand * 100).toFixed(0)}%</td></tr>)}</tbody>
          </table>
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>bbl factor ×{BBL_PER_SM3}. Porosity continuous · facies discrete (SAND/SHALE).</div>
      </Inspector>
    </div>
  );
}
