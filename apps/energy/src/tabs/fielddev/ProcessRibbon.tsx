// ProcessRibbon — the processes, as a ribbon of pop-ups.
//
// Replaces the vertical Processes rail. Two tabs instead of the old four groups:
// everything that builds the STRUCTURE, and everything that fills it with PROPERTIES
// and turns those into a VOLUME. That split is the one a modeller actually works in —
// you are either making the container or filling it — and collapsing four groups into
// two returns the whole left edge of the screen to the model tree.
//
// ── GATING IS KEPT, AND MADE VISIBLE ────────────────────────────────────────
//
// The old rail disabled a process whose prerequisite had not run and said which step it
// was waiting for. That is not decoration: you cannot insert horizons into a grid that
// does not exist, and a button that runs and silently produces nothing is worse than a
// disabled one. The ribbon keeps it — a blocked button is dimmed and its tooltip names
// the step it needs.
import { useMemo } from 'react';
import { Mountain, Boxes, CheckCircle2, Lock } from 'lucide-react';
import { PROCESSES, PROCESS_BY_ID, useStatic, type ProcessId } from './static-store';

/** The two working modes. Ids are listed in the order a modeller runs them. */
export const RIBBON_TABS: Array<{ id: 'structure' | 'property'; label: string; icon: React.ReactNode; ids: ProcessId[] }> = [
  {
    id: 'structure', label: 'Structural modelling', icon: <Mountain size={13} />,
    ids: ['horizons', 'zones', 'layering', 'grid', 'contacts'],
  },
  {
    id: 'property', label: 'Petrophysics & volumes', icon: <Boxes size={13} />,
    ids: ['upscale', 'facies', 'porosity', 'permeability', 'volumes'],
  },
];

export function ProcessRibbon({ tab, onTab }: {
  tab: 'structure' | 'property';
  onTab: (t: 'structure' | 'property') => void;
}) {
  const done = useStatic((s) => s.done);
  const open = useStatic((s) => s.open);
  const windows = useStatic((s) => s.windows);

  const active = useMemo(() => RIBBON_TABS.find((t) => t.id === tab) ?? RIBBON_TABS[0], [tab]);

  /** which prerequisite is missing, if any */
  const blockedBy = (id: ProcessId): string | null => {
    const def = PROCESS_BY_ID.get(id);
    if (!def) return null;
    const missing = def.needs.filter((n) => !done.has(n));
    return missing.length ? missing.map((m) => PROCESS_BY_ID.get(m)?.label ?? m).join(', ') : null;
  };

  return (
    <div className="rb">
      <div className="rb-tabs">
        {RIBBON_TABS.map((t) => {
          const ran = t.ids.filter((i) => done.has(i)).length;
          return (
            <button key={t.id} className={`rb-tab${tab === t.id ? ' on' : ''}`} onClick={() => onTab(t.id)}>
              {t.icon}<span>{t.label}</span>
              <span className="rb-tab-count">{ran}/{t.ids.length}</span>
            </button>
          );
        })}
      </div>

      <div className="rb-actions">
        {active.ids.map((id) => {
          const def = PROCESS_BY_ID.get(id);
          if (!def) return null;
          const blocked = blockedBy(id);
          const isOpen = windows.some((w) => w.id === id);
          const ran = done.has(id);
          return (
            <button key={id}
              className={`rb-btn${isOpen ? ' open' : ''}${ran ? ' ran' : ''}`}
              disabled={!!blocked}
              onClick={() => open(id)}
              title={blocked ? `Waits on: ${blocked}` : def.purpose}>
              <span className="rb-btn-top">
                {blocked ? <Lock size={11} /> : ran ? <CheckCircle2 size={11} /> : <span className="rb-dot" />}
                {def.label}
              </span>
              <span className="rb-btn-step">{def.step}</span>
            </button>
          );
        })}
        <span className="rb-sp" />
        <span className="rb-progress">
          {done.size}/{PROCESSES.length} run
        </span>
      </div>
    </div>
  );
}
