import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { mergeVault } from '../knowledge/vault';
import { route, SUGGESTIONS, type CosmoReply, type Artifact } from '../cosmo/router';
import { Markdown } from '../tabs/md';
import { X, Plus, PanelLeft, PanelRight, Send, Sparkles } from 'lucide-react';

// ── Layered CSS orb (halo pulse · conic spin · glass core · hover ring + label pill). ──
// All animation is disabled under prefers-reduced-motion (via .orb-* classes in theme.css).
export function Orb({ size = 58, onClick, label = true }: { size?: number; onClick?: () => void; label?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label="Open Cosmonaut" title="Cosmonaut"
      style={{ position: 'relative', width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'transparent' }}>
      <span className="orb-halo" style={{ position: 'absolute', inset: -6, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(179,125,240,.6), rgba(98,174,247,.15) 60%, transparent 72%)', filter: 'blur(4px)' }} />
      <span className="orb-conic" style={{ position: 'absolute', inset: 3, borderRadius: '50%',
        background: 'conic-gradient(from 0deg, var(--violet), var(--blue), var(--teal), var(--violet))', opacity: 0.85 }} />
      <span className="orb-conic-2" style={{ position: 'absolute', inset: 8, borderRadius: '50%',
        background: 'conic-gradient(from 180deg, transparent, rgba(255,255,255,.25), transparent)' }} />
      <span className="orb-core" style={{ position: 'relative', width: size * 0.44, height: size * 0.44, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,.9), rgba(140,180,240,.5) 55%, rgba(60,40,110,.7))',
        boxShadow: 'inset 0 0 8px rgba(255,255,255,.5), 0 0 10px rgba(140,120,240,.5)', display: 'grid', placeItems: 'center' }}>
        <Sparkles size={size * 0.2} color="#fff" opacity={0.85} />
      </span>
      {hover && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '1px solid var(--violet)' }} />}
      {label && hover && (
        <span className="mono" style={{ position: 'absolute', right: size + 8, top: '50%', transform: 'translateY(-50%)',
          background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 9px', fontSize: 11, whiteSpace: 'nowrap' }}>
          Cosmonaut
        </span>
      )}
    </button>
  );
}

// Desktop floating orb (bottom-right), hidden on mobile (mobile orb lives in the bottom bar).
export function CosmoOrbFloating({ isMobile }: { isMobile: boolean }) {
  const { toggleCosmo, cosmoOpen } = useStore();
  if (isMobile || cosmoOpen) return null;
  return (
    <div style={{ position: 'fixed', right: 22, bottom: 40, zIndex: 60 }}>
      <Orb onClick={() => toggleCosmo(true)} />
    </div>
  );
}

interface Msg { role: 'user' | 'cosmo'; text: string; reply?: CosmoReply }
interface Session { id: string; title: string; msgs: Msg[]; at: string }

