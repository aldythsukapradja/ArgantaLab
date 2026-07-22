// DataMapOrgChart — the pan/zoom org-chart tree ("North Star" → lifecycle stage →
// class → theme/format group → document), ported 1:1 from COSMO_Final.html
// (buildOrgData + function DataMapOrgChart). Uses d3-hierarchy/d3-shape (same family
// already in the project) for the tidy-tree layout; manual wheel-zoom + drag-pan and
// collapse/expand are reproduced exactly.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import { linkVertical } from 'd3-shape';
import {
  Sparkles, Compass, Layers, Drill, Gauge, CalendarClock, Plus, Minus, Maximize,
  BookMarked, Folder, FileText, Database, MonitorPlay, LayoutDashboard,
} from 'lucide-react';
import { FILES, ORG_STAGES, GEN_TYPE_ICON, CLS_META, fileIcon, type FileRow } from './report-types';

const NODE_W = 176, NODE_H = 54, GAP_X = 22, GAP_Y = 76;

type OrgNode = {
  id: string; kind: 'root' | 'stage' | 'cls' | 'grp' | 'doc'; name: string; sub?: string;
  c: string; icon?: string; children?: OrgNode[] | null; _kids?: number; doc?: FileRow;
};

function buildOrgData(): OrgNode {
  const root: OrgNode = { id: 'root', kind: 'root', name: 'North Star', sub: 'Al Shaheen · Subsurface Data Map', c: '#0FB5A6', icon: 'sparkles', children: [] };
  ORG_STAGES.forEach((st) => {
    const docs = FILES.filter((f) => f.dept === st.id);
    const stageNode: OrgNode = { id: 'st-' + st.id, kind: 'stage', name: st.name, sub: docs.length + ' documents', c: st.c, icon: st.icon, children: [] };
    (['standard', 'generated'] as const).forEach((cls) => {
      const label = cls === 'standard' ? 'Knowledge Base' : 'Cosmo Generated';
      const groupBy = cls === 'standard' ? 'theme' : 'fmt';
      const set = docs.filter((f) => f.cls === cls);
      if (!set.length) return;
      const cm = CLS_META[cls];
      const clsNode: OrgNode = { id: 'cls-' + st.id + '-' + cls, kind: 'cls', name: label, sub: set.length + (cls === 'standard' ? ' standards' : ' outputs'), c: cm[1], icon: cm[0], children: [] };
      const groups: Record<string, FileRow[]> = {};
      set.forEach((f) => { const g = (f as unknown as Record<string, string>)[groupBy]; (groups[g] = groups[g] || []).push(f); });
      Object.entries(groups).forEach(([g, arr]) => {
        clsNode.children!.push({
          id: 'grp-' + st.id + '-' + cls + '-' + g, kind: 'grp', name: g, sub: arr.length + (cls === 'standard' ? ' notes' : ' files'), c: cm[1],
          icon: cls === 'standard' ? 'folder' : (GEN_TYPE_ICON[g] ? GEN_TYPE_ICON[g][0] : 'folder'),
          children: arr.map((f) => ({ id: 'doc-' + f.name, kind: 'doc', name: f.title, sub: f.by, c: st.c, doc: f, icon: fileIcon(f)[0] })),
        });
      });
      stageNode.children!.push(clsNode);
    });
    root.children!.push(stageNode);
  });
  return root;
}

// COSMO's `.org svg{width:100%;height:100%}` rule (meant for the pan/zoom canvas
// <svg>) is a plain descendant selector — it also catches every Lucide icon nested
// inside node cards / zoom buttons, blowing them up to fill their container. An
// inline style always wins over an external stylesheet rule, so we pin icon size
// explicitly here instead of fighting specificity in the generated CSS.
const iconStyle = (size: number): CSSProperties => ({ width: size, height: size, flexShrink: 0 });

function orgIcon(name: string | undefined, size: number) {
  const style = iconStyle(size);
  switch (name) {
    case 'sparkles': return <Sparkles size={size} style={style} />;
    case 'compass': return <Compass size={size} style={style} />;
    case 'layers': return <Layers size={size} style={style} />;
    case 'drill': return <Drill size={size} style={style} />;
    case 'gauge': return <Gauge size={size} style={style} />;
    case 'calendar-clock': return <CalendarClock size={size} style={style} />;
    case 'book-marked': return <BookMarked size={size} style={style} />;
    case 'folder': return <Folder size={size} style={style} />;
    case 'file-text': return <FileText size={size} style={style} />;
    case 'database': return <Database size={size} style={style} />;
    case 'monitor-play': return <MonitorPlay size={size} style={style} />;
    case 'layout-dashboard': return <LayoutDashboard size={size} style={style} />;
    default: return <Sparkles size={size} style={style} />;
  }
}

