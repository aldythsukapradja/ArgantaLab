"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { listRuns, listPosts, subscribe } from "../store.js";
import { listCharacters, subscribeCharacters } from "../characters.js";
import { buildStudioGraph, graphStats, KIND_COLOR } from "../graph.js";

// The knowledge graph: character → generation → post, rendered as SVG with a
// deterministic radial layout. Nobody in Higgsfield/Buffer has this — a visual
// map of every Soul, what it generated, and where it published. Data adapter is
// EngineNode/EngineEdge shaped, so this can later move to the PixiJS engine.

const W = 960, H = 640;

export default function GraphStudio() {
  const [runs, setRuns] = useState([]);
  const [chars, setChars] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sel, setSel] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);

  const refresh = useCallback(async () => {
    setRuns(await listRuns(200));
    setChars(await listCharacters());
    setPosts(await listPosts(200));
  }, []);

  useEffect(() => {
    refresh();
    const u1 = subscribe(refresh);
    const u2 = subscribeCharacters(refresh);
    return () => { u1(); u2(); };
  }, [refresh]);

  const { nodes, edges } = useMemo(
    () => buildStudioGraph(runs, chars, posts, { width: W, height: H }),
    [runs, chars, posts]
  );
  const stats = useMemo(() => graphStats(nodes), [nodes]);
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  // Pan + zoom.
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0012);
    setView((v) => ({ ...v, k: Math.max(0.4, Math.min(3, v.k * factor)) }));
  }, []);
  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y }; };
  const onMove = (e) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }));
  };
  const onUp = () => { drag.current = null; };

  const focus = sel ? new Set([sel, ...edges.filter((e) => e.source === sel || e.target === sel).flatMap((e) => [e.source, e.target])]) : null;

  return (
    <div className="h-full w-full bg-transparent text-white relative z-10 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-lg font-bold tracking-tight">Knowledge Graph</h1>
          <p className="text-white/40 text-[13px]">Soul → generation → post. Every asset, mapped.</p>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full px-4 py-2">
          {Object.entries(KIND_COLOR).map(([kind, color]) => (
            <span key={kind} className="flex items-center gap-1.5 text-[11px] text-white/70">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {kind} <span className="text-white/40">{stats[kind] || 0}</span>
            </span>
          ))}
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="h-full flex items-center justify-center text-white/30 text-sm">
          Empty graph. Create a Soul and generate something — it appears here.
        </div>
      ) : (
        <svg
          width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}
          className="cursor-grab active:cursor-grabbing"
          onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onClick={(e) => { if (e.target.tagName === 'svg') setSel(null); }}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* Edges */}
            {edges.map((e, i) => {
              const s = nodeById[e.source], t = nodeById[e.target];
              if (!s || !t) return null;
              const dim = focus && !(focus.has(e.source) && focus.has(e.target));
              return (
                <line
                  key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={e.kind === 'published' ? KIND_COLOR.post : KIND_COLOR.generation}
                  strokeWidth={dim ? 0.5 : 1.2}
                  strokeOpacity={dim ? 0.08 : 0.35}
                />
              );
            })}
            {/* Nodes */}
            {nodes.map((n) => {
              const dim = focus && !focus.has(n.id);
              const isSel = sel === n.id;
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }}
                   onClick={(e) => { e.stopPropagation(); setSel(isSel ? null : n.id); }}>
                  {isSel && <circle r={n.r + 6} fill="none" stroke={n.color} strokeWidth={1.5} strokeOpacity={0.6} />}
                  <circle
                    r={n.r} fill={n.color}
                    fillOpacity={dim ? 0.2 : (n.kind === 'character' ? 0.95 : 0.85)}
                    stroke={n.kind === 'character' ? '#fff' : n.color}
                    strokeOpacity={dim ? 0.1 : (n.kind === 'character' ? 0.5 : 0)}
                    strokeWidth={n.kind === 'character' ? 1.5 : 0}
                  />
                  {n.kind === 'character' && !dim && (
                    <text y={n.r + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fillOpacity={0.85}>
                      {n.title.length > 18 ? n.title.slice(0, 18) + '…' : n.title}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-1.5">
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(3, v.k * 1.25) }))} className="w-9 h-9 rounded-lg bg-white/[0.06] backdrop-blur border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none">+</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.4, v.k / 1.25) }))} className="w-9 h-9 rounded-lg bg-white/[0.06] backdrop-blur border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none">−</button>
        <button onClick={() => setView({ x: 0, y: 0, k: 1 })} title="Reset view" className="w-9 h-9 rounded-lg bg-white/[0.06] backdrop-blur border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs">⊙</button>
      </div>

      {/* Inspector */}
      {sel && nodeById[sel] && (
        <div className="absolute bottom-5 right-5 z-20 w-64 bg-[#0a0a0c]/90 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full" style={{ background: nodeById[sel].color }} />
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{nodeById[sel].kind}</span>
          </div>
          <p className="text-sm font-medium leading-snug mb-2 break-words">{nodeById[sel].title}</p>
          {nodeById[sel].asset_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nodeById[sel].asset_url} alt="" className="w-full rounded-lg mb-2 border border-white/10" />
          )}
          <div className="flex flex-wrap gap-2 text-[10px] text-white/50">
            {nodeById[sel].trigger_token && <span className="font-mono text-[#22d3ee]/70">{nodeById[sel].trigger_token}</span>}
            {nodeById[sel].provider && <span className="px-1.5 py-0.5 rounded bg-white/5">{nodeById[sel].provider}</span>}
            {nodeById[sel].status && <span className="px-1.5 py-0.5 rounded bg-white/5">{nodeById[sel].status}</span>}
            {nodeById[sel].platform && <span className="px-1.5 py-0.5 rounded bg-white/5">{nodeById[sel].platform}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
