// CompositeStage — canvas that renders a full paper-doll loadout for a
// motion, stepping at the client's cadence. Pure function of its props;
// all game logic lives in engine/.
import { useEffect, useRef, useState } from 'react';
import * as data from './data.js';
import { tintedSheet } from './palettes.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from './compositor.js';

const CHAR_KEYS = [
  'body', 'coat', 'face', 'hair', 'helmet', 'weapon', 'shield',
  'mantle', 'shoes', 'neck', 'facedec', 'hairdec', 'emotion',
];

// Resolve a loadout spec {body:{cat:'body',id,palette}, ...,
// mount:{id}} into draw-ready resources {key: {part, sheet}}.
async function loadResources(spec) {
  const out = {};
  await Promise.all(
    CHAR_KEYS.map(async (key) => {
      // 'emotion' (Layer.tbl slot 3, paired with face's slot 2) carries the
      // actual visual for 13 of the 15 emotes — face itself only differs for
      // Victory/HandToMouth. It's the SAME part-id count as face (39/39) and
      // is never independently chosen, so no saved spec ever sets it — derive
      // it from whichever face is equipped instead of reading it verbatim.
      const sel = key === 'emotion'
        ? (spec.emotion || (spec.face ? { cat: 'emotion', id: spec.face.id, palette: null } : null))
        : spec[key];
      if (!sel || sel.id == null) return;
      const cat = sel.cat || key;
      const parts = await data.charParts(cat);
      const part = parts.find((p) => p.id === sel.id);
      if (!part?.sheet) return;
      let sheet;
      if (sel.palette != null && sel.palette !== part.palette_id && part.idx_sheet) {
        const palettes = await data.charPalettes(cat);
        sheet = await tintedSheet(
          data.loadImage(data.idxSheetUrl(cat, part)),
          palettes[sel.palette] || palettes[0],
          `${cat}:${part.id}:${sel.palette}`
        );
      } else {
        sheet = await data.loadImage(data.sheetUrl(cat, part));
      }
      out[key] = { part, sheet };
    })
  );
  if (spec.mount && spec.mount.id != null) {
    const all = await data.mounts();
    const creature = all[spec.mount.id];
    if (creature?.sheet) {
      out.mount = {
        creature,
        sheet: await data.loadImage(data.mountSheetUrl(creature)),
      };
    }
  }
  return out;
}

// Default canvas backdrop — the checkerboard that reads as "transparent" in the
// Character Lab preview. Callers that composite the hero ONTO a scene (e.g.
// Skill Forge's arena) pass background="transparent" so only the sprite shows.
const CHECKER_BG = 'repeating-conic-gradient(var(--stage-a) 0% 25%, var(--stage-b) 0% 50%) 0 0 / 24px 24px';

export default function CompositeStage({
  spec, motionName, playing = true, stepOverride = null,
  scale = 3, speed = 1, width = 260, height = 260, onStep,
  // oneShot: play motionName's frames 0..n-1 ONCE (hold the last frame), then
  // call onComplete() exactly once — for a real "perform this skill" trigger
  // (Skill Forge's cast) instead of an endlessly looping pose. Additive/
  // backward-compatible: omit both and behavior is identical to before.
  oneShot = false, onComplete,
  // Canvas backdrop. Default = the checkerboard "transparent" preview. Pass
  // 'transparent' (or any CSS background) to drop it, e.g. on a scene where the
  // hero should sit directly on the artwork with no box behind it.
  background = CHECKER_BG,
  // Auto-fit the sprite to a target on-canvas HEIGHT (px), overriding `scale`.
  // A hardcoded `scale` is a guess that only holds for one body's proportions
  // (kid vs adult sheets differ) and easily clips a wide swing frame off the
  // canvas edge. fitHeight instead measures the motion's real union bbox
  // (already computed below for centering) and derives the scale that makes
  // it exactly `fitHeight` tall — same sizing language as a neighboring
  // sprite that's rendered at a fixed CSS box (e.g. MonsterStage's 120px),
  // and clipping-proof by construction as long as the canvas itself has
  // enough width for the (now-known) scaled bbox width too.
  fitHeight = null,
}) {
  const canvasRef = useRef(null);
  const [tables, setTables] = useState(null);
  const [resources, setResources] = useState(null);
  const stateRef = useRef({ step: 0, last: 0 });
  const prevMotionRef = useRef(motionName);
  const firedCompleteRef = useRef(false);

  useEffect(() => { data.motionTables().then(setTables); }, []);

  useEffect(() => {
    let live = true;
    loadResources(spec).then((r) => { if (live) setResources(r); });
    return () => { live = false; };
  }, [JSON.stringify(spec)]);

  // A motion change always restarts from frame 0 — critical for oneShot casts
  // (Swing/Spell must start clean on every press, never mid-loop from the
  // previous motion) and harmless for looping motions too.
  useEffect(() => {
    if (prevMotionRef.current !== motionName) {
      prevMotionRef.current = motionName;
      stateRef.current = { step: 0, last: 0 };
      firedCompleteRef.current = false;
    }
  }, [motionName]);

  useEffect(() => {
    if (!tables || !resources) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const n = stepCount(tables, motionName);
    const STEP_MS = 260 / speed;
    let raf;

    // Exact centering: union bbox across all steps of this motion, computed
    // once per (resources, motion), so the sprite is dead-center at any zoom
    // and doesn't jitter between steps.
    const allSteps = [];
    for (let s = 0; s < n; s++) allSteps.push(resolveStep(tables, resources, motionName, s));
    const bbox = drawListBBox(allSteps);
    // fitHeight overrides the manual `scale`: derive the scale that makes the
    // motion's tallest extent exactly fitHeight px, so sizing is consistent
    // across different hero body proportions and the swing's full arc (bbox
    // already unions every step, e.g. a mid-swing sword) never clips.
    const effScale = fitHeight && bbox ? fitHeight / Math.max(1, bbox.y1 - bbox.y0) : scale;

    function draw(stepIndex) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const list = resolveStep(tables, resources, motionName, stepIndex);
      const anchor = bbox
        ? { x: canvas.width / 2 - bbox.cx * effScale, y: canvas.height / 2 - bbox.cy * effScale }
        : { x: canvas.width / 2, y: canvas.height / 2 };
      paintStep(ctx, list, anchor, effScale);
      onStep?.(stepIndex, n, list);
    }

    if (stepOverride != null) {
      draw(stepOverride % n);
      return;
    }
    function loop(now) {
      const st = stateRef.current;
      if (!st.last) st.last = now;
      if (playing && now - st.last >= STEP_MS) {
        if (oneShot && st.step >= n - 1) {
          if (!firedCompleteRef.current) { firedCompleteRef.current = true; onComplete?.(); }
        } else {
          st.step = oneShot ? Math.min(n - 1, st.step + 1) : (st.step + 1) % n;
          st.last = now;
          draw(st.step);
        }
      }
      raf = requestAnimationFrame(loop);
    }
    draw(stateRef.current.step % n);
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tables, resources, motionName, playing, stepOverride, scale, fitHeight, speed, oneShot]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: 'pixelated', background }}
    />
  );
}
