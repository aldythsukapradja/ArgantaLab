// TimeSlider — dual-range window control + month histogram + summary, faithful to
// the reference tool's .sbar. Two overlaid range inputs share one track (pointer-
// events trick), 2-month minimum span, teal highlight, 24m/5y/TODAY presets.
import { useMemo } from 'react';
import type { ScheduleActivity } from './schedule-model';
import {
  type Window, TOTAL_MONTHS, clampWindow, mi2d, d2mi, fmtMonthYear, today,
} from './time-axis';
import { histogram } from './gantt-geometry';
import { pd } from './time-axis';

interface Props {
  win: Window;
  onChange: (w: Window) => void;
  activities: ScheduleActivity[];
}

export function TimeSlider({ win, onChange, activities }: Props) {
  const buckets = useMemo(() => histogram(activities, TOTAL_MONTHS), [activities]);
  const maxB = Math.max(1, ...buckets);

  const setPreset = (months: number) => {
    const start = d2mi(today());
    onChange(clampWindow(start, start + months));
  };
  const toToday = () => {
    const span = win.mR - win.mL;
    const start = d2mi(today());
    onChange(clampWindow(start, start + span));
  };
  const onRange = (which: 'L' | 'R', v: number) => {
    onChange(which === 'L' ? clampWindow(v, win.mR) : clampWindow(win.mL, v));
  };

  const span = win.mR - win.mL;
  const vs = mi2d(win.mL), ve = mi2d(win.mR);
  const leftPct = (win.mL / (TOTAL_MONTHS - 1)) * 100;
  const rightPct = (win.mR / (TOTAL_MONTHS - 1)) * 100;

  // Summary: wells active in window, by type.
  const summary = useMemo(() => {
    const vsT = vs.getTime(), veT = ve.getTime();
    let op = 0, wi = 0, wo = 0, app = 0;
    const seen = new Set<string>();
    for (const a of activities) {
      if (pd(a.start).getTime() > veT || pd(a.end).getTime() < vsT) continue;
      if (a.kind === 'Rig') continue;
      const key = a.well + a.kind;
      if (seen.has(key)) continue;
      seen.add(key);
      if (a.kind === 'WO') wo++;
      else if (a.kind === 'App') app++;
      else if (a.wellType === 'WI') wi++;
      else op++;
    }
    return { op, wi, wo, app, total: op + wi + wo + app };
  }, [activities, vs, ve]);

  return (
    <div className="dts">
      <div className="dts-top">
        <button className="dbtn" onClick={() => setPreset(24)}>24M</button>
        <button className="dbtn" onClick={() => setPreset(60)}>5Y</button>
        <button className="dbtn" onClick={toToday}>TODAY</button>
        <div className="dts-con">
          <div className="dts-trk" />
          <div className="dts-hlt" style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }} />
          <input type="range" min={0} max={TOTAL_MONTHS - 1} value={win.mL}
            onChange={(e) => onRange('L', +e.target.value)} aria-label="Window start" />
          <input type="range" min={0} max={TOTAL_MONTHS - 1} value={win.mR}
            onChange={(e) => onRange('R', +e.target.value)} aria-label="Window end" />
        </div>
        <div className="dts-lab">{fmtMonthYear(vs)} — {fmtMonthYear(ve)}</div>
      </div>

      <svg className="dts-hist" viewBox={`0 0 ${TOTAL_MONTHS} 26`} preserveAspectRatio="none">
        {buckets.map((b, m) => {
          const h = (b / maxB) * 24;
          const inWin = m >= win.mL && m <= win.mR;
          return b > 0 ? (
            <rect key={m} className={inWin ? '' : 'out'} x={m} y={26 - h} width={0.85} height={h} />
          ) : null;
        })}
      </svg>

      <div className="dts-sum">
        <span><b>{summary.total}</b> wells in window</span>
        <span>· <b>{summary.op}</b> producers</span>
        <span>· <b>{summary.wi}</b> injectors</span>
        <span>· <b>{summary.app}</b> appraisal</span>
        <span>· <b>{summary.wo}</b> workovers</span>
        <span style={{ color: 'var(--ink3)' }}>· {span} mo span</span>
      </div>
    </div>
  );
}
