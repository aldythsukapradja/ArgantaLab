import { Circle, ChevronRight } from 'lucide-react';
import type { WorkflowGroup } from './types';
import './workspace-blueprint.css';

export function WorkflowTree({ groups, active, onSelect, label }: { groups: WorkflowGroup[]; active: string; onSelect: (id: string) => void; label: string }) {
  let number = 0;
  return <nav className="wsb-tree" aria-label={`${label} workflow`}><div className="wsb-tree-title">{label}</div>{groups.map((group, groupIndex) => <section key={group.id}><div className="wsb-group"><span>{String(groupIndex + 1).padStart(2, '0')}</span><div><b>{group.name}</b><small>{group.question}</small></div></div>{group.tabs.map((tab) => { number += 1; return <button key={tab.id} className={active === tab.id ? 'active' : ''} onClick={() => onSelect(tab.id)}><Circle size={8} fill={active === tab.id ? 'currentColor' : 'none'} /><span>{tab.name}</span><em>{String(number).padStart(2, '0')}</em><ChevronRight size={11} /></button>; })}</section>)}</nav>;
}
