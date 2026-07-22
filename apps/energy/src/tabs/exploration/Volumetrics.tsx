// Volumetrics — exploration in-place volumes: deterministic area-depth GRV → STOIIP
// on the REAL Hugin closure (measured/derived), and a seeded Monte-Carlo over the
// selected prospect's uncertain inputs → P90/P50/P10 recoverable + tornado (scenario).
// The founder's spec: "GRV and area-depth relation · contacts · P90/P50/P10 · run
// deterministic · run Monte Carlo · compare cases" (COSMO TAB_SPECS.exploration).
import { useMemo, useState, useCallback } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from '../fielddev/hooks';
import { Inspector, InspectorSection, Segmented, Slider, Loading, ErrorBanner, ReadoutBar } from '../fielddev/chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadSurface } from '../../wb/load';
import type { WbIndex } from '../../wb/types';
import type { SurfaceJson } from '../../engine/grid';
import { gridBounds, gridMinMax } from '../../engine/grid';
import { makeView, padBounds } from '../../engine/view';
import { contactPolygon } from '../../engine/closure';
import { grvClosure, stoiip } from '../../engine/volumetrics';
import { monteCarlo, tornado, type McInput } from '../../engine/mc';
import { riskedResource, gcos, GCOS_ELEMENTS } from '../../engine/explore';
import type { ExplSel } from '../../cosmo/ExplorationExplorer';
import { drawSurface, drawRing } from './explDraw';
import { PROSPECTS, toMMbbl, CITATIONS } from './explData';

const fmtV = (sm3: number) => `${(sm3 / 1e6).toFixed(1)} MMSm³`;
const fmtB = (sm3: number) => `${toMMbbl(sm3).toFixed(0)} MMbbl`;

