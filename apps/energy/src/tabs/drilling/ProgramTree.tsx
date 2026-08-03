import { DRILLING_STAGES } from './registry';

export function ProgramTree({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  let phase = '';
  return <nav className="drs-tree" aria-label="Drilling programme stages"><div className="drs-tree-heading">Drilling programme</div>{DRILLING_STAGES.map((stage, index) => {
    const showPhase = phase !== stage.phase; phase = stage.phase;
    return <div key={stage.id}>{showPhase && <div className="drs-tree-phase">{stage.phase}</div>}<button className={stage.id === active ? 'active' : ''} onClick={() => onSelect(stage.id)}><stage.icon size={14} /><span>{stage.name}</span><em>{String(index + 1).padStart(2, '0')}</em></button></div>;
  })}</nav>;
}
