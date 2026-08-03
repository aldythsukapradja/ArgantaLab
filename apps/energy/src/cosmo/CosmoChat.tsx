// CosmoChat — the animated Cosmonaut, ported 1:1 from COSMO_Final.html (function
// Cosmonaut + its deps). Streaming assistant reply with a blinking caret + typing dots,
// a three-pane canvas (History/Artifacts/Library · chat · artifact preview), device
// frames (Full/16:9/4:3/Tablet/Phone), live artifacts (radial data-map tree, production
// chart, rendered markdown note), sovereign model picker, usage meters, suggestion chips
// and an 80%-screen artifact modal. Uses the founder's exact classes (cosmo-system.css).
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  PanelLeft, PanelRight, Plus, Maximize2, Minimize2, X, Paperclip, Wrench, ChevronDown,
  Lock, ArrowUp, Gauge, BatteryMedium, Shield, Maximize, Monitor, Tv, Tablet, Smartphone,
  GitFork, FileText, BarChart3, Expand, Download, Image as ImageIcon, Gem, Map as MapIcon,
  Box, Waves, TrendingUp, Loader2,
} from 'lucide-react';
import { CosmoAgentOrb } from './CosmoAgentOrb';
import { SurfaceErrorBoundary } from './SurfaceErrorBoundary';
import { loadIndex } from '../wb/load';

// Real, already-built Field Development viewers — the chat never re-implements these, it only
// calls them. Lazy-loaded so the always-mounted chat overlay doesn't pull their weight (canvas,
// three.js internals, etc.) into every page's initial bundle.
const LiveMapView = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/MapView')).MapView }));
const LiveGridModelView = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/GridModelView')).GridModelView }));
const LiveSimulationView = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/SimulationView')).SimulationView }));
const LiveForecast = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/Forecast')).Forecast }));
const LiveLogsView = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/LogsView')).LogsView }));
const LivePetrophysics = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/Petrophysics')).Petrophysics }));
const LiveCorrelationView = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/CorrelationView')).CorrelationView }));
const LiveStructural = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/Structural')).Structural }));
const LiveProperty = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/Property')).Property }));
const LiveVolumetrics = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/Volumetrics')).Volumetrics }));
const LiveUncertainty = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/Uncertainty')).Uncertainty }));
const LiveEconomics = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/Economics')).Economics }));
const LiveFieldReview = lazy(async () => ({ default: (await import('../tabs/fielddev/legacy/FieldReview')).FieldReview }));

// ── data (verbatim from source) ─────────────────────────────────────────────
const CC_SESSIONS = [
  { id: 's1', title: 'Volve — production review', meta: 'today · FRONTIER' },
  { id: 's2', title: 'FD volumetrics — P90/P50/P10', meta: '2d ago · SOVEREIGN' },
  { id: 's3', title: 'Opportunity screening shortlist', meta: '4d ago · DETERMINISTIC' },
];
type CCModel = { id: string; name: string; desc: string; weight: number; ctx: string; badge?: string; locked?: boolean };
const CC_MODELS: Array<{ group: string; tier: string; tc: string; models: CCModel[] }> = [
  { group: 'SOVEREIGN · on-prem', tier: 'SOV', tc: '#2563eb', models: [
    { id: 'arganta-lite', name: 'Arganta Lite', desc: 'Fast local model for everyday lookups', weight: 1, ctx: '128K' },
    { id: 'arganta-core', name: 'Arganta Core', desc: 'Balanced sovereign default · analysis & synthesis', weight: 2, ctx: '200K', badge: 'DEFAULT' },
  ] },
  { group: 'WORKER · agent runtime', tier: 'WRK', tc: '#0FB5A6', models: [
    { id: 'arganta-agent', name: 'Arganta Agent', desc: 'Tool-using workstream agent runtime', weight: 2, ctx: '200K' },
  ] },
  { group: 'FRONTIER · cloud (gated)', tier: 'FRO', tc: '#7c3aed', models: [
    { id: 'arganta-frontier', name: 'Arganta Frontier', desc: 'Deep reasoning for hard, multi-step work', weight: 3, ctx: '1M', locked: true },
  ] },
];
const CC_MODEL_BY_ID = (id: string) =>
  CC_MODELS.flatMap((g) => g.models.map((m) => ({ ...m, tier: g.tier, tc: g.tc }))).find((m) => m.id === id);
