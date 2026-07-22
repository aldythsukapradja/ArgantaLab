// Uncertainty.tsx (V1c) — editable PERT/triangular parameter rows → 10,000 seeded
// Monte-Carlo (fixed seed 20260722, reproducible) → histogram + CDF with
// P90/P50/P10 flags (oil convention) + tornado (sorted |Pearson r|, low/high bars).
// Oil (STOIIP·RF) / gas (GIIP·RF) switch.
import { useMemo, useState, useCallback } from 'react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, Loading, ErrorBanner, withAlpha } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadSurface } from '../../wb/load';
import type { WbIndex } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { grvClosure, stoiip, giip } from '../../engine/volumetrics';
import { monteCarlo, tornado, type McInput, type DistKind } from '../../engine/mc';

const SEED = 20260722;
const N = 10000;

type Case = 'oil' | 'gas';

interface Row extends McInput { }

const oilRows = (d: WbIndex['defaults'], bo: number): Row[] => [
  { key: 'grvMult', label: 'GRV multiplier', dist: 'pert', min: 0.75, mode: 1.0, max: 1.25 },
  { key: 'ntg', label: 'NTG', dist: 'pert', min: d.ntg - 0.15, mode: d.ntg, max: Math.min(1, d.ntg + 0.05) },
  { key: 'phie', label: 'PHIE', dist: 'pert', min: d.phi - 0.05, mode: d.phi, max: d.phi + 0.04 },
  { key: 'sw', label: 'Sw', dist: 'pert', min: Math.max(0, d.sw - 0.08), mode: d.sw, max: d.sw + 0.12 },
  { key: 'bo', label: 'Bo', dist: 'triangular', min: bo - 0.07, mode: bo, max: bo + 0.07 },
  { key: 'owc', label: 'OWC (m)', dist: 'triangular', min: 3160, mode: 3200, max: 3240 },
  { key: 'rf', label: 'Recovery factor', dist: 'pert', min: 0.40, mode: 0.50, max: 0.58 },
];
const gasExtra = (): Row => ({ key: 'bg', label: 'Bg (rm³/Sm³)', dist: 'triangular', min: 0.0035, mode: 0.0040, max: 0.0046 });

export function Uncertainty() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const top = useAsync<SurfaceJson>(() => loadSurface('hugin_top'), []);
  const base = useAsync<SurfaceJson>(() => loadSurface('hugin_base'), []);
  if (idx.loading || top.loading || base.loading) return <Loading what="uncertainty inputs" />;
  if (idx.error || !idx.data || !top.data || !base.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} top={top.data} base={base.data} />;
}

