// Cinematic motion-graphics layer for the deterministic engine.
//
// Everything here is still a pure function of (project, t): GSAP timelines are
// built PAUSED and evaluated with .time(t) — the canonical deterministic-render
// pattern (same trick headless HTML-video renderers use). GSAP has been 100%
// free including commercial use since Webflow's 2025 acquisition, so this adds
// zero licensing weight. Post-FX (grain / vignette / letterbox / light sweep /
// camera push) are classic film-look mattes implemented as seeded canvas math.
import { gsap } from 'gsap';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// mulberry32 — same PRNG family as voice.js; grain must be seeded, not random.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------- backgrounds ----
// 'aurora' — drifting luminous blobs over a deep base. Positions are pure
// sinusoids of t (no state), palette-derived colors.
export function drawAurora(ctx, l, t, W, H) {
  const base = l.colors?.[1] || '#0c1622';
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  const cols = [l.colors?.[0] || '#182a44', l.accent || '#6366f1', l.colors?.[0] || '#182a44'];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const cx = W * (0.5 + 0.38 * Math.sin(t * 0.13 + i * 2.1));
    const cy = H * (0.42 + 0.34 * Math.cos(t * 0.11 + i * 1.7));
    const r = Math.max(W, H) * (0.38 + 0.08 * Math.sin(t * 0.07 + i * 3.3));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, cols[i]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// 'rays' — volumetric light shafts rotating slowly from above.
export function drawRays(ctx, l, t, W, H) {
  const base = l.colors?.[1] || '#0c1622';
  const g0 = ctx.createLinearGradient(0, 0, 0, H);
  g0.addColorStop(0, l.colors?.[0] || '#182a44'); g0.addColorStop(1, base);
  ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, -H * 0.25);
  ctx.rotate(Math.sin(t * 0.05) * 0.15);
  ctx.globalCompositeOperation = 'screen';
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.32 + Math.sin(t * 0.1 + i) * 0.02;
    const len = H * 1.9, wHalf = W * 0.055;
    ctx.save(); ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-wHalf * 0.3, 0); ctx.lineTo(wHalf * 0.3, 0);
    ctx.lineTo(wHalf * 2.2, len); ctx.lineTo(-wHalf * 2.2, len); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------- GSAP text choreography ----
// Per-layer paused timelines, cached and re-built when the layer's text/anim
// changes. Evaluating with .time(lt) mutates the char objects deterministically.
const tlCache = new Map();
export function invalidateTextCache() { tlCache.clear(); }

function buildTimeline(key, lines, anim, size) {
  const chars = [];
  lines.forEach((line, li) => {
    for (const ch of line) chars.push({ ch, li, a: 0, y: 0, s: 1, sp: 0, r: 0 });
  });
  const tl = gsap.timeline({ paused: true });
  if (anim === 'cascade') {
    chars.forEach((c) => { c.a = 0; c.y = size * 0.85; c.s = 0.9; });
    tl.to(chars, { a: 1, y: 0, s: 1, duration: 0.7, stagger: 0.028, ease: 'power3.out' });
  } else if (anim === 'cinematic') {
    chars.forEach((c) => { c.a = 0; c.sp = size * 0.55; c.s = 0.96; });
    tl.to(chars, { a: 1, sp: 0, s: 1, duration: 1.4, ease: 'power2.inOut' });
  } else if (anim === 'typewriter') {
    chars.forEach((c) => { c.a = 0; });
    tl.to(chars, { a: 1, duration: 0.02, stagger: 0.045, ease: 'none' });
  } else { // 'rise' fallback
    chars.forEach((c) => { c.a = 0; c.y = size * 0.5; });
    tl.to(chars, { a: 1, y: 0, duration: 0.6, stagger: 0.02, ease: 'back.out(1.4)' });
  }
  const entry = { tl, chars };
  tlCache.set(key, entry);
  if (tlCache.size > 40) tlCache.delete(tlCache.keys().next().value); // bound the cache
  return entry;
}

