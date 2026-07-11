// The deterministic visual renderer. drawFrame(ctx, project, t) paints ONE frame
// at time t (seconds). Pure function of (project, t): the same project + t always
// paints the same pixels — that's what makes exported content reproducible.

import { drawAurora, drawRays, drawCinematicText, applyPostFx, applyCamera } from './cinematic.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// visible window + local time for a layer
function local(l, t) {
  const s = l.start || 0, d = l.dur || 0;
  if (t < s - 0.001 || t > s + d + 0.5) return null; // small tail so exits can play
  return { lt: t - s, d };
}

function drawBackground(ctx, l, t, W, H) {
  if (l.variant === 'aurora') { drawAurora(ctx, l, t, W, H); return; }
  if (l.variant === 'rays') { drawRays(ctx, l, t, W, H); return; }
  if (l.variant === 'solid') { ctx.fillStyle = l.colors[0]; ctx.fillRect(0, 0, W, H); return; }
  const a = ((l.angle || 155) * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const g = ctx.createLinearGradient(W / 2 - dx * W, H / 2 - dy * H, W / 2 + dx * W, H / 2 + dy * H);
  g.addColorStop(0, l.colors[0]); g.addColorStop(1, l.colors[1] || l.colors[0]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (l.anim === 'drift') { // slow luminous blob, deterministic sinusoid
    const cx = W * (0.5 + 0.22 * Math.sin(t * 0.5)), cy = H * (0.42 + 0.16 * Math.cos(t * 0.37));
    const r = Math.max(W, H) * 0.55;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.10)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

function drawText(ctx, l, lt, d, W, H) {
  const size = l.size * (W / 720); // scale relative to a 720-wide reference
  ctx.font = `${l.weight || 700} ${size}px ${l.font || 'system-ui, sans-serif'}`;
  ctx.textAlign = l.align || 'center';
  ctx.textBaseline = 'middle';
  const maxW = (l.maxWidthN || 0.84) * W;
  const lines = wrapLines(ctx, l.text, maxW);
  // GSAP-choreographed treatments (cascade / cinematic / typewriter) take over.
  if (drawCinematicText(ctx, l, lt, d, W, H, lines)) return;
  const lh = size * 1.12;
  const cx = (l.xN ?? 0.5) * W;
  let cy = (l.yN ?? 0.42) * H;

  // enter animation over first 0.5s, exit fade in last 0.4s
  const enter = clamp(lt / 0.5, 0, 1);
  const outStart = d - 0.4;
  const exit = lt > outStart ? clamp((lt - outStart) / 0.4, 0, 1) : 0;
  let alpha = easeOut(enter) * (1 - exit);
  let ty = 0, scale = 1;
  if (l.anim === 'slide') ty = (1 - easeOut(enter)) * size * 0.9;
  if (l.anim === 'pop') scale = 0.7 + 0.3 * easeOut(enter);
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(cx, cy - ((lines.length - 1) * lh) / 2 + ty);
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetY = size * 0.02;

  lines.forEach((line, i) => {
    const y = i * lh;
    if (l.anim === 'kinetic') { // per-word reveal
      const words = line.split(' ');
      const totalW = ctx.measureText(line).width;
      let x = -totalW / 2;
      const spaceW = ctx.measureText(' ').width;
      const perWord = 0.16;
      words.forEach((w, wi) => {
        const wStart = (i * words.length + wi) * perWord;
        const wa = easeOut(clamp((lt - wStart) / 0.28, 0, 1));
        const ww = ctx.measureText(w).width;
        ctx.save();
        ctx.globalAlpha = clamp(alpha * wa, 0, 1);
        ctx.textAlign = 'left';
        ctx.translate(x, y + (1 - wa) * size * 0.4);
        ctx.fillStyle = l.color || '#fff';
        ctx.fillText(w, 0, 0);
        ctx.restore();
        x += ww + spaceW;
      });
    } else {
      ctx.fillStyle = l.color || '#fff';
      ctx.fillText(line, 0, y);
    }
  });
  ctx.restore();
}

function drawCaption(ctx, l, lt, W, H) {
  const words = l.words || [];
  if (!words.length) return;
  // find active word index by voice-time
  let active = -1;
  for (let i = 0; i < words.length; i++) if (lt >= words[i].start && lt < words[i].end) { active = i; break; }
  if (active < 0 && lt >= (words[words.length - 1]?.end || 0)) active = words.length - 1;
  if (active < 0) active = 0;
  // show a small rolling group around the active word (karaoke style)
  const grp = l.group || 3;
  const startI = Math.max(0, active - Math.floor((grp - 1) / 2));
  const shown = words.slice(startI, startI + grp);
  const size = l.size * (W / 720);
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const spaceW = size * 0.28;
  const widths = shown.map((w) => ctx.measureText(w.word).width);
  const totalW = widths.reduce((a, b) => a + b, 0) + spaceW * (shown.length - 1);
  let x = W / 2 - totalW / 2;
  const y = (l.yN ?? 0.8) * H;
  shown.forEach((w, i) => {
    const isActive = startI + i === active;
    const ww = widths[i];
    const padX = size * 0.16, padY = size * 0.12;
    if (isActive) {
      ctx.fillStyle = l.activeColor || '#ff8a3d';
      roundRect(ctx, x - padX, y - size / 2 - padY, ww + padX * 2, size + padY * 2, size * 0.16);
      ctx.fill();
      ctx.fillStyle = '#160a02';
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, x - padX, y - size / 2 - padY, ww + padX * 2, size + padY * 2, size * 0.16);
      ctx.fill();
      ctx.fillStyle = l.color || '#fff';
    }
    ctx.fillText(w.word, x, y);
    x += ww + spaceW;
  });
}

function drawWaveform(ctx, l, lt, W, H) {
  const peaks = l.peaks || [];
  if (!peaks.length) return;
  const y = (l.yN ?? 0.62) * H, hh = (l.heightN || 0.12) * H;
  const n = peaks.length, bw = (W * 0.8) / n, x0 = W * 0.1;
  const prog = clamp(lt / (l.dur || 1), 0, 1); // sweep in with playback
  ctx.fillStyle = l.color || '#33cfd6';
  for (let i = 0; i < n; i++) {
    const lit = i / n <= prog ? 1 : 0.28;
    const bh = Math.max(2, peaks[i] * hh);
    ctx.globalAlpha = lit;
    roundRect(ctx, x0 + i * bw, y - bh / 2, bw * 0.62, bh, bw * 0.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Paint one full frame. W/H default to the project format.
// Order: camera push → layers → post FX (sweep/vignette/grain/letterbox).
export function drawFrame(ctx, project, t, W, H) {
  W = W || project.format.w; H = H || project.format.h;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  applyCamera(ctx, project, t, W, H);
  for (const l of project.layers) {
    if (l.hidden) continue;
    if (l.type === 'background') { drawBackground(ctx, l, t, W, H); continue; }
    const loc = local(l, t); if (!loc) continue;
    ctx.save();
    if (l.type === 'text') drawText(ctx, l, loc.lt, loc.d, W, H);
    else if (l.type === 'caption') drawCaption(ctx, l, loc.lt, W, H);
    else if (l.type === 'waveform') drawWaveform(ctx, l, loc.lt, W, H);
    ctx.restore();
  }
  ctx.restore();
  applyPostFx(ctx, project, t, W, H);
}

export { roundRect };
