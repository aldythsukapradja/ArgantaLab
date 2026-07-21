import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { mergeVault } from '../../knowledge/vault';
import { toGraph } from '../../knowledge/links';

// Canvas2D knowledge graph. Seeded radial-by-type-ring layout (+ a few relax iterations),
// color by note type, radius ∝ degree, hover → neighbor highlight, click → open note in
// Explorer, pan/zoom, galaxy/rings shape switcher. rAF-gated; static under reduced-motion.

const TYPE_COLOR: Record<string, string> = {
  field: '#50d0b1', well: '#62aef7', wellbore: '#62aef7', surface: '#e58d4b',
  datatable: '#e1ae48', document: '#b37df0', qc: '#e1ae48', archaeology: '#7f9299',
  concept: '#7f9299', decision: '#df7084', extracted: '#b37df0',
};
const RING: Record<string, number> = { field: 0, well: 1, wellbore: 2, surface: 3, datatable: 4, document: 4, qc: 5, archaeology: 5, concept: 5, decision: 5, extracted: 4 };

interface N { id: string; title: string; type: string; deg: number; x: number; y: number }

export function Graph() {
  const { userNotes, openNote } = useStore();
  const notes = useMemo(() => mergeVault(userNotes), [userNotes]);
  const graph = useMemo(() => toGraph(notes), [notes]);
  const [shape, setShape] = useState<'rings' | 'galaxy'>('rings');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  const hoverId = useRef<string | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [hoverTitle, setHoverTitle] = useState<string | null>(null);

  // layout (computed once per shape/graph)
  const nodes = useMemo<N[]>(() => {
    const list: N[] = graph.nodes.map((n) => ({ ...n, x: 0, y: 0 }));
    const byRing: Record<number, N[]> = {};
    for (const n of list) { const r = RING[n.type] ?? 5; (byRing[r] ??= []).push(n); }
    if (shape === 'rings') {
      Object.entries(byRing).forEach(([r, ns]) => {
        const radius = Number(r) * 150;
        ns.forEach((n, i) => {
          if (Number(r) === 0) { n.x = 0; n.y = 0; return; }
          const a = (i / ns.length) * Math.PI * 2 + Number(r);
          n.x = Math.cos(a) * radius; n.y = Math.sin(a) * radius;
        });
      });
    } else {
      // galaxy spiral by degree (high degree = inner)
      const sorted = [...list].sort((a, b) => b.deg - a.deg);
      sorted.forEach((n, i) => {
        const a = i * 0.5; const rad = 26 * Math.sqrt(i);
        n.x = Math.cos(a) * rad; n.y = Math.sin(a) * rad;
      });
    }
    // a few relax iterations (light repulsion between close nodes)
    const idx = new Map(list.map((n) => [n.id, n]));
    for (let it = 0; it < 30; it++) {
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
        const p = list[a], q = list[b];
        let dx = p.x - q.x, dy = p.y - q.y; let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random(); dy = Math.random(); d2 = 1; }
        if (d2 < 40 * 40) { const f = (40 * 40 - d2) / d2 * 0.02; p.x += dx * f; p.y += dy * f; q.x -= dx * f; q.y -= dy * f; }
      }
    }
    void idx;
    return list;
  }, [graph, shape]);

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      (map.get(e.from) ?? map.set(e.from, new Set()).get(e.from)!).add(e.to);
      (map.get(e.to) ?? map.set(e.to, new Set()).get(e.to)!).add(e.from);
    }
    return map;
  }, [graph]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const nodeIndex = new Map(nodes.map((n) => [n.id, n]));
    // auto-fit once
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1, spanY = Math.max(...ys) - Math.min(...ys) || 1;

    function fit() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio; canvas.height = rect.height * devicePixelRatio;
      view.current.scale = Math.min(rect.width / (spanX + 160), rect.height / (spanY + 160), 1.4);
      view.current.tx = rect.width / 2; view.current.ty = rect.height / 2;
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const { scale, tx, ty } = view.current;
      const hov = hoverId.current;
      const nbr = hov ? neighbors.get(hov) : null;
      // edges
      ctx.lineWidth = 0.6;
      for (const e of graph.edges) {
        const a = nodeIndex.get(e.from), b = nodeIndex.get(e.to); if (!a || !b) continue;
        const active = !hov || e.from === hov || e.to === hov;
        ctx.strokeStyle = active ? 'rgba(127,146,153,0.45)' : 'rgba(127,146,153,0.07)';
        ctx.beginPath(); ctx.moveTo(a.x * scale + tx, a.y * scale + ty); ctx.lineTo(b.x * scale + tx, b.y * scale + ty); ctx.stroke();
      }
      // nodes
      for (const n of nodes) {
        const px = n.x * scale + tx, py = n.y * scale + ty;
        const r = Math.max(3, 3 + Math.sqrt(n.deg) * 1.9);
        const dim = hov && n.id !== hov && !(nbr?.has(n.id));
        ctx.globalAlpha = dim ? 0.18 : 1;
        ctx.fillStyle = TYPE_COLOR[n.type] ?? '#7f9299';
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        if (n.id === hov) { ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
        // labels: top-degree or hovered/neighbor
        if ((n.deg >= 8 || n.id === hov || nbr?.has(n.id)) && !dim) {
          ctx.globalAlpha = 1; ctx.fillStyle = getComputedStyle(canvas).color || '#e5eef0';
          ctx.font = '10px ui-monospace, monospace';
          ctx.fillText(n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title, px + r + 3, py + 3);
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop() { draw(); raf = requestAnimationFrame(loop); }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    fit();
    if (reduced) draw(); else loop();

    const toWorld = (mx: number, my: number) => ({ x: (mx - view.current.tx) / view.current.scale, y: (my - view.current.ty) / view.current.scale });
    const pick = (mx: number, my: number): N | null => {
      const w = toWorld(mx, my); let best: N | null = null, bd = 1e9;
      for (const n of nodes) { const dx = n.x - w.x, dy = n.y - w.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n; } }
      return best && Math.sqrt(bd) * view.current.scale < 12 ? best : null;
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (drag.current) { view.current.tx += mx - drag.current.x; view.current.ty += my - drag.current.y; drag.current = { x: mx, y: my }; if (reduced) draw(); return; }
      const hit = pick(mx, my);
      hoverId.current = hit?.id ?? null; canvas.style.cursor = hit ? 'pointer' : 'grab';
      setHoverTitle(hit?.title ?? null);
      if (reduced) draw();
    };
    const onDown = (e: MouseEvent) => { const rect = canvas.getBoundingClientRect(); drag.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
    const onUp = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const moved = drag.current && (Math.abs(mx - drag.current.x) > 3 || Math.abs(my - drag.current.y) > 3);
      drag.current = null;
      if (!moved) { const hit = pick(mx, my); if (hit) openNote(hit.id); }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const before = toWorld(mx, my);
      view.current.scale = Math.max(0.15, Math.min(4, view.current.scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      view.current.tx = mx - before.x * view.current.scale; view.current.ty = my - before.y * view.current.scale;
      if (reduced) draw();
    };
    canvas.addEventListener('mousemove', onMove); canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp); canvas.addEventListener('wheel', onWheel, { passive: false });
    const onResize = () => { fit(); if (reduced) draw(); };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp); canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }, [nodes, graph, neighbors, openNote]);

  const legend = ['field', 'well', 'wellbore', 'surface', 'datatable', 'document', 'extracted'];
  return (
    <div style={{ height: '100%', padding: 14, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="eyebrow">Knowledge graph · {graph.nodes.length} nodes · {graph.edges.length} edges</span>
        <div style={{ display: 'flex', gap: 2, border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden' }}>
          {(['rings', 'galaxy'] as const).map((s) => (
            <button key={s} onClick={() => setShape(s)} style={{ padding: '4px 12px', fontSize: 11, background: shape === s ? 'var(--panel-2)' : 'transparent', color: shape === s ? 'var(--text)' : 'var(--muted)' }}>{s}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {legend.map((t) => <span key={t} className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 8, height: 8, borderRadius: 8, background: TYPE_COLOR[t] }} />{t}</span>)}
        </div>
      </div>
      <div className="panel" style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', color: 'var(--text)' }} />
        {hoverTitle && <div className="mono" style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 10.5, color: 'var(--muted)' }}>{hoverTitle} · click to open</div>}
        <div className="mono" style={{ position: 'absolute', top: 8, right: 10, fontSize: 9.5, color: 'var(--muted)' }}>scroll = zoom · drag = pan</div>
      </div>
    </div>
  );
}
