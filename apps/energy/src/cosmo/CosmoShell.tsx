// CosmoShell — the canonical ArgantaEnergy production UI,
// rendered with the founder's EXACT styles (cosmo-system.css, extracted verbatim +
// scoped; animations kept global → byte-identical). Same classes, same Lucide icons,
// same Inter/JetBrains type → 1:1 with the original design reference. Shell is now
// reproduced 1:1 from COSMO_Final.html: brand (sparkles · COSMO · AL SHAHEEN), nav
// groups COMMAND CENTER / LIFECYCLE / INTELLIGENCE / REPORT (no sovereign-tier bar),
// topbar crumbs + light/dark toggle + settings + avatar (no "+ New"), footer, and the
// Cosmonaut orb. Field Development carries the REAL, truth-locked viewers.
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Compass, Layers, Wrench, Gauge, CalendarClock, LayoutDashboard, Settings, Sparkles,
  Bot, BookOpen, Database, Moon, Sun, FolderTree, FileText, File, MonitorPlay,
  Map as MapIcon, Activity, Columns3, Grid3x3, Boxes, Waves, Box, LineChart,
  DollarSign, ClipboardCheck, Menu, GitBranch, Crosshair, PenLine,
} from 'lucide-react';
import './cosmo-system.css';
import './cosmo-fd.css';
import './cosmo-shell.css';
import { RM_TAB_ORDER, RM_VIEWERS } from '../tabs/reservoir/registry';
import type { Sel } from './CosmoExplorer';
import type { ExplSel } from './ExplorationExplorer';
import { EXPL_TAB_NAMES, explStatus } from '../tabs/exploration/registry';
import { CosmoAgentOrb } from './CosmoAgentOrb';
import { CosmoSettings } from './CosmoSettings';
import { CosmoChat } from './CosmoChat';
import { SurfaceErrorBoundary } from './SurfaceErrorBoundary';
import { Cockpit } from './Cockpit';

// Keep the company-facing Cockpit lean. Scientific workspaces and their larger
// renderers/data payloads are fetched only when the operator opens that lifecycle.
const FieldDev = lazy(async () => ({ default: (await import('../tabs/fielddev/FieldDev')).FieldDev }));
const ReservoirMgmt = lazy(async () => ({ default: (await import('../tabs/reservoir/ReservoirMgmt')).ReservoirMgmt }));
const ReservoirExplorer = lazy(async () => ({ default: (await import('../tabs/reservoir/ReservoirExplorer')).ReservoirExplorer }));
const CosmoExplorer = lazy(async () => ({ default: (await import('./CosmoExplorer')).CosmoExplorer }));
const ExplorationExplorer = lazy(async () => ({ default: (await import('./ExplorationExplorer')).ExplorationExplorer }));
const Exploration = lazy(async () => ({ default: (await import('../tabs/exploration/Exploration')).Exploration }));
const ReportView = lazy(async () => ({ default: (await import('./ReportView')).ReportView }));
const DataView = lazy(async () => ({ default: (await import('./DataView')).DataView }));
const KnowledgeView = lazy(async () => ({ default: (await import('./KnowledgeView')).KnowledgeView }));
const WellDeliveryWorkspace = lazy(async () => ({ default: (await import('../tabs/welldelivery/WellDeliveryWorkspace')).WellDeliveryWorkspace }));
const DrillingSequenceView = lazy(async () => ({ default: (await import('./welldelivery/sequence/DrillingSequenceView')).DrillingSequenceView }));

