// viewers/PressureViewer.tsx — formation-pressure-while-drilling stations.
//
// Each run is one pressure TEST at a fixed depth: the gauge is set, drawdown is pulled,
// and the pressure builds back toward formation pressure. So the natural x-axis is
// TIME WITHIN THE TEST, not depth — and the natural summary across tests is the
// pressure/depth gradient, which is what tells you the fluid and the connectivity.
//
// Two views:
//   Stations — pressure vs depth, one point per test (the gradient plot)
//   Test     — the selected test's pressure/temperature transient vs time
//
// Nothing is fitted or extrapolated: the "formation pressure" shown per station is the
// LATE-TIME pressure actually recorded (final buildup value), never a curve fit.
import { useMemo, useState } from 'react';

export interface PressCurve { source?: string; unit?: string; values: (number | null)[]; screened?: number }
export interface PressRun {
  run?: string | number | null; test?: string | number | null;
  index_kind?: string | null; n_rows?: number; rows_source?: string;
  declared_n_rows?: number | null; source_id?: string;
  curves: Record<string, PressCurve>;
}
export interface PressPayload {
  well: string; kind?: string; dataNature?: string; source_id?: string | null;
  runs: PressRun[];
}

const live = (c?: PressCurve) => (c ? c.values.filter((v): v is number => v != null && Number.isFinite(v)) : []);

/** One station summary, measured — never fitted. */
function summarize(run: PressRun) {
  const p = live(run.curves.PQUARTZ);
  const d = live(run.curves.DEPTH);
  const t = live(run.curves.TQUARTZ);
  // late-time pressure = the last recorded value of the buildup, the closest
  // measured approach to formation pressure this test achieved
  return {
    depth: d.length ? d[d.length - 1] : null,
    pLate: p.length ? p[p.length - 1] : null,
    pMax: p.length ? Math.max(...p) : null,
    pMin: p.length ? Math.min(...p) : null,
    temp: t.length ? t[t.length - 1] : null,
    n: p.length,
  };
}