const SESS_KEY = 'ae_cosmo_sessions';
function loadSessions(): Session[] {
  try { const r = localStorage.getItem(SESS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveSessions(s: Session[]) { try { localStorage.setItem(SESS_KEY, JSON.stringify(s.slice(0, 30))); } catch { /* ignore */ } }

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function CosmoOverlay({ isMobile }: { isMobile: boolean }) {
  const { cosmoOpen, toggleCosmo, userNotes, openNote } = useStore();
  const notes = useMemo(() => mergeVault(userNotes), [userNotes]);
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = sessions.find((s) => s.id === activeId) ?? null;
  const msgs = active?.msgs ?? [];
  const lastArtifact: Artifact = [...msgs].reverse().find((m) => m.reply?.artifact)?.reply?.artifact ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && cosmoOpen) toggleCosmo(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cosmoOpen, toggleCosmo]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs.length]);
  useEffect(() => { if (lastArtifact && !isMobile) setRightOpen(true); }, [lastArtifact, isMobile]);

  if (!cosmoOpen) return null;

  function commit(next: Session[]) { setSessions(next); saveSessions(next); }

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const reply = route(q, notes);
    let sess = active;
    let next = sessions;
    if (!sess) {
      sess = { id: 'cs-' + Date.now().toString(36), title: q.slice(0, 40), msgs: [], at: new Date().toISOString() };
      next = [sess, ...sessions];
      setActiveId(sess.id);
    }
    const updated: Session = { ...sess, msgs: [...sess.msgs, { role: 'user', text: q }, { role: 'cosmo', text: reply.text, reply }] };
    commit(next.map((s) => (s.id === updated.id ? updated : s)));
    setInput('');
  }

  function newChat() { setActiveId(null); setInput(''); }

  // animated grid-template-columns on drawer toggle
  const cols = isMobile ? '1fr' : `${leftOpen ? 232 : 0}px 1fr ${rightOpen ? 340 : 0}px`;

  return (
    <div role="dialog" aria-modal="true" aria-label="Cosmonaut"
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'grid',
        gridTemplateColumns: cols, transition: 'grid-template-columns .22s ease' }}>

      {/* LEFT — history */}
      {!isMobile && (
        <aside style={{ borderRight: leftOpen ? '1px solid var(--line)' : 'none', background: 'var(--panel)', overflow: 'hidden', minWidth: 0 }}>
          {leftOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8 }}>
                <button onClick={newChat} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                  border: '1px solid var(--line)', borderRadius: 5, color: 'var(--text)', fontSize: 12 }}>
                  <Plus size={14} /> New chat
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
                {sessions.length === 0 && <div style={{ padding: 12, fontSize: 11.5, color: 'var(--muted)' }}>No sessions yet.</div>}
                {sessions.map((s) => (
                  <button key={s.id} onClick={() => setActiveId(s.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 5, fontSize: 12,
                      background: s.id === activeId ? 'var(--panel-2)' : 'transparent', color: s.id === activeId ? 'var(--text)' : 'var(--muted)',
                      border: '1px solid ' + (s.id === activeId ? 'var(--line)' : 'transparent'), marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* CENTER — chat */}
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
          {!isMobile && <button onClick={() => setLeftOpen((v) => !v)} aria-label="Toggle history" style={{ color: 'var(--muted)' }}><PanelLeft size={16} /></button>}
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>Cosmonaut <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· deterministic knowledge agent</span></span>
          <TierRack />
          <button onClick={() => setRightOpen((v) => !v)} aria-label="Toggle artifacts" style={{ color: 'var(--muted)' }} title="Artifacts"><PanelRight size={16} /></button>
          <button onClick={() => toggleCosmo(false)} aria-label="Close" style={{ color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 0' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ display: 'inline-block' }}><Orb size={72} label={false} onClick={() => {}} /></div>
                <h2 style={{ fontSize: 18, margin: '14px 0 6px' }}>Ask the Volve knowledge OS</h2>
                <p style={{ color: 'var(--muted)', fontSize: 12.5, maxWidth: 460, margin: '0 auto' }}>
                  Deterministic routing over foundation data, the semantic model and the vault. No LLM call — every answer carries a truthful trace and evidence.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="chip" style={{ padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', color: 'var(--text)' }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => <MessageBubble key={i} msg={m} isLast={i === msgs.length - 1} onOpenNote={openNote} />)}
          </div>
        </div>

        {/* input */}
        <div style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)', padding: '10px 14px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask about production, wells, schema, surfaces, the vault…"
              style={{ flex: 1, resize: 'none', background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)',
                borderRadius: 6, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none', maxHeight: 120 }} />
            <button onClick={() => send(input)} aria-label="Send" style={{ width: 38, height: 38, display: 'grid', placeItems: 'center',
              background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--teal)' }}><Send size={16} /></button>
          </div>
        </div>
      </section>

      {/* RIGHT — artifacts */}
      {!isMobile && rightOpen && (
        <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--panel)', overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
            <span className="eyebrow" style={{ flex: 1 }}>Artifact</span>
            <button onClick={() => setRightOpen(false)} style={{ color: 'var(--muted)' }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14 }}><ArtifactView artifact={lastArtifact} /></div>
        </aside>
      )}

      {/* mobile artifact sheet */}
      {isMobile && rightOpen && (
        <div onClick={() => setRightOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', width: '100%', maxHeight: '70vh', overflow: 'auto', borderTop: '1px solid var(--line)', borderRadius: '10px 10px 0 0', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}><span className="eyebrow" style={{ flex: 1 }}>Artifact</span><button onClick={() => setRightOpen(false)} style={{ color: 'var(--muted)' }}><X size={16} /></button></div>
            <ArtifactView artifact={lastArtifact} />
          </div>
        </div>
      )}
    </div>
  );
}

function TierRack() {
  const tiers = [
    { id: 'DET', on: true, tip: 'Deterministic router — active' },
    { id: 'SOV', on: false, tip: 'Sovereign LLM — upgrade seam, not wired' },
    { id: 'FRO', on: false, tip: 'Frontier LLM — upgrade seam, not wired' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }} title="LLM tier ladder">
      {tiers.map((t) => (
        <span key={t.id} className="chip mono" title={t.tip}
          style={{ padding: '1px 6px', fontSize: 9, color: t.on ? 'var(--teal)' : 'var(--muted)', borderColor: t.on ? 'var(--teal)' : 'var(--line)', opacity: t.on ? 1 : 0.6 }}>
          {t.on ? '● ' : '🔒 '}{t.id}
        </span>
      ))}
    </div>
  );
}

function MessageBubble({ msg, isLast, onOpenNote }: { msg: Msg; isLast: boolean; onOpenNote: (id: string) => void }) {
  if (msg.role === 'user') {
    return <div style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: '10px 10px 2px 10px', padding: '9px 13px', fontSize: 13 }}>{msg.text}</div>;
  }
  return <CosmoBubble msg={msg} isLast={isLast} onOpenNote={onOpenNote} />;
}

function CosmoBubble({ msg, isLast, onOpenNote }: { msg: Msg; isLast: boolean; onOpenNote: (id: string) => void }) {
  const reply = msg.reply!;
  const typed = useTypewriter(msg.text, isLast);
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 20, height: 20 }}><Orb size={20} label={false} onClick={() => {}} /></div>
        <span className="eyebrow" style={{ fontSize: 9 }}>COSMONAUT</span>
        {reply.badges.map((b) => <span key={b.label} className="chip" style={{ padding: '1px 6px', fontSize: 9, color: natureColor(b.nature), borderColor: natureColor(b.nature) }}>{b.label}</span>)}
      </div>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '2px 10px 10px 10px', padding: '10px 14px' }}>
        <Markdown body={typed} onOpenNote={onOpenNote} />
      </div>
      <TraceLine trace={reply.trace} />
    </div>
  );
}

