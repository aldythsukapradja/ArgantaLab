import { Boxes, CheckCircle2, Database, GitBranch, Library, LockKeyhole, PackageOpen } from 'lucide-react';
import type { WorkflowGroup, WorkflowTab, WidgetDisposition } from './types';

const disposition: Record<WidgetDisposition, { label: string; icon: typeof Boxes }> = {
  reuse: { label: 'Reuse Legacy engine', icon: CheckCircle2 },
  adapt: { label: 'Adapt Legacy component', icon: GitBranch },
  new: { label: 'New component', icon: PackageOpen },
  'client-gated': { label: 'Client data required', icon: LockKeyhole },
};

export function WidgetBlueprintViewer({ group, tab, scope }: { group: WorkflowGroup; tab: WorkflowTab; scope: string }) {
  return <main className="wsb-viewer"><header><div><span>{group.name} · {scope}</span><h2>{tab.name}</h2><p>{tab.purpose}</p></div><div className="wsb-software"><small>Simplified analogue</small><b>{tab.software}</b></div></header><div className="wsb-audit"><article><CheckCircle2 size={13} /><span><b>Legacy strength</b>{tab.legacyStrength}</span></article><article><GitBranch size={13} /><span><b>Gap to close</b>{tab.legacyGap}</span></article><article><Library size={13} /><span><b>Planned artifact</b>{tab.output}</span></article></div><section className="wsb-widget-grid">{tab.widgets.map((spec) => { const meta = disposition[spec.disposition]; const Icon = meta.icon; return <article className={`wsb-widget ${spec.disposition}`} key={spec.title}><div className="wsb-widget-head"><div><span>Widget blueprint</span><b>{spec.title}</b></div><em><Icon size={11} />{meta.label}</em></div><p>{spec.purpose}</p><dl><div><dt><Database size={11} />Data source</dt><dd>{spec.dataSource}</dd></div><div><dt><Boxes size={11} />Visual type</dt><dd>{spec.visual}</dd></div><div><dt><Library size={11} />JS library</dt><dd>{spec.library}</dd></div><div><dt><PackageOpen size={11} />Component</dt><dd>{spec.component}</dd></div><div><dt><GitBranch size={11} />Legacy reference</dt><dd>{spec.legacyReference}</dd></div></dl></article>; })}</section><footer><b>Viewer contract</b><span>Widget plan only · no inferred client data · engines remain truth-locked</span><em>{tab.widgets.length} planned widgets</em></footer></main>;
}