const DEV_LABEL: Record<string, string> = { full: 'responsive · full width', ar169: '16:9 · 900 px', ar43: '4:3 · 760 px', tablet: 'tablet · 768 px', mobile: 'phone · 390 px' };
const CC_ARTIFACTS = [
  { id: 'a1', icon: 'file-text', name: 'Oil vs water rate — chart' },
  { id: 'a2', icon: 'gem', name: 'Volumetrics summary — table' },
  { id: 'a3', icon: 'map', name: 'Structure map — snapshot' },
];
const ORG_STAGES = [
  { id: 'corporate', name: 'Corporate', c: '#0a8a7f' },
  { id: 'exploration', name: 'Exploration', c: '#22d3ee' },
  { id: 'field-development', name: 'Field Development', c: '#0FB5A6' },
  { id: 'well-delivery', name: 'Well Delivery', c: '#f59e0b' },
  { id: 'reservoir-management', name: 'Reservoir Management', c: '#7c3aed' },
  { id: 'drilling-sequence', name: 'Drilling', c: '#e11d74' },
];
const artIcon = (name: string, size = 12) =>
  name === 'gem' ? <Gem size={size} /> : name === 'map' ? <MapIcon size={size} /> : <FileText size={size} />;

// FDP knowledge-base note (rendered inside the artifact "Note" tab — placeholder canvas)
const FDP_NOTE = `# Field Development — Volve

> [!note] Evidence-native plan
Every figure below is traceable to a source in the data map.

## Static model
- **Structure**: Hugin Fm top/base + BCU depth surfaces, gridded on a faulted framework
- **Property model**: facies-conditioned porosity & permeability (SIS + SGS)
- **Contacts**: OWC honoured per fault block

## Volumetrics
- **STOIIP** P90 / P50 / P10 from the property realisations
- **Recovery factor** by drive mechanism, benchmarked against analogs

## Development
- Well placement follows sweep and attic-oil screening
- Economics ranks the program on NPV and break-even`;