export const CINEMATIC_ANIMS = ['cascade', 'cinematic', 'typewriter'];

// Draw one text layer with GSAP choreography. Returns true if handled.
export function drawCinematicText(ctx, l, lt, d, W, H, lines) {
  if (!CINEMATIC_ANIMS.includes(l.anim)) return false;
  const size = l.size * (W / 720);
  const key = l.id + '|' + l.text + '|' + l.anim + '|' + Math.round(size);
  const entry = tlCache.get(key) || buildTimeline(key, lines, l.anim, size);
  entry.tl.time(clamp(lt, 0, entry.tl.duration() || 0.001), false);

  const lh = size * 1.14;
  const cx = (l.xN ?? 0.5) * W;
  const cy = (l.yN ?? 0.42) * H - ((lines.length - 1) * lh) / 2;
  const outStart = d - 0.45;
  const exit = lt > outStart ? clamp((lt - outStart) / 0.45, 0, 1) : 0;

  ctx.save();
  ctx.font = `${l.weight || 800} ${size}px ${l.font || 'system-ui, sans-serif'}`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = size * 0.14; ctx.shadowOffsetY = size * 0.02;

  let idx = 0;
  lines.forEach((line, li) => {
    const glyphs = [...line];
    const lineChars = entry.chars.slice(idx, idx + glyphs.length);
    const widths = glyphs.map((ch) => ctx.measureText(ch).width);
    const sp = lineChars[0]?.sp || 0;
    const total = widths.reduce((a, b) => a + b, 0) + sp * Math.max(0, glyphs.length - 1);
    let x = cx - total / 2;
    const y = cy + li * lh;
    for (let i = 0; i < glyphs.length; i++) {
      const c = lineChars[i]; if (!c) break;
      ctx.save();
      ctx.globalAlpha = clamp(c.a * (1 - exit), 0, 1);
      ctx.translate(x + widths[i] / 2, y + c.y);
      ctx.scale(c.s, c.s);
      ctx.fillStyle = l.color || '#fff';
      ctx.fillText(glyphs[i], -widths[i] / 2, 0);
      ctx.restore();
      x += widths[i] + sp;
    }
    idx += glyphs.length;
  });
  ctx.restore();
  return true;
}

// ------------------------------------------------------------- post FX ------
// One shared 160px grain tile, generated once from a FIXED seed. Per-frame we
// blit it at a frame-indexed offset — film grain that never repeats visibly but
// is fully reproducible.
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const S = 160, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S);
  const rnd = mulberry32(1337);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 26;
  }
  x.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

export function applyPostFx(ctx, project, t, W, H) {
  const fx = project.fx || {};
  // light sweep — a soft diagonal band crossing every 7s
  if (fx.sweep !== false) {
    const p = ((t % 7) / 7) * 1.7 - 0.35;
    const x0 = W * (p - 0.18), x1 = W * (p + 0.18);
    const g = ctx.createLinearGradient(x0, 0, x1, H * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // vignette — focus the eye, hide the edges
  if (fx.vignette !== false) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // film grain — seeded tile at a frame-indexed offset
  if (fx.grain !== false) {
    const tile = getGrainTile(), S = 160;
    const fi = Math.floor(t * (project.format?.fps || 30));
    const r = mulberry32(fi + 7);
    const ox = Math.floor(r() * S), oy = Math.floor(r() * S);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'overlay';
    for (let y = -oy; y < H; y += S) for (let x = -ox; x < W; x += S) ctx.drawImage(tile, x, y);
    ctx.restore();
  }
  // letterbox — cinematic 2.39-ish mattes
  if (fx.letterbox) {
    const bar = H * 0.085;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  }
}

// Slow push-in: apply BEFORE drawing layers (caller restores after).
export function applyCamera(ctx, project, t, W, H) {
  const fx = project.fx || {};
  if (!fx.camera) return;
  const k = 1 + 0.06 * clamp(t / Math.max(1, project.duration || 10), 0, 1);
  ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
}
