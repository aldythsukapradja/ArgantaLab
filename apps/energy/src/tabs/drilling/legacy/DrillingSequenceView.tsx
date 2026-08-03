// DrillingSequenceView — the Drilling Sequence lifecycle surface. Rebuild of the
// standalone NOC Drilling Schedule in the COSMO design system, on Volve data.
// 5 tabs (COSMO_Final contract): Overview · Sequence · Rigs · Milestones ·
// Revisions. The Sequence tab is the tool: time slider + rig-swimlane Gantt
// (resizable) + cross-filtering dashboard + field map drawer + legend.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Map as MapIcon, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { Window } from './time-axis';
import { clampWindow, d2mi, mi2d, today } from './time-axis';
import { buildSchedule, allActivities, RESERVOIR_COLOR } from './schedule-model';
import type { DrillingSchedule } from './schedule-model';
import { wellsInWindow } from './schedule-model';
import { filterLabel } from './filters';
import { TimeSlider } from './TimeSlider';
import { DrillingGantt } from './DrillingGantt';
import { DrillingDashboard } from './DrillingDashboard';
import { DrillingFieldMap } from './DrillingFieldMap';
import { OverviewView, RigsView, MilestonesView, RevisionsView } from './SequenceTabs';
import { KpiRibbon, LiveRail } from './SequenceCockpit';
import './drilling-sequence.css';

type Tab = 'overview' | 'sequence' | 'rigs' | 'milestones' | 'revisions';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'rigs', label: 'Rigs' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'revisions', label: 'Revisions' },
];

const LEGEND: { key: string; label: string; color: string }[] = [
  { key: 'act:Dev', label: 'Development', color: '#0FB5A6' },
  { key: 'welltype:WI', label: 'Injector', color: '#2563eb' },
  { key: 'act:App', label: 'Appraisal', color: '#f59e0b' },
  { key: 'act:WO', label: 'Workover', color: '#7c3aed' },
  { key: 'res:Hugin', label: 'Hugin', color: RESERVOIR_COLOR.Hugin },
  { key: 'res:Skagerrak', label: 'Skagerrak', color: RESERVOIR_COLOR.Skagerrak },
  { key: 'res:Ty', label: 'Ty', color: RESERVOIR_COLOR.Ty },
];

