// Cinematic visual primitives that are not the map and not the GL stage.
// Everything renders behind HTML typography — never text in canvas or WebGL.
import { useEffect, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { gsap, dur, prefersReducedMotion } from './timeline';

/* ── Starfield ──────────────────────────────────────────────────────────────
   Canvas, not DOM: 700 twinkling nodes as elements would thrash layout. */
export function Starfield({ density = 620 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      cv.width = cv.offsetWidth * dpr; cv.height = cv.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);

    const stars = Array.from({ length: density }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.2 + 0.25,
      p: Math.random() * Math.PI * 2,
      s: 0.4 + Math.random() * 0.9,
    }));

    const state = { reveal: 0, t: 0 };
    const tl = gsap.to(state, { reveal: 1, duration: dur(4.5), ease: 'power1.inOut' });
    let raf = 0;
    const draw = () => {
      const w = cv.offsetWidth, h = cv.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      state.t += 0.006;
      stars.forEach((st, i) => {
        // Depth order, so the sky fills instead of switching on.
        if (i / stars.length > state.reveal) return;
        ctx.globalAlpha = (0.55 + 0.45 * Math.sin(state.t * st.s + st.p)) * 0.9;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    if (prefersReducedMotion()) { state.reveal = 1; tl.progress(1); }
    draw();
    return () => { cancelAnimationFrame(raf); tl.kill(); ro.disconnect(); };
  }, [density]);
  return <canvas className="kn-starfield" ref={ref} aria-hidden />;
}

/* ── Living ecosystem ───────────────────────────────────────────────────────
   Slide 9. A real d3-force simulation, not a fixed ring pretending to breathe:
   the nodes actually settle, and the graph keeps moving while he talks. */
export const ECOSYSTEM = [
  'Universities', 'Industry', 'Government', 'Students',
  'Senior Geoscientists', 'IndoGeo', 'Publications', 'Datasets',
];

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

interface Node extends SimulationNodeDatum {
  id: string; x: number; y: number; core?: boolean;
}
type Link = SimulationLinkDatum<Node>;

export function EcosystemForce() {
  const host = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<{ a: Node; b: Node }[]>([]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const w = el.clientWidth || 1200, h = el.clientHeight || 700;

    const core: Node = { id: 'core', x: w / 2, y: h / 2, fx: w / 2, fy: h / 2, core: true };
    const ring: Node[] = ECOSYSTEM.map((id, i) => {
      const a = (i / ECOSYSTEM.length) * Math.PI * 2 - Math.PI / 2;
      return { id, x: w / 2 + Math.cos(a) * 260, y: h / 2 + Math.sin(a) * 260 };
    });
    const all = [core, ...ring];
    const linkDefs = ring.map((n) => ({ source: core.id, target: n.id })) as unknown as Link[];

    const sim = forceSimulation<Node>(all)
      .force('link', forceLink<Node, Link>(linkDefs as Link[])
        .id((d) => d.id)
        .distance(Math.min(w, h) * 0.3)
        .strength(0.5))
      .force('charge', forceManyBody().strength(-820))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide(64))
      .alphaDecay(0.02)
      // Never fully cools — the brief asked for an ecosystem that feels alive.
      .alphaMin(prefersReducedMotion() ? 0.3 : 0.008)
      .on('tick', () => {
        setNodes([...all]);
        setLinks(ring.map((n) => ({ a: core, b: n })));
      });

    if (prefersReducedMotion()) sim.stop();
    return () => { sim.stop(); };
  }, []);

  return (
    <div className="kn-eco" ref={host} aria-hidden>
      <svg>
        {links.map((l, i) => (
          <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} data-eco-link />
        ))}
        {nodes.filter((n) => !n.core).map((n) => (
          <circle key={n.id} className="kn-eco-dot" cx={n.x} cy={n.y} r={4} data-eco-node />
        ))}
      </svg>
      {nodes.filter((n) => !n.core).map((n) => (
        <span key={n.id} className="kn-eco-label" data-eco-label style={{ left: n.x, top: n.y }}>{n.id}</span>
      ))}
      {nodes.filter((n) => n.core).map((n) => (
        <span key="core" className="kn-eco-center" data-eco-center style={{ left: n.x, top: n.y }}>
          Shared Geological<br />Framework
        </span>
      ))}
    </div>
  );
}
