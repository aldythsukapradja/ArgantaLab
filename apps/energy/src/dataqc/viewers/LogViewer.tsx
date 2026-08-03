// viewers/LogViewer.tsx — multi-track well-log display on a high-DPI canvas.
//
// Renderer choice: a purpose-built canvas track engine, not a generic charting lib.
// @equinor/videx-wellog is installed but was evaluated and rejected earlier in this
// codebase (see legacy/LogsView.tsx) — its imperative D3 lifecycle fights React's
// re-render/theming model. Canvas gives us DPI-correct curves, per-track scales,
// depth-synced tracks and a picks overlay with no reconciliation fight.
//
// Depth is normalised to metres on the way in (the Volve bundle has a well in mm)
// and displayed in the PROJECT unit system.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DigestedLog } from '../types.ts';
import { useUnits, depth as depthQ, depthToMetres } from '../../units';

const CURVE_COLOR: Record<string, string> = {
  GR: '#e1ae48', RHOB: '#df7084', NPHI: '#62aef7', DT: '#b37df0',
  RT: '#50d0b1', RXO: '#8fd6bd', PEF: '#e58d4b', CALI: '#7f9299',
  SP: '#c9a227', PHIE: '#62aef7', SW: '#62c8f7', VSH: '#a3865e', PERM: '#9bd45f',
};
const colorFor = (family: string | undefined, i: number) =>
  (family && CURVE_COLOR[family]) || ['#50d0b1', '#e1ae48', '#62aef7', '#b37df0', '#df7084'][i % 5];

export interface PickMarker { surface: string; md: number }

export function LogViewer({ log, picks }: { log: DigestedLog; picks?: PickMarker[] }) {
  const { system } = useUnits();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const [selected, setSelected] = useState<string[]>(() => log.curves.slice(0, 4).map((c) => c.mnemonic));
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // depth in METRES regardless of what the file declared
  const mdM = useMemo(() => {
    const f = depthToMetres(1, log.depthUnit) ?? 1;
    return log.md.map((v) => v * f);
  }, [log.md, log.depthUnit]);

  const range = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const v of mdM) { if (!Number.isFinite(v)) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
    return Number.isFinite(lo) ? { lo, hi } : { lo: 0, hi: 1 };
  }, [mdM]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const tracks = useMemo(
    () => log.curves.filter((c) => selected.includes(c.mnemonic)),
    [log.curves, selected],
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`; cv.style.height = `${size.h}px`;
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const css = (n: string, f: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    const ink = css('--ink', '#0f172a'), ink3 = css('--ink3', '#94a3b8'), line = css('--line', '#e2e8f0');

    const padT = 34, padB = 22, padL = 62;
    const plotH = size.h - padT - padB;
    const trackW = tracks.length ? (size.w - padL - 10) / tracks.length : 0;
    const yOf = (m: number) => padT + ((m - range.lo) / (range.hi - range.lo || 1)) * plotH;

    // depth axis
    g.strokeStyle = line; g.lineWidth = 1;
    g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, padT + plotH); g.stroke();
    g.font = '10px ui-monospace, monospace'; g.fillStyle = ink3; g.textAlign = 'right';
    const ticks = 8;
    for (let i = 0; i <= ticks; i++) {
      const m = range.lo + (i / ticks) * (range.hi - range.lo);
      const y = yOf(m);
      g.fillText(depthQ(m, system).text, padL - 6, y + 3);
      g.strokeStyle = line; g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(padL, y); g.lineTo(size.w - 10, y); g.stroke();
      g.globalAlpha = 1;
    }

    // one track per selected curve
    tracks.forEach((c, ti) => {
      const x0 = padL + ti * trackW;
      const col = colorFor(c.family, ti);
      let lo = Infinity, hi = -Infinity;
      for (const v of c.values) { if (v == null || !Number.isFinite(v)) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      if (lo === hi) { hi = lo + 1; }

      g.fillStyle = ink; g.textAlign = 'left'; g.font = '600 10px ui-monospace, monospace';
      g.fillText(`${c.mnemonic}${c.unit ? ` (${c.unit})` : ''}`, x0 + 4, 14);
      g.fillStyle = ink3; g.font = '9px ui-monospace, monospace';
      g.fillText(lo.toFixed(1), x0 + 4, 26);
      g.textAlign = 'right'; g.fillText(hi.toFixed(1), x0 + trackW - 6, 26);
      g.textAlign = 'left';

      g.strokeStyle = line; g.globalAlpha = 0.6;
      g.beginPath(); g.moveTo(x0, padT); g.lineTo(x0, padT + plotH); g.stroke();
      g.globalAlpha = 1;

      g.strokeStyle = col; g.lineWidth = 1;
      g.beginPath();
      let started = false;
      for (let i = 0; i < c.values.length; i++) {
        const v = c.values[i];
        const m = mdM[i];
        if (v == null || !Number.isFinite(v) || !Number.isFinite(m)) { started = false; continue; }
        const x = x0 + ((v - lo) / (hi - lo)) * (trackW - 8) + 4;
        const y = yOf(m);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke();
    });

    // formation picks across all tracks — this is what makes a log readable
    if (picks?.length) {
      g.setLineDash([4, 3]);
      for (const p of picks) {
        const y = yOf(p.md);
        if (y < padT || y > padT + plotH) continue;
        g.strokeStyle = '#e11d74'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(padL, y); g.lineTo(size.w - 10, y); g.stroke();
        g.fillStyle = '#e11d74'; g.font = '600 9px ui-monospace, monospace'; g.textAlign = 'left';
        g.fillText(p.surface, padL + 6, y - 3);
      }
      g.setLineDash([]);
    }

    if (hover && hover.y > padT && hover.y < padT + plotH) {
      g.strokeStyle = ink3; g.globalAlpha = 0.7; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(padL, hover.y); g.lineTo(size.w - 10, hover.y); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
      const m = range.lo + ((hover.y - padT) / plotH) * (range.hi - range.lo);
      g.fillStyle = ink; g.font = '600 10px ui-monospace, monospace'; g.textAlign = 'left';
      g.fillText(depthQ(m, system).text, padL + 6, hover.y - 4);
    }
  }, [tracks, mdM, range, size, system, picks, hover]);

  return (
    <div className="dqv-log">
      <div className="dqv-curves">
        {log.curves.map((c, i) => {
          const on = selected.includes(c.mnemonic);
          return (
            <button
              key={c.mnemonic}
              className={'dqv-curve' + (on ? ' on' : '')}
              style={on ? { borderColor: colorFor(c.family, i), color: colorFor(c.family, i) } : undefined}
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c.mnemonic) : [...s, c.mnemonic]))}
            >
              {c.mnemonic}
            </button>
          );
        })}
      </div>
      <div className="dqv-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover({ x: e.clientX - r.left, y: e.clientY - r.top });
          }}
          onMouseLeave={() => setHover(null)}
        />
      </div>
    </div>
  );
}
