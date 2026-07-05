// The compositor — the client's own rendering law, decoded:
//
// 1. Motion.tbl: a motion has N steps; each step lists LAYER ids (50..62) in
//    draw order for that step (e.g. riding south draws the mount layer LAST
//    so the horse covers the rider's legs).
// 2. Layer.tbl: each layer owns SLOTS. Body=[0(body),1(coat)], Face=[2,3],
//    FaceDeco=[4], Hair=[5], HairDeco=[6,7], MainWeapon=[8..11],
//    SubWeapon=[12], Mantle=[14], Shoes=[15], Necklace=[16], Riding=[]
//    (the mount creature itself), All=[17], BackWeapon=[13,18].
// 3. A part's DSC chunk for the motion (already exported as
//    part.animations[motionName]) gives the part's own frame per step.
// 4. Every EPF frame carries absolute screen offsets; the extractor stores
//    them as part.origin + frame.fx/fy. Adding them recovers pixel-exact
//    client alignment — there are NO hand-tuned offsets in this file.
//
// Slot -> loadout key. Multi-slot layers draw the same equipped part once,
// at its first owned slot (sub-slot split of weapon arcs is a C2+ concern).
const SLOT_TO_KEY = {
  0: 'body',
  1: 'coat',
  2: 'face',
  3: 'emotion',
  4: 'facedec',
  5: 'hair',
  6: 'hairdec',
  8: 'weapon',
  12: 'shield',
  14: 'mantle',
  15: 'shoes',
  16: 'neck',
};
const RIDING_LAYER = 60;

// Direction suffix of a motion name ('South'...), used to pick the mount's
// own DNA animation.
const MOUNT_ANIM = {
  South: 'walk_down',
  North: 'walk_up',
  East: 'walk_right',
  West: 'walk_left',
};

export function motionDirection(motionName) {
  for (const d of ['South', 'North', 'East', 'West']) {
    if (motionName.endsWith(d)) return d;
  }
  return 'South';
}

// Resolve the draw list for one motion step.
// loadout: { body: {part, sheet(canvas|img)}, coat: {...}, ..., mount: {creature, sheet} }
// Returns [{sheet, sx, sy, w, h, dx, dy}] in draw order, coordinates in the
// client's absolute anchor space.
export function resolveStep(tables, loadout, motionName, stepIndex) {
  const motion = tables.motionsByName[motionName];
  if (!motion || !motion.steps.length) return [];
  const step = motion.steps[((stepIndex % motion.steps.length) + motion.steps.length) % motion.steps.length];
  if (!step) {
    // never crash the render loop over a bad lookup — log once and skip
    if (!resolveStep._warned) {
      resolveStep._warned = true;
      console.warn('resolveStep: missing step', motionName, stepIndex);
    }
    return [];
  }
  const out = [];

  // Deviation from the raw table: shoes must cover the pant hem, but
  // Motion.tbl lists the Shoes layer before Body on south-facing motions.
  // Draw shoes right after the Body layer (body+coat) instead.
  const layerOrder = [...step.layers];
  const shoesIdx = layerOrder.indexOf(58);
  const bodyIdx = layerOrder.indexOf(50);
  if (shoesIdx !== -1 && bodyIdx !== -1 && shoesIdx < bodyIdx) {
    layerOrder.splice(shoesIdx, 1);
    layerOrder.splice(layerOrder.indexOf(50) + 1, 0, 58);
  }

  for (const layerId of layerOrder) {
    if (layerId === RIDING_LAYER) {
      const m = loadout.mount;
      if (!m?.creature || !m.sheet) continue;
      const anim = m.creature.animations[MOUNT_ANIM[motionDirection(motionName)]];
      if (!anim?.length) continue;
      const fr = anim[stepIndex % anim.length];
      const fm = m.creature.frames[fr.frame];
      if (!fm) continue;
      out.push({
        sheet: m.sheet,
        sx: fm.x + fm.fx, sy: fm.y + fm.fy, w: fm.w, h: fm.h,
        dx: m.creature.origin[0] + fm.fx, dy: m.creature.origin[1] + fm.fy,
      });
      continue;
    }
    const layer = tables.layersById[layerId];
    if (!layer) continue;
    for (const slot of layer.slots) {
      let key = SLOT_TO_KEY[slot];
      if (!key) continue;
      // Helmets cover hair: an equipped helmet takes the Hair slot.
      // (Layer.tbl has no Helmet layer — the client swaps it in here.)
      const substituted = slot === 5 && loadout.helmet?.part;
      if (substituted) key = 'helmet';
      const eq = loadout[key];
      if (!eq?.part || !eq.sheet) continue;
      // draw each part once (substituted keys own no slot of their own)
      if (!substituted && slot !== firstSlotFor(tables, key)) continue;
      const anim = eq.part.animations?.[motionName];
      if (!anim?.length) continue;
      const fr = anim[stepIndex % anim.length];
      if (!fr) continue;   // stepIndex out of range/NaN — skip rather than crash the tick
      const fm = eq.part.frames[fr.frame];
      if (!fm) continue;
      out.push({
        sheet: eq.sheet,
        sx: fm.x + fm.fx, sy: fm.y + fm.fy, w: fm.w, h: fm.h,
        dx: eq.part.origin[0] + fm.fx, dy: eq.part.origin[1] + fm.fy,
      });
    }
  }
  return out;
}

const firstSlotCache = {};
function firstSlotFor(tables, key) {
  if (!(key in firstSlotCache)) {
    let first = null;
    for (const layer of Object.values(tables.layersById)) {
      for (const slot of layer.slots) {
        if (SLOT_TO_KEY[slot] === key && (first === null || slot < first)) first = slot;
      }
    }
    firstSlotCache[key] = first;
  }
  return firstSlotCache[key];
}

// Paint one step onto a canvas context. anchor = canvas position of the
// client's (0,0) anchor point; scale = integer zoom.
export function paintStep(ctx, drawList, anchor, scale = 2) {
  ctx.imageSmoothingEnabled = false;
  for (const d of drawList) {
    ctx.drawImage(
      d.sheet,
      d.sx, d.sy, d.w, d.h,
      anchor.x + d.dx * scale, anchor.y + d.dy * scale,
      d.w * scale, d.h * scale
    );
  }
}

// Step count for a motion (drives scrubbers / tickers).
export function stepCount(tables, motionName) {
  return tables.motionsByName[motionName]?.steps.length || 1;
}

// Union bounding box of a draw list (client anchor space) — used to center
// the character exactly instead of guessing offsets.
export function drawListBBox(lists) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const list of lists) {
    for (const d of list) {
      x0 = Math.min(x0, d.dx); y0 = Math.min(y0, d.dy);
      x1 = Math.max(x1, d.dx + d.w); y1 = Math.max(y1, d.dy + d.h);
    }
  }
  if (x0 === Infinity) return null;
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
