import { MATURATION_STAGES } from './registry';

export function MaturationTree({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  let phase = '';
  return <nav className="wds-tree" aria-label="Well maturation stages">
    <div className="wds-tree-heading">Well maturation</div>
    {MATURATION_STAGES.map((stage, index) => {
      const showPhase = phase !== stage.phase;
      phase = stage.phase;
      return <div key={stage.id}>
        {showPhase && <div className="wds-tree-phase">{stage.phase}</div>}
        <button className={stage.id === active ? 'active' : ''} onClick={() => onSelect(stage.id)}>
          <stage.icon size={14} /><span>{stage.name}</span><em>{String(index + 1).padStart(2, '0')}</em>
        </button>
      </div>;
    })}
  </nav>;
}
