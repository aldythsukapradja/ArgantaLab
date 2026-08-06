// studio-shell — the chrome the Static Model and the Simulation both wear.
//
// ── WHY THIS IS SHARED CODE AND NOT A COPY ──────────────────────────────────
//
// The two surfaces answer different questions — one builds the container, the other
// makes it flow — but the FURNITURE is the same: a title bar carrying the case
// identity, a ribbon of processes, a tree of what exists on the left, one big canvas,
// and a QC drawer on the right. A modeller who has learned one has learned the other,
// and that only holds if the two are the same code. Two copies drift within a week:
// one grows a keyboard shortcut, the other a different checkbox, and the "same shell"
// promise quietly stops being true.
//
// So the layout, the tree primitives and the view switcher live here. What differs —
// which processes, which branches, which viewers — is passed in.
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// ── TREE PRIMITIVES ─────────────────────────────────────────────────────────

export interface TreeBranchProps {
  /** stable identity for the branch — used as a key and, later, a deep link */
  id?: string;
  icon: ReactNode;
  label: string;
  count?: string;
  /** what a toggle inside this branch changes — stated once, on the branch */
  affects?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function TreeBranch({ icon, label, count, affects, children, defaultOpen = true }: TreeBranchProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-branch">
      <button className="mt-branch-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="mt-branch-icon">{icon}</span>
        <span className="mt-branch-label">{label}</span>
        {count && <span className="mt-branch-count">{count}</span>}
      </button>
      {open && (
        <div className="mt-branch-body">
          {affects && <div className="mt-affects">{affects}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

export interface TreeRowProps {
  on: boolean;
  onToggle: () => void;
  label: string;
  right?: string;
  /**
   * A CHECK is a set — any number may be on. A RADIO is a choice — exactly one is.
   * They are drawn as a square and a disc precisely so the difference is visible
   * before you click: a user who does not know which they are facing cannot predict
   * whether ticking a second row adds to the first or replaces it.
   */
  kind?: 'check' | 'radio';
  dim?: boolean;
  disabled?: boolean;
  title?: string;
}

export function TreeRow({ on, onToggle, label, right, kind = 'check', dim, disabled, title }: TreeRowProps) {
  return (
    <button
      className={`mt-row${on ? ' on' : ''}${dim ? ' dim' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      title={title}
      role={kind === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={on}
    >
      {/* the mark is drawn in CSS, not typed as a glyph: a text tick inherits the
          font's own metrics and sat visibly off-centre in its box at this size */}
      <span className={`mt-box mt-${kind}${on ? ' on' : ''}`} aria-hidden="true" />
      <span className="mt-row-label">{label}</span>
      {right && <span className="mt-row-right">{right}</span>}
    </button>
  );
}

/** "2/6" — how much of a branch is switched on, without opening it. */
export const treeCount = (on: number, total: number) => `${on}/${total}`;

export function TreeEmpty({ children }: { children: ReactNode }) {
  return <div className="mt-empty">{children}</div>;
}

export function TreeFacts({ children }: { children: ReactNode }) {
  return <div className="mt-facts">{children}</div>;
}

// ── THE SHELL ───────────────────────────────────────────────────────────────

export interface StudioView {
  id: string;
  label: string;
  icon?: ReactNode;
  /** why this view exists — the tooltip, so the switcher is not five bare words */
  hint?: string;
}

export interface StudioShellProps {
  /** the case identity: field, counts, what this model IS */
  subtitle: ReactNode;
  /** processes run, or whatever the surface counts as progress */
  progress?: ReactNode;
  /** the process ribbon */
  ribbon?: ReactNode;
  /** the left tree */
  tree?: ReactNode;
  /** view switcher */
  views?: StudioView[];
  view?: string;
  onView?: (v: string) => void;
  /** anything that belongs beside the view switcher */
  toolbar?: ReactNode;
  /** the canvas */
  children: ReactNode;
  /** the right-hand QC drawer, when open */
  aside?: ReactNode;
  asideTitle?: string;
  onCloseAside?: () => void;
  /** the tab that opens the drawer, when it is closed */
  asideTab?: { label: string; title: string; onOpen: () => void };
  /** split view puts a divider between panes */
  split?: boolean;
}

export function StudioShell({
  subtitle, progress, ribbon, tree, views, view, onView, toolbar,
  children, aside, asideTitle, onCloseAside, asideTab, split,
}: StudioShellProps) {
  return (
    <div className="sms">
      {/* No surface title. The ribbon above already names the tab and the workflow
          hint states its purpose — a third copy of the word "Simulation" here is the
          redundancy that was stripped out of the Static Model. */}
      <div className="sms-bar">
        <span className="sms-sub lead">{subtitle}</span>
        <span className="sms-sp" />
        {progress}
      </div>

      {ribbon}

      <div className="sms-shell">
        {tree}
        <div className="sms-stage">
          {(views?.length || toolbar) && (
            <div className="sms-views">
              {views?.map((v) => (
                <button key={v.id}
                  className={`sms-view${view === v.id ? ' on' : ''}`}
                  onClick={() => onView?.(v.id)}
                  title={v.hint}>
                  {v.icon}{v.label}
                </button>
              ))}
              <span className="sms-views-sp" />
              {toolbar}
            </div>
          )}
          <div className={`sms-canvas${split ? ' split' : ''}`}>{children}</div>
        </div>

        {aside ? (
          <aside className="sms-qc">
            <div className="sms-qc-head">
              <span>{asideTitle}</span>
              <button onClick={onCloseAside} title="Close">×</button>
            </div>
            {aside}
          </aside>
        ) : asideTab ? (
          <button className="sms-qc-tab" onClick={asideTab.onOpen} title={asideTab.title}>
            {asideTab.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
