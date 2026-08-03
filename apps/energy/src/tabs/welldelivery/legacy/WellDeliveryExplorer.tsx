// WellDeliveryExplorer — the candidate portfolio (NEW wells + sidetracks from
// Field Development) grouped by Capital Value Process gate. Mirrors the FieldDev
// explorer's role in the shell: a 264px rail feeding the canvas. Selection is
// lifted to the shell so the tabs all read the same candidate.
import { GATES, type Gate } from './types';
import type { WdCandidate } from './types';
import { roleColor } from './shared';
import './well-delivery.css';

export function WellDeliveryExplorer({ candidates, selId, onSelect }: {
  candidates: WdCandidate[]; selId: string | null; onSelect: (id: string) => void;
}) {
  const byGate = (g: Gate) => candidates.filter((c) => c.gate === g);
  return (
    <aside className="wd-explorer">
      <div className="exh">Well Delivery · Candidates</div>
      <div className="wd-tree">
        {GATES.map((g) => {
          const items = byGate(g.id);
          if (!items.length) return null;
          return (
            <div key={g.id}>
              <div className="wd-grp">{g.dg} · {g.label}</div>
              {items.map((c) => (
                <div key={c.id} className={'wd-cand' + (c.id === selId ? ' sel' : '')} onClick={() => onSelect(c.id)} style={{ position: 'relative' }}>
                  <span className="c-dot" style={{ background: roleColor(c.role) }} />
                  <div className="c-body">
                    <div className="c-name">{c.name}</div>
                    <div className="c-sub">{c.kind === 'sidetrack' ? 'sidetrack' : 'new well'} · {c.role}{c.parentWell ? ` · off ${c.parentWell}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {!candidates.length && <div className="wd-empty" style={{ fontSize: 11 }}>Loading candidates…</div>}
      </div>
    </aside>
  );
}