export function DrillingSequenceView() {
  const [tab, setTab] = useState<Tab>('sequence');
  const [schedule, setSchedule] = useState<DrillingSchedule | null>(null);
  const [win, setWin] = useState<Window>(() => {
    const start = d2mi(today());
    return clampWindow(start, start + 24);
  });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [pmVisible, setPmVisible] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(true);
  const [ganttH, setGanttH] = useState(() => (window.innerWidth <= 820 ? 240 : 320));

  useEffect(() => { buildSchedule().then(setSchedule); }, []);

  const acts = useMemo(() => (schedule ? allActivities(schedule) : []), [schedule]);
  const windowWells = useMemo(
    () => (schedule ? wellsInWindow(schedule, iso(mi2d(win.mL)), iso(mi2d(win.mR))) : new Set<string>()),
    [schedule, win],
  );

  const toggleFilter = (f: string) => setActiveFilter((cur) => (cur === f ? null : f));
  const pickWell = (well: string) => toggleFilter(`well:${well}`);

  // Splitter drag — mouse + touch, so the Gantt/dashboard split is resizable on mobile too.
  const splitRef = useRef<HTMLDivElement>(null);
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startH = ganttH;
    const wrap = splitRef.current!;
    const move = (ev: MouseEvent | TouchEvent) => {
      if ('touches' in ev) ev.preventDefault();
      const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
      const max = wrap.clientHeight - 90;
      setGanttH(Math.max(180, Math.min(max, startH + y - startY)));
    };
    const up = () => {
      window.removeEventListener('mousemove', move as EventListener);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move as EventListener);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move as EventListener);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move as EventListener, { passive: false });
    window.addEventListener('touchend', up);
  };

  // Keyboard: ←/→ pan 3mo, t today, 1/2 presets, Esc clear, p PM.
  useEffect(() => {
    if (tab !== 'sequence') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setWin((w) => clampWindow(w.mL - 3, w.mR - 3));
      else if (e.key === 'ArrowRight') setWin((w) => clampWindow(w.mL + 3, w.mR + 3));
      else if (e.key === 't') { const s = d2mi(today()); setWin((w) => clampWindow(s, s + (w.mR - w.mL))); }
      else if (e.key === '1') { const s = d2mi(today()); setWin(clampWindow(s, s + 24)); }
      else if (e.key === '2') { const s = d2mi(today()); setWin(clampWindow(s, s + 60)); }
      else if (e.key === 'Escape') setActiveFilter(null);
      else if (e.key === 'p') setPmVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  if (!schedule) {
    return <div className="dseq"><div className="dseq-empty"><CalendarClock size={22} style={{ marginBottom: 8, opacity: .5 }} /><div>Building the Volve drilling schedule…</div></div></div>;
  }

  return (
    <div className="dseq">
      <div className="dseq-tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`dseq-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.id === 'sequence' && <CalendarClock size={12} />}
            {t.label}
            {t.id === 'sequence' && <span className="st">BETA</span>}
          </div>
        ))}
      </div>

      <div className="dseq-body">
        {tab === 'overview' && <OverviewView schedule={schedule} />}
        {tab === 'rigs' && <RigsView schedule={schedule} win={win} />}
        {tab === 'milestones' && <MilestonesView schedule={schedule} />}
        {tab === 'revisions' && <RevisionsView schedule={schedule} />}

        {tab === 'sequence' && (
          <>
            <div className="dseq-tools">
              <div className="dseg">
                <b className={win.mR - win.mL >= 23 && win.mR - win.mL <= 25 ? 'on' : ''} onClick={() => { const s = d2mi(today()); setWin(clampWindow(s, s + 24)); }}>24 Months</b>
                <b className={win.mR - win.mL >= 59 && win.mR - win.mL <= 61 ? 'on' : ''} onClick={() => { const s = d2mi(today()); setWin(clampWindow(s, s + 60)); }}>5 Years</b>
              </div>
              <div className="sp" />
              <button className={`dbtn pm${pmVisible ? ' on' : ''}`} onClick={() => setPmVisible((v) => !v)}>PM ▾</button>
              <button className={`dbtn${mapOpen ? ' on' : ''}`} onClick={() => setMapOpen((v) => !v)}><MapIcon size={12} /> MAP</button>
              <button className="dbtn" onClick={() => setInspOpen((v) => !v)} title="Toggle inspector">
                {inspOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
              </button>
            </div>

            <KpiRibbon schedule={schedule} win={win} />

            <div className={`dseq-ws${inspOpen ? '' : ' no-insp'}`}>
              <div className="dseq-stage">
                <TimeSlider win={win} onChange={setWin} activities={acts} />

                <div className="dseq-split" ref={splitRef}>
                  {activeFilter && (
                    <div className="dfbadge" onClick={() => setActiveFilter(null)}>{filterLabel(activeFilter)}</div>
                  )}
                  <div className="dgantt-pane" style={{ height: ganttH, flex: 'none' }}>
                    <DrillingGantt schedule={schedule} win={win} height={ganttH}
                      activeFilter={activeFilter} pmVisible={pmVisible} onPickWell={pickWell} />
                  </div>
                  <div className="ddrag" onMouseDown={onDragStart} onTouchStart={onDragStart}><i /><i /><i /><i /><i /></div>
                  <div className="ddash-pane">
                    <DrillingDashboard schedule={schedule} activeFilter={activeFilter} onFilter={toggleFilter} />
                  </div>
                </div>

                <div className="dlegend">
                  {LEGEND.map((l) => (
                    <div key={l.key} className={`dleg${activeFilter === l.key ? ' on' : ''}`} onClick={() => toggleFilter(l.key)}>
                      <i style={{ background: l.color }} />{l.label}
                    </div>
                  ))}
                  <span className="date">Volve · planning horizon from {new Date(schedule.meta.anchor).toLocaleDateString()}</span>
                </div>

                <DrillingFieldMap schedule={schedule} open={mapOpen} onClose={() => setMapOpen(false)}
                  activeFilter={activeFilter} onPickWell={pickWell} windowWells={windowWells} />
              </div>

              {inspOpen && <LiveRail schedule={schedule} activeFilter={activeFilter} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
