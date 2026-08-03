// viewers/ProductionViewer.tsx — monthly production AND injection.
// Stacked-area rates over time plus cumulative curves, in the project unit system.
// Injection is drawn as a mirrored negative band so a voidage-replacement picture
// is readable at a glance — the whole reason injection deserves its own class.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUnits, oilVol, gasVol, waterVol } from '../../units';

export interface ProdMonth { ym: string; oil: number; gas: number; water: number; wi: number }
export interface ProdPayload { well: string; units?: string; monthly: ProdMonth[] }

const SERIES = [
  { key: 'oil' as const, label: 'Oil', color: '#2f9e6d' },
  { key: 'gas' as const, label: 'Gas', color: '#e1ae48' },
  { key: 'water' as const, label: 'Water', color: '#62aef7' },
  { key: 'wi' as const, label: 'Injection', color: '#b37df0' },
];

export function ProductionViewer({ prod }: { prod: ProdPayload }) {
  const { system } = useUnits();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 460 });
  const [on, setOn] = useState<Record<string, boolean>>({ oil: true, gas: true, water: true, wi: true });
  const m = prod.monthly ?? [];

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const totals = useMemo(() => ({
    oil: m.reduce((n, x) => n + (+x.oil || 0), 0),
    gas: m.reduce((n, x) => n + (+x.gas || 0), 0),
    water: m.reduce((n, x) => n + (+x.water || 0), 0),
    wi: m.reduce((n, x) => n + (+x.wi || 0), 0),
  }), [m]);

  useEffect(() => {
    const cv = cvRef.current; if (!cv || !size.w || !size.h || !m.length) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`; cv.style.height = `${size.h}px`;
    const g = cv.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const css = (n: string, f: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    const ink3 = css('--ink3', '#94a3b8'), line = css('--line', '#e2e8f0');

    const padL = 8, padR = 8, padT = 16, padB = 26;
    const w = size.w - padL - padR;
    // injection mirrors below the axis → split the plot around a zero line
    const anyInj = on.wi && totals.wi > 0;
    const hUp = anyInj ? (size.h - padT - padB) * 0.62 : size.h - padT - padB;
    const hDn = anyInj ? (size.h - padT - padB) - hUp : 0;
    const zeroY = padT + hUp;

    let maxUp = 0, maxDn = 0;
    for (const x of m) {
      const up = (on.oil ? +x.oil || 0 : 0) + (on.gas ? (+x.gas || 0) / 1000 : 0) + (on.water ? +x.water || 0 : 0);
      maxUp = Math.max(maxUp, up);
      if (on.wi) maxDn = Math.max(maxDn, +x.wi || 0);
    }
    maxUp = maxUp || 1; maxDn = maxDn || 1;
    const bw = w / m.length;

    // zero line
    g.strokeStyle = line; g.beginPath(); g.moveTo(padL, zeroY); g.lineTo(padL + w, zeroY); g.stroke();

    // stacked positive bars
    m.forEach((x, i) => {
      let acc = 0;
      const bx = padL + i * bw;
      for (const s of SERIES) {
        if (s.key === 'wi' || !on[s.key]) continue;
        const raw = s.key === 'gas' ? (+x[s.key] || 0) / 1000 : (+x[s.key] || 0);
        if (raw <= 0) continue;
        const h = (raw / maxUp) * hUp;
        g.fillStyle = s.color;
        g.fillRect(bx, zeroY - acc - h, Math.max(0.6, bw - 0.4), h);
        acc += h;
      }
      if (on.wi) {
        const wi = +x.wi || 0;
        if (wi > 0) {
          const h = (wi / maxDn) * hDn;
          g.fillStyle = '#b37df0';
          g.fillRect(bx, zeroY, Math.max(0.6, bw - 0.4), h);
        }
      }
    });

    // year ticks
    g.font = '9px ui-monospace, monospace'; g.fillStyle = ink3; g.textAlign = 'center';
    let lastYear = '';
    m.forEach((x, i) => {
      const y = (x.ym || '').slice(0, 4);
      if (y && y !== lastYear) {
        lastYear = y;
        const bx = padL + i * bw;
        g.strokeStyle = line; g.globalAlpha = 0.6;
        g.beginPath(); g.moveTo(bx, padT); g.lineTo(bx, zeroY + hDn); g.stroke();
        g.globalAlpha = 1;
        g.fillText(y, bx, size.h - 8);
      }
    });

    g.textAlign = 'left'; g.fillStyle = ink3;
    g.fillText('produced ↑', padL + 2, padT + 10);
    if (anyInj) g.fillText('injected ↓', padL + 2, zeroY + 12);
  }, [m, size, on, totals]);

  if (!m.length) return <div className="dqv-empty">No monthly records in this asset.</div>;

  return (
    <div className="dqv-prod">
      <div className="dqv-bar">
        {SERIES.map((s) => (
          <button
            key={s.key}
            className={'dqv-chip' + (on[s.key] ? ' on' : '')}
            style={on[s.key] ? { borderColor: s.color, color: s.color } : undefined}
            onClick={() => setOn((o) => ({ ...o, [s.key]: !o[s.key] }))}
          >
            {s.label}
          </button>
        ))}
        <span className="dqv-meta">
          {m.length} months · {m[0]?.ym} → {m[m.length - 1]?.ym}
        </span>
      </div>
      <div className="dqv-totals">
        <span>Oil <b>{oilVol(totals.oil, system).text}</b></span>
        <span>Gas <b>{gasVol(totals.gas, system).text}</b></span>
        <span>Water <b>{waterVol(totals.water, system).text}</b></span>
        <span>Injected <b>{waterVol(totals.wi, system).text}</b></span>
      </div>
      <div className="dqv-canvas-wrap" ref={wrapRef}><canvas ref={cvRef} /></div>
    </div>
  );
}
