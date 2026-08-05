// KnowledgeView (Intelligence → Knowledge) — the ArgantaEnergy knowledge base. CDF-style
// connected twin: Explorer (folder tree · note center with clickable wikilinks · backlinks
// + local graph) and Graph & Timeline (d3-force graph, layout modes, type filter, living
// physics). Built from knowledge-model.ts (scalable multi-field generator), grounded in the
// real Volve wb index. Fully rebranded — neutral geoscience knowledge, no vendor identity.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, forceRadial,
  type Simulation,
} from 'd3-force';
import { BookOpen, Search, ChevronRight, Sparkles, Orbit, Grid2x2, CircleDot, Focus, RotateCcw, Maximize, Download, FolderDown, FlaskConical } from 'lucide-react';
import './knowledge-cosmo.css';
import { ExtractionStudio } from './ExtractionStudio';
import { downloadNote, exportVault } from './note-export';
import { loadIndex } from '../wb/load';
import type { WbIndex } from '../wb/types';
import {
  buildGraph, buildLinkIndex, volveSeed, extractedGraph, TYPE_COLOR, TYPE_LABEL, FOLDER_ORDER,
  type KNode, type KType, type KGraph, type LinkIndex,
} from './knowledge-model';
import { IntelligenceHeader, IntelligenceSurface, IntelligenceTabs } from './IntelligenceChrome';
import { useStore } from '../store';

