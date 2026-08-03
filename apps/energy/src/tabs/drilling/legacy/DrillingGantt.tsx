// DrillingGantt — the SVG rig-swimlane Gantt. Premium rebuild of the reference
// tool's render(): gradient bars with depth + inner highlight + soft shadow,
// dependency threads between consecutive rig activities, a glowing animated TODAY
// sweep, per-bar entrance motion. Data→bars mapping (no manual DOM). Bar click
// lifts a well: crossfilter. Preserves filter-dimming, PM markers, tooltips.
import { useLayoutEffect, useRef, useState, useMemo, Fragment } from 'react';
import type { DrillingSchedule, ScheduleActivity } from './schedule-model';
import { RESERVOIR_COLOR, KIND_LABEL, WELLTYPE_LABEL } from './schedule-model';
import {
  type Window, xOfDate, fmtDate, fmtMonthYear, today, addMonths, pd, db, ppd,
} from './time-axis';
import {
  laneLayout, positionBars, axisTicks, basisColor, dk, lt, HEADER_H,
} from './gantt-geometry';
import { matchesFilter } from './filters';

interface Props {
  schedule: DrillingSchedule;
  win: Window;
  height: number;
  activeFilter: string | null;
  pmVisible: boolean;
  onPickWell: (well: string) => void;
}

interface Tip { x: number; y: number; a: ScheduleActivity }

// Base colors that get a vertical gradient (depth). Injectors use a hatch; WO is
// semi-transparent so stays flat.
const GRAD_BASES = [...new Set([...Object.values(RESERVOIR_COLOR), '#f59e0b', '#cbd5e1'])];
const gradId = (hex: string) => `grad-${hex.replace('#', '')}`;

