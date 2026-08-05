// CosmoShell — the canonical ArgantaEnergy production UI,
// rendered with the founder's EXACT styles (cosmo-system.css, extracted verbatim +
// scoped; animations kept global → byte-identical). Same classes, same Lucide icons,
// same Inter/JetBrains type → 1:1 with the original design reference. Shell is now
// reproduced 1:1 from COSMO_Final.html: brand (sparkles · COSMO · AL SHAHEEN), nav
// groups COMMAND CENTER / LIFECYCLE / INTELLIGENCE / REPORT (no sovereign-tier bar),
// topbar crumbs + light/dark toggle + settings + avatar (no "+ New"), footer, and the
// Cosmonaut orb. Field Development carries the REAL, truth-locked viewers.
import { Suspense, useEffect, useState } from 'react';
import { lazyRetry } from './lazy-retry';
import {
  Compass, Layers, Wrench, Gauge, CalendarClock, LayoutDashboard, PanelLeft, PanelLeftClose, Settings, Sparkles,
  Bot, BookOpen, Database, Moon, Sun, FolderTree, FileText, File, MonitorPlay,
  Menu, GitBranch, GraduationCap,
} from 'lucide-react';
import './cosmo-system.css';
import './cosmo-fd.css';
import './cosmo-shell.css';
import { CosmoAgentOrb } from './CosmoAgentOrb';
import { CosmoSettings } from './CosmoSettings';
import { CosmoChat } from './CosmoChat';
import { CommandPalette } from '../agent/CommandPalette';
import { SurfaceErrorBoundary } from './SurfaceErrorBoundary';
import { useStore } from '../store';
import { useSession as useFieldcraftSession } from '../fieldcraft-legacy/session';
import { Cockpit } from './Cockpit';

// Keep the company-facing Cockpit lean. Scientific workspaces and their larger
// renderers/data payloads are fetched only when the operator opens that lifecycle.
const FieldDevShell = lazyRetry(async () => ({ default: (await import('../tabs/fielddev/FieldDevShell')).FieldDevShell }));
const ExplorationShell = lazyRetry(async () => ({ default: (await import('../tabs/exploration/ExplorationShell')).ExplorationShell }));
const ReservoirManagementShell = lazyRetry(async () => ({ default: (await import('../tabs/reservoir/ReservoirManagementShell')).ReservoirManagementShell }));
const IntelInsights = lazyRetry(async () => ({ default: (await import('./IntelInsights')).IntelInsights }));
const IntelAgents = lazyRetry(async () => ({ default: (await import('./IntelAgents')).IntelAgents }));
const ReportView = lazyRetry(async () => ({ default: (await import('./ReportView')).ReportView }));
const DataView = lazyRetry(async () => ({ default: (await import('./DataView')).DataView }));
const KnowledgeView = lazyRetry(async () => ({ default: (await import('./KnowledgeView')).KnowledgeView }));
const WellDeliveryShell = lazyRetry(async () => ({ default: (await import('../tabs/welldelivery/WellDeliveryShell')).WellDeliveryShell }));
const DrillingShell = lazyRetry(async () => ({ default: (await import('../tabs/drilling/DrillingShell')).DrillingShell }));
/* The current Fieldcraft: a one-page concept shell for the Volve course, built
   from scratch. The previous implementation is parked whole under
   `fieldcraft-legacy/` and still reachable from Command Center, so its decks,
   quiz bank and mission runner stay available while this one is designed. */
const Academy = lazyRetry(async () => ({ default: (await import('../academy/Academy')).Academy }));
const FieldcraftLegacy = lazyRetry(async () => ({ default: (await import('../fieldcraft-legacy/Fieldcraft')).Fieldcraft }));
/* Loaded only once a legacy Fieldcraft mission is actually running. */
const MissionHud = lazyRetry(async () => ({ default: (await import('../fieldcraft-legacy/MissionHud')).MissionHud }));

