// hooks.ts — shared React hooks for the workbench viewers.
import { useEffect, useRef, useState, useCallback } from 'react';

/** A high-DPI canvas that auto-resizes to its parent and re-runs `draw`. */
export function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[],
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    });
    ro.observe(wrap);
    setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || size.w === 0 || size.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    cv.style.width = `${size.w}px`;
    cv.style.height = `${size.h}px`;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    draw(ctx, size.w, size.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, ...deps]);

  return { canvasRef, wrapRef, size };
}

/** Read a CSS custom property value from :root (resolves the active theme). */
export function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#888';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

/** localStorage-backed state (JSON). */
export function usePersist<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } catch { /* ignore */ }
    return initial;
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setVal((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);
  return [val, set];
}

/** Generic async resource loader with loading/error state. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => { if (alive) setState({ data, error: null, loading: false }); },
      (err) => { if (alive) setState({ data: null, error: String(err?.message || err), loading: false }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