const LIFECYCLES = [
  { id: 'exploration', name: 'Exploration', icon: Compass, color: '#22d3ee', status: 'BETA', sub: 'Basins, plays, prospects and prospect-level volumes' },
  { id: 'field-development', name: 'Field Development', icon: Layers, color: '#0FB5A6', status: 'LIVE', sub: 'Static model, volumetrics, well placement and economics' },
  { id: 'well-delivery', name: 'Well Delivery', icon: Wrench, color: '#f59e0b', status: 'BETA', sub: 'Well design, trajectory, drilling, completion and post-mortem' },
  { id: 'reservoir-management', name: 'Reservoir Management', icon: Gauge, color: '#7c3aed', status: 'LIVE', sub: 'Surveillance, forecasting, patterns and opportunity screening' },
  { id: 'drilling-sequence', name: 'Drilling', icon: CalendarClock, color: '#e11d74', status: 'BETA', sub: 'Rig-by-time drilling schedule, revisions and sequence changes' },
];
const INTEL = [
  { id: 'insights', name: 'Insights', icon: Sparkles },
  { id: 'agents', name: 'Agents', icon: Bot },
  { id: 'knowledge', name: 'Knowledge', icon: BookOpen },
  { id: 'data', name: 'Data', icon: Database },
];
const REPORT = [
  { id: 'manager', name: 'Manager', icon: FolderTree },
  { id: 'report', name: 'Report', icon: FileText },
  { id: 'document', name: 'Document', icon: File },
  { id: 'presentation', name: 'Presentation', icon: MonitorPlay },
];
// mobile bottom-sheet groups (ported 1:1 from source M_GROUPS) — same items as the
// desktop nav groups, with a "hint" subline for the sheet rows.
type SheetItem = { id: string; label: string; icon: typeof Compass; hint: string; zone: 'vertical' | 'report' | 'intel' };
const M_GROUPS: Record<string, { title: string; items: SheetItem[] }> = {
  verticals: { title: 'Lifecycle', items: LIFECYCLES.map((l) => ({ id: l.id, label: l.name, icon: l.icon, hint: l.sub, zone: 'vertical' })) },
  report: { title: 'Report', items: REPORT.map((t) => ({ id: t.id, label: t.name, icon: t.icon, hint: 'report · ' + t.name.toLowerCase(), zone: 'report' })) },
  intel: {
    title: 'Intelligence',
    items: INTEL.map((i) => ({ id: i.id, label: i.name, icon: i.icon, hint: 'intelligence', zone: 'intel' as const })),
  },
};
// Field Development tabs → our real, built subtabs
const FD_TABS = [
  { id: 'map', label: 'Map', icon: MapIcon }, { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'petrophysics', label: 'Petrophysics', icon: Gauge }, { id: 'correlation', label: 'Correlation', icon: Columns3 },
  { id: 'structural', label: 'Structural', icon: Layers }, { id: 'property', label: 'Property', icon: Grid3x3 },
  { id: 'gridmodel', label: 'Static Model', icon: Boxes }, { id: 'simulation', label: 'Simulation', icon: Waves },
  { id: 'volumetrics', label: 'Volumetrics', icon: Box }, { id: 'uncertainty', label: 'Uncertainty', icon: Sparkles },
  { id: 'forecast', label: 'Forecast', icon: LineChart }, { id: 'economics', label: 'Economics', icon: DollarSign },
  { id: 'review', label: 'Field Review', icon: ClipboardCheck },
];
// Exploration tabs → the founder's canonical TAB_SPECS.exploration set (COSMO). name
// must match the router; Seismic renders the founder's spec until its canvas is built.
const EXPL_ICON: Record<string, typeof Compass> = {
  'Overview': LayoutDashboard, 'Basemap': MapIcon, 'Seismic': Waves, 'Wells': Activity,
  'Interpretation': PenLine, 'Plays & Prospects': Crosshair, 'Volumetrics': Box, 'Risk & Uncertainty': Sparkles,
};
const EXPL_TABS = EXPL_TAB_NAMES.map((name) => ({ name, icon: EXPL_ICON[name] ?? Compass, spec: explStatus(name) === 'spec' }));
// Reservoir Management tabs → the 9 COSMO sub-tabs (registry order), icons from the
// already-imported lucide set.
const RM_ICON: Record<string, typeof Compass> = {
  overview: LayoutDashboard, surveillance: Activity, production: LineChart, injection: Waves,
  pressure: Gauge, welltests: ClipboardCheck, patterns: GitBranch, forecast: Sparkles, opportunities: Box,
};
const RM_TABS = RM_TAB_ORDER.map((id) => ({ id, label: RM_VIEWERS[id].label, icon: RM_ICON[id] ?? Gauge }));

type NavItem = { id: string; name: string; icon: typeof Compass; color?: string; status?: string };

