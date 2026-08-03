import { STUDY_STAGES, type StudyPhase } from './registry';

const PHASES: StudyPhase[] = ['Frame', 'Model', 'System', 'Decide', 'Output'];

export function StudyTree({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <nav className="exs-tree" aria-label="Exploration study stages">
      <div className="exs-tree-h">Study workflow</div>
      {PHASES.map((phase) => {
        const stages = STUDY_STAGES.filter((stage) => stage.phase === phase);
        return stages.length ? (
          <div key={phase}>
            <div className="exs-tree-phase">{phase}</div>
            {stages.map((stage) => {
              const n = STUDY_STAGES.indexOf(stage) + 1;
              return (
                <button key={stage.id} className={'exs-tree-item' + (active === stage.id ? ' active' : '')} onClick={() => onSelect(stage.id)}>
                  <span className={'exs-tree-dot ' + stage.status} />
                  <span>{stage.shortName}</span>
                  <small>{String(n).padStart(2, '0')}</small>
                </button>
              );
            })}
          </div>
        ) : null;
      })}
    </nav>
  );
}

