import { useEffect, useState } from 'react';
import {
  Check, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Flag, GraduationCap, Target, X,
} from 'lucide-react';
import { missionById } from './missions';
import {
  completeMission, missionStepsDone, pauseMission, requestLabsView, saveStepEvidence, useSession,
} from './session';
import './fieldcraft.css';

/**
 * The mission HUD rides alongside a lifecycle workspace.
 *
 * It is rendered by the shell rather than by Fieldcraft, so the learner keeps
 * their step list and evidence capture while working inside Exploration, Field
 * Development, Well Delivery or Reservoir Management. None of those verticals
 * needs to know anything about it.
 */
export function MissionHud({ onReturn }: { onReturn: () => void }) {
  const session = useSession();
  const mission = session.activeMission ? missionById(session.activeMission) : undefined;
  const [step, setStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  // A newly started mission always opens on its first unfinished step.
  useEffect(() => {
    if (!mission) return;
    const progress = session.missions[mission.id];
    const firstOpen = mission.steps.findIndex((s) => !(progress?.steps[s.id] ?? '').trim());
    setStep(firstOpen === -1 ? mission.steps.length - 1 : firstOpen);
    setCollapsed(false);
    // Only re-seed when the mission itself changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.id]);

  if (!mission) return null;

  const progress = session.missions[mission.id];
  const stepIds = mission.steps.map((s) => s.id);
  const done = missionStepsDone(session, mission.id, stepIds);
  const current = mission.steps[step];
  const value = progress?.steps[current.id] ?? '';
  const allDone = done === mission.steps.length;

  if (collapsed) {
    return (
      <button className="fc-hud-pill" onClick={() => setCollapsed(false)}>
        <span><Target size={14} /></span>
        <b>{mission.title}</b>
        <em>{done}/{mission.steps.length}</em>
        <ChevronsUp size={14} />
      </button>
    );
  }

  return (
    <aside className="fc-hud" aria-label={`Mission: ${mission.title}`}>
      <header>
        <span className="fc-hud-mark"><GraduationCap size={14} /></span>
        <div><small>FIELDCRAFT MISSION · DAY {mission.dayNumber}</small><b>{mission.title}</b></div>
        <button onClick={() => setCollapsed(true)} aria-label="Collapse mission"><ChevronsDown size={15} /></button>
        <button onClick={pauseMission} aria-label="Close mission"><X size={15} /></button>
      </header>

      <div className="fc-hud-scope"><Target size={11} />{mission.scope}</div>

      <div className="fc-hud-track" role="group" aria-label="Mission steps">
        {mission.steps.map((s, i) => {
          const filled = (progress?.steps[s.id] ?? '').trim().length > 0;
          return (
            <button
              key={s.id}
              className={`${i === step ? 'active' : ''} ${filled ? 'done' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}${filled ? ', captured' : ''}`}
            >{filled ? <Check size={11} /> : i + 1}</button>
          );
        })}
      </div>

      <div className="fc-hud-step">
        <small>STEP {step + 1} OF {mission.steps.length}</small>
        <b>{current.title}</b>
        {current.module && <span className="fc-hud-module"><Target size={10} />{current.module.replace(/-/g, ' ')}</span>}
        <p>{current.detail}</p>
        <label>
          <span>{current.evidence}</span>
          <textarea
            value={value}
            rows={3}
            placeholder="Capture what you found…"
            onChange={(e) => saveStepEvidence(mission.id, current.id, e.target.value)}
          />
        </label>
      </div>

      <footer>
        <button onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0} aria-label="Previous step"><ChevronLeft size={14} /></button>
        {step < mission.steps.length - 1
          ? <button className="fc-hud-next" onClick={() => setStep((n) => n + 1)}>Next step<ChevronRight size={14} /></button>
          : <button className="fc-hud-next" disabled={!allDone} onClick={() => { completeMission(mission.id, stepIds); onReturn(); }}><Flag size={13} />Submit {mission.output}</button>}
        <button className="fc-hud-return" onClick={() => { requestLabsView(); onReturn(); }}>Fieldcraft</button>
      </footer>
    </aside>
  );
}