export function DrillingGantt({ schedule, win, height, activeFilter, pmVisible, onPickWell }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(900);
  const [tip, setTip] = useState<Tip | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailW(Math.max(200, el.clientWidth)));
    ro.observe(el);
    setAvailW(Math.max(200, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const rigs = schedule.rigs;
  const lay = laneLayout(height, rigs.length);
  const svgH = lay.rowH * rigs.length;
  const { years, months } = useMemo(() => axisTicks(win, availW), [win, availW]);
  const todayX = xOfDate(win, availW, today());
  const showToday = todayX >= 0 && todayX <= availW;
  const pxPerDay = ppd(win, availW);

  const reservoirs = Object.keys(RESERVOIR_COLOR) as (keyof typeof RESERVOIR_COLOR)[];
  const laneTint = ['rgba(15,181,166,.06)', 'rgba(37,99,235,.06)'];

  return (
    <div className="dgantt-scroll">
      <div className="dgantt-rail" style={{ height: svgH }}>
        {rigs.map((r, i) => (
          <div key={r.id} className="dgantt-rb"
            style={{ height: lay.rowH, borderLeft: `3px solid ${r.color}` }}>
            <div className="dgantt-rn">Rig {i + 1}</div>
            <div className="dgantt-rs">{r.name}</div>
          </div>
        ))}
      </div>

      <div className="dgantt-svgwrap" ref={wrapRef}>
        <svg className={`dgantt-svg${activeFilter ? ' dimmed' : ''}${pmVisible ? ' pm-on' : ''}`}
          width={availW} height={svgH} viewBox={`0 0 ${availW} ${svgH}`}>
          <defs>
            {/* injector hatch, per reservoir */}
            {reservoirs.map((res) => (
              <pattern key={res} id={`hatch-${res}`} width={6} height={6}
                patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={6} height={6} fill={RESERVOIR_COLOR[res]} />
                <line x1={0} y1={0} x2={0} y2={6} stroke="rgba(255,255,255,.55)" strokeWidth={2} />
              </pattern>
            ))}
            {/* vertical gradient per base color (depth) */}
            {GRAD_BASES.map((base) => (
              <linearGradient key={base} id={gradId(base)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={lt(base, 26)} />
                <stop offset="1" stopColor={dk(base, 12)} />
              </linearGradient>
            ))}
            {/* soft bar shadow */}
            <filter id="barShadow" x="-20%" y="-30%" width="140%" height="180%">
              <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#000" floodOpacity="0.35" />
            </filter>
            {/* TODAY glow */}
            <filter id="todayGlow" x="-300%" y="-30%" width="700%" height="160%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {rigs.map((rig, ri) => {
            const y0 = ri * lay.rowH;
            const bars = positionBars(rig.acts, win, availW);
            const camps = schedule.campaigns.filter((c) => c.rigId === rig.id);
            const miles = schedule.milestones.filter((m) => m.rigId === rig.id);
            const pmBucket = new Map<number, number>();
            const midY = y0 + lay.barT + lay.barH / 2;
            return (
              <g key={rig.id}>
                <rect x={0} y={y0} width={availW} height={lay.rowH} fill={laneTint[ri % 2]} />
                <line x1={0} y1={y0 + lay.rowH} x2={availW} y2={y0 + lay.rowH} stroke="var(--line)" />

                {years.map((t, i) => (
                  <Fragment key={`y${i}`}>
                    <line x1={t.x} y1={y0} x2={t.x} y2={y0 + lay.rowH} stroke="var(--line)" strokeWidth={1} />
                    {ri === 0 && t.x >= -10 && t.x <= availW + 10 && (
                      <text x={t.x + 4} y={y0 + 13} fontSize={12} fontWeight={800} fill="var(--ink2)">{t.label}</text>
                    )}
                  </Fragment>
                ))}
                {ri === 0 && months.map((t, i) => (
                  <Fragment key={`m${i}`}>
                    <line x1={t.x} y1={y0 + HEADER_H} x2={t.x} y2={y0 + lay.rowH} stroke="var(--line2)" strokeWidth={0.5} />
                    <text x={t.x + 1} y={y0 + 26} fontSize={8} fill="var(--ink3)">{t.label}</text>
                  </Fragment>
                ))}
                <line x1={0} y1={y0 + HEADER_H} x2={availW} y2={y0 + HEADER_H} stroke="var(--line)" />

                {/* campaign bands */}
                {camps.map((c, i) => {
                  const cx = xOfDate(win, availW, pd(c.start));
                  const cw = db(pd(c.start), pd(c.end)) * pxPerDay;
                  if (cw < 2) return null;
                  return (
                    <g key={`c${i}`}>
                      <rect x={cx} y={y0 + lay.campT} width={cw} height={12} rx={4}
                        fill={c.color} opacity={0.12} stroke={c.color} strokeOpacity={0.45} />
                      {cw > 60 && (
                        <text x={cx + cw / 2} y={y0 + lay.campT + 9} fontSize={8} fontWeight={700}
                          letterSpacing={0.4} textAnchor="middle" fill={c.color} opacity={0.9}>{c.label.toUpperCase()}</text>
                      )}
                    </g>
                  );
                })}

                {/* dependency threads: rig can't drill two at once → thread consecutive bars */}
                {bars.map(({ a, x }, i) => {
                  if (i === 0) return null;
                  const prev = bars[i - 1];
                  if (prev.a.kind === 'Rig' || a.kind === 'Rig') return null;
                  const x1 = prev.x + prev.w, x2 = x;
                  if (x2 - x1 < 2 || x2 - x1 > 120) return null;
                  const mx = (x1 + x2) / 2;
                  return (
                    <path key={`dep${a.id}`} d={`M${x1},${midY} C${mx},${midY} ${mx},${midY} ${x2},${midY}`}
                      stroke="var(--teal)" strokeWidth={1.2} strokeOpacity={0.4} fill="none" strokeDasharray="1,2" />
                  );
                })}

                {/* milestones */}
                {miles.map((m, i) => {
                  const mx = xOfDate(win, availW, pd(m.date));
                  if (mx < 0 || mx > availW) return null;
                  return (
                    <g key={`ms${i}`}>
                      <polygon points={`${mx},${y0 + HEADER_H + 5} ${mx - 5},${y0 + HEADER_H - 3} ${mx + 5},${y0 + HEADER_H - 3}`}
                        fill={m.color} filter="url(#todayGlow)" />
                      <text x={mx + 7} y={y0 + HEADER_H + 3} fontSize={8} fontWeight={700} fill={m.color}>{m.label}</text>
                    </g>
                  );
                })}

                {/* well bars */}
                {bars.map(({ a, x, w, style }) => {
                  const match = matchesFilter(a, activeFilter);
                  const by = y0 + lay.barT;
                  const showLabel = w >= 26;
                  const showPill = w >= 44 && a.kind !== 'Rig';
                  const fill = style.hatch
                    ? `url(#hatch-${style.hatch})`
                    : style.dash
                      ? style.fill
                      : GRAD_BASES.includes(style.fill) ? `url(#${gradId(style.fill)})` : style.fill;
                  return (
                    <g key={a.id} data-act={a.kind} className={`gbar${match ? ' match' : ''}`}
                      onClick={() => onPickWell(a.well)}
                      onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, a })}
                      onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                      onMouseLeave={() => setTip(null)}>
                      {/* body with soft shadow */}
                      <rect x={x} y={by} width={w} height={lay.barH} rx={3.5}
                        fill={fill} stroke={style.stroke} strokeWidth={1}
                        strokeDasharray={style.dash} filter="url(#barShadow)" />
                      {/* top inner highlight */}
                      {!style.dash && w > 4 && (
                        <line x1={x + 2} y1={by + 1.5} x2={x + w - 2} y2={by + 1.5}
                          stroke="#fff" strokeOpacity={0.35} strokeWidth={1} />
                      )}
                      {/* left accent stripe */}
                      {w > 6 && a.kind !== 'Rig' && (
                        <rect x={x} y={by} width={2.5} height={lay.barH} rx={1}
                          fill={style.hatch ? RESERVOIR_COLOR[style.hatch] : lt(style.fill.slice(0, 7), 50)} opacity={0.9} />
                      )}
                      {/* basis maturation dot */}
                      {w > 10 && a.kind !== 'Rig' && (
                        <circle cx={x + 7} cy={by + 6} r={2.6} fill={basisColor(a)} stroke="#fff" strokeWidth={0.6} />
                      )}
                      {a.nonFid && <circle cx={x + 7} cy={by + lay.barH - 5} r={2.6} fill="#ef4444" />}
                      {showLabel && (
                        <text x={x + w / 2} y={by + lay.barH / 2}
                          fontSize={9} fontWeight={600} fill={style.textColor}
                          textAnchor="middle" dominantBaseline="middle"
                          transform={`rotate(-90 ${x + w / 2} ${by + lay.barH / 2})`}>
                          {a.well}
                        </text>
                      )}
                      {showPill && !showLabel && (
                        <text x={x + 5} y={by + lay.barH - 3} fontSize={8} fill={style.textColor}>{a.well}</text>
                      )}
                      {(a.kind === 'Dev' || a.kind === 'WO') && a.reservoir && pd(a.end).getFullYear() >= 2026 && (() => {
                        const bucket = Math.round(x / 8);
                        const off = (pmBucket.get(bucket) ?? 0);
                        pmBucket.set(bucket, off + 1);
                        const py = by - 4 - off * 9;
                        return (
                          <g className="pm-marker">
                            <polygon points={`${x + 3},${py} ${x - 1},${py - 6} ${x + 7},${py - 6}`} fill="#e11d74" />
                            <text x={x + 10} y={py - 1} fontSize={7} fontWeight={700} fill="#e11d74">PM</text>
                          </g>
                        );
                      })()}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* TODAY sweep — glowing, animated */}
          {showToday && (
            <g className="today-sweep">
              <rect x={todayX - 22} y={0} width={22} height={svgH} fill="url(#todayFade)" />
              <line x1={todayX} y1={0} x2={todayX} y2={svgH} stroke="#e11d74" strokeWidth={1.6}
                strokeDasharray="6,3" filter="url(#todayGlow)" />
              <rect x={todayX - 21} y={2} width={42} height={13} rx={3.5} fill="#e11d74" />
              <text x={todayX} y={11.5} fontSize={8} fontWeight={800} fill="#fff" textAnchor="middle" letterSpacing={0.4}>TODAY</text>
            </g>
          )}
          <defs>
            <linearGradient id="todayFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#e11d74" stopOpacity="0" />
              <stop offset="1" stopColor="#e11d74" stopOpacity="0.14" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {tip && <GanttTip tip={tip} />}
    </div>
  );
}

function GanttTip({ tip }: { tip: Tip }) {
  const a = tip.a;
  const flip = tip.x > window.innerWidth - 300;
  const style: React.CSSProperties = {
    display: 'block',
    left: flip ? tip.x - 288 : tip.x + 14,
    top: Math.min(tip.y + 14, window.innerHeight - 160),
  };
  const pmDue = (a.kind === 'Dev' || a.kind === 'WO') && a.reservoir && pd(a.end).getFullYear() >= 2026
    ? fmtDate(addMonths(pd(a.end), 6)) : null;
  const natLabel: Record<string, string> = { measured: 'Measured', reported: 'Reported', interpreted: 'Interpreted', scenario: 'Scenario' };
  return (
    <div className="dtip" style={style}>
      <div className="w">{a.well}
        <span className="badge" style={{ background: basisColor(a) }}>{a.basis}</span>
      </div>
      <div className="row"><span className="k">Activity</span><span className="v">{KIND_LABEL[a.kind]}{a.wellType ? ` · ${WELLTYPE_LABEL[a.wellType]}` : ''}</span></div>
      {a.reservoir && <div className="row"><span className="k">Reservoir</span><span className="v" style={{ color: RESERVOIR_COLOR[a.reservoir] }}>{a.reservoir}</span></div>}
      <div className="row"><span className="k">Window</span><span className="v">{fmtMonthYear(pd(a.start))} → {fmtMonthYear(pd(a.end))}</span></div>
      <div className="row"><span className="k">Duration</span><span className="v">{a.days} days</span></div>
      {a.nonFid && <div className="row"><span className="k">Status</span><span className="v" style={{ color: '#ef4444' }}>Non-FID</span></div>}
      {pmDue && <div className="row"><span className="k">PM due</span><span className="v">{pmDue}</span></div>}
      <div className="row"><span className="k">Basis</span><span className="v"><span className={`dnat ${a.dataNature}`}>{natLabel[a.dataNature]}</span></span></div>
    </div>
  );
}
