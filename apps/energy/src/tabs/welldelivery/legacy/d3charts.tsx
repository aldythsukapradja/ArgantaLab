// d3charts.tsx — shared D3(-math) + React(-SVG) chart primitives for the Well
// Delivery cockpits. We use d3-scale/d3-shape for the maths and render real SVG in
// React (interactive: hover crosshair, tooltips, wheel-zoom) instead of the old
// imperative <canvas>. Only libs already in the repo (d3-scale, d3-shape, d3-array).
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** ResizeObserver-backed element size (for responsive SVG viewports). */
export function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

/** Floating tooltip anchored at (x,y) inside a relatively-positioned chart wrap. */
export function ChartTip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const flip = x > w * 0.6;
  return (
    <div style={{
      position: 'absolute', left: flip ? undefined : x + 12, right: flip ? (w - x + 12) : undefined, top: y,
      transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 5,
      background: 'color-mix(in srgb, var(--panel) 92%, transparent)', border: '1px solid var(--line)',
      borderRadius: 6, padding: '6px 9px', font: '10.5px var(--mono)', color: 'var(--text)',
      boxShadow: '0 4px 14px rgba(0,0,0,.28)', whiteSpace: 'nowrap',
    }}>{children}</div>
  );
}

export function TipRow({ k, v, c }: { k: string; v: string; c?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: 'var(--muted)' }}>{k}</span><span style={{ color: c || 'var(--text)' }}>{v}</span></div>;
}

/** CSS var → concrete colour (for SVG stroke/fill that can't take var() through gradients). */
export function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#888';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}
