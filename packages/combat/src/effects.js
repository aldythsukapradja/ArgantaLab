// Shared skill-effect animation system — the spell VFX both games play. Ported
// from Kingdom's TestRoom (spawnEffect/drawEffect) so a cast looks identical in
// Kingdom and the farm. IO is injected (each app has its own data.effects() +
// image loader + effect-sheet URL); the animation stepping/rendering is shared.
//
// Effect data shape (from Kingdom /data effects.json, which the farm also reaches):
//   effectsAll[id] = { sheet, origin:[x,y], frames:[{x,y,fx,fy,w,h}], animation:[{frame,delay,alpha}] }

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Queue an effect anchored to a fixed tile [tx,ty] (spells are brief, so a fixed
// anchor is fine). `loadSheet(eff)` returns a Promise<Image>. Pushes onto fxList.
export function spawnEffect(fxList, effectsAll, id, atTile, loadSheet) {
  const eff = effectsAll?.[id];
  if (!eff?.sheet || !eff.animation?.length) return;
  Promise.resolve(loadSheet(eff)).then((sheet) => {
    if (sheet) fxList.push({ eff, sheet, atTile: [atTile[0], atTile[1]], start: nowMs() });
  }).catch(() => {});
}

// Draw one queued effect at time `now`. Returns true while still animating, false
// when finished (use as the filter predicate: fx = fx.filter(f => drawEffect(...))).
export function drawEffect(ctx, f, now, TILE) {
  let t = now - f.start;
  for (const s of f.eff.animation) {
    const d = Math.min(1500, Math.max(60, s.delay || 100));
    if (t < d) {
      const fm = f.eff.frames[s.frame];
      if (!fm) return true;
      const px = f.atTile[0] * TILE, py = f.atTile[1] * TILE;
      const [ox, oy] = f.eff.origin || [0, 0];
      ctx.globalAlpha = s.alpha != null ? s.alpha : 1;
      ctx.drawImage(
        f.sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h,
        px + TILE / 2 - 24 + ox + fm.fx,
        py + TILE - 8 + oy + fm.fy,
        fm.w, fm.h,
      );
      ctx.globalAlpha = 1;
      return true;
    }
    t -= d;
  }
  return false;
}
