// Forecast.tsx (V1c) — real monthly production + Arps decline fit → EUR, an
// OFFSET-WELL benchmark envelope (P90/P50/P10 type-wells from the 7 producers),
// field sum, and the F-12 material-balance tank check (~19.6 MMSm³ [PEER]).
// Injection wells annotated. All curves forecast/scenario — screening decline,
// not a full-physics simulation.
import { useMemo, useState, useCallback } from 'react';
import { useAsync, useCanvas, cssVar } from '../hooks';
import { Inspector, InspectorSection, Segmented, Loading, ErrorBanner, withAlpha } from '../chrome';
import { NatureBadge } from '../../../components/Provenance';
import { loadIndex, loadProd, loadProdField } from '../../../wb/load';
import type { WbIndex, ProdJson } from '../../../wb/types';
import { fitArps, arps, eur } from '../../../engine/dca';
import { percentile } from '../../../engine/mc';
import { useUnits, oilVol, oilRate } from '../../../units';

const DAYS_PER_MONTH = 30.4375; // avg — monthly Sm³ → Sm³/d for bopd conversion

const PRODUCERS = ['F-1 C', 'F-5', 'F-11', 'F-12', 'F-14', 'F-15 D', 'F-4'];

export function Forecast() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const prods = useAsync<Array<{ name: string; prod: ProdJson } | null>>(
    () => Promise.all(PRODUCERS.map((n) => loadProd(n).then((prod) => ({ name: n, prod })).catch(() => null))), []);
  const field = useAsync<ProdJson>(loadProdField, []);
  if (idx.loading || prods.loading) return <Loading what="production history" />;
  if (idx.error || !idx.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner prods={(prods.data ?? []).filter(Boolean) as Array<{ name: string; prod: ProdJson }>} field={field.data ?? null} />;
}

// producing-month-aligned oil series (t=0 at first nonzero oil)
function alignedOil(p: ProdJson): number[] {
  const oil = p.monthly.map((m) => m.oil);
  const start = oil.findIndex((v) => v > 0);
  return start < 0 ? [] : oil.slice(start);
}

