// CosmoAgentOrb — the founder's Cosmonaut orb, ported VERBATIM from COSMO_Final.html
// (function AgentOrb). Same canvas draw: teal/blue bloom, conic ring, orbiting agent
// dots, molten core with drifting light blobs, specular, sparkles. 1:1 with the shell
// reference. Reads `html.dark` each frame so it re-themes with the light/dark toggle.
import { useEffect, useRef } from 'react';

// agent palette (the orbiting dots) — colors only; matches the source AGENTS ring
const AG = [
  { c: '#22d3ee' }, { c: '#0FB5A6' }, { c: '#2563eb' }, { c: '#a855f7' },
  { c: '#f59e0b' }, { c: '#e11d74' }, { c: '#38bdf8' },
];
function aoHx(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function CosmoAgentOrb({ size = 64 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current; if (!host) return;
    const cv = document.createElement('canvas');
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.style.display = 'block'; cv.style.borderRadius = '50%';
    host.insertBefore(cv, host.firstChild);
    const ctx = cv.getContext('2d')!;
    const cx = size / 2, cy = size / 2, R = size / 2;
    const orbitRx = R * 0.80, orbitRy = R * 0.30, tilt = -0.42;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0, raf = 0, hover = 0;
    const onEnter = () => (hover = 1), onLeave = () => (hover = 0);
    host.addEventListener('pointerenter', onEnter); host.addEventListener('pointerleave', onLeave);
    const conic = !!(ctx as unknown as { createConicGradient?: unknown }).createConicGradient;
    function frame() {
      const r = host!.getBoundingClientRect();
      if (r.width === 0) { raf = requestAnimationFrame(frame); return; }
      const dark = document.documentElement.classList.contains('dark');
      if (!reduce) t += 0.016 * (1 + hover * 0.7);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
      const bloom = R * (1.0 + 0.05 * Math.sin(t * 1.3));
      const bg = ctx.createRadialGradient(cx, cy, R * 0.28, cx, cy, bloom);
      bg.addColorStop(0, aoHx('#0FB5A6', dark ? 0.42 : 0.28)); bg.addColorStop(0.45, aoHx('#2563eb', dark ? 0.20 : 0.13)); bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, bloom, 0, 7); ctx.fill();
      if (conic) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.35);
        const ring = (ctx as unknown as { createConicGradient: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient(0, 0, 0);
        ring.addColorStop(0, aoHx('#0FB5A6', 0)); ring.addColorStop(.25, aoHx('#22d3ee', .55)); ring.addColorStop(.5, aoHx('#2563eb', 0)); ring.addColorStop(.72, aoHx('#a855f7', .5)); ring.addColorStop(1, aoHx('#0FB5A6', 0));
        ctx.strokeStyle = ring; ctx.lineWidth = R * 0.10; ctx.beginPath(); ctx.arc(0, 0, R * 0.90, 0, 7); ctx.stroke(); ctx.restore();
      }
      const pos = (ang: number) => {
        const co = Math.cos(ang), si = Math.sin(ang); const x = co * orbitRx, y = si * orbitRy;
        const rx = x * Math.cos(tilt) - y * Math.sin(tilt), ry = x * Math.sin(tilt) + y * Math.cos(tilt); return { x: cx + rx, y: cy + ry, depth: (si + 1) / 2 };
      };
      const N = AG.length || 7, items: Array<{ c: string; p: { x: number; y: number; depth: number } }> = [];
      for (let i = 0; i < N; i++) { const ang = t * 0.6 + i * (Math.PI * 2 / N); items.push({ c: (AG[i] && AG[i].c) || '#22d3ee', p: pos(ang) }); }
      items.sort((u, v) => u.p.depth - v.p.depth);
      const dot = (it: { c: string; p: { x: number; y: number; depth: number } }) => {
        const { p, c } = it, dd = p.depth, rr = (size * 0.046) * (0.55 + dd * 0.7);
        ctx.save(); ctx.globalAlpha = 0.32 + dd * 0.68;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 3.4);
        g.addColorStop(0, aoHx(c, .95)); g.addColorStop(0.4, aoHx(c, .35)); g.addColorStop(1, aoHx(c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr * 3.4, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.5 + dd * 0.5; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.9 * dd; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(p.x - rr * 0.3, p.y - rr * 0.3, rr * 0.4, 0, 7); ctx.fill();
        ctx.restore();
      };
      items.filter((it) => it.p.depth < 0.5).forEach(dot);
      const coreR = R * 0.52 * (1 + 0.03 * Math.sin(t * 1.6));
      const sb = ctx.createRadialGradient(cx - coreR * 0.3, cy - coreR * 0.35, coreR * 0.1, cx, cy, coreR);
      sb.addColorStop(0, dark ? '#13324a' : '#0e2740'); sb.addColorStop(0.7, dark ? '#0b1b2e' : '#0a1728'); sb.addColorStop(1, dark ? '#081120' : '#060f1c');
      ctx.fillStyle = sb; ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 7); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      const bx = cx + Math.cos(t * 0.9) * coreR * 0.4, by = cy + Math.sin(t * 1.1) * coreR * 0.4;
      const lg = ctx.createRadialGradient(bx, by, 0, bx, by, coreR * 1.2); lg.addColorStop(0, aoHx('#22d3ee', .75)); lg.addColorStop(0.5, aoHx('#0FB5A6', .30)); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2);
      const b2x = cx + Math.cos(t * 1.3 + 2) * coreR * 0.45, b2y = cy + Math.sin(t * 0.8 + 1) * coreR * 0.45;
      const lg2 = ctx.createRadialGradient(b2x, b2y, 0, b2x, b2y, coreR * 1.1); lg2.addColorStop(0, aoHx('#7c3aed', .6)); lg2.addColorStop(0.55, aoHx('#2563eb', .25)); lg2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg2; ctx.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const sp = ctx.createRadialGradient(cx - coreR * 0.35, cy - coreR * 0.4, 0, cx - coreR * 0.35, cy - coreR * 0.4, coreR * 0.8);
      sp.addColorStop(0, 'rgba(255,255,255,.85)'); sp.addColorStop(0.3, 'rgba(255,255,255,.18)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = aoHx('#5fe3cf', dark ? 0.7 : 0.5); ctx.lineWidth = Math.max(1, size * 0.012); ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 7); ctx.stroke();
      items.filter((it) => it.p.depth >= 0.5).forEach(dot);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = t * 1.5 + i * 1.7, rr = R * (0.6 + 0.32 * ((i * 37 % 10) / 10));
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a * 1.3) * rr * 0.6, tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i));
        ctx.globalAlpha = tw * 0.55; ctx.fillStyle = '#bff5ee'; ctx.beginPath(); ctx.arc(px, py, size * 0.012, 0, 7); ctx.fill();
      }
      ctx.restore();
      raf = requestAnimationFrame(frame);
      if (reduce) { cancelAnimationFrame(raf); raf = 0; }
    }
    frame();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      host!.removeEventListener('pointerenter', onEnter); host!.removeEventListener('pointerleave', onLeave);
      if (cv.parentNode) cv.remove();
    };
  }, [size]);
  return <div ref={ref} style={{ width: size, height: size }} />;
}
