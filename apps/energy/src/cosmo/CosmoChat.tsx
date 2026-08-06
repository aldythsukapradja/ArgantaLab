// CosmoChat — the animated Cosmonaut, ported 1:1 from COSMO_Final.html (function
// Cosmonaut + its deps). Streaming assistant reply with a blinking caret + typing dots,
// a three-pane canvas (History/Artifacts/Library · chat · artifact preview), device
// frames (Full/16:9/4:3/Tablet/Phone), live artifacts (radial data-map tree, production
// chart, rendered markdown note), sovereign model picker, usage meters, suggestion chips
// and an 80%-screen artifact modal. Uses the founder's exact classes (cosmo-system.css).
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanelLeft, PanelRight, Plus, Maximize2, Minimize2, X, Paperclip, Wrench, ChevronDown, ExternalLink,
  ArrowUp, Maximize, Monitor, Tv, Tablet, Smartphone,
  GitFork, FileText, BarChart3, Expand, Download, Image as ImageIcon, Gem, Map as MapIcon,
  Box, Waves, TrendingUp, Loader2,
} from 'lucide-react';
import { CosmoAgentOrb } from './CosmoAgentOrb';
import { SurfaceErrorBoundary } from './SurfaceErrorBoundary';
import { loadIndex } from '../wb/load';
import { useAgent } from '../agent/useAgent';
import { AgentCard } from '../agent/AgentCard';
import { AgentTrace } from './AgentTrace.tsx';
import { AgentWelcome } from './AgentWelcome.tsx';
import { ChatArtifact } from './ChatArtifact.tsx';
import type { TurnTrace } from '../agent/types.ts';
import type { AnswerCard, CardChip } from '../agent/types';
import { useBridge, type BridgeEngine } from '../agent/bridge/useBridge';
import type { BridgeEvent } from '../agent/bridge/client';
import { BridgeFeedItem, BridgeMessageExtras, type BridgeMsgKind } from '../agent/bridge/BridgeFeedItem';
import { BridgeConnectDialog } from '../agent/bridge/BridgeConnectDialog';
import { EngineModelPicker, type EngineModelOption } from '../agent/bridge/EngineModelPicker';
import { ClaudeMark } from '../agent/bridge/ClaudeMark';
import { OpenAIMark } from '../agent/bridge/OpenAIMark';
import { ArgantaMark } from '../agent/ArgantaMark';

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
// The model picker is built from what CAN ACTUALLY ANSWER, at render time.
//
// It used to be a static array: "Arganta Lite 128K", "Arganta Core 200K",
// "Arganta Frontier 1M", each with a rate-limit weight drawn as filled bars.
// None of it was real. There is no Arganta Lite; the context figures were
// invented; the weights measured nothing; and the model actually answering,
// as this app's own reasoning trace shows on every turn, is whatever the
// Worker's ladder resolves to — @cf/meta/llama-3.1-8b-instruct-fp8 most of the
// time. A picker that names models which do not exist is a worse lie than a
// wrong number, because the user chooses on the strength of it.
//
// Now: the sovereign rows come from /v1/health's real provider ladder, and the
// Frontier rows from the engine registry that genuinely drives the bridge.

/** A row in the picker. `sub` is the provider, shown because "llama-3.3-70b"
 *  means little without knowing who is serving it. */
