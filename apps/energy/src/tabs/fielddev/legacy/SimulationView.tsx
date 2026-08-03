// SimulationView.tsx (S5) — the dynamic-simulation tab. Runs the FV oil-water
// IMPES engine (engine/sim/fv.ts) as a screening waterflood between a real Volve
// injector and producer, and ANIMATES the saturation front over time with a
// play/scrub timeline, plus live production curves (oil rate + water cut vs PVI)
// and recovery factor. Deterministic, mass-conservative, Buckley-Leverett-validated.
import { useMemo, useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { SlidersHorizontal, Play, Pause, RotateCcw, Waypoints, Box, Square } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from '../hooks';
import { Inspector, InspectorSection, Slider, Loading, ErrorBanner, ReadoutBar } from '../chrome';
import { NatureBadge } from '../../../components/Provenance';
import { loadIndex, loadSurface } from '../../../wb/load';
import type { WbIndex } from '../../../wb/types';
import { sampleGrid } from '../../../engine/grid';
import type { FvCfg, FvResult } from '../../../engine/sim/fv';
import { traceStreamlines } from '../../../engine/sim/streamline';
import { COREY_DEFAULTS } from '../../../engine/sim/relperm';
import { packSimFrames } from '../../../engine/pack-sim';
import { ProductionChartView } from './ProductionChartView';
const SimDrape = lazy(() => import('./SimDrape')); // G5 lightweight 3D HC-flow drape

const RESERVOIR_K = 500; // mD — screening Volve-scale (uniform; the flood pattern is
                         // perm-independent for a homogeneous field, so magnitude is display-only)
/** Auto-scaled reservoir-volume label (rm³ / 10³ / 10⁶ / 10⁹). */
function volFmt(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}·10⁹ rm³`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}·10⁶ rm³`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}·10³ rm³`;
  return `${v.toFixed(0)} rm³`;
}

export function SimulationView() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  if (idx.loading) return <Loading what="simulation setup" />;
  if (idx.error || !idx.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} />;
}

function Inner({ index }: { index: WbIndex }) {
  const d = index.defaults;
  const [res, setRes] = useState(26);        // areal grid resolution
  const [muRatio, setMuRatio] = useState(6); // oil/water viscosity ratio (mobility)
  const [nw, setNw] = useState(3);
  const [no, setNo] = useState(2);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showStreams, setShowStreams] = useState(false);
  const [view3d, setView3d] = useState(true); // 3D-first (the 2D dual-canvas is now a toggle)
  const [inspOpen, setInspOpen] = useState(true);

  // pick a real injector + producer from the well set
  const { inj, prod } = useMemo(() => {
    const ws = index.wells.filter((w) => isFinite(w.x) && isFinite(w.y));
    const inj = ws.find((w) => w.role === 'injector') ?? ws.find((w) => w.role === 'both');
    const prods = ws.filter((w) => w.role === 'producer');
    // producer farthest from the injector → a clean sweep
    let prod = prods[0];
    if (inj && prods.length) prod = prods.reduce((best, w) => ((w.x - inj.x) ** 2 + (w.y - inj.y) ** 2) > ((best.x - inj.x) ** 2 + (best.y - inj.y) ** 2) ? w : best, prods[0]);
    return { inj, prod };
  }, [index]);

  // build the waterflood CONFIG synchronously (cheap) — the heavy solve runs in a worker
  const simCfg = useMemo(() => {
    if (!inj || !prod) return null;
    // square-ish domain around the injector→producer pair (equal padding both axes)
    const span = Math.max(Math.abs(inj.x - prod.x), Math.abs(inj.y - prod.y)) + 1;
    const cxw = (inj.x + prod.x) / 2, cyw = (inj.y + prod.y) / 2, half = Math.max(span * 0.75, 900);
    const minX = cxw - half, maxX = cxw + half, minY = cyw - half, maxY = cyw + half;
    const nx = res, ny = res;
    const dx = (maxX - minX) / nx, dy = (maxY - minY) / ny;
    const toIJ = (x: number, y: number) => ({ i: Math.max(0, Math.min(nx - 1, Math.round((x - minX) / dx - 0.5))), j: Math.max(0, Math.min(ny - 1, Math.round((y - minY) / dy - 0.5))) });
    const iw = toIJ(inj.x, inj.y), pw = toIJ(prod.x, prod.y);
    const phi = new Float64Array(nx * ny).fill(d.phi);
    const k = new Float64Array(nx * ny).fill(RESERVOIR_K);
    const Vcell = dx * dy * 20, poreVol = d.phi * Vcell * nx * ny;
    const corey = { ...COREY_DEFAULTS, nw, no };
    const fvCfg: FvCfg = {
      nx, ny, dx, dy, dz: 20, phi, k, muw: 0.5, muo: 0.5 * muRatio, corey,
      wells: [{ i: iw.i, j: iw.j, mode: 'rate', rate: poreVol }, { i: pw.i, j: pw.j, mode: 'bhp', bhp: 100, WI: 1e5 }],
    };
    return { fvCfg, fvOpts: { tEnd: 1.2, nReports: 32, cfl: 0.35 }, nx, ny, dx, dy, minX, minY, maxX, maxY, iw, pw, corey };
  }, [inj, prod, res, muRatio, nw, no, d.phi]);

  // heavy solve OFF the main thread — Simulation tab now paints instantly
  const [simResult, setSimResult] = useState<FvResult | null>(null);
  useEffect(() => {
    if (!simCfg) { setSimResult(null); return; }
    setSimResult(null);
    const w = new Worker(new URL('../../../workers/sim.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ ok: boolean; result?: FvResult }>) => { if (e.data.ok && e.data.result) setSimResult(e.data.result); w.terminate(); };
    w.postMessage({ cfg: simCfg.fvCfg, opts: simCfg.fvOpts });
    return () => w.terminate();
  }, [simCfg]);

  const sim = useMemo(() => (simCfg && simResult ? { result: simResult, nx: simCfg.nx, ny: simCfg.ny, dx: simCfg.dx, dy: simCfg.dy, minX: simCfg.minX, minY: simCfg.minY, maxX: simCfg.maxX, maxY: simCfg.maxY, iw: simCfg.iw, pw: simCfg.pw, corey: simCfg.corey } : null), [simCfg, simResult]);
  const nFrames = sim ? sim.result.snapshots.length : 0;

  // ── 3D HC-flow (G5): pack the Sw frame sequence + drape on the real Hugin top ──
  const huginTop = useAsync(() => loadSurface('hugin_top'), []);
  const simPack = useMemo(() => (sim ? packSimFrames(sim.result.snapshots.map((s) => s.sw), { nx: sim.nx, ny: sim.ny }) : null), [sim]);
  const simGrid = sim ? { nx: sim.nx, ny: sim.ny, dx: sim.dx, dy: sim.dy, x0: sim.minX, y0: sim.minY } : null;
  const zAt = useMemo(() => { const g = huginTop.data; return g ? (x: number, y: number) => sampleGrid(g, x, y) : undefined; }, [huginTop.data]);
  const f = Math.min(frame, Math.max(0, nFrames - 1));
  const snap = sim ? sim.result.snapshots[f] : null;

  // streamlines from the current snapshot's flux field (unit-cell geom → pts in
  // cell coords for direct canvas mapping). The streamline twin shares this exact
  // flux field the FV pressure solve produced (S6).
  const streams = useMemo(() => {
    if (!sim || !snap || !showStreams) return null;
    return traceStreamlines(
      { nx: sim.nx, ny: sim.ny, dx: 1, dy: 1, dz: 1, phi: new Float64Array(sim.nx * sim.ny).fill(d.phi) },
      snap.fluxX, snap.fluxY,
      [{ i: sim.iw.i, j: sim.iw.j, name: inj?.name ?? 'INJ', kind: 'inj' }, { i: sim.pw.i, j: sim.pw.j, name: prod?.name ?? 'PROD', kind: 'prod' }],
      { perInjector: 40 },
    );
  }, [sim, snap, showStreams, d.phi, inj, prod]);

  // animation loop
  useEffect(() => {
    if (!playing || nFrames === 0) return;
    const id = setInterval(() => setFrame((p) => (p + 1) % nFrames), 90);
    return () => clearInterval(id);
  }, [playing, nFrames]);
  useEffect(() => { setFrame(0); }, [sim]);

  // saturation ramp: oil (low Sw) amber → water (high Sw) blue
  const swColor = useCallback((sw: number, e: { swc: number; sor: number }) => {
    const t = Math.max(0, Math.min(1, (sw - e.swc) / (1 - e.swc - e.sor)));
    const oil = [225, 174, 72], water = [98, 174, 247];
    return `rgb(${(oil[0] + (water[0] - oil[0]) * t) | 0},${(oil[1] + (water[1] - oil[1]) * t) | 0},${(oil[2] + (water[2] - oil[2]) * t) | 0})`;
  }, []);

  const drawMap = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!sim || !snap) return;
    const { nx, ny } = sim;
    const pad = 8; const cw = (w - 2 * pad) / nx, ch = (h - 2 * pad) / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      ctx.fillStyle = swColor(snap.sw[j * nx + i], sim.corey);
      ctx.fillRect(pad + i * cw, pad + (ny - 1 - j) * ch, cw + 0.5, ch + 0.5);
    }
    // streamlines (cell-coord pts → canvas; y-flipped). Reached-producer = teal.
    if (streams) {
      ctx.lineWidth = 0.9;
      for (const sl of streams.lines) {
        if (sl.pts.length < 2) continue;
        ctx.strokeStyle = sl.toWell ? 'rgba(80,208,177,0.55)' : 'rgba(200,200,210,0.28)';
        ctx.beginPath();
        sl.pts.forEach(([x, y], idx) => { const cx = pad + x * cw, cy = pad + (ny - y) * ch; idx ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); });
        ctx.stroke();
      }
    }
    // wells
    const pin = (iw: { i: number; j: number }, col: string, label: string) => {
      const x = pad + (iw.i + 0.5) * cw, y = pad + (ny - 1 - iw.j + 0.5) * ch;
      ctx.fillStyle = col; ctx.strokeStyle = cssVar('--bg'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cssVar('--text'); ctx.font = `600 10px ${cssVar('--mono')}`; ctx.fillText(label, x + 7, y - 5);
    };
    pin(sim.iw, cssVar('--blue'), `▼ ${inj?.name ?? 'INJ'}`);
    pin(sim.pw, cssVar('--amber'), `▲ ${prod?.name ?? 'PROD'}`);
  }, [sim, snap, swColor, inj, prod, streams]);

  const mapC = useCanvas(drawMap, [drawMap]);

  // production series for the D3 chart (1e) — oil rate + water cut vs PVI
  const prodData = useMemo(() => (sim ? sim.result.snapshots.map((s) => ({ pvi: s.pvi, oilRate: oilRateOf(s), waterCut: s.waterCut })) : []), [sim]);
  const seekToPvi = useCallback((pvi: number) => {
    if (!sim) return;
    const snaps = sim.result.snapshots;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < snaps.length; i++) { const d = Math.abs(snaps[i].pvi - pvi); if (d < bestD) { bestD = d; best = i; } }
    setPlaying(false); setFrame(best);
  }, [sim]);

  const rf = sim && snap ? snap.cumOil / sim.result.ooip : 0;

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <button onClick={() => setPlaying((p) => !p)} title={playing ? 'Pause' : 'Play'} style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--teal)', background: 'var(--panel-2)', color: 'var(--teal)' }}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
          <button onClick={() => { setFrame(0); setPlaying(true); }} title="Restart" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}><RotateCcw size={15} /></button>
          <span className="chip mono" style={{ color: 'var(--teal)', borderColor: 'var(--teal)' }}>PVI {snap ? snap.pvi.toFixed(2) : '–'}</span>
          <span className="chip mono" style={{ color: 'var(--amber)', borderColor: 'var(--amber)' }}>RF {(rf * 100).toFixed(1)}%</span>
          <span className="chip mono" style={{ color: 'var(--blue)' }}>WC {snap ? (snap.waterCut * 100).toFixed(0) : '0'}%</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowStreams((s) => !s)} title="Streamlines (flux diagnostics)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 9px', borderRadius: 4, border: `1px solid ${showStreams ? 'var(--teal)' : 'var(--line)'}`, background: 'var(--panel-2)', color: showStreams ? 'var(--teal)' : 'var(--muted)', fontSize: 11 }}>
            <Waypoints size={14} /><span className="mono">SL</span>
          </button>
          <button onClick={() => setView3d((v) => !v)} title="2D map / 3D HC-flow"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 9px', borderRadius: 4, border: `1px solid ${view3d ? 'var(--teal)' : 'var(--line)'}`, background: 'var(--panel-2)', color: view3d ? 'var(--teal)' : 'var(--muted)', fontSize: 11 }}>
            {view3d ? <Box size={14} /> : <Square size={14} />}<span className="mono">{view3d ? '3D' : '2D'}</span>
          </button>
          <span className="chip" style={{ color: 'var(--muted)' }}>oil-water IMPES · Buckley-Leverett-validated</span>
          <NatureBadge nature="scenario" />
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}><SlidersHorizontal size={15} /></button>
        </div>

        {!sim ? <Loading what="running waterflood (IMPES)" /> : view3d && simPack && simGrid ? (
          <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
            <Suspense fallback={<Loading what="3D HC-flow drape" />}>
              <SimDrape pack={simPack} grid={simGrid} zAt={zAt} owc={index.contacts[0]?.tvdss ?? 3200}
                wells={index.wells.filter((w) => isFinite(w.x) && isFinite(w.y)).map((w) => ({ name: w.name, x: w.x, y: w.y, role: w.role }))}
                injName={inj?.name} prodName={prod?.name} />
            </Suspense>
            <ReadoutBar left={`3D HC-flow · ${inj?.name ?? 'inj'} → ${prod?.name ?? 'prod'} · draped on Hugin top · one texture/frame`} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div ref={mapC.wrapRef} style={{ flex: 1.6, minHeight: 100, position: 'relative', overflow: 'hidden' }}>
              <canvas ref={mapC.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
              <ReadoutBar left={`Sw front · ${inj?.name ?? 'inj'} → ${prod?.name ?? 'prod'} · ${sim.nx}×${sim.ny} · screening waterflood`} />
              <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 8, alignItems: 'center', background: 'color-mix(in srgb, var(--panel) 80%, transparent)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--line)' }}>
                {([['oil', 'rgb(225,174,72)'], ['water', 'rgb(98,174,247)']] as const).map(([l, c]) => <span key={l} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />{l}</span>)}
              </div>
            </div>
            {/* timeline scrubber */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', borderTop: '1px solid var(--line)', fontSize: 10.5, color: 'var(--muted)' }}>
              <span className="mono">t</span>
              <input type="range" min={0} max={Math.max(0, nFrames - 1)} step={1} value={f} onChange={(e) => { setPlaying(false); setFrame(parseInt(e.target.value)); }} style={{ flex: 1, accentColor: 'var(--teal)' }} />
              <span className="mono" style={{ color: 'var(--text)' }}>{f + 1}/{nFrames}</span>
            </div>
            <div style={{ flex: 1, minHeight: 90, position: 'relative', overflow: 'hidden', borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
              <ProductionChartView data={prodData} playheadPvi={snap?.pvi ?? null} onScrub={seekToPvi} />
            </div>
          </div>
        )}
      </div>

      <Inspector title="Simulation inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Run">
          <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {[['injector', inj?.name ?? '–'], ['producer', prod?.name ?? '–'], ['grid', sim ? `${sim.nx}×${sim.ny}` : '–'], ['OOIP', sim ? volFmt(sim.result.ooip) : '–'], ['RF @1.2PVI', `${(rf * 100).toFixed(1)}%`]].map(([k, v]) => <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{v}</td></tr>)}
          </tbody></table>
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4 }}>Water injected at ~1 PVI/unit-time; producer on BHP. Screening — not a history match.</div>
        </InspectorSection>
        {streams && (
          <InspectorSection title="Streamline diagnostics (S6)">
            <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
              {Object.entries(streams.allocation).map(([k, v]) => <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--teal)' }}>{(v * 100).toFixed(0)}%</td></tr>)}
              <tr><td style={{ color: 'var(--muted)' }}>streamlines</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{streams.lines.length}</td></tr>
            </tbody></table>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4 }}>Pollock tracing on the SAME pressure solve → injector→producer allocation (the flux lens the cell field can't show).</div>
          </InspectorSection>
        )}
        <InspectorSection title="Fluids (Corey)">
          <Slider label="Oil/water μ ratio" min={1} max={20} step={1} value={muRatio} onChange={setMuRatio} fmt={(v) => `${v}×`} />
          <Slider label="Water exponent nw" min={2} max={6} step={1} value={nw} onChange={setNw} fmt={(v) => `${v}`} />
          <Slider label="Oil exponent no" min={2} max={5} step={1} value={no} onChange={setNo} fmt={(v) => `${v}`} />
          <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Higher μ ratio → less favourable mobility → earlier breakthrough, lower sweep.</div>
        </InspectorSection>
        <InspectorSection title="Grid">
          <Slider label="Areal resolution" min={16} max={40} step={2} value={res} onChange={setRes} fmt={(v) => `${v}`} />
          <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>φ {d.phi} · k {RESERVOIR_K} mD (screening, homogeneous). IMPES + CFL sub-stepping.</div>
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Two-phase oil-water · mass-conservative · S6 will add the streamline twin on the same pressure solve.</div>
      </Inspector>
    </div>
  );
}

// oil rate at a snapshot = total production − water produced (per unit time proxy:
// use the producer's total rate × oil fraction). Uses wellRate + waterCut.
function oilRateOf(s: { wellRate: number[]; waterCut: number }): number {
  const prod = s.wellRate.filter((r) => r > 0).reduce((a, r) => a + r, 0);
  return prod * (1 - s.waterCut);
}