export function PressureViewer({ press }: { press: PressPayload }) {
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<'stations' | 'test'>('stations');

  const stations = useMemo(
    () => press.runs.map((r, i) => ({ i, run: r, ...summarize(r) })).filter((s) => s.pLate != null),
    [press],
  );

  const depthRange = useMemo(() => {
    const ds = stations.map((s) => s.depth).filter((v): v is number => v != null);
    return ds.length ? [Math.min(...ds), Math.max(...ds)] as const : [0, 1] as const;
  }, [stations]);
  const presRange = useMemo(() => {
    const ps = stations.flatMap((s) => [s.pLate, s.pMax].filter((v): v is number => v != null));
    return ps.length ? [Math.min(...ps), Math.max(...ps)] as const : [0, 1] as const;
  }, [stations]);

  const cur = press.runs[sel];
  const curP = live(cur?.curves.PQUARTZ);
  const curT = live(cur?.curves.TIME);
  const curTemp = live(cur?.curves.TQUARTZ);

  const W = 620, H = 320, padL = 54, padB = 34, padT = 12, padR = 12;
  const pw = W - padL - padR, ph = H - padT - padB;

  return (
    <div className="dqv-press">
      <div className="dqv-bar">
        <span className="dqv-chip on">{press.well}</span>
        <span className="dqv-chip">{press.runs.length} stations</span>
        <button className={'dqv-chip' + (view === 'stations' ? ' on' : '')} onClick={() => setView('stations')}>Gradient</button>
        <button className={'dqv-chip' + (view === 'test' ? ' on' : '')} onClick={() => setView('test')}>Transient</button>
        {cur?.rows_source === 'preview' && (
          <span className="dqv-chip warn" title="Read from the decimated preview — the full decode was unavailable">decimated</span>
        )}
        <span className="dqv-meta">{press.dataNature ?? 'measured'} · FPWD</span>
      </div>

      {view === 'stations' ? (
        <div className="dqv-canvas-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
            {/* pressure/depth gradient — depth DOWN, the industry convention */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = padT + f * ph;
              const dv = depthRange[0] + f * (depthRange[1] - depthRange[0]);
              return (
                <g key={f}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="1" opacity="0.4" />
                  <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">{dv.toFixed(0)}</text>
                </g>
              );
            })}
            {[0, 0.5, 1].map((f) => {
              const x = padL + f * pw;
              const pv = presRange[0] + f * (presRange[1] - presRange[0]);
              return (
                <g key={f}>
                  <line x1={x} y1={padT} x2={x} y2={padT + ph} stroke="var(--line)" strokeWidth="1" opacity="0.4" />
                  <text x={x} y={H - padB + 14} textAnchor="middle" fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">{pv.toFixed(0)}</text>
                </g>
              );
            })}
            <text x={padL} y={H - 6} fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">
              Formation pressure ({cur?.curves.PQUARTZ?.unit ?? 'bar'}) — late-time measured, not fitted
            </text>
            <text x={12} y={padT + 8} fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">Depth (m)</text>

            {stations.map((s) => {
              if (s.depth == null || s.pLate == null) return null;
              const x = padL + ((s.pLate - presRange[0]) / (presRange[1] - presRange[0] || 1)) * pw;
              const y = padT + ((s.depth - depthRange[0]) / (depthRange[1] - depthRange[0] || 1)) * ph;
              return (
                <circle
                  key={s.i} cx={x} cy={y} r={s.i === sel ? 6 : 4}
                  fill={s.i === sel ? 'var(--teal, #14b8a6)' : '#2563eb'}
                  stroke="var(--panel)" strokeWidth="1.5" style={{ cursor: 'pointer' }}
                  onClick={() => { setSel(s.i); setView('test'); }}
                >
                  <title>{`Station ${s.run.test ?? s.i + 1} · ${s.depth.toFixed(1)} m · ${s.pLate.toFixed(1)} bar${s.temp != null ? ` · ${s.temp.toFixed(1)} °C` : ''}`}</title>
                </circle>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="dqv-canvas-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
            {(() => {
              if (!curP.length) return <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill="var(--ink3)">No pressure samples in this station</text>;
              const pMin = Math.min(...curP), pMax = Math.max(...curP);
              const tMin = curT.length ? Math.min(...curT) : 0;
              const tMax = curT.length ? Math.max(...curT) : curP.length;
              const xOf = (i: number) => padL + ((curT.length ? curT[i] - tMin : i) / ((curT.length ? tMax - tMin : curP.length) || 1)) * pw;
              const yOf = (v: number) => padT + ph - ((v - pMin) / (pMax - pMin || 1)) * ph;
              const d = curP.map((v, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
              const tempPath = curTemp.length === curP.length ? (() => {
                const a = Math.min(...curTemp), b = Math.max(...curTemp);
                return curTemp.map((v, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${(padT + ph - ((v - a) / (b - a || 1)) * ph).toFixed(1)}`).join(' ');
              })() : null;
              return (
                <>
                  {[0, 0.5, 1].map((f) => {
                    const y = padT + f * ph;
                    return (
                      <g key={f}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" opacity="0.4" />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">{(pMax - f * (pMax - pMin)).toFixed(0)}</text>
                      </g>
                    );
                  })}
                  {tempPath && <path d={tempPath} fill="none" stroke="#f97316" strokeWidth="1" opacity="0.55" />}
                  <path d={d} fill="none" stroke="#2563eb" strokeWidth="1.4" />
                  <text x={12} y={padT + 8} fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">
                    Pressure ({cur?.curves.PQUARTZ?.unit ?? 'bar'})
                  </text>
                  <text x={padL} y={H - 6} fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">
                    Time within test ({cur?.curves.TIME?.unit ?? 's'}) {tempPath ? '· orange = gauge temperature (own scale)' : ''}
                  </text>
                </>
              );
            })()}
          </svg>
        </div>
      )}

      <div className="dqv-press-list">
        {stations.map((s) => (
          <button key={s.i} className={'dqv-press-row' + (s.i === sel ? ' on' : '')} onClick={() => setSel(s.i)}>
            <b>#{String(s.run.test ?? s.i + 1)}</b>
            <span>{s.depth != null ? `${s.depth.toFixed(1)} m` : '—'}</span>
            <span>{s.pLate != null ? `${s.pLate.toFixed(1)} bar` : '—'}</span>
            <span>{s.temp != null ? `${s.temp.toFixed(1)} °C` : '—'}</span>
            <em>{s.n.toLocaleString()} pts</em>
          </button>
        ))}
      </div>
    </div>
  );
}
