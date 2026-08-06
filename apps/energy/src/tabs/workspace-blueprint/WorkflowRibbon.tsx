// WorkflowRibbon — the workspace stage nav, formerly the left-hand WorkflowTree.
// Petrel's ribbon shape: every stage of the vertical is visible at once in ONE row,
// segmented into its phase groups by a rule, each segment captioned underneath.
// A caption strip below the ribbon carries the active stage's explanation, so the
// buttons themselves stay at 1–2 words and never truncate.
//
// It renders a fragment — the ribbon plus the (currently reserved) left column —
// because `.wsb-layout` is one grid: ribbon spans row 1, the drawer takes row 2
// column 1, and the stage surface auto-places into the only cell left.
import { Circle } from 'lucide-react';
import type { WorkflowGroup } from './types';
import './workspace-blueprint.css';

export function WorkflowRibbon({ groups, active, onSelect, label, drawer }: {
  groups: WorkflowGroup[];
  active: string;
  onSelect: (id: string) => void;
  label: string;
  /** The vertical's left rail — Field Development passes its Petrel Input tree. */
  /** Omit for the default empty rail; pass explicit `null` to REMOVE the column —
   *  a surface with its own tree does not want a second one beside it. */
  drawer?: React.ReactNode | null;
}) {
  const tabs = groups.flatMap((g) => g.tabs);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const step = Math.max(1, tabs.findIndex((t) => t.id === current?.id) + 1);

  return (
    <>
      <div className="wsb-ribbon">
        <nav className="wsb-ribbon-row" aria-label={`${label} workflow`}>
          {groups.map((group, groupIndex) => (
            <section
              key={group.id}
              className={'wsb-ribbon-seg' + (group.tabs.some((t) => t.id === current?.id) ? ' on' : '')}
            >
              <div className="wsb-ribbon-cmds">
                {group.tabs.map((tab) => {
                  const Icon = tab.icon ?? Circle;
                  const on = tab.id === current?.id;
                  return (
                    <button
                      key={tab.id}
                      className={'wsb-cmd' + (on ? ' active' : '')}
                      onClick={() => onSelect(tab.id)}
                      aria-current={on ? 'page' : undefined}
                      title={`${tab.name} — ${tab.purpose}`}
                    >
                      <Icon size={19} />
                      <span>{tab.short ?? tab.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="wsb-ribbon-cap" title={group.question}>
                <i>{String(groupIndex + 1).padStart(2, '0')}</i>
                <b>{group.short ?? group.name}</b>
              </div>
            </section>
          ))}
        </nav>
        {current && (
          <div className="wsb-ribbon-hint">
            <span>{current.blurb ?? current.purpose}</span>
            <em>{step}/{tabs.length}</em>
          </div>
        )}
      </div>
      {/* The left rail. A vertical supplies its own tree via `drawer`; without one the
          column normally stays empty rather than collapsing, so the canvas does not
          jump width as you move between verticals.
          An EXPLICIT null is different from an omitted prop: it means the surface has
          its own tree and does not want a second one (the Static Model does), so the
          column is genuinely removed and the canvas takes the space. */}
      {drawer !== null && <div className="wsb-drawer">{drawer}</div>}
    </>
  );
}
