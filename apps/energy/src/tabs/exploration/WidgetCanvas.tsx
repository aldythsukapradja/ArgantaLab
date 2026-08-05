// The widget canvas. Hero + two supports, no footer, no left drawer, and no
// blueprint text on the face of the card — that moved behind (i).
//
// Every widget renders its frame, its provenance chip and its chart slot. The slot
// is where the deterministic chart lands; until then it shows what it will draw and
// what it will draw it with, so a stage is never a blank rectangle.
import { Database, GitBranch, Info, Library, PackageOpen, Boxes, TriangleAlert, CheckCircle2, LockKeyhole, X } from 'lucide-react';
import type { WidgetBlueprint, WorkflowTab, WidgetDisposition } from '../workspace-blueprint/types';
import { useCanvas } from './canvas-store';
import { PROVENANCE_META } from '../../viz/palette';
import { FindingLine } from './FindingLine';
import { CHARTS } from './charts/registry';

const DISPOSITION: Record<WidgetDisposition, { label: string; icon: typeof Boxes }> = {
  reuse: { label: 'Reuse Legacy engine', icon: CheckCircle2 },
  adapt: { label: 'Adapt Legacy component', icon: GitBranch },
  new: { label: 'New component', icon: PackageOpen },
  'client-gated': { label: 'Client data required', icon: LockKeyhole },
};

export function WidgetCanvas({ tab, scope }: { tab: WorkflowTab; scope: string }) {
  const artifact = useCanvas((s) => s.artifacts[tab.id]);
  const hero = tab.widgets.find((w) => w.hero) ?? tab.widgets[0];
  const supports = tab.widgets.filter((w) => w !== hero);
  // A tab's grade is the worst of its widgets — a canvas cannot be more trustworthy
  // than the least trustworthy thing on it.
  const tabProvenance = hero.provenance ?? 'DERIVED';

  // No canvas header. The group, scope, tab name and blurb are all already on
  // screen in the scope bar and the ribbon's caption strip — repeating them here
  // cost a row and told the user nothing new. The stage's output artifact is the
  // one thing that was NOT elsewhere, so it moves onto the finding row.
  return (
    <main className="exc-canvas">
      <FindingLine
        stageId={tab.id}
        scopeName={scope}
        provenance={tabProvenance}
        artifactName={tab.output}
        settled={Boolean(artifact)}
      />
      <div className="exc-grid">
        <WidgetFrame spec={hero} tabId={tab.id} scope={scope} hero />
        <div className="exc-supports">
          {supports.map((spec) => <WidgetFrame key={spec.title} spec={spec} tabId={tab.id} scope={scope} />)}
        </div>
      </div>
    </main>
  );
}

function WidgetFrame({ spec, tabId, scope, hero = false }: {
  spec: WidgetBlueprint; tabId: string; scope: string; hero?: boolean;
}) {
  const key = `${tabId}:${spec.title}`;
  const infoOpen = useCanvas((s) => s.infoOpen) === key;
  const setInfoOpen = useCanvas((s) => s.setInfoOpen);
  const grade = spec.provenance ?? 'DERIVED';
  const meta = PROVENANCE_META[grade];
  const Chart = CHARTS[spec.component];

  return (
    <section className={`exc-widget${hero ? ' hero' : ''}${spec.disposition === 'client-gated' ? ' gated' : ''}`}>
      <header>
        <div>
          <b>{spec.title}</b>
          <span className={`exc-chip ${grade.toLowerCase()}`} title={`${meta.hint} · ${meta.fill}`}>
            <i />{grade}{spec.n !== undefined && <em>n={spec.n.toLocaleString()}</em>}
          </span>
        </div>
        <div className="exc-widget-tools">
          <button
            className={'exc-icon-btn' + (infoOpen ? ' on' : '')}
            onClick={() => setInfoOpen(key)}
            aria-expanded={infoOpen}
            title="Widget blueprint: data source, visual, library, component"
            aria-label="Widget blueprint"
          ><Info size={12} /></button>
        </div>
      </header>

      {/* The chart. A widget with no registered component falls back to its
          blueprint rather than a blank rectangle, so a gap is always visible. */}
      <div className="exc-slot" data-hero={hero}>
        {Chart ? <Chart scope={scope} /> : (
          <div className="exc-slot-inner">
            <span className="exc-slot-kicker">No chart registered · {spec.component}</span>
            <p className="exc-slot-visual">{spec.visual}</p>
            <p className="exc-slot-lib"><Library size={10} />{spec.library}</p>
          </div>
        )}
      </div>

      {spec.remark && (
        <p className="exc-remark"><TriangleAlert size={11} />{spec.remark}</p>
      )}

      {infoOpen && <WidgetInfo spec={spec} onClose={() => setInfoOpen(key)} />}
    </section>
  );
}

/** The (i) panel — the original blueprint, kept verbatim, plus the audit rows.
 *  A popover rather than a modal: the point of the panel is to explain the chart
 *  behind it, so the chart has to stay visible. */
function WidgetInfo({ spec, onClose }: { spec: WidgetBlueprint; onClose: () => void }) {
  const disposition = DISPOSITION[spec.disposition];
  const DispositionIcon = disposition.icon;
  const grade = spec.provenance ?? 'DERIVED';

  return (
    <div className="exc-info" role="dialog" aria-label={`${spec.title} blueprint`}>
      <header>
        <b>{spec.title}</b>
        <button className="exc-icon-btn" onClick={onClose} aria-label="Close blueprint"><X size={12} /></button>
      </header>
      <p className="exc-info-purpose">{spec.purpose}</p>
      <dl>
        <Row icon={<Database size={10} />} label="Data source" planned={spec.dataSource} actual={spec.dataSourceActual} />
        <Row icon={<Boxes size={10} />} label="Visual type" planned={spec.visual} />
        <Row icon={<Library size={10} />} label="JS library" planned={spec.library} />
        <Row icon={<PackageOpen size={10} />} label="Component" planned={spec.component} />
        <Row icon={<DispositionIcon size={10} />} label="Disposition" planned={disposition.label} />
        <Row icon={<GitBranch size={10} />} label="Legacy reference" planned={spec.legacyReference} />
        <Row
          icon={<i className={`exc-dot ${grade.toLowerCase()}`} />}
          label="Provenance"
          planned={`${grade} · ${PROVENANCE_META[grade].hint} · rendered as ${PROVENANCE_META[grade].fill}${spec.n !== undefined ? ` · n=${spec.n.toLocaleString()}` : ''}`}
        />
        {spec.remark && <Row icon={<TriangleAlert size={10} />} label="Remark" planned={spec.remark} warn />}
      </dl>
    </div>
  );
}

function Row({ icon, label, planned, actual, warn }: {
  icon: React.ReactNode; label: string; planned: string; actual?: string; warn?: boolean;
}) {
  return (
    <div className={warn ? 'warn' : undefined}>
      <dt>{icon}{label}</dt>
      <dd>
        {actual ? (
          <>
            <span className="exc-info-planned"><small>PLANNED</small>{planned}</span>
            <span className="exc-info-actual"><small>ACTUAL</small>{actual}</span>
          </>
        ) : planned}
      </dd>
    </div>
  );
}