export function ExplVolumetrics({ sel, setSel }: { sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const top = useAsync<SurfaceJson>(() => loadSurface('hugin_top'), []);
  const base = useAsync<SurfaceJson>(() => loadSurface('hugin_base'), []);
  if (idx.loading || top.loading || base.loading) return <Loading what="Hugin volumetrics" />;
  if (idx.error || !idx.data || !top.data || !base.data) return <ErrorBanner msg={idx.error || top.error || 'surfaces unavailable'} />;
  return <Inner index={idx.data} top={top.data} base={base.data} sel={sel} setSel={setSel} />;
}

function Inner({ index, top, base, sel, setSel }: { index: WbIndex; top: SurfaceJson; base: SurfaceJson; sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const pid = sel?.folder === 'prospects' ? sel.id : 'volve';
  const prospect = PROSPECTS.find((p) => p.id === pid) ?? PROSPECTS[0];
  const [owc, setOwc] = useState(index.contacts[0]?.tvdss ?? 3200);
  const [n, setN] = useState(10000);
  const [inspOpen, setInspOpen] = useState(true);

  // deterministic area-depth GRV on the real Hugin closure at the chosen contact
  const grvDet = useMemo(() => grvClosure(top, base, owc, top.cell), [top, base, owc]);
  const stDet = stoiip(grvDet.grv, index.defaults.ntg, index.defaults.phi, index.defaults.sw, index.pvt.Bo);

  // POS + risked Monte-Carlo for the selected prospect (scenario)
  const pos = useMemo(() => gcos(GCOS_ELEMENTS.map((e) => ({ p: prospect.gcos[e.key] }))), [prospect]);
  const mc = prospect.mc;
  const risked = useMemo(() => riskedResource(mc, pos, n, 4242), [mc, pos, n]);
  const tor = useMemo(() => {
    const inputs: McInput[] = [mc.grv, mc.ntg, mc.phi, mc.sw, mc.rf];
    const res = monteCarlo(inputs, (v) => stoiip(v[mc.grv.key], v[mc.ntg.key], v[mc.phi.key], v[mc.sw.key], mc.bo) * v[mc.rf.key], n, 4242);
    return tornado(res, inputs);
  }, [mc, n]);

  const bounds = useMemo(() => padBounds(gridBounds(top), 0.06), [top]);
  const minmax = useMemo(() => gridMinMax(top), [top]);
  const ring = useMemo(() => { try { return contactPolygon(top, owc); } catch { return null; } }, [top, owc]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const view = makeView(bounds, w, h, 26);
    drawSurface(ctx, view, top, minmax, owc);
    if (ring?.ring?.length) drawRing(ctx, view, ring.ring);
  }, [bounds, top, minmax, owc, ring]);
  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  // recoverable histogram (second canvas)
  const drawHist = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const data = risked.recoverable.realizations; if (!data.length) return;
    const lo = data[0], hi = data[data.length - 1]; const bins = 40; const counts = new Array(bins).fill(0);
    for (const v of data) { const b = Math.min(bins - 1, Math.floor(((v - lo) / Math.max(1e-9, hi - lo)) * bins)); counts[b]++; }
    const cmax = Math.max(...counts); const pad = 6; const bw = (w - pad * 2) / bins;
    ctx.fillStyle = cssVar('--cyan'); ctx.globalAlpha = 0.55;
    counts.forEach((c, i) => { const bh = (c / cmax) * (h - pad * 2); ctx.fillRect(pad + i * bw, h - pad - bh, bw - 1, bh); });
    ctx.globalAlpha = 1;
    for (const [val, col] of [[risked.recoverable.p90, '--amber'], [risked.recoverable.p50, '--ink'], [risked.recoverable.p10, '--green']] as const) {
      const x = pad + ((val - lo) / Math.max(1e-9, hi - lo)) * (w - pad * 2);
      ctx.strokeStyle = cssVar(col); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    }
  }, [risked]);
  const { canvasRef: histRef, wrapRef: histWrap } = useCanvas(drawHist, [drawHist]);

  const Card = ({ t, v, s, nat }: { t: string; v: string; s: string; nat: 'derived' | 'scenario' }) => (
    <div className="panel" style={{ padding: '9px 13px', minWidth: 132, flex: 1 }}>
      <div className="eyebrow" style={{ marginBottom: 3 }}>{t}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{v}</div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s}</div>
      <div style={{ marginTop: 5 }}><NatureBadge nature={nat} /></div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={PROSPECTS.map((p) => ({ id: p.id, label: p.name.split(' ')[0] }))} value={prospect.id} onChange={(id) => setSel({ folder: 'prospects', id })} accent="--cyan" />
          <div style={{ flex: 1 }} />
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}><SlidersHorizontal size={15} /></button>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          <ReadoutBar left={`Hugin closure · OWC ${owc} m · GRV ${(grvDet.grv / 1e6).toFixed(0)} Mm³ · ${grvDet.cells} cells`} />
        </div>
        {/* MC distribution + cards */}
        <div style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)', padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="eyebrow">Recoverable distribution · {n.toLocaleString()} realizations · POS {(pos * 100).toFixed(0)}%</div>
          </div>
          <div ref={histWrap} style={{ height: 84, position: 'relative', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <canvas ref={histRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Card t="Deterministic STOIIP" v={fmtV(stDet)} s={`${fmtB(stDet)} · full Hugin closure`} nat="derived" />
            <Card t="P90 recoverable" v={fmtV(risked.recoverable.p90)} s={fmtB(risked.recoverable.p90)} nat="scenario" />
            <Card t="P50 recoverable" v={fmtV(risked.recoverable.p50)} s={fmtB(risked.recoverable.p50)} nat="scenario" />
            <Card t="P10 recoverable" v={fmtV(risked.recoverable.p10)} s={fmtB(risked.recoverable.p10)} nat="scenario" />
            <Card t="Risked mean (×POS)" v={fmtV(risked.riskedMean)} s={fmtB(risked.riskedMean)} nat="scenario" />
          </div>
        </div>
      </div>

      <Inspector title="Volumetrics inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Contact (area-depth)">
          <Slider label="Oil–water contact" min={3000} max={3350} step={5} value={owc} onChange={setOwc} fmt={(v) => `${v} m TVDSS`} />
          <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Deck OWC {index.contacts[0]?.tvdss ?? 3200} m · crest-connected flood-fill of the real Hugin grids.</div>
        </InspectorSection>
        <InspectorSection title="Monte-Carlo">
          <Segmented options={[{ id: '2000', label: '2k' }, { id: '10000', label: '10k' }, { id: '30000', label: '30k' }]} value={String(n)} onChange={(v) => setN(+v)} accent="--violet" />
          <div style={{ marginTop: 8 }}><table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
            {[['GRV', mc.grv], ['NTG', mc.ntg], ['PHI', mc.phi], ['SW', mc.sw], ['RF', mc.rf]].map(([k, d]) => { const inp = d as McInput; return (
              <tr key={k as string}><td style={{ color: 'var(--muted)' }}>{k as string}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{inp.min < 1 ? inp.min.toFixed(2) : (inp.min / 1e6).toFixed(0)} / {inp.mode < 1 ? inp.mode.toFixed(2) : (inp.mode / 1e6).toFixed(0)} / {inp.max < 1 ? inp.max.toFixed(2) : (inp.max / 1e6).toFixed(0)}</td></tr>
            ); })}
          </tbody></table></div>
        </InspectorSection>
        <InspectorSection title="Tornado (sensitivity)">
          {tor.map((b) => { const mag = Math.min(1, Math.abs(b.r)); return (
            <div key={b.key} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)' }}><span>{b.label}</span><span className="mono" style={{ color: 'var(--text)' }}>r={b.r.toFixed(2)}</span></div>
              <div style={{ height: 7, background: 'var(--panel-2)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${mag * 100}%`, height: '100%', background: b.r >= 0 ? 'var(--green)' : 'var(--rose)' }} /></div>
            </div>
          ); })}
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)', lineHeight: 1.5 }}>Deterministic STOIIP is the unfaulted screening upper bound (validated ≈22 MMSm³ dynamic [{CITATIONS.dynamic}]). Prospect ranges are pre-drill <b style={{ color: 'var(--amber)' }}>scenario</b>.</div>
      </Inspector>
    </div>
  );
}