const LIFECYCLES = [
  { id: 'exploration', name: 'Exploration', icon: Compass, color: '#22d3ee', status: 'BETA', sub: 'Basins, plays, prospects and prospect-level volumes' },
  { id: 'field-development', name: 'Field Development', icon: Layers, color: '#0FB5A6', status: 'LIVE', sub: 'Static model, volumetrics, well placement and economics' },
  // Order follows the asset lifecycle: you manage the reservoir before you deliver
  // the next well against it, so Reservoir Management precedes Well Delivery.
  { id: 'reservoir-management', name: 'Reservoir Management', icon: Gauge, color: '#7c3aed', status: 'LIVE', sub: 'Surveillance, forecasting, patterns and opportunity screening' },
  { id: 'well-delivery', name: 'Well Delivery', icon: Wrench, color: '#f59e0b', status: 'BETA', sub: 'Well design, trajectory, drilling, completion and post-mortem' },
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
type SheetItem = { id: string; label: string; icon: typeof Compass; hint: string; zone: 'command' | 'vertical' | 'report' | 'intel' };
const M_GROUPS: Record<string, { title: string; items: SheetItem[] }> = {
  command: {
    title: 'Command Center',
    items: [
      { id: 'cockpit', label: 'Cockpit', icon: LayoutDashboard, hint: 'spatial intelligence · map, search, dossiers', zone: 'command' },
      { id: 'fieldcraft', label: 'Fieldcraft', icon: GraduationCap, hint: 'training · course concept', zone: 'command' },
      { id: 'learn', label: 'Learn', icon: GraduationCap, hint: 'decks, quizzes and guided missions', zone: 'command' },
    ],
  },
  verticals: { title: 'Lifecycle', items: LIFECYCLES.map((l) => ({ id: l.id, label: l.name, icon: l.icon, hint: l.sub, zone: 'vertical' })) },
  report: {
    title: 'Report',
    items: REPORT.map((t) => ({ id: t.id, label: t.name, icon: t.icon, hint: 'report · ' + t.name.toLowerCase(), zone: 'report' as const })),
  },
  intel: {
    title: 'Intelligence',
    items: INTEL.map((i) => ({ id: i.id, label: i.name, icon: i.icon, hint: 'intelligence', zone: 'intel' as const })),
  },
};
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
  // A nested surface, or an agent turn, can ask to route elsewhere (Data QC's
  // extraction gate mirror → Knowledge → Extraction Studio). We apply the top-level
  // surface here and leave the intent STANDING — the destination reads its own
  // `sub`/`mode` off the same object. Keyed on `seq` so a repeat of an identical
  // intent still re-fires. Nobody consumes it; that is what makes multi-reader
  // intents (shell takes `nav`, vertical takes `sub`) race-free.
  const viewIntent = useStore((s) => s.viewIntent);
  useEffect(() => { if (viewIntent) setNav(viewIntent.nav); }, [viewIntent?.seq, viewIntent?.nav]);
  // Field Development now owns its own tab/scope state internally (FieldDevShell).
  // What's left here is just the guided-tour bridge into its parked Legacy (v1)
  // view — CosmoChat drives Legacy directly, bumping the nonce to force it open
  // even if Legacy is already showing a different sub-tab.
  const [legacyTab, setLegacyTab] = useState('map');
  const [legacyNonce, setLegacyNonce] = useState(0);
  const [tourVolveNonce, setTourVolveNonce] = useState(0);
  const [settings, setSettings] = useState(false);
  const [chat, setChat] = useState(false);
  const [chatFull, setChatFull] = useState(false);
  /** Manual sidebar collapse. Separate from the automatic collapse the agent triggers,
   *  so closing the agent restores whatever the user had chosen rather than always
   *  re-expanding. Persisted: a rail is a working preference, not a per-visit accident. */
  const [railPinned, setRailPinned] = useState(() => {
    try { return localStorage.getItem('arganta:rail') === '1'; } catch { return false; }
  });
  const toggleRail = () => setRailPinned((v) => {
    const next = !v;
    try { localStorage.setItem('arganta:rail', next ? '1' : '0'); } catch { /* private mode */ }
    return next;
  });
  const [chatFullSignal, setChatFullSignal] = useState(0);

  // mobile shell state — off-canvas drawer + bottom sheet (ported 1:1 from source)
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);
  useEffect(() => { document.body.classList.toggle('drawer-open', drawer); return () => document.body.classList.remove('drawer-open'); }, [drawer]);
  useEffect(() => { document.body.classList.toggle('sheet-open', !!sheet); return () => document.body.classList.remove('sheet-open'); }, [sheet]);
  useEffect(() => { document.body.classList.toggle('cosmo-on', chat); return () => document.body.classList.remove('cosmo-on'); }, [chat]);
  const closeMobile = () => { setDrawer(false); setSheet(null); };
  const toggleSheet = (g: string) => { setDrawer(false); setSheet((s) => (s === g ? null : g)); };
  const sheetGo = (it: SheetItem) => {
    setSheet(null);
    setNav(it.id);
    if (it.zone === 'vertical') setLegacyTab('map');
  };

  const active = LIFECYCLES.find((l) => l.id === nav);
  const isFD = nav === 'field-development';
  const isExpl = nav === 'exploration';
  const isRM = nav === 'reservoir-management';
  const isFieldcraft = nav === 'fieldcraft';
  const isLearn = nav === 'learn';
  const fieldcraftSession = useFieldcraftSession();
  const reportItem = REPORT.find((r) => r.id === nav);
  const isReport = !!reportItem;
  const crumbLabel = active ? active.name
    : (INTEL.find((i) => i.id === nav) || reportItem
        || (isFieldcraft ? { name: 'Fieldcraft' }
          : isLearn ? { name: 'Learn' }
            : { name: 'Cockpit' })).name;

  // active bottom-nav tab — an open sheet wins; otherwise derive from the current nav.
  // Cockpit and Fieldcraft share the Command Center tab, since that sheet holds both.
  const mActive = sheet ? sheet
    : nav === 'cockpit' ? 'command'
    : LIFECYCLES.some((l) => l.id === nav) ? 'verticals'
    : isFieldcraft || isLearn ? 'command'
    : isReport ? 'report'
    : INTEL.some((i) => i.id === nav) ? 'intel' : '';

  const navItem = (item: NavItem, onClick: () => void) => {
    const on = nav === item.id;
    return (
      // data-name feeds the rail tooltip in CSS, so a collapsed icon can still say
      // what it is without duplicating the label anywhere.
      <div key={item.id} data-name={item.name} className={'navitem' + (on ? ' active' : '')} onClick={onClick}>
        <span className="d" style={!on && item.color ? { color: item.color } : undefined}><item.icon size={15} /></span>
        <span className="lbl">{item.name}</span>
      </div>
    );
  };

  return (
    // Classes are driven from STATE, not a :has() selector on the panel. :has() looked
    // tidier — the trigger really is the panel being on screen — but Chrome did not
    // invalidate padding-right or the grid tracks when the selector flipped: the rule
    // was the only active one in the cascade and the computed value stayed at 0.
    <div className={'app'
      + (railPinned ? ' rail-pinned' : '')
      + (chat ? ' agent-open' : '')
      + (chat && chatFull ? ' agent-full' : '')}>
      {/* sidebar — 1:1 COSMO */}
      <aside className="sidebar">
        <div className="brand">
          <div className="mark"><Sparkles size={16} /></div>
          <div><div className="bt">Arganta<span style={{ background: 'linear-gradient(100deg,#0FB5A6,#5fe3cf)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>Energy</span></div></div>
          <button className="rail-btn" onClick={toggleRail} aria-pressed={railPinned}
            title={railPinned ? 'Expand the sidebar' : 'Collapse the sidebar to icons'}
            aria-label={railPinned ? 'Expand the sidebar' : 'Collapse the sidebar to icons'}>
            {railPinned ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>
        <div className="nav">
          <div className="navlabel">COMMAND CENTER</div>
          {navItem({ id: 'cockpit', name: 'Cockpit', icon: LayoutDashboard }, () => { setNav('cockpit'); closeMobile(); })}
          {/* Fieldcraft sits in Command Center but stays out of the REPORT array below —
              that array drives ReportView, which cannot render this surface. */}
          {navItem({ id: 'fieldcraft', name: 'Fieldcraft', icon: GraduationCap, color: '#0FB5A6' }, () => { setNav('fieldcraft'); closeMobile(); })}
          {navItem({ id: 'learn', name: 'Learn', icon: GraduationCap, color: '#94a3b8' }, () => { setNav('learn'); closeMobile(); })}

          <div className="navlabel">LIFECYCLE</div>
          {LIFECYCLES.map((l) => navItem(l, () => { setNav(l.id); setLegacyTab('map'); closeMobile(); }))}

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
          <span className="tb-brand">
            <span className="tb-brand-mark"><Sparkles size={13} /></span>
            <span className="tb-brand-word">Arganta<em>Energy</em></span>
          </span>
          <span>ArgantaEnergy</span><span className="sep">/</span>
          {active && <><span>Lifecycle</span><span className="sep">/</span></>}
          <span className="cur">{crumbLabel}</span>
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
            <Cockpit dark={dark} onNavigate={(id) => { setNav(id); setLegacyTab('map'); closeMobile(); }} zoomVolveSignal={tourVolveNonce} />
          ) : isFD ? (
            <FieldDevShell driveLegacyTab={legacyTab} driveLegacyNonce={legacyNonce} />
        ) : isExpl ? (
          <ExplorationShell />
        ) : isRM ? (
          <ReservoirManagementShell />
        ) : nav === 'insights' ? (
          <IntelInsights />
        ) : nav === 'agents' ? (
          <IntelAgents onNavigate={(id) => { setNav(id); closeMobile(); }} />
        ) : isReport ? (
          <ReportView tab={reportItem!.name} goTab={(t) => setNav(REPORT.find((r) => r.name === t)?.id || 'manager')} />
        ) : nav === 'data' ? (
          <DataView />
        ) : nav === 'knowledge' ? (
          <KnowledgeView />
        ) : nav === 'well-delivery' ? (
          <WellDeliveryShell />
        ) : nav === 'drilling-sequence' ? (
          <DrillingShell />
        ) : isFieldcraft ? (
          <Academy />
        ) : isLearn ? (
          <FieldcraftLegacy onOpenWorkspace={(id, module) => {
            setNav(id);
            // Field Development exposes a deep-link hook, so a mission step can
            // land the learner directly on the module it is about. The other
            // verticals surface the target module in the HUD instead.
            if (id === 'field-development' && module) {
              setLegacyTab(module);
              setLegacyNonce((n) => n + 1);
            }
            closeMobile();
          }} />
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
      {/* Stroke weight is set HERE, not in CSS: lucide renders `stroke-width` as
          an SVG presentation attribute that this renderer refuses to let CSS
          override — verified, even with !important. Bolder-when-active is one of
          WhatsApp's main selected-tab cues, so it has to come from the prop. */}
      <nav className="mnav" aria-label="Primary">
        <button className={'mtab ' + (mActive === 'command' ? 'on' : '')} onClick={() => toggleSheet('command')} aria-expanded={sheet === 'command'}>
          <LayoutDashboard size={24} strokeWidth={mActive === 'command' ? 2.5 : 2.1} /><span>Cockpit</span>
        </button>
        <button className={'mtab ' + (mActive === 'verticals' ? 'on' : '')} onClick={() => toggleSheet('verticals')}>
          <GitBranch size={24} strokeWidth={mActive === 'verticals' ? 2.5 : 2.1} /><span>Lifecycle</span>
        </button>
        <button className="mtab mtab-orb" onClick={() => { setChat(true); setChatFullSignal((s) => s + 1); closeMobile(); }} aria-label="Arganta">
          <CosmoAgentOrb size={52} />
          <span className="mtab-orb-lbl">Arganta</span>
        </button>
        <button className={'mtab ' + (mActive === 'intel' ? 'on' : '')} onClick={() => toggleSheet('intel')}>
          <Sparkles size={24} strokeWidth={mActive === 'intel' ? 2.5 : 2.1} /><span>Intelligence</span>
        </button>
        <button className={'mtab ' + (mActive === 'report' ? 'on' : '')} onClick={() => toggleSheet('report')}>
          <FileText size={24} strokeWidth={mActive === 'report' ? 2.5 : 2.1} /><span>Report</span>
        </button>
      </nav>

      <CosmoChat
        open={chat}
        onClose={() => setChat(false)}
        onFullChange={setChatFull}
        fullSignal={chatFullSignal}
        onFocusCockpit={() => setNav('cockpit')}
        onZoomVolve={() => setTourVolveNonce((n) => n + 1)}
        onFieldDevTab={(t) => { setNav('field-development'); setLegacyTab(t); setLegacyNonce((n) => n + 1); }}
      />
      <CosmoSettings open={settings} onClose={() => setSettings(false)} dark={dark} setDark={setDark} />
      {/* ⌘K — the same agent as the chat, a second front door. */}
      <CommandPalette />

      {/* A running Fieldcraft mission follows the learner into whichever
          lifecycle workspace it is scoped to, so the vertical acts as the lab. */}
      {fieldcraftSession.activeMission && !isLearn && (
        <Suspense fallback={null}>
          <MissionHud onReturn={() => { setNav('learn'); closeMobile(); }} />
        </Suspense>
      )}
    </div>
  );
}
