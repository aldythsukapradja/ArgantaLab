// Drives the simulated study run: one timer, one step at a time, pausable.
//
// The hook owns no state of its own beyond the timer handle — everything the UI
// reads lives in the canvas store, so the run log and artifact graph survive tab
// switches and the run keeps going while you look at a different stage.
import { useEffect, useRef } from 'react';
import { STUDY_PLAN } from './agent-run';
import { useCanvas } from './canvas-store';

// The plan is a module constant, so flattening it once at module scope keeps the
// effect's dependency list honest — there is no per-render array to chase.
const FLAT = STUDY_PLAN.flatMap((stage) =>
  stage.steps.map((step, stepIndex) => ({ stage, step, stepIndex })));

export function useStudyRun(scopeName: string, onStage: (stageId: string) => void) {
  const status = useCanvas((s) => s.runStatus);
  const logLength = useCanvas((s) => s.log.length);
  const advanceRun = useCanvas((s) => s.advanceRun);
  const settleArtifact = useCanvas((s) => s.settleArtifact);
  const setRunStatus = useCanvas((s) => s.setRunStatus);

  // Cursor into the flattened step list. A ref, not state: it must not re-render
  // the shell on every tick, and it must survive a pause without rewinding.
  const cursor = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;

  useEffect(() => {
    if (status === 'idle') { cursor.current = 0; return; }
    if (status !== 'running') return;
    if (cursor.current >= FLAT.length) { setRunStatus('done'); return; }

    const { stage, step, stepIndex } = FLAT[cursor.current];
    timer.current = setTimeout(() => {
      cursor.current += 1;
      // Appending to the log is what re-enters this effect and schedules the next
      // step — the run advances on state, not on a self-perpetuating timer chain.
      advanceRun(stage.stageId, stepIndex, {
        stageId: stage.stageId, step: step.label, detail: step.detail, seq: cursor.current,
      });
      // Bring the canvas to the stage being worked. This is the story thread: the
      // run walks the workspace the way a study walks its stages.
      onStageRef.current(stage.stageId);

      // The last step of a stage settles its artifact into the graph.
      if (stepIndex === stage.steps.length - 1) {
        settleArtifact({
          stageId: stage.stageId, name: stage.artifact, status: 'settled',
          provenance: stage.provenance, n: stage.n, inputs: stage.inputs,
          finding: stage.finding(scopeName),
        });
      }
    }, step.ms);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [status, logLength, scopeName, advanceRun, settleArtifact, setRunStatus]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
}