function Inner({ index, top, base }: { index: WbIndex; top: SurfaceJson; base: SurfaceJson }) {
  const d = index.defaults, bo = index.pvt.Bo;
  const [fill, setFill] = useState<Case>('oil');
  const [inspOpen, setInspOpen] = useState(true);
  const [rows, setRows] = useState<Row[]>(() => oilRows(d, bo));

  // GRV(owc) lookup so MC stays fast (no 10k flood-fills)
  const grvLut = useMemo(() => {
    const xs: number[] = [], ys: number[] = [];
    for (let owc = 3000; owc <= 3400; owc += 10) { xs.push(owc); ys.push(grvClosure(top, base, owc, top.cell).grv); }
    return { xs, ys };
  }, [top, base]);
  const grvAt = useCallback((owc: number) => {
    const { xs, ys } = grvLut;
    if (owc <= xs[0]) return ys[0]; if (owc >= xs[xs.length - 1]) return ys[ys.length - 1];
    const i = Math.min(xs.length - 2, Math.floor((owc - xs[0]) / 10));
    const t = (owc - xs[i]) / (xs[i + 1] - xs[i]);
    return ys[i] + (ys[i + 1] - ys[i]) * t;
  }, [grvLut]);

  const activeRows = useMemo(() => fill === 'gas' ? [...rows.filter((r) => r.key !== 'bo'), gasExtra()] : rows, [rows, fill]);

  const mc = useMemo(() => {
    const fn = (v: Record<string, number>) => {
      const grv = grvAt(v.owc) * v.grvMult;
      if (fill === 'oil') return stoiip(grv, v.ntg, v.phie, v.sw, v.bo ?? bo) * v.rf / 1e6; // MMSm³ recoverable
      return giip(grv, v.ntg, v.phie, v.sw, v.bg ?? 0.0040) * v.rf / 1e9; // BSm³ recoverable
    };
    return monteCarlo(activeRows, fn, N, SEED);
  }, [activeRows, grvAt, fill, bo]);

  const tor = useMemo(() => tornado(mc, activeRows), [mc, activeRows]);
  const unit = fill === 'oil' ? 'MMSm³' : 'BSm³';

  // histogram + CDF
  const drawHist = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const data = mc.realizations; const lo = data[0], hi = data[data.length - 1];
    const nb = 40; const bins = new Array(nb).fill(0);
    for (const v of data) { const b = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * nb))); bins[b]++; }
    const maxB = Math.max(...bins);
    const padL = 44, padB = 26, padT = 14, padR = 44;
    const plotW = w - padL - padR, plotH = h - padB - padT;
    const x = (v: number) => padL + (v - lo) / (hi - lo) * plotW;
    // histogram bars
    for (let i = 0; i < nb; i++) { const bx = padL + (i / nb) * plotW, bw = plotW / nb; const bh = (bins[i] / maxB) * plotH; ctx.fillStyle = withAlpha(cssVar('--teal'), 0.55); ctx.fillRect(bx, padT + plotH - bh, bw - 1, bh); }
    // CDF
    ctx.strokeStyle = cssVar('--amber'); ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < data.length; i += Math.max(1, (data.length / 300) | 0)) { const cy = padT + plotH - (i / data.length) * plotH; const cx = x(data[i]); i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy); }
    ctx.stroke();
    // P90/P50/P10 flags
    const flags: Array<[string, number, string]> = [['P90', mc.p90, cssVar('--blue')], ['P50', mc.p50, cssVar('--text')], ['P10', mc.p10, cssVar('--rose')]];
    ctx.font = '9px var(--mono)';
    for (const [lab, val, col] of flags) { const px = x(val); ctx.strokeStyle = col; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + plotH); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(`${lab} ${val.toFixed(1)}`, px, padT - 3); }
    // axes
    ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'center'; ctx.fillText(unit, padL + plotW / 2, h - 4);
    ctx.textAlign = 'right'; ctx.fillStyle = cssVar('--amber'); ctx.fillText('CDF 100%', w - 4, padT + 8); ctx.fillText('0%', w - 4, padT + plotH);
  }, [mc, unit]);

  const drawTornado = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const bars = tor; const padL = 96, padR = 40, padT = 10;
    const rowH = Math.min(30, (h - padT - 10) / Math.max(1, bars.length));
    const base50 = mc.p50; const allO = bars.flatMap((b) => [b.lowOut, b.highOut]); const lo = Math.min(base50, ...allO), hi = Math.max(base50, ...allO);
    const plotW = w - padL - padR; const x = (v: number) => padL + (v - lo) / Math.max(1e-6, hi - lo) * plotW;
    const cx = x(base50);
    ctx.strokeStyle = cssVar('--muted'); ctx.setLineDash([3, 3]); ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + bars.length * rowH); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '10px var(--mono)';
    bars.forEach((b, i) => {
      const y = padT + i * rowH + rowH / 2; const x1 = x(Math.min(b.lowOut, b.highOut)), x2 = x(Math.max(b.lowOut, b.highOut));
      ctx.fillStyle = b.r >= 0 ? withAlpha(cssVar('--teal'), 0.7) : withAlpha(cssVar('--rose'), 0.7);
      ctx.fillRect(x1, y - rowH * 0.3, Math.max(2, x2 - x1), rowH * 0.6);
      ctx.fillStyle = cssVar('--text'); ctx.textAlign = 'right'; ctx.fillText(b.label, padL - 6, y + 3);
      ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'left'; ctx.fillText(`r=${b.r.toFixed(2)}`, x2 + 4, y + 3);
    });
  }, [tor, mc]);

  const hist = useCanvas(drawHist, [drawHist]);
  const torn = useCanvas(drawTornado, [drawTornado]);

  const editRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => r.key === key ? { ...r, ...patch } : r));

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={[{ id: 'oil' as const, label: 'Oil STOIIP·RF' }, { id: 'gas' as const, label: 'Gas GIIP·RF' }]} value={fill} onChange={setFill} accent="--amber" />
          <span className="chip" style={{ color: 'var(--muted)' }}>{N.toLocaleString()} realizations · seed {SEED} · reproducible</span>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--text)' }}>P90 {mc.p90.toFixed(1)} · P50 {mc.p50.toFixed(1)} · P10 {mc.p10.toFixed(1)} {unit}</span>
          <NatureBadge nature="derived" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '4px 10px', fontSize: 10.5, color: 'var(--muted)' }} className="eyebrow">Histogram + CDF</div>
            <div ref={hist.wrapRef} style={{ flex: 1, minHeight: 120, position: 'relative' }}><canvas ref={hist.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} /></div>
          </div>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '4px 10px', fontSize: 10.5, color: 'var(--muted)' }} className="eyebrow">Tornado — |Pearson r| sorted</div>
            <div ref={torn.wrapRef} style={{ flex: 1, minHeight: 120, position: 'relative' }}><canvas ref={torn.canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} /></div>
          </div>
        </div>
      </div>

      <Inspector title="Uncertainty inputs" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Distributions (min · mode · max)">
          {activeRows.map((r) => {
            const editable = fill === 'oil' || r.key !== 'bg'; // bg row is synthetic in gas but still editable via rows? keep read-only for gas-only extra
            return (
              <div key={r.key} style={{ marginBottom: 10, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>{r.label}</span>
                  <select value={r.dist} disabled={r.key === 'bg' && fill === 'gas'} onChange={(e) => editRow(r.key, { dist: e.target.value as DistKind })} style={{ fontSize: 10, background: 'var(--panel-2)', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 3 }}>
                    <option value="pert">PERT</option><option value="triangular">Triangular</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['min', 'mode', 'max'] as const).map((f) => (
                    <input key={f} type="number" step="any" value={r[f]} disabled={r.key === 'bg' && fill === 'gas'}
                      onChange={(e) => editRow(r.key, { [f]: parseFloat(e.target.value) } as Partial<Row>)}
                      style={{ width: '33%', padding: '3px 4px', fontSize: 10, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: editable ? 'var(--text)' : 'var(--muted)' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </InspectorSection>
        <InspectorSection title="Result">
          <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {[['P90 (pct10)', mc.p90], ['P50', mc.p50], ['P10 (pct90)', mc.p10], ['mean', mc.mean]].map(([k, v]) => <tr key={k as string}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{(v as number).toFixed(2)} {unit}</td></tr>)}
          </tbody></table>
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 6 }}>Fixed seed {SEED} → identical P50 across reloads. Oil convention: P90 ≤ P50 ≤ P10.</div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}
