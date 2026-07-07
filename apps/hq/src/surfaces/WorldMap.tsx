import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoContains } from 'd3-geo'
import { feature, merge } from 'topojson-client'
import worldData from 'world-atlas/countries-110m.json'

// Dotted world map (D3 + TopoJSON). The land dot-grid is computed ONCE at module
// load (point-in-polygon is expensive); the component only projects it per width
// (cheap). PLACEHOLDER region nodes + arcs (badged) → real usage-% by region later.

const topo = worldData as unknown as { objects: { countries: unknown } }
const LAND = feature(topo as never, (topo.objects.countries) as never) as never
const MERGED = merge(topo as never, ((topo.objects.countries as { geometries: unknown[] }).geometries) as never) as never

// [lng, lat] grid points that fall on land — computed once.
const LAND_GRID: [number, number][] = (() => {
  const pts: [number, number][] = []
  for (let lat = 76; lat >= -54; lat -= 6) for (let lng = -176; lng <= 176; lng += 6) {
    if (geoContains(MERGED, [lng, lat])) pts.push([lng, lat])
  }
  return pts
})()

const REGIONS: [number, number, string][] = [[-96, 39, 'NA'], [10, 50, 'EU'], [106, -1, 'SEA'], [134, -25, 'AU'], [45, 24, 'ME'], [-58, -20, 'SA']]
const ARCS: [number, number][] = [[0, 1], [0, 2], [1, 4], [2, 3], [4, 5]]

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(es => setW(Math.round(es[0].contentRect.width)))
    ro.observe(el); setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function WorldMap() {
  const [ref, w] = useWidth()
  const h = 58
  const model = useMemo(() => {
    if (w < 20) return null
    const proj = geoEqualEarth().fitSize([w, h], LAND)
    const dots: [number, number][] = []
    for (const [lng, lat] of LAND_GRID) { const p = proj([lng, lat]); if (p) dots.push([p[0], p[1]]) }
    const nodes = REGIONS.map(([lng, lat, label]) => { const p = proj([lng, lat]); return p ? { x: p[0], y: p[1], label } : null }).filter(Boolean) as { x: number; y: number; label: string }[]
    const arcs = ARCS.map(([a, b]) => {
      const A = nodes[a], B = nodes[b]; if (!A || !B) return ''
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - Math.abs(B.x - A.x) * 0.22
      return `M${A.x.toFixed(1)} ${A.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}`
    }).filter(Boolean)
    return { dots, nodes, arcs }
  }, [w])

  return (
    <div ref={ref} style={{ width: '100%', height: h }}>
      {model && (
        <svg width={w} height={h} style={{ display: 'block' }}>
          <g fill="var(--c-muted)" opacity="0.5">{model.dots.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="0.8" />)}</g>
          <g fill="none" stroke="var(--c-accent2)" strokeWidth="1" strokeOpacity="0.7">{model.arcs.map((d, i) => <path key={i} d={d} />)}</g>
          <g fill="var(--c-accent2)">{model.nodes.map((n, i) => <circle key={i} cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r="2"><animate attributeName="r" values="2;3;2" dur={`${1.4 + i * 0.2}s`} repeatCount="indefinite" /></circle>)}</g>
        </svg>
      )}
    </div>
  )
}
