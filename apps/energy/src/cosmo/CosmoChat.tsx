// CosmoChat — the animated Cosmonaut, ported 1:1 from COSMO_Final.html (function
// Cosmonaut + its deps). Streaming assistant reply with a blinking caret + typing dots,
// a three-pane canvas (History/Artifacts/Library · chat · artifact preview), device
// frames (Full/16:9/4:3/Tablet/Phone), live artifacts (radial data-map tree, production
// chart, rendered markdown note), sovereign model picker, usage meters, suggestion chips
// and an 80%-screen artifact modal. Uses the founder's exact classes (cosmo-system.css).
import { useEffect, useRef, useState } from 'react';
import {
  PanelLeft, PanelRight, Plus, Maximize2, Minimize2, X, Paperclip, Wrench, ChevronDown,
  Lock, ArrowUp, Gauge, BatteryMedium, Shield, Maximize, Monitor, Tv, Tablet, Smartphone,
  GitFork, FileText, BarChart3, Expand, Download, Image as ImageIcon, Gem, Map as MapIcon,
} from 'lucide-react';
import { CosmoAgentOrb } from './CosmoAgentOrb';

// ── data (verbatim from source) ─────────────────────────────────────────────
const CC_SESSIONS = [
  { id: 's1', title: 'Al Shaheen — production review', meta: 'today · FRONTIER' },
  { id: 's2', title: 'FD volumetrics — P90/P50/P10', meta: '2d ago · SOVEREIGN' },
  { id: 's3', title: 'Opportunity screening shortlist', meta: '4d ago · DETERMINISTIC' },
];
type CCModel = { id: string; name: string; desc: string; weight: number; ctx: string; badge?: string; locked?: boolean };
const CC_MODELS: Array<{ group: string; tier: string; tc: string; models: CCModel[] }> = [
  { group: 'SOVEREIGN · on-prem', tier: 'SOV', tc: '#2563eb', models: [
    { id: 'cosmo-lite', name: 'Cosmo Lite', desc: 'Fast local model for everyday lookups', weight: 1, ctx: '128K' },
    { id: 'cosmo-core', name: 'Cosmo Core', desc: 'Balanced sovereign default · analysis & synthesis', weight: 2, ctx: '200K', badge: 'DEFAULT' },
  ] },
  { group: 'WORKER · agent runtime', tier: 'WRK', tc: '#0FB5A6', models: [
    { id: 'cosmo-agent', name: 'Cosmo Agent', desc: 'Tool-using workstream agent runtime', weight: 2, ctx: '200K' },
  ] },
  { group: 'FRONTIER · cloud (C1-gated)', tier: 'FRO', tc: '#7c3aed', models: [
    { id: 'cosmo-frontier', name: 'Cosmo Frontier', desc: 'Deep reasoning for hard, multi-step work', weight: 3, ctx: '1M', locked: true },
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
  { id: 'drilling-sequence', name: 'Drilling Sequence', c: '#e11d74' },
];
const artIcon = (name: string, size = 12) =>
  name === 'gem' ? <Gem size={size} /> : name === 'map' ? <MapIcon size={size} /> : <FileText size={size} />;

// FDP knowledge-base note (rendered inside the artifact "Note" tab — placeholder canvas)
const FDP_NOTE = `# Field Development — Al Shaheen

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

type Msg = { role: 'user' | 'assistant'; text: string; done: boolean };
const WELCOME: Msg = { role: 'assistant', text: 'Welcome to **Cosmonaut** — the RMO Cosmo orchestrator for the **Al Shaheen** field. Ask me anything, or open the artifact pane to see live content.', done: true };
const CANNED = `Here is the **Al Shaheen** lifecycle at a glance:\n\n- **Exploration** · BETA · GeaVision, GeaGuard\n- **Field Development** · LIVE · WellAion\n- **Well Delivery** · BETA · WellNova\n- **Reservoir Management** · LIVE · Prismo, WellWatch, WellNexus\n- **Drilling Sequence** · BETA\n\nOpen the artifact pane on the right to inspect the live data-map tree, a rendered knowledge-base note, or a production chart.`;

// ── the Cosmonaut canvas ────────────────────────────────────────────────────
export function CosmoChat({ open, onClose, fullSignal }: { open: boolean; onClose: () => void; fullSignal?: number }) {
  const [full, setFull] = useState(false);
  // mobile Cosmonaut orb tap opens the canvas straight to full-screen (source openCosmoFull)
  useEffect(() => { if (fullSignal) setFull(true); }, [fullSignal]);
  const [leftTab, setLeftTab] = useState('history');
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [device, setDevice] = useState('full');
  const [model, setModel] = useState('cosmo-core');
  const [mopen, setMopen] = useState(false);
  const [draft, setDraft] = useState('');
  const [artifact, setArtifact] = useState('note');
  const [artFull, setArtFull] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cm = CC_MODEL_BY_ID(model) || ({} as ReturnType<typeof CC_MODEL_BY_ID> & object) as NonNullable<ReturnType<typeof CC_MODEL_BY_ID>>;
  const chips = ['Production summary', 'Build a chart', 'Model as table', 'Screen opportunities'];

  const renderArtifact = () => artifact === 'note' ? <MdCanvas md={FDP_NOTE} /> : artifact === 'tree' ? <CosmoMiniTree /> : <CosmoMiniChart />;

  const streamAssistant = (fullText: string) => {
    if (streamRef.current) clearInterval(streamRef.current);
    setMsgs((m) => [...m, { role: 'assistant', text: '', done: false }]);
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
    setTimeout(() => streamAssistant(CANNED), 240);
  };
  const onNew = () => { if (streamRef.current) clearInterval(streamRef.current); setMsgs([WELCOME]); };
  useEffect(() => () => { if (streamRef.current) clearInterval(streamRef.current); }, []);

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
        <div><div className="tt">Cosmonaut</div><div className="sub">RMO Cosmo · orchestrator</div></div>
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
                <div className="who" style={m.role === 'user' ? { textAlign: 'right' } : undefined}>{m.role === 'user' ? 'YOU' : 'COSMONAUT'}</div>
                <div className="bub">
                  {m.role === 'assistant'
                    ? (m.text ? <div dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) + (m.done ? '' : '<span class="cc-caret"></span>') }} /> : <div className="cc-typing"><i /><i /><i /></div>)
                    : m.text}
                  {m.role === 'assistant' && m.done && i === msgs.length - 1 && msgs.length > 1 && (
                    <div className="art-chip" onClick={() => { if (!showRight) setShowRight(true); }}><PanelRight size={12} /> Open artifact pane</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="cc-composer">
            <div className="cc-shell">
              <textarea className="cc-input" rows={1} placeholder="Ask Cosmonaut…" value={draft}
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
              <span className="u" style={{ marginLeft: 'auto' }}><Shield size={11} /> {cm.tier} · C1-Controlled</span>
            </div>
            <div className="cc-chips">{chips.map((c) => <div className="cc-chip" key={c} onClick={() => send(c)}>{c}</div>)}</div>
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
                <b key={a[0]} className={artifact === a[0] ? 'on' : ''} onClick={() => setArtifact(a[0])}>{segIcon(a[1])} {a[2]}</b>
              ))}
            </div>
            <div className="cc-ic" title="Expand to full screen" onClick={() => setArtFull(true)}><Expand size={14} /></div>
            <div className="cc-ic" title="Download"><Download size={14} /></div>
            <div className="cc-ic" title="Close preview" onClick={() => setShowRight(false)}><X size={14} /></div>
          </div>
          <div className="cc-art-preview">
            <div className={'cc-frame ' + device}>
              <div className="fbar"><i /><i /><i /><span className="furl">{artifact === 'tree' ? 'data-map.tree' : artifact === 'chart' ? 'field-production.chart' : 'fdp.md'} · {DEV_LABEL[device] || device}</span></div>
              <div className="fbody">{renderArtifact()}</div>
            </div>
            <div className="cc-dev-tag">{DEV_LABEL[device] || device}</div>
          </div>
        </div>

        <div className="cc-scrim" onClick={() => { setShowLeft(false); setShowRight(false); }} />
      </div>

      <div className={'modal-scrim ' + (artFull ? 'on' : '')} onClick={() => setArtFull(false)}>
        <div className="art-modal" onClick={(e) => e.stopPropagation()}>
          <div className="art-modal-hd">
            <span className="am-title">{artifact === 'tree' ? <GitFork size={15} /> : artifact === 'chart' ? <BarChart3 size={15} /> : <FileText size={15} />} {artifact === 'tree' ? 'Data-map tree' : artifact === 'chart' ? 'Field production chart' : 'Knowledge-base note'}</span>
            <div className="art-seg" style={{ marginLeft: '12px' }}>
              {[['tree', 'git-fork', 'Tree'], ['note', 'file-text', 'Note'], ['chart', 'bar-chart-3', 'Chart']].map((a) => (
                <b key={a[0]} className={artifact === a[0] ? 'on' : ''} onClick={() => setArtifact(a[0])}>{segIcon(a[1])} {a[2]}</b>
              ))}
            </div>
            <button className="mx" style={{ marginLeft: 'auto' }} onClick={() => setArtFull(false)}><X size={15} /></button>
          </div>
          <div className="art-modal-body">{renderArtifact()}</div>
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
