// One generated sentence per canvas — what the data says for the current scope.
//
// Deterministic and templated, never an LLM at runtime: the same scope produces
// the same sentence every time, which is what lets it be trusted and tested. It
// carries its own provenance chip, and where the data is thin it says so — a thin
// record IS the finding, and a blank panel would hide it.
import { GitBranch, Quote } from 'lucide-react';
import { planFor } from './agent-run';
import { useCanvas } from './canvas-store';
import type { Provenance } from '../../viz/palette';

export function FindingLine({ stageId, scopeName, provenance, artifactName, settled }: {
  stageId: string; scopeName: string; provenance: Provenance;
  /** The stage's output artifact. It rode on the canvas header until that header
   *  was removed for repeating the ribbon — this was the only part worth keeping. */
  artifactName?: string; settled?: boolean;
}) {
  const artifact = useCanvas((s) => s.artifacts[stageId]);
  const runStage = useCanvas((s) => s.runStage);
  const running = useCanvas((s) => s.runStatus === 'running') && runStage === stageId;

  const plan = planFor(stageId);
  // Before the run settles an artifact the line is still the plan's own finding —
  // the sentence is a function of the data, not of the run having happened.
  const text = artifact?.finding ?? plan?.finding(scopeName) ?? '';
  if (!text) return null;

  return (
    <div className={'exc-finding' + (running ? ' working' : '') + (artifact ? ' settled' : '')}>
      <Quote size={12} />
      <p>{text}</p>
      {artifactName && (
        <span className="exc-finding-artifact" title={`This stage emits ${artifactName}`}>
          <GitBranch size={10} />{artifactName}
          {settled && <b>settled</b>}
        </span>
      )}
      <span className={`exc-finding-grade ${(artifact?.provenance ?? provenance).toLowerCase()}`}>
        {artifact?.provenance ?? provenance}
        {artifact && <em>n={artifact.n.toLocaleString()}</em>}
      </span>
    </div>
  );
}
