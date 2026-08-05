// The agentic study run, made visible.
//
// It is labelled SIMULATED because it is: no engine has executed. What is real is
// the shape — the step sequence, the file names, the record counts and the artifact
// graph all come from the audit, so when the deterministic engines land they slot
// into this exact frame.
//
// The run is also the story mode: it walks the nine stages in order, bringing the
// canvas with it, so the workspace narrates itself end to end without anyone
// touching a control.
import { Bot, CirclePause, Play, RotateCcw, Square } from 'lucide-react';
import { planFor, RUN_TOTAL_STEPS } from './agent-run';
import { useCanvas } from './canvas-store';

export function StudyRunBar({ activeStage }: { activeStage: string }) {
  const status = useCanvas((s) => s.runStatus);
  const artifacts = useCanvas((s) => s.artifacts);
  const log = useCanvas((s) => s.log);
  const startRun = useCanvas((s) => s.startRun);
  const pauseRun = useCanvas((s) => s.pauseRun);
  const resumeRun = useCanvas((s) => s.resumeRun);
  const resetRun = useCanvas((s) => s.resetRun);

  const done = Object.keys(artifacts).length;
  const pct = Math.round((log.length / RUN_TOTAL_STEPS) * 100);
  const last = log[log.length - 1];
  const current = planFor(activeStage);

  return (
    <div className={`exc-run ${status}`}>
      <div className="exc-run-head">
        <span className="exc-run-badge"><Bot size={12} />Study agent<em>simulated</em></span>

        {status === 'idle' && <button className="exc-run-go" onClick={startRun}><Play size={11} />Run the study</button>}
        {status === 'running' && <button className="exc-run-go" onClick={pauseRun}><CirclePause size={11} />Pause</button>}
        {status === 'paused' && <button className="exc-run-go" onClick={resumeRun}><Play size={11} />Resume</button>}
        {(status === 'running' || status === 'paused') && (
          <button className="exc-run-stop" onClick={resetRun} title="Stop and clear"><Square size={10} /></button>
        )}
        {status === 'done' && <button className="exc-run-go" onClick={resetRun}><RotateCcw size={11} />Run again</button>}

        <div className="exc-run-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="exc-run-count">{done}/9 artifacts</span>
      </div>

      {/* The nine-node artifact strip that used to sit here was the ribbon drawn
          twice — same nine stages, same order, one row apart. What it uniquely
          carried was the DAG (what each stage consumes), and that survives as the
          lineage readout below plus the tooltip on the current stage. */}
      {last && (
        <div className="exc-run-tail">
          <b>{last.step}</b>
          <span>{last.detail}</span>
          {current && (
            <i className="exc-run-lineage" title={current.inputs.length
              ? `${current.artifact} consumes ${current.inputs.map((id) => planFor(id)?.artifact ?? id).join(', ')}`
              : `${current.artifact} is the root artifact — it consumes nothing`}>
              {current.artifact}
              {current.inputs.length > 0 && <> ← {current.inputs.map((id) => planFor(id)?.artifact ?? id).join(' · ')}</>}
            </i>
          )}
          <em>{log.length}/{RUN_TOTAL_STEPS}</em>
        </div>
      )}
    </div>
  );
}
