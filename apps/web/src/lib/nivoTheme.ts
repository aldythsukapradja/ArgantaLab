// Bridges Nivo charts to the app's CSS-variable theme so charts repaint correctly
// in both light and dark mode. Read at render time (after document.dataset.theme
// is set), so the values always reflect the active theme.

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export interface NivoTheme {
  text: { fill: string; fontFamily: string; fontSize: number }
  axis: { ticks: { text: { fill: string; fontSize: number } }; legend: { text: { fill: string } } }
  grid: { line: { stroke: string; strokeWidth: number } }
  tooltip: { container: { background: string; color: string; fontSize: number; borderRadius: number; boxShadow: string; border: string } }
  labels: { text: { fill: string; fontWeight: number } }
  crosshair: { line: { stroke: string } }
}

// `_theme` is unused but accepted so callers can pass the store theme as a memo
// dependency — that's what forces a recompute when the user flips light/dark.
export function nivoTheme(_theme?: 'light' | 'dark'): NivoTheme {
  const t2 = cssVar('--t2', '#9AA6C4')
  const t3 = cssVar('--t3', '#5C6886')
  const border = cssVar('--border', 'rgba(255,255,255,0.09)')
  const t1 = cssVar('--t1', '#F4F7FF')
  const bg2 = cssVar('--bg-2', '#0b1020')
  return {
    text: { fill: t2, fontFamily: 'inherit', fontSize: 11 },
    axis: { ticks: { text: { fill: t3, fontSize: 11 } }, legend: { text: { fill: t2 } } },
    grid: { line: { stroke: border, strokeWidth: 1 } },
    tooltip: {
      container: {
        background: bg2, color: t1, fontSize: 12, borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,.35)', border: `1px solid ${border}`,
      },
    },
    labels: { text: { fill: t1, fontWeight: 700 } },
    crosshair: { line: { stroke: t3 } },
  }
}