export function DataMapOrgChart({ onOpen }: { onOpen: (f: FileRow) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(ORG_STAGES.map((st) => 'st-' + st.id)));
  const [tf, setTf] = useState({ x: 40, y: 30, k: 0.8 });
  const raw = useMemo(buildOrgData, []);

  const prune = (n: OrgNode): OrgNode => {
    const o: OrgNode = { ...n };
    if (collapsed.has(n.id)) { o._kids = (n.children || []).length; o.children = null; }
    else if (n.children) { o.children = n.children.map(prune); }
    return o;
  };
  const rootData = useMemo(() => prune(raw), [raw, collapsed]);
  const hierData = useMemo(() => hierarchy(rootData), [rootData]);
  const layout = useMemo(() => tree<OrgNode>().nodeSize([NODE_W + GAP_X, NODE_H + GAP_Y]).separation((a, b) => (a.parent === b.parent ? 1 : 1.25))(hierData), [hierData]);
  const nodes = layout.descendants();
  const links = layout.links();
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
  const link = linkVertical<unknown, HierarchyPointNode<OrgNode>>().x((d) => d.x).y((d) => d.y);

  const tfRef = useRef(tf); tfRef.current = tf;
  const extRef = useRef({ minX, maxX, maxY }); extRef.current = { minX, maxX, maxY };
  const clampK = (k: number) => Math.max(0.12, Math.min(2, +k.toFixed(3)));

  function fit() {
    const el = wrapRef.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight, M = 90;
    const { minX, maxX, maxY } = extRef.current;
    const gw = (maxX - minX) + NODE_W + M * 2, gh = maxY + NODE_H + M * 2;
    const k = clampK(Math.min(1, Math.min(w / gw, h / gh)));
    setTf({ k, x: w / 2 - ((minX + maxX) / 2) * k, y: Math.max(M * k, h / 2 - (maxY / 2) * k) });
  }
  function zoomBy(f: number) {
    const el = wrapRef.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    setTf((t) => { const nk = clampK(t.k * f); const cx = w / 2, cy = h / 2; const r = nk / t.k; return { k: nk, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r }; });
  }
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    let drag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
      setTf((t) => { const nk = clampK(t.k * (e.deltaY < 0 ? 1.08 : 0.926)); const kr = nk / t.k; return { k: nk, x: mx - (mx - t.x) * kr, y: my - (my - t.y) * kr }; });
    };
    const onDown = (e: PointerEvent) => { if (e.button !== 0) return; const t = tfRef.current; drag = { x: e.clientX, y: e.clientY, px: t.x, py: t.y, moved: false }; el.classList.add('grabbing'); };
    const onMove = (e: PointerEvent) => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y, px = drag.px, py = drag.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      setTf((t) => ({ ...t, x: px + dx, y: py + dy }));
    };
    const onUp = () => { if (drag) { (el as unknown as { _moved?: boolean })._moved = drag.moved; el.classList.remove('grabbing'); } drag = null; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    const t = setTimeout(fit, 60);
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => { el.removeEventListener('wheel', onWheel); el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); ro.disconnect(); clearTimeout(t); };
  }, []);

  const toggle = (id: string, hasKids: boolean) => { if (!hasKids) return; setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const expandAll = () => setCollapsed(new Set());
  const collapseToStages = () => setCollapsed(new Set(raw.children!.map((st) => st.id)));
  const nodeClick = (n: HierarchyPointNode<OrgNode>) => {
    const el = wrapRef.current as unknown as { _moved?: boolean } | null;
    if (el && el._moved) { el._moved = false; return; }
    const d = n.data;
    if (d.kind === 'doc') { if (d.doc) onOpen(d.doc); }
    else { const hasKids = !!((d.children && d.children.length) || d._kids); toggle(d.id, hasKids); }
  };

  return (
    <div className="org" ref={wrapRef}>
      <div className="org-seg">
        <b onClick={expandAll}>Expand all</b>
        <b onClick={collapseToStages}>Collapse to stages</b>
      </div>
      <div className="org-ctrls">
        <div className="ocb" onClick={() => zoomBy(1.25)} title="Zoom in"><Plus size={16} style={iconStyle(16)} /></div>
        <div className="ocb" onClick={() => zoomBy(0.8)} title="Zoom out"><Minus size={16} style={iconStyle(16)} /></div>
        <div className="ocb" onClick={fit} title="Fit"><Maximize size={15} style={iconStyle(15)} /></div>
      </div>
      <svg>
        <g transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`}>
          {links.map((l, i) => <path key={i} className="org-link" d={link(l as unknown as { source: HierarchyPointNode<OrgNode>; target: HierarchyPointNode<OrgNode> }) || undefined} />)}
          {nodes.map((n) => {
            const d = n.data; const hasKids = !!((d.children && d.children.length) || d._kids);
            const isCol = collapsed.has(d.id);
            return (
              <g key={d.id} transform={`translate(${n.x - NODE_W / 2},${n.y - NODE_H / 2})`}>
                <foreignObject className="org-fo" width={NODE_W} height={NODE_H}>
                  <div className={'node-card ' + d.kind + (isCol ? ' collapsed' : '')} onClick={() => nodeClick(n)} title={d.name}>
                    <span className="edge" style={{ background: d.c }} />
                    {d.kind === 'doc'
                      ? <span className="ndot" style={{ background: d.c }} />
                      : <span className="nic" style={{ background: d.c }}>{orgIcon(d.icon, d.kind === 'root' ? 16 : 14)}</span>}
                    <span className="ntx"><span className="nnm">{d.name}</span><span className="nsub">{d.sub || ''}</span></span>
                    {d.kind === 'doc' && d.doc && <span className="ntag">{d.doc.pr}</span>}
                    {hasKids && d.kind !== 'root' && <span className="node-count">{isCol ? '+' + (d._kids || (d.children && d.children.length)) : '−'}</span>}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="org-legend">
        {ORG_STAGES.map((s) => <span className="lg" key={s.id}><i style={{ background: s.c }} />{s.name}</span>)}
      </div>
      <div className="org-hint">scroll = zoom · drag = pan · click a node to expand · click a doc to open</div>
    </div>
  );
}