type PickerRow = { id: string; name: string; sub: string; badge?: string };
type PickerGroup = { group: string; tc: string; rows: PickerRow[] };

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
  // Only http(s) survives. A markdown link is attacker-influenced text as far as
  // this renderer is concerned -- the models quote URLs they found on the web --
  // so javascript:, data: and friends never reach an href.
  const safeUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : null);
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  const inline = (s: string) => s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a class="wl">$2</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="wl">$1</a>')
    // [label](https://…) -- the shape every model uses for a citation. Left
    // unparsed these rendered as literal brackets followed by a bare URL, which
    // is how the Sources list looked.
    .replace(/\[([^\]]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/g, (whole, label, url) => {
      const safe = safeUrl(url);
      if (!safe) return whole;
      return `<a class="md-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer nofollow" data-src="${esc(safe)}">${label}<span class="md-link-host">${esc(host(safe))}</span></a>`;
    })
    // A bare URL on its own still deserves to be clickable.
    .replace(/(^|[\s(])(https?:\/\/(?:[^\s()<]|\([^\s()<]*\))+)/g, (whole, pre, url) => {
      const safe = safeUrl(url);
      if (!safe) return whole;
      return `${pre}<a class="md-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer nofollow" data-src="${esc(safe)}">${esc(host(safe))}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  // A markdown table is the one construct that cannot be read line-by-line: the
  // separator row (|---|---|) only means anything in the context of the row
  // above it. Without this the models' comparison tables rendered as literal
  // pipes -- "| Axis | What you're checking |" -- which is exactly the shape of
  // answer they reach for most when comparing two basins.
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|?[\s:-]*-[-\s|:]*\|?\s*$/.test(l) && l.includes('-');
  const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    let m: RegExpMatchArray | null;

    // table: a header row, a separator row, then body rows until the block ends
    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1]) && isRow(lines[i + 1])) {
      close();
      const head = cells(line);
      const body: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && isRow(lines[j]) && !isSep(lines[j]); j++) body.push(cells(lines[j]));
      out.push(
        '<div class="md-table-wrap"><table class="md-table"><thead><tr>'
        + head.map((h) => `<th>${inline(h)}</th>`).join('')
        + '</tr></thead><tbody>'
        + body.map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')
        + '</tbody></table></div>',
      );
      i = j - 1;
      continue;
    }

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
  /** A real answer from the agent. When present the bubble renders the card
   *  rather than prose — the numbers come from local files, not from a model. */
  card?: AnswerCard;
  /** A Frontier (Claude Code / Codex) mission event, rendered by BridgeFeedItem
   *  instead of markdown prose — status lines, tool activity, approval prompts,
   *  the completion capsule. */
  bridge?: BridgeMsgKind;
  /** The receipt for `card` — real pipeline steps, never a narrated monologue. */
  trace?: TurnTrace;
  /** The closing line under the card. Grounded against the card or not shown. */
  summary?: string;
  /** The opening screen. Rendered live from the loaded gazetteer rather than
   *  stored as prose, so its figures can never go stale in localStorage. */
  welcome?: boolean;
};
/** Fold the recent conversation into the prompt for a Frontier mission.
 *
 *  WHY THIS EXISTS: `startMission` sends a prompt and nothing else -- no thread
 *  id, no history -- so the bridge server spawns a FRESH agent run every time.
 *  The agent was not forgetting or drifting; it was never told what came before,
 *  which is why it would answer a follow-up with "this is the start of our
 *  conversation".
 *
 *  This is the honest stopgap, not the real fix. Proper continuity is a resumed
 *  session on the server (the Claude Agent SDK supports resume by id), which
 *  lives outside this repo. Re-sending history costs tokens on every turn and
 *  is trimmed hard for that reason -- so it is labelled as a transcript rather
 *  than dressed up as the agent's own memory.
 */
const HISTORY_TURNS = 8;
const HISTORY_CHARS = 6000;

function withHistory(msgs: Msg[], text: string): string {
  const prior = msgs
    .filter((m) => !m.welcome && !m.bridge && (m.text || '').trim())
    .slice(-HISTORY_TURNS)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${(m.text || '').trim()}`);
  if (!prior.length) return text;

  // Newest turns matter most, so drop from the FRONT when trimming.
  let body = prior.join('\n\n');
  while (body.length > HISTORY_CHARS && prior.length > 1) {
    prior.shift();
    body = prior.join('\n\n');
  }
  return [
    'Earlier in this conversation (transcript, for context -- do not greet the user as if this were a new conversation):',
    body,
    '---',
    `Current message: ${text}`,
  ].join('\n\n');
}

type StreamFlags = { wellPick?: LiveIntent; tourWellPick?: boolean; assistWellPick?: boolean; confirmPick?: boolean };
// The welcome carries no prose at all — see AgentWelcome.tsx, which reads its
// figures out of the gazetteer that is loaded right now. Persisting it as text
// is exactly how a stale count outlives the catalogue it described: "14,069
// places" was true when it was typed and had no way of noticing when it wasn't.
const WELCOME: Msg = { role: 'assistant', text: '', done: true, welcome: true };

/** Older sessions have the previous hardcoded welcome sitting in localStorage.
 *  Left alone it would keep quoting that count forever, so it is swapped for
 *  the live one on the way in. */
const LEGACY_WELCOME = /^Ask me about any \*\*basin\*\*/;
const migrate = (list: Msg[]): Msg[] =>
  list.map((m) => (m.welcome || (m.role === 'assistant' && LEGACY_WELCOME.test(m.text ?? '')) ? WELCOME : m));
// (The old canned lifecycle reply is gone — every non-tour turn is now a real
// agent answer rendered as a card.)

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
export function CosmoChat({ open, onClose, fullSignal, onFieldDevTab, onFullChange }: {
  open: boolean;
  onClose: () => void;
  /** Full-canvas mode. The shell pushes its content aside for the docked panel but
   *  must NOT when the panel covers the screen — pushing a hidden layout only causes
   *  a reflow jump on exit. */
  onFullChange?: (full: boolean) => void;
  fullSignal?: number;
  /** guided-tour hooks — CosmoShell owns nav/tab, so the tour drives it through these */
  /** Vestigial: both drove the removed FDP Agentic tour's app navigation.
   *  Kept in the signature because CosmoShell still passes them and that file
   *  is in flight in another session — dropping them there is a follow-up, not
   *  a reason to break someone else's working tree. Nothing reads them. */
  onFocusCockpit?: () => void;
  onZoomVolve?: () => void;
  onFieldDevTab?: (tab: string) => void;
}) {
  const [full, setFull] = useState(false);
  // mobile Cosmonaut orb tap opens the canvas straight to full-screen (source openCosmoFull)
  useEffect(() => { if (fullSignal) setFull(true); }, [fullSignal]);
  useEffect(() => { onFullChange?.(full); }, [full, onFullChange]);
  const [leftTab, setLeftTab] = useState('history');
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [device, setDevice] = useState('full');
  const [mopen, setMopen] = useState(false);
  const [draft, setDraft] = useState('');
  const [artifact, setArtifact] = useState<string>('note');
  const [artFull, setArtFull] = useState(false);
  // Chat history persists across reloads — every message (Core answers,
  // Frontier missions, both) is written to localStorage, capped so a long-lived
  // session can't grow without bound. Cards/bridge fields are plain JSON, so
  // this is a straight round-trip; a corrupt or missing entry just starts fresh.
  const CHAT_HISTORY_KEY = 'ae_chat_history';
  const CHAT_HISTORY_CAP = 200;
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return migrate(parsed as Msg[]);
    } catch { /* corrupt or unavailable — start fresh */ }
    return [WELCOME];
  });
  useEffect(() => {
    try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(msgs.slice(-CHAT_HISTORY_CAP))); } catch { /* storage full/unavailable — just won't persist */ }
  }, [msgs]);
  const [pendingIntent, setPendingIntent] = useState<LiveIntent | null>(null);
  const [activeWell, setActiveWell] = useState<string | null>(null);
  const [wells, setWells] = useState<string[]>([]);
  // The real agent. Everything below the composer routes through this: resolve
  // → capability → plan → commands on the store's bus.
  const agent = useAgent();
  const [sugIndex, setSugIndex] = useState(-1);
  const [sugOpen, setSugOpen] = useState(false);
  const suggestions = useMemo(
    () => (sugOpen && draft.trim().length >= 2 ? agent.suggestions(draft, 6) : []),
    [sugOpen, draft, agent],
  );
  // ── Frontier: Claude Code / Codex, over the local Arganta Bridge ──────────
  // Same protocol HQ's BridgeConsole speaks (tools/arganta-bridge), a different
  // origin's localStorage — the token has to be pasted here too, it cannot be
  // read from HQ's browser storage across origins.
  const [brain, setBrain] = useState<'agent' | BridgeEngine>('agent');
  const bridge = useBridge();
  const [bridgeToken, setBridgeToken] = useState(() => localStorage.getItem('ae_bridge_token') || '');
  const [bridgeUrl, setBridgeUrl] = useState(() => localStorage.getItem('ae_bridge_url') || '');
  const [bridgeDialogOpen, setBridgeDialogOpen] = useState(false);
  const [bridgeRunning, setBridgeRunning] = useState(false);
  // A live "Nsec" ticker while a mission runs — the same reassurance Claude
  // Code's own CLI spinner gives you, so a quiet stretch between tool calls
  // doesn't read as the mission having silently died.
  const [bridgeElapsed, setBridgeElapsed] = useState(0);
  useEffect(() => {
    if (!bridgeRunning) { setBridgeElapsed(0); return; }
    const startedAt = Date.now();
    const iv = setInterval(() => setBridgeElapsed(Math.round((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(iv);
  }, [bridgeRunning]);
  const bridgeMissionsRef = useRef(0);
  // Label of the model the in-flight mission is running on — captured at launch
  // so the completion capsule names the right one even if the picker changes
  // mid-run (same as HQ's runModelRef).
  const runModelRef = useRef('');
  /** Did this mission stream a `message` event? If so the completion capsule
   *  must not restate the result -- see the 'done' handler. */
  const sawMessageRef = useRef(false);
  /** Seconds the current agent turn has been running. Real elapsed time, shown
   *  because a 9-16 second wait with no feedback reads as a broken app -- and
   *  because a counter that ticks is the one honest thing we can say while the
   *  answer is still being assembled. */
  const [askElapsed, setAskElapsed] = useState(0);
  /** The source the reader tapped, shown in a preview sheet before they leave.
   *
   *  Deliberately NOT an iframe. Instagram and LinkedIn use a native in-app
   *  WebView, which a web page cannot call; the web equivalent is an iframe,
   *  and the publishers these citations point at (news sites, journals) send
   *  X-Frame-Options: DENY precisely to stop that. A sheet that renders blank
   *  for most sources would be worse than the plain link it replaced, so this
   *  shows what we genuinely know -- publisher and full URL -- and hands off. */
  const [sourceSheet, setSourceSheet] = useState<{ url: string; host: string } | null>(null);
  const ENGINE_NAME: Record<BridgeEngine, string> = { claude: 'Claude', codex: 'OpenAI' };

  // Real model options only. Claude Code's aliases are the CLI's own — '' runs
  // its default. Codex authenticates via a ChatGPT plan login, which can't pick
  // a raw model id, only REASONING EFFORT (the bridge passes this as
  // `-c model_reasoning_effort`) — so "the latest ChatGPT/Codex model" is
  // whatever ships behind Auto; effort is the one real lever exposed.
  const ENGINE_MODELS: Record<BridgeEngine, { Mark: typeof ClaudeMark; accent: string; capsulePrefix: string; options: EngineModelOption[] }> = {
    claude: {
      Mark: ClaudeMark, accent: '#D97757', capsulePrefix: 'Claude',
      options: [
        { id: '', label: 'Default', sub: "Claude's default model" },
        { id: 'opus', label: 'Opus 4.8', sub: 'Most capable' },
        { id: 'sonnet', label: 'Sonnet', sub: 'Balanced' },
        { id: 'haiku', label: 'Haiku', sub: 'Fastest' },
      ],
    },
    codex: {
      Mark: OpenAIMark, accent: '#10A37F', capsulePrefix: 'Codex',
      options: [
        { id: '', label: 'Auto', sub: 'Latest Codex model, your plan default' },
        { id: 'high', label: 'High effort', sub: 'Most thorough (slower)' },
        { id: 'medium', label: 'Medium effort', sub: 'Balanced' },
        { id: 'low', label: 'Low effort', sub: 'Fastest' },
      ],
    },
  };
  const [claudeModel, setClaudeModel] = useState(() => localStorage.getItem('ae_bridge_model') || '');
  const [codexModel, setCodexModel] = useState(() => localStorage.getItem('ae_bridge_codex_model') || '');
  const frontierModel = brain === 'claude' ? claudeModel : brain === 'codex' ? codexModel : '';
  const setFrontierModel = (id: string) => {
    if (brain === 'claude') { setClaudeModel(id); localStorage.setItem('ae_bridge_model', id); }
    else if (brain === 'codex') { setCodexModel(id); localStorage.setItem('ae_bridge_codex_model', id); }
  };

  // Reveals mission text the same way Core/Lite's own replies stream in — the
  // "echo" the mission's output as it lands, not a wall of text appearing at
  // once. Deliberately its OWN interval per message rather than reusing
  // `streamAssistant`'s single shared `streamRef`: a mission can emit several
  // `message` events close together, and sharing one ref would cut the first
  // one off mid-reveal (leaving it with an eternal blinking cursor) the moment
  // the second one starts.
  /** Mark the trailing steps box finished so its last row stops pulsing. */
  const settleSteps = (m: Msg[]): Msg[] => {
    const last = m[m.length - 1];
    if (last?.bridge?.kind !== 'steps' || !last.bridge.running) return m;
    const c = [...m];
    c[c.length - 1] = { ...last, bridge: { ...last.bridge, running: false } };
    return c;
  };

  const streamBridgeMessage = (text: string) => {
    let atIndex = -1;
    setMsgs((m) => { atIndex = m.length; return [...m, { role: 'assistant', text: '', done: false }]; });
    let i = 0;
    const iv = setInterval(() => {
      i += Math.max(3, Math.round(text.length / 70));
      setMsgs((m) => {
        if (atIndex < 0 || atIndex >= m.length) return m;
        const c = [...m];
        c[atIndex] = { ...c[atIndex], text: text.slice(0, i) };
        return c;
      });
      if (i >= text.length) {
        clearInterval(iv);
        setMsgs((m) => {
          if (atIndex < 0 || atIndex >= m.length) return m;
          const c = [...m];
          c[atIndex] = { ...c[atIndex], done: true };
          return c;
        });
      }
    }, 20);
  };

  bridge.onEvent((e: BridgeEvent) => {
    switch (e.type) {
      case 'status': case 'tool':
        // Fold into the trailing steps box rather than opening a new bubble --
        // one mission, one progress item. A new box only starts after the
        // agent has actually said something.
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (last?.bridge?.kind === 'steps') {
            const steps = [...last.bridge.steps, { label: e.label, kind: e.type }];
            const c = [...m];
            c[c.length - 1] = { ...last, bridge: { kind: 'steps', steps, running: true } };
            return c;
          }
          return [...m, {
            role: 'assistant', text: '', done: true,
            bridge: { kind: 'steps', steps: [{ label: e.label, kind: e.type }], running: true },
          }];
        });
        break;
      case 'message':
        sawMessageRef.current = true;
        setMsgs((m) => settleSteps(m));
        streamBridgeMessage(e.text);
        break;
      case 'awaiting_approval':
        setMsgs((m) => [...m, {
          role: 'assistant', text: '', done: true,
          bridge: { kind: 'approval', approvalId: e.approvalId, tool: e.tool, label: e.label, input: e.input },
        }]);
        break;
      case 'done':
        setBridgeRunning(false);
        setMsgs((m) => {
          // The completion capsule must not repeat what was already streamed.
          //
          // This used to compare the capsule's result against the last message
          // for EXACT equality, which fails on any trailing-whitespace or
          // truncation difference -- and when it failed the user read the whole
          // answer twice. Whether a `message` event arrived is a fact we can
          // record directly, so record it instead of guessing from the text.
          const result = (e.result || '').trim();
          const echo = sawMessageRef.current;
          return [...settleSteps(m), {
            role: 'assistant', text: '', done: true,
            bridge: { kind: 'done', ok: e.ok, result: echo ? undefined : (result || undefined), costUsd: e.costUsd, engineLabel: runModelRef.current || ENGINE_NAME[brain as BridgeEngine] },
          }];
        });
        break;
      case 'error':
        setBridgeRunning(false);
        setMsgs((m) => [...m, { role: 'assistant', text: '', done: true, bridge: { kind: 'error', message: e.message } }]);
        break;
    }
  });

  useEffect(() => { if (bridge.status === 'open') setBridgeDialogOpen(false); }, [bridge.status]);

  useEffect(() => {
    if (!agent.busy) { setAskElapsed(0); return; }
    const started = Date.now();
    const iv = setInterval(() => setAskElapsed(Math.round((Date.now() - started) / 1000)), 250);
    return () => clearInterval(iv);
  }, [agent.busy]);

  // Keep the chat panel pinned to the VISIBLE area, not the layout viewport.
  // On iOS the software keyboard does not shrink the layout viewport, so a
  // `position:fixed; top:0` panel keeps its full height and its header (with the
  // Close button) slides out of sight above the keyboard. visualViewport is the
  // only thing that reports where the user can actually see, so it drives the
  // panel's top/height directly. Desktop is untouched — the CSS that consumes
  // these vars is inside the mobile breakpoint, and both fall back sanely.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      const height = Math.round(vv.height);
      // A zero/absurd reading (seen when the surface is measured before it is
      // laid out) would otherwise collapse the panel to nothing. Keep the last
      // good value — or the CSS fallback — instead of writing a broken one.
      if (!Number.isFinite(height) || height < 120) return;
      root.style.setProperty('--cc-vv-h', `${height}px`);
      root.style.setProperty('--cc-vv-top', `${Math.round(vv.offsetTop)}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    // visualViewport does not always fire for rotation or a window resize.
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      root.style.removeProperty('--cc-vv-h');
      root.style.removeProperty('--cc-vv-top');
    };
  }, []);

  const bridgeHttpBase = (bridgeUrl || 'ws://127.0.0.1:7717').trim().replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/+$/, '');

  const connectBridge = () => {
    if (!bridgeToken) return;
    localStorage.setItem('ae_bridge_token', bridgeToken);
    if (bridgeUrl) localStorage.setItem('ae_bridge_url', bridgeUrl);
    bridge.connect(bridgeToken, bridgeUrl || undefined).catch(() => { /* status reflects it */ });
  };

  const switchBrain = (next: 'agent' | BridgeEngine) => {
    setBrain(next);
    if (next !== 'agent' && bridge.status !== 'open') {
      if (bridgeToken) connectBridge(); else setBridgeDialogOpen(true);
    }
  };

  const runFrontierMission = (text: string) => {
    if (bridge.status !== 'open') { setBridgeDialogOpen(true); return; }
    setMsgs((m) => [...m, { role: 'user', text, done: true }]);
    bridgeMissionsRef.current += 1;
    setBridgeRunning(true);
    sawMessageRef.current = false;
    const engine = brain as BridgeEngine;
    const model = engine === 'claude' ? claudeModel : codexModel;
    const cfg = ENGINE_MODELS[engine];
    const optionLabel = (cfg.options.find((o) => o.id === model) || cfg.options[0]).label;
    runModelRef.current = `${cfg.capsulePrefix} ${optionLabel}`;
    bridge.startMission(withHistory(msgs, text), {
      engine, model: model || undefined,
      missionId: `energy_${Date.now().toString(36)}_${bridgeMissionsRef.current}`,
    });
  };

  const [tourKind, setTourKind] = useState<'assist' | 'agentic' | null>(null);
  const tourStepRef = useRef(0);
  const tourTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Built from live state, so it can only ever offer what exists.
  const modelGroups: PickerGroup[] = useMemo(() => {
    const out: PickerGroup[] = [];
    const ladder = agent.activeModel?.ladder ?? [];
    out.push({
      group: 'ARGANTA CORE · tool-calling',
      tc: '#2563eb',
      rows: ladder.length
        ? ladder.map((p, i) => ({
          id: `core:${p.model}`,
          name: p.model,
          sub: p.provider,
          // Health reports preference order, not who answered. The head is
          // tried first; each turn's trace names the one that actually ran.
          badge: i === 0 ? 'TRIED FIRST' : undefined,
        }))
        : [{ id: 'core:none', name: 'Deterministic grammar', sub: 'no model configured' }],
    });
    for (const engine of ['claude', 'codex'] as BridgeEngine[]) {
      const cfg = ENGINE_MODELS[engine];
      out.push({
        group: `${cfg.capsulePrefix.toUpperCase()} · frontier, over the bridge`,
        tc: cfg.accent,
        rows: cfg.options.map((o) => ({ id: `${engine}:${o.id}`, name: o.label, sub: o.sub })),
      });
    }
    return out;
  }, [agent.activeModel, ENGINE_MODELS]);

  /** What the composer pill shows: the tier that would answer right now. */
  const currentPick = useMemo(() => {
    if (brain === 'agent') {
      const head = agent.activeModel?.ladder?.[0];
      return { name: head ? head.model : 'Deterministic grammar', sub: head?.provider ?? 'local', tc: '#2563eb' };
    }
    const cfg = ENGINE_MODELS[brain as BridgeEngine];
    const opt = cfg.options.find((o) => o.id === (brain === 'claude' ? claudeModel : codexModel)) ?? cfg.options[0];
    return { name: `${cfg.capsulePrefix} ${opt.label}`, sub: opt.sub, tc: cfg.accent };
  }, [brain, agent.activeModel, claudeModel, codexModel, ENGINE_MODELS]);

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
    setDraft('');
    setSugOpen(false);
    setSugIndex(-1);

    // Frontier mode is a different agent entirely — a live Claude Code / Codex
    // mission over the local Bridge, not the petroleum tool-calling agent. It
    // owns its own user-message push (see runFrontierMission) since a mission
    // that can't be sent yet (bridge not connected) must not show a phantom
    // "you said" bubble with nothing following it.
    if (brain !== 'agent') { runFrontierMission(t); return; }

    setMsgs((m) => [...m, { role: 'user', text: t, done: true }]);

    // The guided well-picker tours keep their own scripted path.
    const intent = detectIntent(t);
    if (intent) {
      setPendingIntent(intent);
      setTimeout(() => streamAssistant(INTENT_COPY[intent].prompt, { wellPick: intent }), 240);
      return;
    }

    if (!agent.ready) {
      setTimeout(() => streamAssistant('Still loading the catalogue — try again in a moment.'), 200);
      return;
    }

    // A real turn. The card IS the answer; any prose from the language tier has
    // already been grounding-checked and is usually empty by design.
    void agent.ask(t).then((answer) => {
      if (!answer) { streamAssistant("I couldn't read that — try naming a basin, country, field or well."); return; }
      setMsgs((m) => [...m, { role: 'assistant', text: answer.text, done: true, card: answer.card, trace: answer.trace, summary: answer.summary }]);
    }).catch((err) => {
      // Backstop. useAgent already degrades to the deterministic tier on its
      // own, so reaching here means something unforeseen broke -- and a turn
      // that answers nothing at all is the one outcome never worth shipping.
      // eslint-disable-next-line no-console
      console.error('[chat] turn failed', err);
      streamAssistant('That turn failed on my side. Nothing in the app was changed — try again, or name the entity directly.');
    });
  };

  /** A chip re-enters as if typed, so chips and typing share one code path. */
  const onChip = (chip: CardChip) => send(chip.query);
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
    try { localStorage.removeItem(CHAT_HISTORY_KEY); } catch { /* ignore */ }
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
        {/* Title only. The scope breadcrumb lives in the Scope Bar on the
            surfaces themselves — repeating it here just crowded the header. */}
        <div className="cc-top-title">
          <div className="tt">Arganta</div>
        </div>
        <div className="sp" />
        {/* Says which tier answered — "CORE"/"LITE" only. The live model name
            (once shown here) had no upper bound on length and, combined with
            this badge's own `white-space:nowrap`, was long enough to push the
            icon row — Close included — off the visible edge of the panel. */}
        <span className={'ag-tier has-mark ' + agent.tier} title={agent.workerConfigured
          ? (agent.tier === 'core' ? `Answered by the language tier${agent.activeModel ? ` (${agent.activeModel.model})` : ''}, grounded in local data` : 'Worker unreachable — deterministic tier answering')
          : 'No agent Worker configured — deterministic tier'}>
          <ArgantaMark size={11} color={agent.tier === 'core' ? '#22c55e' : 'var(--ink3)'} />
          <b>{agent.tier === 'core' ? 'CORE' : 'LITE'}</b>
          {agent.busy ? ' · thinking' : ''}
        </span>
        <div className="cc-icons">
          <div className="cc-ic" title="History & artifacts" onClick={() => setShowLeft((v) => !v)}><PanelLeft size={15} /></div>
          <div className="cc-ic" title="New chat" onClick={onNew}><Plus size={15} /></div>
          <div className="cc-ic" title="Artifact browser" onClick={() => setShowRight((v) => !v)}><PanelRight size={15} /></div>
          <div className="cc-ic" id="ccFullBtn" title="Full canvas" onClick={() => setFull((v) => !v)}>{full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</div>
          <div className="cc-ic" title="Close" onClick={onClose}><X size={15} /></div>
        </div>
      </div>

      {/* Arganta Core (the petroleum tool-calling agent, Lite/Core tier above)
          vs Arganta Frontier — Claude Code or Codex, direct over the local
          Bridge. Two different agents; Frontier just has two engine choices. */}
      <div className="bf-engines">
        <button type="button" className={'bf-engine-pill' + (brain === 'agent' ? ' on' : '')} onClick={() => switchBrain('agent')} title="Arganta Core — the tool-calling petroleum agent">
          <ArgantaMark size={12} />Arganta Core
        </button>
        <div className={'bf-frontier-group' + (brain !== 'agent' ? ' on' : '')}>
          {/* Not a static label — it lights up the moment either engine is
              picked, so choosing Claude or OpenAI visibly reads as "now in
              Frontier mode", not three flat, unrelated buttons. */}
          <span className="bf-frontier-label">Frontier</span>
          <button type="button" className={'bf-engine-pill' + (brain === 'claude' ? ' on' : '')} onClick={() => switchBrain('claude')}>
            <ClaudeMark size={12} />Claude
          </button>
          <button type="button" className={'bf-engine-pill' + (brain === 'codex' ? ' on' : '')} onClick={() => switchBrain('codex')}>
            <OpenAIMark size={12} />OpenAI
          </button>
        </div>
        {brain !== 'agent' && (() => {
          const engineCfg = ENGINE_MODELS[brain as BridgeEngine];
          const FrontierMark = engineCfg.Mark;
          return (
            <span className={'ag-tier has-mark ' + (bridge.status === 'open' ? 'core' : 'lite')} style={{ marginLeft: 'auto' }}>
              <FrontierMark size={11} color={bridge.status === 'open' ? engineCfg.accent : 'var(--ink3)'} />
              <b>{bridge.status === 'open' ? 'CONNECTED' : bridge.status.toUpperCase()}</b>
            </span>
          );
        })()}
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
          {/* Scoped to cc-mid, NOT the whole canvas: a full-canvas scrim sat on
              top of cc-top and swallowed clicks on the panel's own Close button
              — you could open Frontier's connect dialog and then have no way to
              dismiss the chat at all. It now only ever covers the message area. */}
          {brain !== 'agent' && bridgeDialogOpen && (
            <BridgeConnectDialog
              engineName={ENGINE_NAME[brain as BridgeEngine]}
              status={bridge.status}
              token={bridgeToken}
              url={bridgeUrl}
              onToken={setBridgeToken}
              onUrl={setBridgeUrl}
              onConnect={() => { connectBridge(); }}
              onClose={msgs.length > 1 ? () => setBridgeDialogOpen(false) : undefined}
            />
          )}
          <div
            className="cc-stream"
            ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
            onClick={(ev) => {
              // Delegated so it covers links inside dangerouslySetInnerHTML,
              // which React cannot attach handlers to individually.
              const a = (ev.target as HTMLElement | null)?.closest?.('a.md-link') as HTMLAnchorElement | null;
              const url = a?.dataset?.src;
              if (!a || !url) return;
              ev.preventDefault();
              let host = url;
              try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
              setSourceSheet({ url, host });
            }}
          >
            {msgs.map((m, i) => (
              <div className={'msg ' + m.role} key={i}>
                <div className="who" style={m.role === 'user' ? { textAlign: 'right' } : undefined}>{m.role === 'user' ? 'YOU' : 'ARGANTA'}</div>
                <div className="bub">
                  {m.role === 'assistant'
                    ? (m.welcome
                      ? <AgentWelcome
                          index={agent.index}
                          tier={agent.tier}
                          activeModel={agent.activeModel}
                          workerConfigured={agent.workerConfigured}
                          onChip={send}
                        />
                      : m.bridge
                      ? <BridgeFeedItem item={m.bridge} fileBase={bridgeHttpBase} token={bridgeToken} onResolve={(id, ok, input) => {
                          bridge.respondApproval(id, ok, input);
                          setMsgs((cur) => cur.map((x) => (x.bridge?.kind === 'approval' && x.bridge.approvalId === id
                            ? { ...x, bridge: { ...x.bridge, resolved: ok ? 'approved' : 'denied' } } : x)));
                        }} renderMarkdown={mdToHtml} />
                      : m.card
                        ? (<div className="ag-arrive">
                          {m.text && <div dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />}
                          <AgentCard card={m.card} onChip={onChip} />
                          {m.card.artifact && (
                            <ChatArtifact
                              component={m.card.artifact.component}
                              props={m.card.artifact.props}
                              // Only offered when a Frontier engine is selected.
                              // Arganta Core is a local tool-caller with no
                              // vision; showing it an image is not something it
                              // can do, so the affordance is simply absent.
                              onExamine={brain === 'agent' ? undefined : runFrontierMission}
                            />
                          )}
                          {m.summary && <p className="ag-summary">{m.summary}</p>}
                          {m.trace && <AgentTrace trace={m.trace} />}
                        </div>)
                        : m.text
                          ? (<>
                            <div dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) + (m.done ? '' : '<span class="cc-caret"></span>') }} />
                            {brain !== 'agent' && m.done && <BridgeMessageExtras text={m.text} fileBase={bridgeHttpBase} token={bridgeToken} />}
                          </>)
                          : brain !== 'agent' ? null : <div className="cc-typing"><i /><i /><i /></div>)
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
                  {/* The "Open artifact pane" chip lived here. It appeared under
                      every finished answer regardless of whether an artifact had
                      been produced, so it read as an instruction rather than an
                      affordance — and it interrupted the mission feed, which is
                      the thing worth reading. Removed deliberately; the pane is
                      still reachable from the shell. */}
                </div>
              </div>
            ))}
            {sourceSheet && (
              <div className="src-sheet-scrim" onClick={() => setSourceSheet(null)} role="presentation">
                <div className="src-sheet" role="dialog" aria-modal="true" aria-label="External source" onClick={(e) => e.stopPropagation()}>
                  <div className="src-sheet-head">
                    <span className="src-sheet-host">{sourceSheet.host}</span>
                    <button className="src-sheet-x" onClick={() => setSourceSheet(null)} aria-label="Close">
                      <X size={15} strokeWidth={2.2} />
                    </button>
                  </div>
                  <p className="src-sheet-url">{sourceSheet.url}</p>
                  <p className="src-sheet-note">
                    This is an external site, outside ArgantaEnergy. It opens in a new tab — publishers
                    block embedding, so nothing here can preview the page itself.
                  </p>
                  <div className="src-sheet-actions">
                    <a
                      className="src-sheet-go"
                      href={sourceSheet.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      onClick={() => setSourceSheet(null)}
                    >
                      <ExternalLink size={13} strokeWidth={2.2} /> Open {sourceSheet.host}
                    </a>
                    <button
                      className="src-sheet-copy"
                      onClick={() => { void navigator.clipboard?.writeText(sourceSheet.url); setSourceSheet(null); }}
                    >Copy link</button>
                  </div>
                </div>
              </div>
            )}
            {brain === 'agent' && agent.busy && (
              <div className="msg assistant">
                <div className="who">ARGANTA</div>
                <div className="bub">
                  <div className="ag-working">
                    <span className="ag-working-orb" aria-hidden />
                    <span className="ag-working-text">
                      {/* Says only what is true. The catalogue is local and
                          instant; the wait is the model choosing a tool, and
                          when no model is configured there is no model to wait
                          for -- so the two cases read differently. */}
                      {agent.workerConfigured
                        ? 'Reading the catalogue and choosing what to open'
                        : 'Matching against the catalogue'}
                    </span>
                    {askElapsed >= 2 && <span className="ag-working-secs">{askElapsed}s</span>}
                  </div>
                </div>
              </div>
            )}
            {brain !== 'agent' && bridgeRunning && (
              <div className="msg assistant">
                <div className="who">ARGANTA</div>
                <div className="bub">
                  <div className="bf-thinking">
                    <span className="bf-think-dot" /><span className="bf-think-dot" /><span className="bf-think-dot" />
                    <i>{ENGINE_NAME[brain as BridgeEngine]} is working… {bridgeElapsed}s</i>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="cc-composer">
            {brain !== 'agent' && bridge.status !== 'open' && msgs.length > 1 && !bridgeDialogOpen && (
              <button type="button" className="bf-reconnect-pill" onClick={() => setBridgeDialogOpen(true)}>
                <span className="bf-dot bad" /> Bridge disconnected — reconnect
              </button>
            )}
            <div className="cc-shell" style={{ position: 'relative' }}>
              {suggestions.length > 0 && brain === 'agent' && (
                <div className="ag-sugg">
                  {suggestions.map((s, i) => (
                    <button type="button" key={s.node.id}
                      className={'ag-sugg-row' + (i === sugIndex ? ' on' : '')}
                      onMouseDown={(e) => { e.preventDefault(); send(s.node.name); }}>
                      <span className="nm">{s.node.displayName}</span>
                      {/* A fuzzy or phonetic hit says so BEFORE you commit to it. */}
                      {(s.stage === 'fuzzy' || s.stage === 'phonetic') && <span className="fz">≈</span>}
                      <span className="kd">{s.node.kind.replace('-', ' ')}</span>
                    </button>
                  ))}
                </div>
              )}
              {brain !== 'agent' && (
                <EngineModelPicker
                  Mark={ENGINE_MODELS[brain as BridgeEngine].Mark}
                  accent={ENGINE_MODELS[brain as BridgeEngine].accent}
                  capsulePrefix={ENGINE_MODELS[brain as BridgeEngine].capsulePrefix}
                  models={ENGINE_MODELS[brain as BridgeEngine].options}
                  model={frontierModel}
                  onPick={setFrontierModel}
                  disabled={bridgeRunning}
                />
              )}
              <textarea className="cc-input" rows={1}
                placeholder={brain === 'agent'
                  ? 'Ask about a basin, country, field or well…'
                  : bridge.status === 'open'
                    ? `Give ${ENGINE_NAME[brain as BridgeEngine]} a mission…`
                    : 'Connect to the bridge first'}
                value={draft}
                disabled={brain !== 'agent' && bridge.status !== 'open'}
                onInput={(e) => { const el = e.currentTarget; setDraft(el.value); if (brain === 'agent') { setSugOpen(true); setSugIndex(-1); } el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight) + 'px'; }}
                onBlur={() => setSugOpen(false)}
                onKeyDown={(e) => {
                  if (suggestions.length && brain === 'agent') {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSugIndex((i) => (i + 1) % suggestions.length); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSugIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); return; }
                    if (e.key === 'Escape') { setSugOpen(false); return; }
                    if (e.key === 'Enter' && !e.shiftKey && sugIndex >= 0) {
                      e.preventDefault(); send(suggestions[sugIndex].node.name); e.currentTarget.style.height = 'auto'; return;
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); e.currentTarget.style.height = 'auto'; }
                }} />
              <div className="cc-tray">
                <button className="cc-tool" title="Attach"><Paperclip size={15} /></button>
                <button className="cc-tool" title="Tools"><Wrench size={15} /></button>
                <div className="cc-mwrap">
                  <div className="cc-mdl" onClick={() => setMopen(!mopen)}>
                    <span className="dot" style={{ background: currentPick.tc }} />{currentPick.name}
                    <span className="cv">{currentPick.sub}</span><ChevronDown size={13} />
                  </div>
                  <div className={'cc-menu ' + (mopen ? 'on' : '')}>
                    {modelGroups.map((g) => {
                      const engine = g.rows[0]?.id.startsWith('claude:') ? 'claude'
                        : g.rows[0]?.id.startsWith('codex:') ? 'codex' : null;
                      const Mark = engine ? ENGINE_MODELS[engine as BridgeEngine].Mark : null;
                      return (
                        <div key={g.group}>
                          <div className="cc-mgrp">
                            {/* The engine's own mark where we genuinely have one.
                                For the sovereign ladder there is no single vendor
                                — it is groq or Cloudflare depending on which
                                answers — so a coloured dot, not an invented logo. */}
                            {Mark ? <Mark size={11} /> : <i style={{ background: g.tc }} />}
                            {g.group}
                          </div>
                          {g.rows.map((r) => (
                            <div
                              key={r.id}
                              className={'cc-mrow ' + (
                                (brain === 'agent' && r.id.startsWith('core:'))
                                || r.id === `${brain}:${brain === 'claude' ? claudeModel : codexModel}` ? 'on' : '')}
                              onClick={() => {
                                const [kind, rest] = [r.id.slice(0, r.id.indexOf(':')), r.id.slice(r.id.indexOf(':') + 1)];
                                // Selecting a Frontier row picks that engine AND
                                // its option. The sovereign rows are not a choice
                                // — the Worker owns its own fallback order — so
                                // they only switch the brain back to Core.
                                if (kind === 'claude' || kind === 'codex') {
                                  setBrain(kind as BridgeEngine);
                                  if (kind === 'claude') setClaudeModel(rest); else setCodexModel(rest);
                                } else {
                                  setBrain('agent');
                                }
                                setMopen(false);
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="mnm">{r.name}{r.badge && <span className="cc-mbadge">{r.badge}</span>}</div>
                                <div className="mds">{r.sub}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button className="cc-send" disabled={!draft.trim() || (brain !== 'agent' && (bridge.status !== 'open' || bridgeRunning))} onClick={() => send()}><ArrowUp size={16} /></button>
              </div>
            </div>
            {/* The usage strip lived here — "Context 24% of 200K", "Weekly 62%
                · resets Mon", "SOV · governed". Every one of those numbers was
                a hardcoded literal inherited from the COSMO mock: the bars
                never moved, the week never reset, and nothing measured context.
                Invented telemetry is the same failure as an invented figure,
                and it sat under a chat whose entire claim is that its numbers
                come from somewhere. Removed rather than wired up — real usage
                metering is a feature to build deliberately, not to fake. */}
            {/* The starter chips lived here. Two of them launched the "FDP AI
                Assist" / "FDP Agentic" walkthroughs, which drive the LEGACY
                tabs — a route that no longer reflects how the app is built. The
                other four ("Kutei Basin", "Volve", …) were hardcoded queries
                that the welcome screen now offers live, computed from the
                gazetteer, so they can never point at something absent.
                Removed rather than relabelled: the replacement is a real
                agentic workflow, not a shorter list of the same shortcuts. */}
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
