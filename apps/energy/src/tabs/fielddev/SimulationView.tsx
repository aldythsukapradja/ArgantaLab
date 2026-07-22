// SimulationView.tsx (S5) — the dynamic-simulation tab. Runs the FV oil-water
// IMPES engine (engine/sim/fv.ts) as a screening waterflood between a real Volve
// injector and producer, and ANIMATES the saturation front over time with a
// play/scrub timeline, plus live production curves (oil rate + water cut vs PVI)
// and recovery factor. Deterministic, mass-conservative, Buckley-Leverett-validated.
import { useMemo, useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Play, Pause, RotateCcw } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Slider, Loading, ErrorBanner, ReadoutBar } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex } from '../../wb/load';
import type { WbIndex } from '../../wb/types';
import { simulateFV } from '../../engine/sim/fv';
import { COREY_DEFAULTS } from '../../engine/sim/relperm';

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

  // build + run the waterflood (memoised on params)
  const sim = useMemo(() => {
    if (!inj || !prod) return null;
    // square-ish domain around the injector→producer pair (equal padding both axes
    // so the grid never blows up when the wells are nearly aligned on one axis)
    const span = Math.max(Math.abs(inj.x - prod.x), Math.abs(inj.y - prod.y)) + 1;
    const cxw = (inj.x + prod.x) / 2, cyw = (inj.y + prod.y) / 2, half = Math.max(span * 0.75, 900);
    const minX = cxw - half, maxX = cxw + half, minY = cyw - half, maxY = cyw + half;
    const nx = res, ny = res; // square grid — bounded, ≤ 40×40 cells
    const dx = (maxX - minX) / nx, dy = (maxY - minY) / ny;
    const toIJ = (x: number, y: number) => ({ i: Math.max(0, Math.min(nx - 1, Math.round((x - minX) / dx - 0.5))), j: Math.max(0, Math.min(ny - 1, Math.round((y - minY) / dy - 0.5))) });
    const iw = toIJ(inj.x, inj.y), pw = toIJ(prod.x, prod.y);
    const phi = new Float64Array(nx * ny).fill(d.phi);
    const k = new Float64Array(nx * ny).fill(RESERVOIR_K); // uniform → pattern is perm-independent
    const Vcell = dx * dy * 20, poreVol = d.phi * Vcell * nx * ny;
    const corey = { ...COREY_DEFAULTS, nw, no };
    const result = simulateFV({
      nx, ny, dx, dy, dz: 20, phi, k, muw: 0.5, muo: 0.5 * muRatio, corey,
      wells: [
        { i: iw.i, j: iw.j, mode: 'rate', rate: poreVol },              // ~1 PVI per unit time
        { i: pw.i, j: pw.j, mode: 'bhp', bhp: 100, WI: 1e5 },
      ],
    }, { tEnd: 1.2, nReports: 32, cfl: 0.35 });
    return { result, nx, ny, dx, dy, minX, minY, maxX, maxY, iw, pw, corey };
  }, [inj, prod, res, muRatio, nw, no, d.phi]);

  const nFrames = sim ? sim.result.snapshots.length : 0;
  const f = Math.min(frame, Math.max(0, nFrames - 1));
  const snap = sim ? sim.result.snapshots[f] : null;

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
    // wells
    const pin = (iw: { i: number; j: number }, col: string, label: string) => {
      const x = pad + (iw.i + 0.5) * cw, y = pad + (ny - 1 - iw.j + 0.5) * ch;
      ctx.fillStyle = col; ctx.strokeStyle = cssVar('--bg'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cssVar('--text'); ctx.font = '600 10px var(--mono)'; ctx.fillText(label, x + 7, y - 5);
    };
    pin(sim.iw, cssVar('--blue'), `▼ ${inj?.name ?? 'INJ'}`);
    pin(sim.pw, cssVar('--amber'), `▲ ${prod?.name ?? 'PROD'}`);
  }, [sim, snap, swColor, inj, prod]);

  const drawProd = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!sim) return;
    const snaps = sim.result.snapshots; const padL = 34, padB = 18, padT = 8, padR = 8;
    const pw = w - padL - padR, ph = h - padB - padT;
    const maxPvi = snaps[snaps.length - 1].pvi || 1;
    // oil rate (normalized) + water cut, both 0..1
    const q0 = Math.max(...snaps.map((s) => oilRateOf(s)), 1e-9);
    const x = (pvi: number) => padL + (pvi / maxPvi) * pw;
    const y = (v: number) => padT + ph - v * ph;
    ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ph); ctx.lineTo(padL + pw, padT + ph); ctx.stroke();
    ctx.fillStyle = cssVar('--muted'); ctx.font = '9px var(--mono)'; ctx.textAlign = 'right';
    ctx.fillText('1', padL - 3, padT + 4); ctx.fillText('0', padL - 3, padT + ph + 3);
    // oil rate (amber)
    ctx.strokeStyle = cssVar('--amber'); ctx.lineWidth = 1.5; ctx.beginPath();
    snaps.forEach((s, i) => { const px = x(s.pvi), py = y(oilRateOf(s) / q0); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
    // water cut (blue)
    ctx.strokeStyle = cssVar('--blue'); ctx.lineWidth = 1.5; ctx.beginPath();
    snaps.forEach((s, i) => { const px = x(s.pvi), py = y(s.waterCut); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
    // playhead
    if (snap) { const px = x(snap.pvi); ctx.strokeStyle = cssVar('--text'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + ph); ctx.stroke(); ctx.setLineDash([]); }
    ctx.textAlign = 'left'; ctx.fillStyle = cssVar('--amber'); ctx.fillText('oil rate', padL + 4, padT + 9); ctx.fillStyle = cssVar('--blue'); ctx.fillText('water cut', padL + 52, padT + 9);
    ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'center'; ctx.fillText('PVI', padL + pw / 2, h - 4);
  }, [sim, snap]);

  const mapC = useCanvas(drawMap, [drawMap]);
  const prodC = useCanvas(drawProd, [drawProd]);

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
          <span className="chip" style={{ color: 'var(--muted)' }}>oil-water IMPES · Buckley-Leverett-validated</span>
          <NatureBadge nature="scenario" />
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}><SlidersHorizontal size={15} /></button>
        </div>

        {!sim ? <Loading what="running waterflood (IMPES)" /> : (
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
            <div ref={prodC.wrapRef} style={{ flex: 1, minHeight: 90, position: 'relative', overflow: 'hidden', borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
              <canvas ref={prodC.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
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
