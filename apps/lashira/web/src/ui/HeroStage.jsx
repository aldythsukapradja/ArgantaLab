import { useEffect, useRef } from 'react';
import { loadMotionTables, loadPlayerResources } from '../net/hero.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';

// A small live-composited avatar preview — the SAME engine (compositor + hero.js
// loaders) the farm renders with, so what the wizard shows IS what walks the
// farm a second later. Mirrors Kingdom's CompositeStage: draws synchronously once
// before entering the rAF loop, so it still paints on a backgrounded / hidden tab
// (the documented rAF-throttle gotcha).
let tablesP = null;
const getTables = () => (tablesP ||= loadMotionTables());

export default function HeroStage({
  spec,
  motion = 'NormalStandBySouth',
  scale = 3,
  width = 168,
  height = 196,
  fps = 6,
}) {
  const canvasRef = useRef(null);
  const S = useRef({ tables: null, resources: null, raf: 0, motion, scale, fps, width, height });
  S.current.motion = motion;
  S.current.scale = scale;
  S.current.fps = fps;
  S.current.width = width;
  S.current.height = height;

  useEffect(() => {
    let live = true;
    getTables().then((t) => { if (live) { S.current.tables = t; paintOnce(); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    loadPlayerResources(spec)
      .then((r) => { if (live) { S.current.resources = r; startLoop(); } })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(spec)]);

  useEffect(() => () => cancelAnimationFrame(S.current.raf), []);

  function draw(now) {
    const c = canvasRef.current;
    const st = S.current;
    if (!c || !st.tables || !st.resources) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== st.width * dpr) { c.width = st.width * dpr; c.height = st.height * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, st.width, st.height);

    const total = Math.max(1, stepCount(st.tables, st.motion));
    const frame = Math.floor((now / (1000 / st.fps))) % total;
    let list = [];
    try { list = resolveStep(st.tables, st.resources, st.motion, frame) || []; } catch { list = []; }
    if (!list.length) return;
    const bb = drawListBBox([list]);
    if (!bb) return;
    // Fit the WHOLE figure inside the stage instead of a fixed scale — a tall
    // helmet, mount, or wide outfit could exceed `st.scale` and crop off the top
    // (the real bug: scale=3 on a 196px canvas clipped elaborate headgear).
    // Never scale UP past st.scale (a tiny placeholder shouldn't look huge).
    const pad = 12;
    const bbW = Math.max(1, bb.x1 - bb.x0);
    const bbH = Math.max(1, bb.y1 - bb.y0);
    const fitScale = Math.min(st.scale, (st.width - pad * 2) / bbW, (st.height - pad * 2) / bbH);
    const anchorX = st.width / 2 - ((bb.x0 + bb.x1) / 2) * fitScale;
    const anchorY = st.height - pad - bb.y1 * fitScale;
    paintStep(ctx, list, { x: anchorX, y: anchorY }, fitScale);
  }

  function paintOnce() { draw(performance.now()); }

  function startLoop() {
    cancelAnimationFrame(S.current.raf);
    const tick = (t) => { draw(t); S.current.raf = requestAnimationFrame(tick); };
    draw(performance.now());          // synchronous first paint (hidden-tab safe)
    S.current.raf = requestAnimationFrame(tick);
  }

  return (
    <canvas
      ref={canvasRef}
      className="ob-hero-canvas"
      style={{ width, height, imageRendering: 'pixelated' }}
      aria-label="Your hero preview"
    />
  );
}