function TraceLine({ trace }: { trace: CosmoReply['trace'] }) {
  return (
    <details style={{ marginTop: 6 }}>
      <summary className="mono" style={{ fontSize: 10, color: 'var(--muted)', cursor: 'pointer', listStyle: 'none' }}>
        ▸ trace · {trace.intent} → {trace.route}
      </summary>
      <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', padding: '6px 0 0 12px', lineHeight: 1.7, borderLeft: '1px solid var(--line)', marginLeft: 4, paddingLeft: 10 }}>
        <div>intent → <span style={{ color: 'var(--text)' }}>{trace.intent}</span></div>
        <div>classification → {trace.classification}</div>
        <div>{trace.route}</div>
        <div>grounded to → <span style={{ color: 'var(--teal)' }}>{trace.grounded}</span></div>
        <div>evidence → {trace.evidence}</div>
      </div>
    </details>
  );
}

function ArtifactView({ artifact }: { artifact: Artifact }) {
  if (!artifact) return <div style={{ color: 'var(--muted)', fontSize: 12 }}>No artifact yet. Ask a question to generate one.</div>;
  if (artifact.kind === 'svg') return <div><div className="eyebrow" style={{ marginBottom: 8 }}>{artifact.title}</div><div dangerouslySetInnerHTML={{ __html: artifact.svg }} /></div>;
  if (artifact.kind === 'md') return <div><div className="eyebrow" style={{ marginBottom: 8 }}>{artifact.title}</div><Markdown body={artifact.md} /></div>;
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{artifact.title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
        <thead><tr>{artifact.columns.map((c) => <th key={c} style={{ textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{c}</th>)}</tr></thead>
        <tbody>{artifact.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="mono" style={{ padding: '5px 8px', borderBottom: '1px solid var(--line)' }}>{String(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function natureColor(n: string) {
  return { measured: 'var(--teal)', reported: 'var(--amber)', interpreted: 'var(--orange)', derived: 'var(--violet)' }[n] ?? 'var(--muted)';
}

// typewriter reveal (word-by-word ~15ms); skipped under reduced-motion or non-last messages.
function useTypewriter(full: string, active: boolean): string {
  const [shown, setShown] = useState(active && !prefersReduced() ? '' : full);
  useEffect(() => {
    if (!active || prefersReduced()) { setShown(full); return; }
    const words = full.split(' ');
    let i = 0;
    setShown('');
    const id = setInterval(() => {
      i++;
      setShown(words.slice(0, i).join(' '));
      if (i >= words.length) clearInterval(id);
    }, 15);
    return () => clearInterval(id);
  }, [full, active]);
  return shown;
}