// ── minimal markdown → HTML (bold · headings · bullets · callouts) ───────────
function mdToHtml(md: string) {
  const src = String(md || '');
  const lines = src.split('\n');
  const out: string[] = [];
  let inList = false;
  const close = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline = (s: string) => s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a class="wl">$2</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="wl">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^> \[!(\w+)\]\s*(.*)$/))) { close(); out.push(`<div class="cal cal-${m[1].toLowerCase()}"><b>${inline(m[2] || m[1])}</b></div>`); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { close(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    close(); out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join('');
}

// ── live artifacts ──────────────────────────────────────────────────────────
function CosmoMiniTree() {
  const cx = 170, cy = 150, R = 110, stages = ORG_STAGES;
  return (
    <>
      <svg viewBox="0 0 340 300" className="mini-tree">
        {stages.map((s, i) => {
          const a = -Math.PI / 2 + (i / stages.length) * Math.PI * 2;
          const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
          return (
            <g key={s.id}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="8" fill={s.c} />
              <text x={x} y={y + (Math.sin(a) > 0 ? 22 : -14)} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="var(--ink2)">{s.name.split(' ')[0]}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="15" fill="var(--teal)" />
        <circle cx={cx} cy={cy} r="22" fill="none" stroke="var(--teal)" strokeOpacity=".35" strokeWidth="1.5" />
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">NS</text>
      </svg>
      <div className="mini-legend">{stages.map((s) => <span key={s.id}><i style={{ background: s.c }} />{s.name}</span>)}</div>
    </>
  );
}
function CosmoMiniChart() {
  const data: Array<[string, number, string]> = [['Exploration', 42, '#22d3ee'], ['Field Dev', 88, '#0FB5A6'], ['Well Del', 63, '#f59e0b'], ['Reservoir', 95, '#7c3aed'], ['Drilling', 54, '#e11d74']];
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>Documents by lifecycle</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 6 }}>live · rendered from the data map</div>
      <div className="mini-bars">{data.map((d) => <div className="b" key={d[0]} style={{ height: d[1] + '%', background: `linear-gradient(${d[2]},${d[2]}88)` }} title={d[0]} />)}</div>
      <div className="mini-legend">{data.map((d) => <span key={d[0]}><i style={{ background: d[2] }} />{d[0]}</span>)}</div>
    </div>
  );
}
function MdCanvas({ md }: { md: string }) {
  return (
    <div className="obs fadein">
      <div className="obs-body" dangerouslySetInnerHTML={{ __html: mdToHtml(md) }} />
      <div className="obs-tag"><FileText size={11} /> markdown canvas · rendered placeholder · no build</div>
    </div>
  );
}

type Msg = {
  role: 'user' | 'assistant'; text: string; done: boolean;
  wellPick?: LiveIntent; tourWellPick?: boolean; assistWellPick?: boolean; confirmPick?: boolean;
};
type StreamFlags = { wellPick?: LiveIntent; tourWellPick?: boolean; assistWellPick?: boolean; confirmPick?: boolean };
const WELCOME: Msg = { role: 'assistant', text: 'Welcome to **Arganta** — the ArgantaEnergy orchestrator. The active field is **Volve**. Ask me to **map**, **model**, **simulate** or **forecast** a well, or open the artifact pane to see live content.', done: true };
const CANNED = `Here is the **Volve** lifecycle at a glance:\n\n- **Exploration** · BETA\n- **Field Development** · LIVE\n- **Well Delivery** · BETA\n- **Reservoir Management** · LIVE\n- **Drilling** · BETA\n\nOpen the artifact pane on the right to inspect the live data-map tree, a rendered knowledge-base note, or a production chart. Or ask me to **map**, **build a 3D model**, **simulate** or **forecast** a well — I'll pull up the real Field Development viewer.`;

// ── live-intent detection: map / 3D model / simulate / forecast a specific well ──────────────
type LiveIntent = 'map' | 'model3d' | 'sim' | 'forecast';
const INTENT_COPY: Record<LiveIntent, { verb: string; prompt: string; loading: string; title: string; file: string }> = {
  map: { verb: 'map', prompt: 'Sure — which well should I center the structure map on?', loading: 'Opening the structure map', title: 'Structure map', file: 'structure-map.live' },
  model3d: { verb: 'build a 3D model for', prompt: 'Which well should the 3D static model focus on?', loading: 'Opening the 3D static model', title: '3D static model', file: 'static-model-3d.live' },
  sim: { verb: 'simulate', prompt: 'Which well should I run the simulation for? It renders with the full animation.', loading: 'Opening the simulation, with animation', title: 'Simulation (animated)', file: 'simulation-3d.live' },
  forecast: { verb: 'forecast', prompt: "Which well's production forecast would you like to see?", loading: 'Opening the production forecast', title: 'Production forecast', file: 'forecast.live' },
};
function detectIntent(text: string): LiveIntent | null {
  const t = text.toLowerCase();
  if (/\bsimulat/.test(t)) return 'sim';
  if (/\b(3d|static)\s*model|grid\s*model/.test(t)) return 'model3d';
  if (/\bforecast/.test(t)) return 'forecast';
  if (/\bmap\b/.test(t)) return 'map';
  return null;
}
function ArtLoading({ label }: { label: string }) {
  return <div className="cc-art-loading"><Loader2 size={16} className="spin" /> {label}…</div>;
}

// ── the shared Field Development step spine — one source of truth for both tour modes:
// "FDP AI Assist" (renders each real viewer inside the chat, asks a well every step) and
// "FDP Agentic" (drives the real app's tabs directly, asks a well once, slower + one HITL pause).
const ASSIST_LABEL = 'FDP AI Assist · Volve';
const AGENTIC_LABEL = 'FDP Agentic · Volve';
type FdpStep = {
  tab: string; label: string; artifact: string;
  narrate: (well: string) => string;
  askWell?: boolean;       // agentic mode: pause for a well pick at this step
  confirmBefore?: boolean; // agentic mode: pause for a human "continue?" before this step
};
const FDP_STEPS: FdpStep[] = [
  { tab: 'map', label: 'Map', artifact: 'map', narrate: (w) => `Locating **${w}** on the structure map and centering the view…` },
  { tab: 'logs', label: 'Logs', artifact: 'logs', askWell: true, narrate: (w) => `Pulling **${w}**'s composite logs and rendering the curve tracks…` },
  { tab: 'petrophysics', label: 'Petrophysics', artifact: 'petrophysics', narrate: (w) => `Recomputing porosity, Vsh and water saturation from **${w}**'s logs…` },
  { tab: 'correlation', label: 'Correlation', artifact: 'correlation', narrate: (w) => `Correlating **${w}** against its offset wells along the marked picks…` },
  { tab: 'structural', label: 'Structural', artifact: 'structural', narrate: (w) => `Rebuilding the fault-block framework around **${w}**…` },
  { tab: 'property', label: 'Property', artifact: 'property', narrate: (w) => `Conditioning the porosity/permeability property model near **${w}**…` },
  { tab: 'gridmodel', label: 'Static Model', artifact: 'gridmodel', narrate: (w) => `Assembling the 3D static grid and draping **${w}**'s trajectory…` },
  { tab: 'simulation', label: 'Simulation', artifact: 'simulation', confirmBefore: true, narrate: (w) => `Running the flow simulation and animating saturation fronts around **${w}**…` },
  { tab: 'volumetrics', label: 'Volumetrics', artifact: 'volumetrics', narrate: (w) => `Rolling up STOIIP and recovery ranges for **${w}**'s drainage area…` },
  { tab: 'uncertainty', label: 'Uncertainty', artifact: 'uncertainty', narrate: (w) => `Sampling the P90/P50/P10 uncertainty band around **${w}**…` },
  { tab: 'forecast', label: 'Forecast', artifact: 'forecast', narrate: (w) => `Projecting **${w}**'s production forecast from the history-matched decline…` },
  { tab: 'economics', label: 'Economics', artifact: 'economics', narrate: (w) => `Running NPV and break-even economics on **${w}**'s development case…` },
  { tab: 'review', label: 'Field Review', artifact: 'review', narrate: (w) => `Compiling the Field Review summary for **${w}**…` },
];
const AGENTIC_STEP_MS = 3200; // deliberate, "full agentic" pacing
const ASSIST_STEP_MS = 1400;

// ── the Arganta canvas ───────────────────────────────────────────────────────
export function CosmoChat({ open, onClose, fullSignal, onFocusCockpit, onZoomVolve, onFieldDevTab }: {
  open: boolean;
  onClose: () => void;
  fullSignal?: number;
  /** guided-tour hooks — CosmoShell owns nav/tab, so the tour drives it through these */
  onFocusCockpit?: () => void;
  onZoomVolve?: () => void;
  onFieldDevTab?: (tab: string) => void;
}) {
  const [full, setFull] = useState(false);
  // mobile Cosmonaut orb tap opens the canvas straight to full-screen (source openCosmoFull)
  useEffect(() => { if (fullSignal) setFull(true); }, [fullSignal]);
  const [leftTab, setLeftTab] = useState('history');
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [device, setDevice] = useState('full');
  const [model, setModel] = useState('arganta-core');
  const [mopen, setMopen] = useState(false);
  const [draft, setDraft] = useState('');
  const [artifact, setArtifact] = useState<string>('note');
  const [artFull, setArtFull] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [pendingIntent, setPendingIntent] = useState<LiveIntent | null>(null);
  const [activeWell, setActiveWell] = useState<string | null>(null);
  const [wells, setWells] = useState<string[]>([]);
  const [tourKind, setTourKind] = useState<'assist' | 'agentic' | null>(null);
  const touring = tourKind !== null;
  const tourStepRef = useRef(0);
  const tourTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cm = CC_MODEL_BY_ID(model) || ({} as ReturnType<typeof CC_MODEL_BY_ID> & object) as NonNullable<ReturnType<typeof CC_MODEL_BY_ID>>;
  const chips = [ASSIST_LABEL, AGENTIC_LABEL, 'Map a well', 'Simulate a well', 'Forecast a well'];

  // real Volve well roster (wb/index.json) — used only to populate the "which well?" picker
  useEffect(() => { loadIndex().then((idx) => setWells(idx.wells.map((w) => w.name))).catch(() => setWells([])); }, []);

  const FDP_ARTIFACT_VIEW: Record<string, React.ReactNode> = {
    map: <LiveMapView />, logs: <LiveLogsView />, petrophysics: <LivePetrophysics />,
    correlation: <LiveCorrelationView />, structural: <LiveStructural />, property: <LiveProperty />,
    gridmodel: <LiveGridModelView />, simulation: <LiveSimulationView />, volumetrics: <LiveVolumetrics />,
    uncertainty: <LiveUncertainty />, forecast: <LiveForecast />, economics: <LiveEconomics />, review: <LiveFieldReview />,
  };
  const renderArtifact = () => {
    if (artifact === 'model3d') return <Suspense fallback={<ArtLoading label="Loading 3D static model" />}><LiveGridModelView /></Suspense>;
    if (artifact === 'sim') return <Suspense fallback={<ArtLoading label="Loading simulation" />}><LiveSimulationView /></Suspense>;
    if (FDP_ARTIFACT_VIEW[artifact]) return <Suspense fallback={<ArtLoading label={`Loading ${ARTIFACT_META[artifact]?.title ?? artifact}`} />}>{FDP_ARTIFACT_VIEW[artifact]}</Suspense>;
    return artifact === 'note' ? <MdCanvas md={FDP_NOTE} /> : artifact === 'tree' ? <CosmoMiniTree /> : <CosmoMiniChart />;
  };
  const ARTIFACT_META: Record<string, { file: string; title: string }> = {
    tree: { file: 'data-map.tree', title: 'Data-map tree' },
    note: { file: 'fdp.md', title: 'Knowledge-base note' },
    chart: { file: 'field-production.chart', title: 'Field production chart' },
    ...Object.fromEntries(FDP_STEPS.map((s) => [s.artifact, { file: `${s.tab}.live`, title: `${s.label}${activeWell ? ` — ${activeWell}` : ''}` }])),
    map: { file: INTENT_COPY.map.file, title: `${INTENT_COPY.map.title}${activeWell ? ` — ${activeWell}` : ''}` },
    model3d: { file: INTENT_COPY.model3d.file, title: `${INTENT_COPY.model3d.title}${activeWell ? ` — ${activeWell}` : ''}` },
    sim: { file: INTENT_COPY.sim.file, title: `${INTENT_COPY.sim.title}${activeWell ? ` — ${activeWell}` : ''}` },
    forecast: { file: INTENT_COPY.forecast.file, title: `${INTENT_COPY.forecast.title}${activeWell ? ` — ${activeWell}` : ''}` },
  };

  const streamAssistant = (fullText: string, flags?: StreamFlags) => {
    if (streamRef.current) clearInterval(streamRef.current);
    setMsgs((m) => [...m, { role: 'assistant', text: '', done: false, ...flags }]);
    let i = 0;
    streamRef.current = setInterval(() => {
      i += Math.max(2, Math.round(fullText.length / 90));
      setMsgs((m) => { const c = [...m]; const last = c[c.length - 1]; c[c.length - 1] = { ...last, text: fullText.slice(0, i) }; return c; });
      if (i >= fullText.length) {
        if (streamRef.current) clearInterval(streamRef.current); streamRef.current = null;
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], done: true }; return c; });
      }
    }, 26);
  };
  const send = (text?: string) => {
    const t = (text != null ? text : draft).trim(); if (!t) return;
    setMsgs((m) => [...m, { role: 'user', text: t, done: true }]); setDraft('');
    const intent = detectIntent(t);
    if (intent) {
      setPendingIntent(intent);
      setTimeout(() => streamAssistant(INTENT_COPY[intent].prompt, { wellPick: intent }), 240);
      return;
    }
    setTimeout(() => streamAssistant(CANNED), 240);
  };
  // the well-picker step — a real chip list from the wb well roster; selecting one renders the
  // real Field Development viewer for that intent in the artifact pane.
  const selectWell = (well: string) => {
    if (!pendingIntent) return;
    const intent = pendingIntent;
    setPendingIntent(null);
    setMsgs((m) => [...m, { role: 'user', text: well, done: true }]);
    setActiveWell(well);
    setArtifact(intent);
    setShowRight(true);
    setTimeout(() => streamAssistant(`${INTENT_COPY[intent].loading} for **${well}**. Opening the artifact pane →`), 200);
  };
  const tourTimeout = (fn: () => void, ms: number) => { tourTimers.current.push(setTimeout(fn, ms)); };

  // ── Mode 1 — "FDP AI Assist": every step renders the real viewer INSIDE the chat's artifact
  // pane, with process-flavored narration ("locating…", "recomputing…") instead of a flat
  // "Opening X". Pauses at every single step to ask which well, per the requested behavior.
  const runAssistStep = () => {
    const i = tourStepRef.current;
    if (i >= FDP_STEPS.length) {
      setTourKind(null);
      tourTimeout(() => streamAssistant("That's the full FDP AI Assist walkthrough on **Volve** — every tab, well by well."), 200);
      return;
    }
    const step = FDP_STEPS[i];
    onFieldDevTab?.(step.tab); // keep the real app's tab in sync in the background too
    tourTimeout(() => streamAssistant(`Which well should I use for **${step.label}**?`, { assistWellPick: true }), 250);
  };
  const startAssistTour = () => {
    if (touring) return;
    setMsgs((m) => [...m, { role: 'user', text: ASSIST_LABEL, done: true }]);
    setTourKind('assist');
    tourStepRef.current = 0;
    onFocusCockpit?.();
    tourTimeout(() => {
      streamAssistant("Starting the FDP AI Assist walkthrough on **Volve** — I'll ask for a well at every step and show you the real view here.");
      tourTimeout(() => runAssistStep(), ASSIST_STEP_MS);
    }, 240);
  };
  const selectAssistWell = (well: string) => {
    const step = FDP_STEPS[tourStepRef.current];
    setActiveWell(well);
    setMsgs((m) => [...m, { role: 'user', text: well, done: true }]);
    setArtifact(step.artifact);
    setShowRight(true);
    tourTimeout(() => {
      streamAssistant(step.narrate(well));
      tourStepRef.current += 1;
      tourTimeout(() => runAssistStep(), ASSIST_STEP_MS);
    }, 220);
  };

  // ── Mode 2 — "FDP Agentic": drives the REAL app (Cockpit → Field Development tabs), slower
  // and deliberate, with one human-in-the-loop confirmation partway through (after the static
  // model, before running the simulation) in addition to the single well pick at Logs.
  const runAgenticStep = () => {
    const i = tourStepRef.current;
    if (i >= FDP_STEPS.length) {
      setTourKind(null);
      tourTimeout(() => streamAssistant("That's the full FDP Agentic walkthrough on **Volve** — map through Field Review."), 200);
      return;
    }
    const step = FDP_STEPS[i];
    if (step.confirmBefore) {
      tourTimeout(() => streamAssistant(`Static model is built. Continue to **${step.label}**?`, { confirmPick: true }), 300);
      return; // paused here — resumeAgenticAfterConfirm() continues
    }
    onFieldDevTab?.(step.tab);
    if (step.askWell) {
      tourTimeout(() => streamAssistant(`Opening **${step.label}** — which well should I pull it for?`, { tourWellPick: true }), 250);
      return; // paused here — selectTourWell() resumes the sequence
    }
    tourTimeout(() => {
      streamAssistant(`Opening **${step.label}**…`);
      tourStepRef.current = i + 1;
      tourTimeout(() => runAgenticStep(), AGENTIC_STEP_MS);
    }, 250);
  };
  const startAgenticTour = () => {
    if (touring) return;
    setMsgs((m) => [...m, { role: 'user', text: AGENTIC_LABEL, done: true }]);
    setTourKind('agentic');
    tourStepRef.current = 0;
    onFocusCockpit?.();
    tourTimeout(() => {
      streamAssistant('Opening the 3D globe, then zooming into **Volve** in 2D…');
      onZoomVolve?.();
      tourTimeout(() => runAgenticStep(), AGENTIC_STEP_MS);
    }, 240);
  };
  const selectTourWell = (well: string) => {
    setActiveWell(well);
    setMsgs((m) => [...m, { role: 'user', text: well, done: true }]);
    tourStepRef.current += 1;
    tourTimeout(() => {
      streamAssistant(`Got it — **${well}**. Continuing the walkthrough…`);
      tourTimeout(() => runAgenticStep(), AGENTIC_STEP_MS);
    }, 200);
  };
  const confirmAgenticContinue = () => {
    // resumes past the confirm gate directly — does NOT call runAgenticStep() (which would just
    // hit the same confirmBefore check again and re-ask forever).
    const i = tourStepRef.current;
    const step = FDP_STEPS[i];
    setMsgs((m) => [...m, { role: 'user', text: 'Continue', done: true }]);
    onFieldDevTab?.(step.tab);
    tourTimeout(() => {
      streamAssistant(`Opening **${step.label}**…`);
      tourStepRef.current = i + 1;
      tourTimeout(() => runAgenticStep(), AGENTIC_STEP_MS);
    }, 250);
  };
  const pauseAgenticTour = () => {
    setMsgs((m) => [...m, { role: 'user', text: 'Pause', done: true }]);
    setTourKind(null);
    tourTimeout(() => streamAssistant('Paused the walkthrough — say the word whenever you want to pick it back up.'), 200);
  };

  const onNew = () => {
    if (streamRef.current) clearInterval(streamRef.current);
    tourTimers.current.forEach(clearTimeout); tourTimers.current = [];
    setMsgs([WELCOME]); setPendingIntent(null); setActiveWell(null); setTourKind(null);
  };
  useEffect(() => () => {
    if (streamRef.current) clearInterval(streamRef.current);
    tourTimers.current.forEach(clearTimeout);
  }, []);

  const leftBody = leftTab === 'history' ? (
    <div>{CC_SESSIONS.map((s, i) => <div className={'cc-sess ' + (i === 0 ? 'on' : '')} key={s.id}><div className="st">{s.title}</div><div className="sm">{s.meta}</div></div>)}</div>
  ) : leftTab === 'artifacts' ? (
    <div>{CC_ARTIFACTS.map((a) => <div className="cc-art" key={a.id}><span className="ai">{artIcon(a.icon, 12)}</span>{a.name}</div>)}</div>
  ) : (
    <div className="cc-lib">{[1, 2, 3, 4].map((n) => <div className="im" key={n}><ImageIcon size={18} /></div>)}</div>
  );

  return (
    <div className={'cosmo-canvas ' + (open ? 'open' : '') + (full ? ' full' : '')} id="cosmoCanvas">
      <div className="cc-top">
        <div className="g"><CosmoAgentOrb size={26} /></div>
        <div><div className="tt">Arganta</div><div className="sub">ArgantaEnergy · orchestrator</div></div>
        <div className="sp" />
        <div className="cc-ic" title="History & artifacts" onClick={() => setShowLeft((v) => !v)}><PanelLeft size={15} /></div>
        <div className="cc-ic" title="New chat" onClick={onNew}><Plus size={15} /></div>
        <div className="cc-ic" title="Artifact browser" onClick={() => setShowRight((v) => !v)}><PanelRight size={15} /></div>
        <div className="cc-ic" id="ccFullBtn" title="Full canvas" onClick={() => setFull((v) => !v)}>{full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</div>
        <div className="cc-ic" title="Close" onClick={onClose}><X size={15} /></div>
      </div>

      <div className={'cc-body' + (showLeft ? ' show-left' : '') + (showRight ? ' show-right' : '')} id="ccBody">
        <div className="cc-left">
          <div className="cc-left-tabs">
            {[['history', 'History'], ['artifacts', 'Artifacts'], ['library', 'Library']].map((t) => (
              <div className={'lt ' + (leftTab === t[0] ? 'on' : '')} key={t[0]} onClick={() => setLeftTab(t[0])}>{t[1]}</div>
            ))}
          </div>
          <div className="cc-left-body">{leftBody}</div>
        </div>

        <div className="cc-mid">
          <div className="cc-stream" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            {msgs.map((m, i) => (
              <div className={'msg ' + m.role} key={i}>
                <div className="who" style={m.role === 'user' ? { textAlign: 'right' } : undefined}>{m.role === 'user' ? 'YOU' : 'ARGANTA'}</div>
                <div className="bub">
                  {m.role === 'assistant'
                    ? (m.text ? <div dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) + (m.done ? '' : '<span class="cc-caret"></span>') }} /> : <div className="cc-typing"><i /><i /><i /></div>)
                    : m.text}
                  {m.role === 'assistant' && m.done && i === msgs.length - 1 && m.wellPick && pendingIntent === m.wellPick && (
                    <div className="cc-well-pick">
                      {(wells.length ? wells : ['F-1', 'F-4', 'F-5', 'F-9', 'F-11', 'F-12', 'F-14', 'F-15']).slice(0, 10).map((w) => (
                        <button key={w} onClick={() => selectWell(w)}>{w}</button>
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant' && m.done && i === msgs.length - 1 && m.tourWellPick && tourKind === 'agentic' && (
                    <div className="cc-well-pick">
                      {(wells.length ? wells : ['F-1', 'F-4', 'F-5', 'F-9', 'F-11', 'F-12', 'F-14', 'F-15']).slice(0, 10).map((w) => (
                        <button key={w} onClick={() => selectTourWell(w)}>{w}</button>
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant' && m.done && i === msgs.length - 1 && m.assistWellPick && tourKind === 'assist' && (
                    <div className="cc-well-pick">
                      {(wells.length ? wells : ['F-1', 'F-4', 'F-5', 'F-9', 'F-11', 'F-12', 'F-14', 'F-15']).slice(0, 10).map((w) => (
                        <button key={w} onClick={() => selectAssistWell(w)}>{w}</button>
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant' && m.done && i === msgs.length - 1 && m.confirmPick && tourKind === 'agentic' && (
                    <div className="cc-well-pick">
                      <button onClick={confirmAgenticContinue}>Continue ▶</button>
                      <button onClick={pauseAgenticTour}>Pause</button>
                    </div>
                  )}
                  {m.role === 'assistant' && m.done && i === msgs.length - 1 && !m.wellPick && !m.tourWellPick && !m.assistWellPick && !m.confirmPick && !touring && msgs.length > 1 && (
                    <div className="art-chip" onClick={() => { if (!showRight) setShowRight(true); }}><PanelRight size={12} /> Open artifact pane</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="cc-composer">
            <div className="cc-shell">
              <textarea className="cc-input" rows={1} placeholder="Ask Arganta…" value={draft}
                onInput={(e) => { const el = e.currentTarget; setDraft(el.value); el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight) + 'px'; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); e.currentTarget.style.height = 'auto'; } }} />
              <div className="cc-tray">
                <button className="cc-tool" title="Attach"><Paperclip size={15} /></button>
                <button className="cc-tool" title="Tools"><Wrench size={15} /></button>
                <div className="cc-mwrap">
                  <div className="cc-mdl" onClick={() => setMopen(!mopen)}>
                    <span className="dot" style={{ background: cm.tc }} />{cm.name}
                    <span className="cv">{cm.ctx}</span><ChevronDown size={13} />
                  </div>
                  <div className={'cc-menu ' + (mopen ? 'on' : '')}>
                    {CC_MODELS.map((g) => (
                      <div key={g.group}>
                        <div className="cc-mgrp"><i style={{ background: g.tc }} />{g.group}</div>
                        {g.models.map((m) => (
                          <div className={'cc-mrow ' + (model === m.id ? 'on' : '') + (m.locked ? ' locked' : '')} key={m.id}
                            onClick={() => { if (!m.locked) setModel(m.id); setMopen(false); }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="mnm">{m.name}{m.badge && <span className="cc-mbadge">{m.badge}</span>}{m.locked && <span className="cc-mlock"><Lock size={9} /> C1</span>}</div>
                              <div className="mds">{m.desc}</div>
                            </div>
                            <div className="mmeta">
                              <span className="cc-weight" title="Rate-limit weight">{[1, 2, 3].map((w) => <i key={w} className={w <= m.weight ? 'f' : ''} />)}</span>
                              <span className="mctx">{m.ctx}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <button className="cc-send" disabled={!draft.trim()} onClick={() => send()}><ArrowUp size={16} /></button>
              </div>
            </div>
            <div className="cc-usage">
              <span className="u"><Gauge size={11} /> Context <div className="cc-bar"><i style={{ width: '24%' }} /></div> 24% of {cm.ctx}</span>
              <span className="u"><BatteryMedium size={11} /> Weekly <div className="cc-bar warn"><i style={{ width: '62%' }} /></div> 62% · resets Mon</span>
              <span className="u" style={{ marginLeft: 'auto' }}><Shield size={11} /> {cm.tier} · governed</span>
            </div>
            <div className="cc-chips">
              {chips.map((c) => (
                <div className="cc-chip" key={c} onClick={() => (c === ASSIST_LABEL ? startAssistTour() : c === AGENTIC_LABEL ? startAgenticTour() : send(c))}>{c}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="cc-right">
          <div className="cc-right-top">
            <div className="cc-dev">
              {[['full', 'maximize', 'Full'], ['ar169', 'monitor', '16:9'], ['ar43', 'tv', '4:3'], ['tablet', 'tablet', 'Tablet'], ['mobile', 'smartphone', 'Phone']].map((d) => (
                <b key={d[0]} className={device === d[0] ? 'on' : ''} onClick={() => setDevice(d[0])}>{devIcon(d[1])} {d[2]}</b>
              ))}
            </div>
            <div className="art-seg">
              {[['tree', 'git-fork', 'Tree'], ['note', 'file-text', 'Note'], ['chart', 'bar-chart-3', 'Chart']].map((a) => (
                <b key={a[0]} className={artifact === a[0] ? 'on' : ''} onClick={() => setArtifact(a[0] as 'tree' | 'note' | 'chart')}>{segIcon(a[1])} {a[2]}</b>
              ))}
            </div>
            <div className="cc-ic" title="Expand to full screen" onClick={() => setArtFull(true)}><Expand size={14} /></div>
            <div className="cc-ic" title="Download"><Download size={14} /></div>
            <div className="cc-ic" title="Close preview" onClick={() => setShowRight(false)}><X size={14} /></div>
          </div>
          <div className="cc-art-preview">
            <div className={'cc-frame ' + device}>
              <div className="fbar"><i /><i /><i /><span className="furl">{ARTIFACT_META[artifact]?.file ?? artifact} · {DEV_LABEL[device] || device}</span></div>
              <div className="fbody"><SurfaceErrorBoundary key={artifact}>{renderArtifact()}</SurfaceErrorBoundary></div>
            </div>
            <div className="cc-dev-tag">{DEV_LABEL[device] || device}</div>
          </div>
        </div>

        <div className="cc-scrim" onClick={() => { setShowLeft(false); setShowRight(false); }} />
      </div>

      <div className={'modal-scrim ' + (artFull ? 'on' : '')} onClick={() => setArtFull(false)}>
        <div className="art-modal" onClick={(e) => e.stopPropagation()}>
          <div className="art-modal-hd">
            <span className="am-title">{artIcon2(artifact)} {ARTIFACT_META[artifact]?.title ?? artifact}</span>
            <div className="art-seg" style={{ marginLeft: '12px' }}>
              {[['tree', 'git-fork', 'Tree'], ['note', 'file-text', 'Note'], ['chart', 'bar-chart-3', 'Chart']].map((a) => (
                <b key={a[0]} className={artifact === a[0] ? 'on' : ''} onClick={() => setArtifact(a[0] as 'tree' | 'note' | 'chart')}>{segIcon(a[1])} {a[2]}</b>
              ))}
            </div>
            <button className="mx" style={{ marginLeft: 'auto' }} onClick={() => setArtFull(false)}><X size={15} /></button>
          </div>
          <div className="art-modal-body"><SurfaceErrorBoundary key={artifact}>{renderArtifact()}</SurfaceErrorBoundary></div>
        </div>
      </div>
    </div>
  );
}

function devIcon(n: string) {
  return n === 'monitor' ? <Monitor size={12} /> : n === 'tv' ? <Tv size={12} /> : n === 'tablet' ? <Tablet size={12} /> : n === 'smartphone' ? <Smartphone size={12} /> : <Maximize size={12} />;
}
function segIcon(n: string) {
  return n === 'git-fork' ? <GitFork size={11} /> : n === 'bar-chart-3' ? <BarChart3 size={11} /> : <FileText size={11} />;
}
function artIcon2(artifact: string) {
  if (artifact === 'tree') return <GitFork size={15} />;
  if (artifact === 'chart') return <BarChart3 size={15} />;
  if (artifact === 'map') return <MapIcon size={15} />;
  if (artifact === 'model3d') return <Box size={15} />;
  if (artifact === 'sim') return <Waves size={15} />;
  if (artifact === 'forecast') return <TrendingUp size={15} />;
  return <FileText size={15} />;
}