// ── note markdown → HTML with clickable [[wikilinks]] ─────────────────────────
function noteHtml(md: string) {
  const lines = md.split('\n'); const out: string[] = []; let inList = false;
  const close = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline = (s: string) => s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a class="wl" data-wl="$1">$2</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="wl" data-wl="$1">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^>\s*(.*)$/))) { close(); out.push(`<div class="cal">${inline(m[1])}</div>`); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { close(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    close(); out.push(`<p>${inline(line)}</p>`);
  }
  close(); return out.join('');
}

const LAYOUTS: Array<{ id: string; label: string; icon: typeof Orbit }> = [
  { id: 'galaxy', label: 'Galaxy', icon: Orbit },
  { id: 'constellation', label: 'Constellation', icon: Sparkles },
  { id: 'rings', label: 'Rings', icon: CircleDot },
  { id: 'neurons', label: 'Neurons', icon: Grid2x2 },
  { id: 'atomic', label: 'Atomic', icon: Focus },
];

type SimNode = KNode & { x?: number; y?: number; fx?: number | null; fy?: number | null };
type SimLink = { source: SimNode | string; target: SimNode | string; kind: string };

// ── Graph & Timeline ─────────────────────────────────────────────────────────
function KnowledgeGraph({ graph, index, sel, setSel }: { graph: KGraph; index: LinkIndex; sel: string | null; setSel: (id: string | null) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const [, setFrame] = useState(0);
  const [layout, setLayout] = useState('galaxy');
  const [living, setLiving] = useState(true);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [off, setOff] = useState<Set<KType>>(new Set());
  const [tip, setTip] = useState<{ x: number; y: number; n: SimNode } | null>(null);

  const nodes = useMemo<SimNode[]>(() => graph.nodes.map((n) => ({ ...n })), [graph]);
  // graph edges come from the resolved [[wikilinks]] (Obsidian-equivalent), not a separate model
  const links = useMemo<SimLink[]>(() => index.edges.map((e) => ({ source: e.from, target: e.to, kind: e.kind })), [index]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // atomic layout: only selected + neighbors (from wikilink graph)
  const neighborIds = useMemo(() => {
    if (layout !== 'atomic' || !sel) return null;
    const s = new Set<string>([sel]);
    index.outgoing.get(sel)?.forEach((id) => s.add(id));
    index.backlinks.get(sel)?.forEach((id) => s.add(id));
    return s;
  }, [layout, sel, index]);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const active = neighborIds ? nodes.filter((n) => neighborIds.has(n.id)) : nodes;
    const activeIds = new Set(active.map((n) => n.id));
    const activeLinks = links.filter((l) => activeIds.has(typeof l.source === 'string' ? l.source : l.source.id) && activeIds.has(typeof l.target === 'string' ? l.target : l.target.id));

    const sim = forceSimulation<SimNode>(active)
      .force('link', forceLink<SimNode, SimLink>(activeLinks as SimLink[]).id((d) => d.id).distance(layout === 'neurons' ? 26 : 40).strength(0.6))
      .force('charge', forceManyBody().strength(layout === 'neurons' ? -55 : layout === 'atomic' ? -220 : -95).distanceMax(360))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide(11));

    sim.stop(); // we control ticking so the layout settles even if rAF is throttled

    if (layout === 'constellation') {
      // cluster by type — anchor each type at a point on a ring
      const types = Array.from(new Set(active.map((n) => n.type)));
      const anchor = (t: KType) => { const i = types.indexOf(t); const a = (i / types.length) * Math.PI * 2; return { x: W / 2 + Math.cos(a) * Math.min(W, H) * 0.34, y: H / 2 + Math.sin(a) * Math.min(W, H) * 0.34 }; };
      sim.force('x', forceX<SimNode>((d) => anchor(d.type).x).strength(0.18)).force('y', forceY<SimNode>((d) => anchor(d.type).y).strength(0.18));
    } else if (layout === 'rings') {
      // radial by folder index
      sim.force('r', forceRadial<SimNode>((d) => 60 + FOLDER_ORDER.indexOf(d.folder) * 46, W / 2, H / 2).strength(0.5));
    }

    // settle a good static layout synchronously (no rAF dependency), then frame it
    for (let i = 0; i < 160; i++) sim.tick();
    frameNodes(active, W, H);
    // living = keep animating gently (rAF-driven); otherwise leave the static layout
    if (living) { sim.on('tick', () => setFrame((f) => f + 1)); sim.alphaTarget(0.02).alpha(0.2).restart(); }
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [nodes, links, layout, living, neighborIds]);

  // pan / zoom
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; setView((v) => { const nk = Math.max(0.3, Math.min(3, v.k * (e.deltaY < 0 ? 1.08 : 0.926))); const kr = nk / v.k; return { k: nk, x: mx - (mx - v.x) * kr, y: my - (my - v.y) * kr }; }); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const nodeDrag = useRef<SimNode | null>(null);
  const onDown = (e: React.PointerEvent) => { if (e.button !== 0) return; pan.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }; wrapRef.current?.querySelector('svg')?.classList.add('grabbing'); };
  const onMove = (e: React.PointerEvent) => {
    if (nodeDrag.current) { const n = nodeDrag.current; n.fx = (e.clientX - (wrapRef.current!.getBoundingClientRect().left) - view.x) / view.k; n.fy = (e.clientY - (wrapRef.current!.getBoundingClientRect().top) - view.y) / view.k; simRef.current?.alphaTarget(0.1).restart(); return; }
    if (pan.current) setView((v) => ({ ...v, x: pan.current!.ox + (e.clientX - pan.current!.sx), y: pan.current!.oy + (e.clientY - pan.current!.sy) }));
  };
  const onUp = () => { if (nodeDrag.current) { nodeDrag.current.fx = null; nodeDrag.current.fy = null; nodeDrag.current = null; if (!living) simRef.current?.alphaTarget(0); } pan.current = null; wrapRef.current?.querySelector('svg')?.classList.remove('grabbing'); };
  // frame the given nodes' bounds into the viewport
  const frameNodes = (ns: SimNode[], W?: number, H?: number) => {
    const el = wrapRef.current; if (!el) return;
    const w = W ?? el.clientWidth, h = H ?? el.clientHeight;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ns.forEach((n) => { if (n.x == null || n.y == null) return; minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
    if (!isFinite(minX)) return;
    const gw = maxX - minX + 120, gh = maxY - minY + 120;
    const k = Math.max(0.3, Math.min(1.6, Math.min(w / gw, h / gh)));
    setView({ k, x: (w - (minX + maxX) * k) / 2, y: (h - (minY + maxY) * k) / 2 });
  };
  const fit = () => frameNodes(neighborIds ? nodes.filter((n) => neighborIds.has(n.id)) : nodes);

  const shown = (n: SimNode) => !off.has(n.type) && (!neighborIds || neighborIds.has(n.id));
  const labelFor = (n: SimNode) => ['field', 'reservoir', 'lifecycle', 'domain'].includes(n.type) || view.k > 1.5 || sel === n.id;
  const rad = (n: SimNode) => (n.type === 'field' ? 11 : n.type === 'reservoir' || n.type === 'lifecycle' ? 8 : n.type === 'domain' ? 7 : 5);

  return (
    <div className="kb-graph" ref={wrapRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
      <div className="kg-toolbar">
        <div className="kg-seg">
          {LAYOUTS.map((l) => <b key={l.id} className={layout === l.id ? 'on' : ''} onClick={() => setLayout(l.id)}><l.icon size={12} /> {l.label}</b>)}
        </div>
        <div className={'kg-btn' + (living ? ' on' : '')} onClick={() => setLiving((v) => !v)}><Sparkles size={12} /> Living</div>
        <div className="kg-btn" onClick={fit}><Maximize size={12} /> Fit</div>
        <div className="kg-btn" onClick={() => { simRef.current?.alpha(0.8).restart(); }}><RotateCcw size={12} /> Re-layout</div>
      </div>
      <div className="kg-legend">
        {(Object.keys(TYPE_LABEL) as KType[]).map((t) => (
          <div key={t} className={'lg' + (off.has(t) ? ' off' : '')} onClick={() => setOff((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; })}>
            <i style={{ background: TYPE_COLOR[t] }} />{TYPE_LABEL[t]}
          </div>
        ))}
      </div>

      <svg className="kg-svg">
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {links.map((l, i) => {
            const s = typeof l.source === 'string' ? byId.get(l.source) : l.source;
            const t = typeof l.target === 'string' ? byId.get(l.target) : l.target;
            if (!s || !t || !shown(s) || !shown(t)) return null;
            const hot = sel && (s.id === sel || t.id === sel);
            return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={hot ? TYPE_COLOR[s.type] : 'var(--line)'} strokeWidth={hot ? 1.4 : 0.7} strokeOpacity={hot ? 0.8 : 0.4} />;
          })}
          {nodes.filter(shown).map((n) => (
            <g key={n.id} className="kg-node" transform={`translate(${n.x || 0},${n.y || 0})`}
              onPointerDown={(e) => { e.stopPropagation(); nodeDrag.current = n; }}
              onClick={(e) => { e.stopPropagation(); setSel(sel === n.id ? null : n.id); }}
              onPointerEnter={() => setTip({ x: (n.x || 0) * view.k + view.x, y: (n.y || 0) * view.k + view.y, n })}
              onPointerLeave={() => setTip(null)}>
              <circle r={rad(n) + (sel === n.id ? 3 : 0)} fill={TYPE_COLOR[n.type]}
                stroke={sel === n.id ? 'var(--ink)' : '#fff'} strokeWidth={sel === n.id ? 2 : 1} fillOpacity={0.92} />
              {labelFor(n) && <text x={rad(n) + 3} y={3}>{n.title}</text>}
            </g>
          ))}
        </g>
      </svg>

      {tip && (
        <div className="kg-tip" style={{ left: Math.min(tip.x + 14, (wrapRef.current?.clientWidth || 999) - 250), top: tip.y + 12 }}>
          <div className="tt"><i style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[tip.n.type], display: 'inline-block' }} />{tip.n.title}</div>
          <div className="tm">{TYPE_LABEL[tip.n.type]}{tip.n.meta ? ' · ' + tip.n.meta : ''}</div>
        </div>
      )}
    </div>
  );
}

// ── Explorer ─────────────────────────────────────────────────────────────────
function Explorer({ graph, index, sel, setSel }: { graph: KGraph; index: LinkIndex; sel: string | null; setSel: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ '01_Fields': true, '06_Lifecycles': true, '05_Data': true });
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  // resolve wikilink text → node by title OR alias, case-insensitive (like Obsidian)
  const byTitle = useMemo(() => {
    const m = new Map<string, KNode>();
    graph.nodes.forEach((n) => { const k = n.title.toLowerCase(); if (!m.has(k)) m.set(k, n); n.aliases?.forEach((a) => { const ak = a.toLowerCase(); if (!m.has(ak)) m.set(ak, n); }); });
    return m;
  }, [graph]);
  const node = sel ? byId.get(sel) : null;

  const folders = useMemo(() => {
    const g: Record<string, KNode[]> = {};
    graph.nodes.forEach((n) => { if (q && !(n.title.toLowerCase().includes(q.toLowerCase()) || n.tags.join(' ').includes(q.toLowerCase()))) return; (g[n.folder] = g[n.folder] || []).push(n); });
    return g;
  }, [graph, q]);

  // backlinks (in) + outgoing (out) + unresolved — from resolved [[wikilinks]], Obsidian-style
  const ctx = useMemo(() => {
    if (!sel) return null;
    const inc = [...(index.backlinks.get(sel) || [])].map((id) => byId.get(id)!).filter(Boolean);
    const out = [...(index.outgoing.get(sel) || [])].map((id) => byId.get(id)!).filter(Boolean);
    const unresolved = [...(index.unresolved.get(sel) || [])];
    return { inc, out, unresolved };
  }, [sel, index, byId]);

  const onBody = (e: React.MouseEvent) => {
    const t = (e.target as HTMLElement).closest('.wl') as HTMLElement | null;
    if (t) { const title = t.getAttribute('data-wl') || t.textContent || ''; const n = byTitle.get(title.toLowerCase()) || byTitle.get(title); if (n) setSel(n.id); }
  };

  return (
    <div className="kb-explorer">
      <div className="kb-tree">
        <input className="kb-search" placeholder="Search notes & tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="kb-treelist">
          {FOLDER_ORDER.filter((f) => folders[f]?.length).map((f) => (
            <div className="kb-folder" key={f}>
              <div className="kb-fhd" onClick={() => setOpen((o) => ({ ...o, [f]: !o[f] }))}>
                <ChevronRight size={11} style={{ transform: open[f] ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }} />
                {f}<span className="fcount">{folders[f].length}</span>
              </div>
              {(open[f] || q) && folders[f].map((n) => (
                <div key={n.id} className={'kb-note' + (sel === n.id ? ' on' : '')} onClick={() => setSel(n.id)}>
                  <span className="ndot" style={{ background: TYPE_COLOR[n.type] }} /><span className="ntx">{n.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="kb-center">
        {node ? (
          <>
            <div className="kb-note-head">
              <span className="kb-chip" style={{ background: TYPE_COLOR[node.type] }}>{TYPE_LABEL[node.type]}</span>
              <button className="kb-dl" onClick={() => downloadNote(node)} title="Download this note as Obsidian .md"><Download size={13} /> Download .md</button>
            </div>
            <div className="kb-meta">{node.folder}{node.meta ? ' · ' + node.meta : ''} · {node.tags.join(' ')}</div>
            <div className="kb-body" onClick={onBody} dangerouslySetInnerHTML={{ __html: noteHtml(node.body) }} />
          </>
        ) : (
          <div className="kb-empty" style={{ padding: 40, textAlign: 'center' }}>Select a note from the tree or graph to open it.</div>
        )}
      </div>

      <div className="kb-ctx">
        {node ? (
          <>
            <div className="ch">Linked mentions · {ctx?.inc.length || 0}</div>
            {ctx?.inc.length ? ctx.inc.map((n, i) => (
              <div className="kb-link" key={'i' + i} onClick={() => setSel(n.id)}><span className="ldot" style={{ background: TYPE_COLOR[n.type] }} />{n.title}<span className="lkind">{TYPE_LABEL[n.type]}</span></div>
            )) : <div className="kb-empty">No backlinks.</div>}
            <div className="ch">Links out · {ctx?.out.length || 0}</div>
            {ctx?.out.length ? ctx.out.map((n, i) => (
              <div className="kb-link" key={'o' + i} onClick={() => setSel(n.id)}><span className="ldot" style={{ background: TYPE_COLOR[n.type] }} />{n.title}<span className="lkind">{TYPE_LABEL[n.type]}</span></div>
            )) : <div className="kb-empty">No outgoing links.</div>}
            {!!ctx?.unresolved.length && (
              <>
                <div className="ch">Unresolved · {ctx.unresolved.length}</div>
                {ctx.unresolved.map((u, i) => <div className="kb-link kb-unresolved" key={'u' + i}><span className="ldot" style={{ background: 'var(--line2)' }} />{u}</div>)}
              </>
            )}
          </>
        ) : <div className="kb-empty">Backlinks & local graph appear here.</div>}
      </div>
    </div>
  );
}

// ── shell ────────────────────────────────────────────────────────────────────
export function KnowledgeView() {
  const [idx, setIdx] = useState<WbIndex | null>(null);
  const [sub, setSub] = useState<'explorer' | 'graph' | 'extraction'>('explorer');
  // arriving from another surface (e.g. Data QC's extraction gate, an agent turn) —
  // honour the requested sub-tab. Keyed on `seq`, so re-requesting the same view
  // re-fires but merely re-rendering does not hijack later navigation.
  const viewIntent = useStore((s) => s.viewIntent);
  useEffect(() => {
    if (viewIntent?.nav !== 'knowledge') return;
    const sub = viewIntent.sub;
    if (sub === 'explorer' || sub === 'graph' || sub === 'extraction') setSub(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewIntent?.seq]);
  const [sel, setSel] = useState<string | null>('field:volve');
  useEffect(() => { loadIndex().then(setIdx).catch(() => setIdx(null)); }, []);
  // accepted extractions join the graph as first-class nodes, so knowledge reviewed
  // in the Studio is immediately navigable in Explorer and Graph
  const userNotes = useStore((s) => s.userNotes);
  const graph = useMemo<KGraph | null>(() => {
    if (!idx) return null;
    const base = buildGraph([volveSeed(idx)]);
    const ext = extractedGraph(userNotes, base);
    return ext.nodes.length
      ? { nodes: [...base.nodes, ...ext.nodes], edges: [...base.edges, ...ext.edges] }
      : base;
  }, [idx, userNotes]);
  const index = useMemo<LinkIndex | null>(() => (graph ? buildLinkIndex(graph.nodes) : null), [graph]);

  return (
    <IntelligenceSurface className="kb knowledge-surface" accent="var(--teal)">
      <IntelligenceHeader icon={BookOpen} title="Knowledge Base" subtitle={graph && index ? `${graph.nodes.length} notes · ${index.edges.length} links · Volve` : 'loading…'}
        status={<div className="kb-prov"><Search size={11} /> CONNECTED TWIN · data ↔ knowledge · scalable multi-field</div>}
        actions={graph ? <button className="kb-dl kb-export" onClick={() => exportVault(graph.nodes)} title="Download the whole vault as an Obsidian ZIP"><FolderDown size={14} /> Export Vault (.zip)</button> : undefined} />
      <IntelligenceTabs active={sub} onChange={setSub} ariaLabel="Knowledge views" items={[
        { id: 'explorer', label: 'Explorer', icon: BookOpen },
        { id: 'graph', label: 'Graph & Timeline', icon: Orbit },
        { id: 'extraction', label: 'Extraction Studio', icon: FlaskConical },
      ]} />
      {/* the Studio owns its own sources (Data QC digests + uploads) — it does not
          depend on the Volve graph, so it must not wait on it */}
      {sub === 'extraction' ? <ExtractionStudio />
        : graph && index ? (sub === 'explorer'
          ? <Explorer graph={graph} index={index} sel={sel} setSel={setSel} />
          : <KnowledgeGraph graph={graph} index={index} sel={sel} setSel={setSel} />)
        : <div className="kb-empty" style={{ padding: 40 }}>Loading Volve knowledge graph…</div>}
    </IntelligenceSurface>
  );
}
