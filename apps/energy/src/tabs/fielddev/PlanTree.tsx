// PlanTree — the left rail of the Field Development Suite. A decision tree, not a
// data tree (contrast CosmoExplorer's Petrel object tree, still used by Legacy):
// each row is a stage of the plan, its dot shows real progress, not folder counts.
import { STAGES, type StageManifest, type StagePhase } from './registry';

const PHASE_ORDER: StagePhase[] = ['Frame', 'Reduce', 'Design', 'Predict', 'Commit', 'Decide'];

function groupByPhase(stages: StageManifest[]) {
  const groups = new Map<StagePhase, StageManifest[]>();
  for (const s of stages) {
    if (!groups.has(s.phase)) groups.set(s.phase, []);
    groups.get(s.phase)!.push(s);
  }
  return PHASE_ORDER.filter((p) => groups.has(p)).map((p) => ({ phase: p, stages: groups.get(p)! }));
}

export function PlanTree({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  const groups = groupByPhase(STAGES);
  return (
    <nav className="fds-tree" aria-label="Development plan stages">
      <div className="fds-tree-h">Plan</div>
      {groups.map((g) => (
        <div key={g.phase}>
          <div className="fds-tree-phase">{g.phase}</div>
          {g.stages.map((s) => {
            const n = STAGES.findIndex((x) => x.id === s.id) + 1;
            return (
              <div key={s.id} className={'fds-tree-item' + (active === s.id ? ' active' : '')}
                onClick={() => onSelect(s.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(s.id); }}>
                <span className={'fds-tree-dot ' + s.status} title={s.status} />
                <span className="fds-tree-label">{s.name}</span>
                <span className="fds-tree-n">{String(n).padStart(2, '0')}</span>
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