function Inner({ prods, field }: { prods: Array<{ name: string; prod: ProdJson }>; field: ProdJson | null }) {
  const { system } = useUnits();
  const [sel, setSel] = useState('F-12');
  const [view, setView] = useState<'well' | 'field'>('well');
  const [b, setB] = useState(0.5);
  const [inspOpen, setInspOpen] = useState(true);
  const [hover, setHover] = useState<{ t: number; q: number } | null>(null);

  const selProd = prods.find((p) => p.name === sel);
  const selSeries = useMemo(() => selProd ? alignedOil(selProd.prod) : [], [selProd]);
  const fit = useMemo(() => selSeries.length ? fitArps(selSeries, b) : null, [selSeries, b]);
  const qEcon = useMemo(() => selSeries.length ? Math.max(...selSeries) * 0.02 : 0, [selSeries]);
  const cumHist = useMemo(() => selSeries.reduce((a, v) => a + v, 0), [selSeries]);
  const eurVal = useMemo(() => fit ? eur(fit.qi, fit.Di, fit.b, qEcon) : 0, [fit, qEcon]);

  // offset envelope: per producing-month, P90/P50/P10 across all producers
  const envelope = useMemo(() => {
    const series = prods.map((p) => alignedOil(p.prod)).filter((s) => s.length > 3);
    const maxT = Math.max(...series.map((s) => s.length), 0);
    const p90: number[] = [], p50: number[] = [], p10: number[] = [];
    for (let t = 0; t < maxT; t++) {
      const vals = series.map((s) => s[t]).filter((v) => v != null && v > 0).sort((a, c) => a - c);
      if (!vals.length) { p90.push(NaN); p50.push(NaN); p10.push(NaN); continue; }
      p90.push(percentile(vals, 10)); p50.push(percentile(vals, 50)); p10.push(percentile(vals, 90));
    }
    return { p90, p50, p10, maxT };
  }, [prods]);

  const fieldSeries = useMemo(() => field ? field.monthly.map((m) => m.oil) : [], [field]);

  // injectors (wi > 0 anywhere)
  const injectors = useMemo(() => prods.filter((p) => p.prod.monthly.some((m) => m.wi > 0)).map((p) => p.name), [prods]);

  const plotSeries = view === 'field' ? fieldSeries : selSeries;

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 52, padB = 30, padT = 16, padR = 14;
    const plotW = w - padL - padR, plotH = h - padB - padT;
    const nT = Math.max(view === 'field' ? plotSeries.length : Math.max(envelope.maxT, (fit ? fit.peakIdx + 120 : selSeries.length)), 12);
    const allQ = [...plotSeries, ...(view === 'well' ? [...envelope.p10.filter(isFinite)] : [])];
    const qMax = Math.max(...allQ, 1);
    const x = (t: number) => padL + (t / nT) * plotW;
    const y = (q: number) => padT + plotH - (q / qMax) * plotH;
    // axes
    ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    // rate display: metric = Sm³/mo (native); field = bopd (Sm³/mo → Sm³/d → bbl/d)
    const rateDisp = (q: number) => system === 'field' ? q / DAYS_PER_MONTH * 6.2898 : q;
    ctx.fillStyle = cssVar('--muted'); ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const q = qMax * i / 4; const yy = y(q); ctx.fillText((rateDisp(q) / 1e3).toFixed(0) + 'k', padL - 4, yy + 3); ctx.strokeStyle = cssVar('--line'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke(); ctx.setLineDash([]); }
    ctx.textAlign = 'center'; ctx.fillText('producing months', padL + plotW / 2, h - 6);
    ctx.save(); ctx.translate(12, padT + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(system === 'field' ? 'oil rate bopd' : 'oil rate Sm³/mo', 0, 0); ctx.restore();

    // offset envelope (well view only)
    if (view === 'well') {
      const bandFill = (hi: number[], lo: number[], col: string) => {
        ctx.fillStyle = col; ctx.beginPath(); let started = false;
        for (let t = 0; t < hi.length; t++) { if (!isFinite(hi[t])) continue; const px = x(t), py = y(hi[t]); started ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), started = true); }
        for (let t = lo.length - 1; t >= 0; t--) { if (!isFinite(lo[t])) continue; ctx.lineTo(x(t), y(lo[t])); }
        ctx.closePath(); ctx.fill();
      };
      bandFill(envelope.p10, envelope.p90, withAlpha(cssVar('--violet'), 0.16));
      // median line
      ctx.strokeStyle = withAlpha(cssVar('--violet'), 0.8); ctx.lineWidth = 1; ctx.setLineDash([5, 3]); ctx.beginPath(); let st = false;
      for (let t = 0; t < envelope.p50.length; t++) { if (!isFinite(envelope.p50[t])) continue; const px = x(t), py = y(envelope.p50[t]); st ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), st = true); }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // history
    ctx.strokeStyle = cssVar('--teal'); ctx.lineWidth = 1.5; ctx.beginPath();
    plotSeries.forEach((q, t) => { const px = x(t), py = y(q); t ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();

    // Arps forecast (well view)
    if (view === 'well' && fit) {
      ctx.strokeStyle = cssVar('--amber'); ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath();
      for (let t = 0; t <= nT - fit.peakIdx; t++) { const q = arps(fit.qi, fit.Di, fit.b, t); if (q < qEcon) break; const px = x(fit.peakIdx + t), py = y(q); t ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
    }

    if (hover) { const px = x(hover.t), py = y(hover.q); ctx.fillStyle = cssVar('--text'); ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'left'; ctx.fillText(`t${hover.t} · ${(rateDisp(hover.q)/1e3).toFixed(1)}k ${system === 'field' ? 'bopd' : 'Sm³'}`, px + 6, py - 4); }
  }, [plotSeries, envelope, fit, qEcon, view, selSeries, hover, system]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);
  const onMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const padL = 52, padR = 14; const plotW = rect.width - padL - padR;
    const nT = Math.max(view === 'field' ? plotSeries.length : Math.max(envelope.maxT, selSeries.length), 12);
    const t = Math.round(((e.clientX - rect.left - padL) / plotW) * nT);
    if (t >= 0 && t < plotSeries.length) setHover({ t, q: plotSeries[t] });
  };

  const f12Cum = useMemo(() => { const p = prods.find((x) => x.name === 'F-12'); return p ? alignedOil(p.prod).reduce((a, v) => a + v, 0) / 1e6 : 0; }, [prods]);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <Segmented options={[{ id: 'well' as const, label: 'Well' }, { id: 'field' as const, label: 'Field sum' }]} value={view} onChange={setView} accent="--blue" />
          {view === 'well' && <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--text)' }}>{prods.map((p) => <option key={p.name} value={p.name}>{p.name}{injectors.includes(p.name) ? ' ⟲inj' : ''}</option>)}</select>}
          <span className="chip" style={{ color: 'var(--muted)' }}>screening decline — not full-physics sim</span>
          <div style={{ flex: 1 }} />
          <NatureBadge nature="scenario" />
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
          <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', width: '100%', height: '100%' }} />
          <div style={{ position: 'absolute', right: 12, top: 10, display: 'flex', gap: 10, fontSize: 10, color: 'var(--muted)', flexDirection: 'column' }}>
            <span><span style={{ color: 'var(--teal)' }}>▬</span> history</span>
            <span><span style={{ color: 'var(--amber)' }}>▬</span> Arps forecast</span>
            {view === 'well' && <span><span style={{ color: 'var(--violet)' }}>▬</span> offset P90–P10</span>}
          </div>
        </div>
      </div>

      <Inspector title="Forecast inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        {view === 'well' && fit && (
          <InspectorSection title={`Arps fit · ${sel}`}>
            <table className="mono" style={{ width: '100%', fontSize: 10.5 }}><tbody>
              {[['qi', system === 'field' ? oilRate(fit.qi / DAYS_PER_MONTH, 'field').text : `${(fit.qi / 1e3).toFixed(1)}k Sm³/mo`], ['Di', `${(fit.Di * 100).toFixed(1)}%/mo`], ['b', fit.b.toFixed(2)], ['cum (hist)', oilVol(cumHist, system).text], ['EUR', oilVol(eurVal, system).text]].map(([k, v]) => <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td><td style={{ textAlign: 'right', color: 'var(--text)' }}>{v}</td></tr>)}
            </tbody></table>
            <div style={{ marginTop: 8 }}><label style={{ fontSize: 10.5, color: 'var(--muted)' }}>b exponent</label><input type="range" min={0} max={1} step={0.05} value={b} onChange={(e) => setB(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--amber)' }} /></div>
          </InspectorSection>
        )}
        <InspectorSection title="F-12 material-balance tank check">
          <div style={{ fontSize: 10.5, lineHeight: 1.5, color: 'var(--muted)', border: '1px solid var(--teal)', borderRadius: 4, padding: 8 }}>
            <div>F-12 cum oil (history): <b style={{ color: 'var(--text)' }}>{oilVol(f12Cum * 1e6, system).text}</b></div>
            <div style={{ marginTop: 4 }}>MBAL tank STOIP target: <b style={{ color: 'var(--text)' }}>≈{oilVol(19.6e6, system).text}</b> [PEER Metsebo]</div>
            <div style={{ marginTop: 4 }}>Reconciliation gauges the F-12 compartment against the tank estimate.</div>
          </div>
        </InspectorSection>
        <InspectorSection title="Offset benchmark">
          <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Type-wells P90/P50/P10 from {prods.length} producers, producing-month aligned. The selected well's decline is compared to this envelope.</div>
        </InspectorSection>
        <InspectorSection title="Injection (annotated)">
          <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{injectors.length ? injectors.map((n) => `I-${n}`).join(', ') : 'none detected'} — water injection support.</div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}
