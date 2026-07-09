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

export default function CompositeStage({
  spec, motionName, playing = true, stepOverride = null,
  scale = 3, speed = 1, width = 260, height = 260, onStep,
}) {
  const canvasRef = useRef(null);
  const [tables, setTables] = useState(null);
  const [resources, setResources] = useState(null);
  const stateRef = useRef({ step: 0, last: 0 });

  useEffect(() => { data.motionTables().then(setTables); }, []);

  useEffect(() => {
    let live = true;
    loadResources(spec).then((r) => { if (live) setResources(r); });
    return () => { live = false; };
  }, [JSON.stringify(spec)]);

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

    function draw(stepIndex) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const list = resolveStep(tables, resources, motionName, stepIndex);
      const anchor = bbox
        ? { x: canvas.width / 2 - bbox.cx * scale, y: canvas.height / 2 - bbox.cy * scale }
        : { x: canvas.width / 2, y: canvas.height / 2 };
      paintStep(ctx, list, anchor, scale);
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
        st.step = (st.step + 1) % n;
        st.last = now;
        draw(st.step);
      }
      raf = requestAnimationFrame(loop);
    }
    draw(stateRef.current.step % n);
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tables, resources, motionName, playing, stepOverride, scale, speed]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: 'pixelated', background: 'repeating-conic-gradient(var(--stage-a) 0% 25%, var(--stage-b) 0% 50%) 0 0 / 24px 24px' }}
    />
  );
}
