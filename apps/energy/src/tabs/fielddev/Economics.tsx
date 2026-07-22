// Economics.tsx (V1c) — screening cashflow from the Fable-set defaults, tied to
// the field oil/gas-by-year (from prod-field), NPV (mid-year) / payback / IRR-lite
// + a waterfall + cumulative chart. All scenario. Screening economics — NOT
// investment advice (we are not a licensed advisor).
import { useMemo, useState, useCallback } from 'react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Slider, Loading, ErrorBanner, withAlpha } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadProdField } from '../../wb/load';
import type { ProdJson } from '../../wb/types';
import { cashflow, npv, payback, irr, ECON_DEFAULTS } from '../../engine/econ';
import { BBL_PER_SM3 } from '../../engine/volumetrics';
import { useUnits, oilVol } from '../../units';

export function Economics() {
  const field = useAsync<ProdJson>(loadProdField, []);
  if (field.loading) return <Loading what="field production" />;
  if (field.error || !field.data) return <ErrorBanner msg={field.error || 'field production unavailable'} />;
  return <Inner field={field.data} />;
}

function Inner({ field }: { field: ProdJson }) {
  const { system } = useUnits();
  const [oilPrice, setOilPrice] = useState(ECON_DEFAULTS.oilPrice);
  const [gasPrice, setGasPrice] = useState(ECON_DEFAULTS.gasPrice);
  const [opexVar, setOpexVar] = useState(ECON_DEFAULTS.opexVar);
  const [opexFix, setOpexFix] = useState(ECON_DEFAULTS.opexFix / 1e6);
  const [capex, setCapex] = useState(ECON_DEFAULTS.capex / 1e6);
  const [disc, setDisc] = useState(ECON_DEFAULTS.disc * 100);
  const [aband, setAband] = useState(ECON_DEFAULTS.aband / 1e6);
  const [tax, setTax] = useState(false);
  const [inspOpen, setInspOpen] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  // field oil/gas by year (Sm³ → bbl / Mscf)
  const { oilBbl, gasMscf, years } = useMemo(() => {
    const byYear = new Map<number, { oil: number; gas: number }>();
    for (const m of field.monthly) { const y = +m.ym.slice(0, 4); const e = byYear.get(y) ?? { oil: 0, gas: 0 }; e.oil += m.oil; e.gas += m.gas; byYear.set(y, e); }
    const ys = [...byYear.keys()].sort((a, b) => a - b).filter((y) => (byYear.get(y)!.oil) > 0);
    return {
      years: ys,
      oilBbl: ys.map((y) => byYear.get(y)!.oil * BBL_PER_SM3),
      gasMscf: ys.map((y) => (byYear.get(y)!.gas * 35.3147) / 1000),
    };
  }, [field]);

  const rows = useMemo(() => cashflow({
    oilByYear: oilBbl, gasByYear: gasMscf, price: oilPrice, gasPrice,
    opexVar, opexFix: opexFix * 1e6, capex: capex * 1e6, aband: aband * 1e6,
    taxRate: tax ? ECON_DEFAULTS.taxRate : 0,
  }), [oilBbl, gasMscf, oilPrice, gasPrice, opexVar, opexFix, capex, aband, tax]);

  const nets = rows.map((r) => r.net);
  const npvVal = npv(nets, disc / 100);
  const pb = payback(nets);
  const irrVal = irr(nets);
  const cumOilBbl = oilBbl.reduce((a, b) => a + b, 0);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 56, padB = 30, padT = 16, padR = 56;
    const plotW = w - padL - padR, plotH = h - padB - padT;
    const nY = rows.length;
    const maxNet = Math.max(...nets.map(Math.abs), 1);
    const cum = rows.map((r) => r.cumulative);
    const cumMin = Math.min(0, ...cum), cumMax = Math.max(0, ...cum);
    const bw = plotW / nY * 0.7;
    const netY = (v: number) => padT + plotH / 2 - (v / maxNet) * (plotH / 2);
    const cumY = (v: number) => padT + plotH - ((v - cumMin) / Math.max(1e-6, cumMax - cumMin)) * plotH;
    // zero line
    ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(padL, netY(0)); ctx.lineTo(padL + plotW, netY(0)); ctx.stroke();
    // net bars
    rows.forEach((r, i) => {
      const cx = padL + (i + 0.5) / nY * plotW; const y0 = netY(0), y1 = netY(r.net);
      ctx.fillStyle = r.net >= 0 ? withAlpha(cssVar('--teal'), 0.65) : withAlpha(cssVar('--rose'), 0.65);
      ctx.fillRect(cx - bw / 2, Math.min(y0, y1), bw, Math.abs(y1 - y0));
      if (hover === i) { ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 1; ctx.strokeRect(cx - bw / 2, Math.min(y0, y1), bw, Math.abs(y1 - y0)); }
    });
    // cumulative line
    ctx.strokeStyle = cssVar('--amber'); ctx.lineWidth = 1.5; ctx.beginPath();
    rows.forEach((r, i) => { const cx = padL + (i + 0.5) / nY * plotW; const cy = cumY(r.cumulative); i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); });
    ctx.stroke();
    // labels
    ctx.fillStyle = cssVar('--muted'); ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'center';
    rows.forEach((_, i) => { if (i % 2 === 0) ctx.fillText(String(years[i]), padL + (i + 0.5) / nY * plotW, h - 6); });
    ctx.textAlign = 'right'; ctx.fillStyle = cssVar('--teal'); ctx.fillText('net $MM', padL - 4, padT + 8);
    ctx.fillStyle = cssVar('--amber'); ctx.textAlign = 'left'; ctx.fillText('cum $MM', padL + plotW + 4, cumY(cumMax) + 4);
    if (hover != null) { const r = rows[hover]; const cx = padL + (hover + 0.5) / nY * plotW; ctx.fillStyle = cssVar('--text'); ctx.textAlign = 'center'; ctx.fillText(`${(r.net / 1e6).toFixed(0)} | cum ${(r.cumulative / 1e6).toFixed(0)}`, cx, netY(0) - 6); }
  }, [rows, nets, hover, years]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);
  const onMove = (e: React.MouseEvent) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const padL = 56, padR = 56; const plotW = rect.width - padL - padR; const i = Math.floor(((e.clientX - rect.left - padL) / plotW) * rows.length); setHover(i >= 0 && i < rows.length ? i : null); };

  const M = (v: number) => `$${(v / 1e6).toFixed(0)}MM`;

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <span className="eyebrow">Screening cashflow · tied to field oil/gas-by-year</span>
          <span className="chip" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }}>screening economics — not investment advice</span>
          <div style={{ flex: 1 }} />
          <NatureBadge nature="scenario" />
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 10, borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          {[['NPV @ ' + disc.toFixed(0) + '%', M(npvVal), npvVal >= 0 ? 'var(--teal)' : 'var(--rose)'], ['Payback', pb != null ? `${pb.toFixed(1)} yr` : '—', 'var(--text)'], ['IRR-lite', irrVal != null ? `${(irrVal * 100).toFixed(0)}%` : '—', 'var(--text)'], ['Cum oil', oilVol(cumOilBbl / BBL_PER_SM3, system).text, 'var(--text)'], ['Tax', tax ? '78%' : 'pre-tax', 'var(--muted)']].map(([k, v, c]) => (
            <div key={k} className="panel" style={{ padding: '8px 12px', minWidth: 110, flex: 1 }}>
              <div className="eyebrow" style={{ marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
          <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
      </div>

      <Inspector title="Economics inputs" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Prices (Fable-set)">
          <Slider label="Oil price" min={40} max={120} step={1} value={oilPrice} onChange={setOilPrice} fmt={(v) => `$${v}/bbl`} />
          <Slider label="Gas price" min={2} max={14} step={0.5} value={gasPrice} onChange={setGasPrice} fmt={(v) => `$${v}/Mscf`} />
        </InspectorSection>
        <InspectorSection title="Costs">
          <Slider label="Opex variable" min={5} max={30} step={1} value={opexVar} onChange={setOpexVar} fmt={(v) => `$${v}/bbl`} />
          <Slider label="Opex fixed" min={10} max={100} step={5} value={opexFix} onChange={setOpexFix} fmt={(v) => `$${v}MM/yr`} />
          <Slider label="Capex (field)" min={200} max={2500} step={50} value={capex} onChange={setCapex} fmt={(v) => `$${v}MM`} />
          <Slider label="Abandonment" min={0} max={400} step={10} value={aband} onChange={setAband} fmt={(v) => `$${v}MM`} />
        </InspectorSection>
        <InspectorSection title="Discounting & tax">
          <Slider label="Discount rate" min={6} max={15} step={1} value={disc} onChange={setDisc} fmt={(v) => `${v}%`} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
            <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} /> Norway 78% petroleum tax (screening — not fiscal advice)
          </label>
        </InspectorSection>
        <InspectorSection title="Basis">
          <div style={{ fontSize: 9.5, color: 'var(--muted)', lineHeight: 1.5 }}>North Sea offshore screening basis. Mid-year discounting. Oil/gas-by-year from prod-field (Volve production). Per-well capex ${ECON_DEFAULTS.capexWell / 1e6}MM.</div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}
