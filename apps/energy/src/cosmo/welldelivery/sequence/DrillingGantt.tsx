// DrillingGantt — the SVG rig-swimlane Gantt. React-idiomatic rebuild of the
// reference tool's render(): lanes → axis → campaign bands → milestones → well
// bars (fill/stroke/hatch/basis-dot/label) → PM markers → TODAY line. Data→bars
// mapping (no manual DOM). Bar click lifts a well: crossfilter.
import { useLayoutEffect, useRef, useState, useMemo, Fragment } from 'react';
import type { DrillingSchedule, ScheduleActivity } from './schedule-model';
import { RESERVOIR_COLOR, KIND_LABEL, WELLTYPE_LABEL } from './schedule-model';
import {
  type Window, xOfDate, fmtDate, fmtMonthYear, today, addMonths, pd, db, ppd,
} from './time-axis';
import {
  laneLayout, positionBars, axisTicks, basisColor, HEADER_H,
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

  // Hatch patterns for injectors, one per reservoir.
  const reservoirs = Object.keys(RESERVOIR_COLOR) as (keyof typeof RESERVOIR_COLOR)[];

  const laneTint = ['rgba(15,181,166,.05)', 'rgba(37,99,235,.05)'];

  return (
    <div className="dgantt-scroll">
      {/* rig label rail */}
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
            {reservoirs.map((res) => (
              <pattern key={res} id={`hatch-${res}`} width={6} height={6}
                patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={6} height={6} fill={RESERVOIR_COLOR[res]} />
                <line x1={0} y1={0} x2={0} y2={6} stroke="rgba(255,255,255,.55)" strokeWidth={2} />
              </pattern>
            ))}
          </defs>

          {rigs.map((rig, ri) => {
            const y0 = ri * lay.rowH;
            const bars = positionBars(rig.acts, win, availW);
            const camps = schedule.campaigns.filter((c) => c.rigId === rig.id);
            const miles = schedule.milestones.filter((m) => m.rigId === rig.id);
            // PM markers: Dev/WO with TD ≥ 2026, stacked per 8px bucket to avoid overlap.
            const pmBucket = new Map<number, number>();
            return (
              <g key={rig.id}>
                {/* lane background */}
                <rect x={0} y={y0} width={availW} height={lay.rowH} fill={laneTint[ri % 2]} />
                <line x1={0} y1={y0 + lay.rowH} x2={availW} y2={y0 + lay.rowH} stroke="var(--line)" />

                {/* year gridlines + labels */}
                {years.map((t, i) => (
                  <Fragment key={`y${i}`}>
                    <line x1={t.x} y1={y0} x2={t.x} y2={y0 + lay.rowH} stroke="var(--line)" strokeWidth={1} />
                    {ri === 0 && t.x >= -10 && t.x <= availW + 10 && (
                      <text x={t.x + 4} y={y0 + 13} fontSize={12} fontWeight={800} fill="var(--ink2)">{t.label}</text>
                    )}
                  </Fragment>
                ))}
                {/* month ticks */}
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
                      <rect x={cx} y={y0 + lay.campT} width={cw} height={12} rx={3}
                        fill={c.color} opacity={0.13} stroke={c.color} strokeOpacity={0.5} />
                      {cw > 60 && (
                        <text x={cx + cw / 2} y={y0 + lay.campT + 9} fontSize={8} fontWeight={700}
                          textAnchor="middle" fill={c.color}>{c.label}</text>
                      )}
                    </g>
                  );
                })}

                {/* milestone markers (RFSU triangles) */}
                {miles.map((m, i) => {
                  const mx = xOfDate(win, availW, pd(m.date));
                  if (mx < 0 || mx > availW) return null;
                  return (
                    <g key={`ms${i}`}>
                      <polygon points={`${mx},${y0 + HEADER_H + 4} ${mx - 4},${y0 + HEADER_H - 3} ${mx + 4},${y0 + HEADER_H - 3}`} fill={m.color} />
                      <text x={mx + 6} y={y0 + HEADER_H + 2} fontSize={8} fontWeight={700} fill={m.color}>▾ {m.label}</text>
                    </g>
                  );
                })}

                {/* well bars */}
                {bars.map(({ a, x, w, style }) => {
                  const match = matchesFilter(a, activeFilter);
                  const by = y0 + lay.barT;
                  const showLabel = w >= 26;
                  const showPill = w >= 44 && a.kind !== 'Rig';
                  const fill = style.hatch ? `url(#hatch-${style.hatch})` : style.fill;
                  return (
                    <g key={a.id} data-act={a.kind} className={match ? 'match' : ''}
                      onClick={() => onPickWell(a.well)}
                      onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, a })}
                      onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                      onMouseLeave={() => setTip(null)}>
                      <rect x={x} y={by} width={w} height={lay.barH} rx={2}
                        fill={fill} stroke={style.stroke} strokeWidth={1}
                        strokeDasharray={style.dash} />
                      {/* basis maturation dot */}
                      {w > 8 && a.kind !== 'Rig' && (
                        <circle cx={x + 5} cy={by + 5} r={2.5} fill={basisColor(a)} stroke="#fff" strokeWidth={0.5} />
                      )}
                      {/* non-FID red dot */}
                      {a.nonFid && (
                        <circle cx={x + 5} cy={by + lay.barH - 5} r={2.5} fill="#ef4444" />
                      )}
                      {/* vertical well label inside bar */}
                      {showLabel && (
                        <text x={x + w / 2} y={by + lay.barH / 2}
                          fontSize={9} fontWeight={600} fill={style.textColor}
                          textAnchor="middle" dominantBaseline="middle"
                          transform={`rotate(-90 ${x + w / 2} ${by + lay.barH / 2})`}>
                          {a.well}
                        </text>
                      )}
                      {/* below-bar pill */}
                      {showPill && !showLabel && (
                        <text x={x + 3} y={by + lay.barH - 3} fontSize={8} fill={style.textColor}>{a.well}</text>
                      )}
                      {/* PM marker */}
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

          {/* TODAY line (single canonical value) */}
          {showToday && (
            <g>
              <line x1={todayX} y1={0} x2={todayX} y2={svgH} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,3" />
              <rect x={todayX - 20} y={2} width={40} height={13} rx={3} fill="#ef4444" />
              <text x={todayX} y={11} fontSize={8} fontWeight={700} fill="#fff" textAnchor="middle">TODAY</text>
            </g>
          )}
        </svg>
      </div>

      {/* tooltip */}
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