export function CosmoShell() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    html.setAttribute('data-ui', 'cosmo');
    return () => { html.removeAttribute('data-ui'); html.classList.remove('dark'); if (prevTheme) html.setAttribute('data-theme', prevTheme); };
  }, []);
  // keep BOTH theme mechanisms in sync: cosmo-system.css keys off html.dark, but the
  // shared workbench viewers (Field Development / Exploration canvases) ported from the
  // classic UI key off html[data-theme] — without this they were stuck reading the
  // no-attribute default (dark) regardless of the COSMO light/dark toggle, which is why
  // charts rendered with a black panel background while the shell chrome looked light.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', dark);
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const [nav, setNav] = useState('cockpit');
  const [tab, setTab] = useState('map');
  const [sel, setSel] = useState<Sel>(null);
  const [explTab, setExplTab] = useState<string>('Overview');
  const [explSel, setExplSel] = useState<ExplSel>(null);
  const [wdSub, setWdSub] = useState<string>('proposal');
  const [rmTab, setRmTab] = useState<string>('overview');
  const [settings, setSettings] = useState(false);
  const [chat, setChat] = useState(false);
  const [chatFullSignal, setChatFullSignal] = useState(0);

  // mobile shell state — off-canvas drawer + bottom sheet (ported 1:1 from source)
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);
  useEffect(() => { document.body.classList.toggle('drawer-open', drawer); return () => document.body.classList.remove('drawer-open'); }, [drawer]);
  useEffect(() => { document.body.classList.toggle('sheet-open', !!sheet); return () => document.body.classList.remove('sheet-open'); }, [sheet]);
  useEffect(() => { document.body.classList.toggle('cosmo-on', chat); return () => document.body.classList.remove('cosmo-on'); }, [chat]);
  const closeMobile = () => { setDrawer(false); setSheet(null); };
  const toggleSheet = (g: string) => { setDrawer(false); setSheet((s) => (s === g ? null : g)); };
  const openCockpit = () => {
    setNav('cockpit');
    setDrawer(false);
    setSheet(window.matchMedia('(max-width: 820px)').matches ? 'verticals' : null);
  };
  useEffect(() => {
    if (nav === 'cockpit' && window.matchMedia('(max-width: 820px)').matches) {
      setSheet('verticals');
    }
  }, [nav]);
  const sheetGo = (it: SheetItem) => {
    setSheet(null);
    if (it.zone === 'vertical') { setNav(it.id); setTab('map'); }
    else if (it.zone === 'report') setNav(it.id);
    else if (it.zone === 'intel') setNav(it.id);
  };

  const active = LIFECYCLES.find((l) => l.id === nav);
  const isFD = nav === 'field-development';
  const isExpl = nav === 'exploration';
  const isRM = nav === 'reservoir-management';
  const reportItem = REPORT.find((r) => r.id === nav);
  const isReport = !!reportItem;
  const crumbLabel = active ? active.name
    : (INTEL.find((i) => i.id === nav) || reportItem || { name: 'Cockpit' }).name;

  // active bottom-nav tab — an open sheet wins; otherwise derive from the current nav
  const mActive = sheet ? sheet
    : nav === 'cockpit' ? 'cockpit'
    : LIFECYCLES.some((l) => l.id === nav) ? 'verticals'
    : isReport ? 'report'
    : INTEL.some((i) => i.id === nav) ? 'intel' : '';

  const navItem = (item: NavItem, onClick: () => void) => {
    const on = nav === item.id;
    return (
      <div key={item.id} className={'navitem' + (on ? ' active' : '')} onClick={onClick}>
        <span className="d" style={!on && item.color ? { color: item.color } : undefined}><item.icon size={15} /></span>
        <span className="lbl">{item.name}</span>
        {item.status && <span className={'st st-' + item.status}>{item.status}</span>}
      </div>
    );
  };

  return (
    <div className="app">
      {/* sidebar — 1:1 COSMO */}
      <aside className="sidebar">
        <div className="brand">
          <div className="mark"><Sparkles size={16} /></div>
          <div><div className="bt">Arganta<span style={{ background: 'linear-gradient(100deg,#0FB5A6,#5fe3cf)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>Energy</span></div></div>
        </div>
        <div className="nav">
          <div className="navlabel">COMMAND CENTER</div>
          {navItem({ id: 'cockpit', name: 'Cockpit', icon: LayoutDashboard }, openCockpit)}

          <div className="navlabel">LIFECYCLE</div>
          {LIFECYCLES.map((l) => navItem(l, () => { setNav(l.id); setTab('map'); closeMobile(); }))}

          <div className="navlabel">INTELLIGENCE</div>
          {INTEL.map((n) => navItem(n, () => { setNav(n.id); closeMobile(); }))}

          <div className="navlabel">REPORT</div>
          {REPORT.map((n) => navItem(n, () => { setNav(n.id); closeMobile(); }))}
        </div>
      </aside>

      {/* topbar — direct grid child (row 1, col 2) */}
      <header className="topbar">
        <button className="mham" onClick={() => { setSheet(null); setDrawer((d) => !d); }} aria-label="Menu"><Menu size={19} /></button>
        <div className="crumbs">
          <span>ArgantaEnergy</span><span className="sep">/</span>
          {active && <><span>Lifecycle</span><span className="sep">/</span></>}
          <span className="cur">{crumbLabel}</span>
          {isFD && <><span className="sep">/</span><span className="cur">{FD_TABS.find((t) => t.id === tab)?.label}</span></>}
          {isExpl && <><span className="sep">/</span><span className="cur">{explTab}</span></>}
          {isRM && <><span className="sep">/</span><span className="cur">{RM_TABS.find((t) => t.id === rmTab)?.label}</span></>}
        </div>
        <div className="tr">
          <button className="ibtn" title="Theme" onClick={() => setDark((d) => !d)}>{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
          <button className="ibtn" title="Settings" onClick={() => setSettings(true)}><Settings size={15} /></button>
          <div className="avatar">A</div>
        </div>
      </header>

      {/* main — direct grid child (row 2, col 2). The error boundary is keyed by nav so a
          failed surface (e.g. a stale lazy chunk) shows a Reload prompt instead of white-
          screening the app, and navigating elsewhere resets it. */}
      <main className="main">
       <SurfaceErrorBoundary key={nav}>
        <Suspense fallback={(
          <div className="surface-loader" role="status">
            <span><Sparkles size={18} /></span>
            <b>Opening workspace</b>
            <small>Connecting data, evidence and viewers…</small>
          </div>
        )}>
          {nav === 'cockpit' ? (
            <Cockpit dark={dark} onNavigate={(id) => { setNav(id); setTab('map'); closeMobile(); }} />
          ) : isFD ? (
          <>
            <div className="tabs">
              {FD_TABS.map((t) => (
                <div key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <t.icon size={13} />{t.label}
                </div>
              ))}
            </div>
            <div className="fd-body">
              <CosmoExplorer sel={sel} setSel={setSel} />
              <div className="fd-canvas">
                <div className="fd-view"><FieldDev subtab={tab} /></div>
              </div>
            </div>
          </>
        ) : isExpl ? (
          <>
            <div className="tabs">
              {EXPL_TABS.map((t) => (
                <div key={t.name} className={'tab' + (explTab === t.name ? ' on' : '')} onClick={() => setExplTab(t.name)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <t.icon size={13} />{t.name}
                  {t.spec && <span className="st st-BETA" style={{ marginLeft: 2 }}>SPEC</span>}
                </div>
              ))}
            </div>
            <div className="fd-body">
              <ExplorationExplorer sel={explSel} setSel={setExplSel} />
              <div className="fd-canvas">
                <div className="fd-view"><Exploration tab={explTab} sel={explSel} setSel={setExplSel} /></div>
              </div>
            </div>
          </>
        ) : isRM ? (
          <>
            <div className="tabs">
              {RM_TABS.map((t) => (
                <div key={t.id} className={'tab' + (rmTab === t.id ? ' on' : '')} onClick={() => setRmTab(t.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <t.icon size={13} />{t.label}
                </div>
              ))}
            </div>
            <div className="fd-body">
              <ReservoirExplorer />
              <div className="fd-canvas">
                <div className="fd-view"><ReservoirMgmt subtab={rmTab} /></div>
              </div>
            </div>
          </>
        ) : isReport ? (
          <ReportView tab={reportItem!.name} goTab={(t) => setNav(REPORT.find((r) => r.name === t)?.id || 'manager')} />
        ) : nav === 'data' ? (
          <DataView />
        ) : nav === 'knowledge' ? (
          <KnowledgeView />
        ) : nav === 'well-delivery' ? (
          <WellDeliveryWorkspace tab={wdSub} setTab={setWdSub} />
        ) : nav === 'drilling-sequence' ? (
          <DrillingSequenceView />
          ) : (
          <div className="content">
            <div className="ph" style={{ height: '100%' }}>
              <div className="phi">{active ? <active.icon size={24} /> : <LayoutDashboard size={24} />}</div>
              <div className="pht">{crumbLabel} — coming online</div>
              <div className="phs">This surface comes online as we build ArgantaEnergy out region by region.</div>
            </div>
          </div>
          )}
        </Suspense>
       </SurfaceErrorBoundary>
      </main>

      {/* footer — spans full width (row 3) */}
      <footer className="footer">
        <span>ARGANTAENERGY · WORLD PETROLEUM</span>
        <span>ACTIVE FIELD · VOLVE · NORTH SEA</span>
        <span style={{ marginLeft: 'auto' }}>EVIDENCE-NATIVE · TRUTH-LOCKED</span>
      </footer>

      {/* Arganta agent orb — opens the animated chat canvas */}
      <div className={'orb-host' + (chat ? ' hidden' : '')} title="Ask Arganta" onClick={() => setChat(true)}>
        <div className="orb-label">Ask <b>Arganta</b></div>
        <CosmoAgentOrb size={64} />
      </div>

      {/* ===== mobile UI — off-canvas drawer scrim + bottom sheet + bottom nav ===== */}
      <div className="mscrim" onClick={closeMobile} />
      <div className="msheet" role="dialog" aria-label="section menu">
        <div className="msheet-grip" />
        <div className="msheet-title">{sheet ? M_GROUPS[sheet].title : ''}</div>
        <div className="msheet-items">
          {sheet && M_GROUPS[sheet].items.map((it) => {
            const on = nav === it.id;
            return (
              <div className={'msheet-item ' + (on ? 'on' : '')} key={it.id} onClick={() => sheetGo(it)}>
                <span className="mi-ic"><it.icon size={16} /></span>
                <span><span className="mi-t">{it.label}</span><br /><span className="mi-s">{it.hint}</span></span>
              </div>
            );
          })}
        </div>
      </div>
      <nav className="mnav" aria-label="Primary">
        <button className={'mtab ' + (mActive === 'cockpit' ? 'on' : '')} onClick={openCockpit}>
          <LayoutDashboard size={23} strokeWidth={1.7} /><span>Cockpit</span>
        </button>
        <button className={'mtab ' + (mActive === 'verticals' ? 'on' : '')} onClick={() => toggleSheet('verticals')}>
          <GitBranch size={23} strokeWidth={1.7} /><span>Lifecycle</span>
        </button>
        <button className="mtab mtab-orb" onClick={() => { setChat(true); setChatFullSignal((s) => s + 1); closeMobile(); }} aria-label="Arganta">
          <CosmoAgentOrb size={52} />
          <span className="mtab-orb-lbl">Arganta</span>
        </button>
        <button className={'mtab ' + (mActive === 'report' ? 'on' : '')} onClick={() => toggleSheet('report')}>
          <FileText size={23} strokeWidth={1.7} /><span>Report</span>
        </button>
        <button className={'mtab ' + (mActive === 'intel' ? 'on' : '')} onClick={() => toggleSheet('intel')}>
          <Sparkles size={23} strokeWidth={1.7} /><span>Intelligence</span>
        </button>
      </nav>

      <CosmoChat open={chat} onClose={() => setChat(false)} fullSignal={chatFullSignal} />
      <CosmoSettings open={settings} onClose={() => setSettings(false)} dark={dark} setDark={setDark} />
    </div>
  );
}
