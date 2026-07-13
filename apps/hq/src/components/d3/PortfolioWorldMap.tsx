import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldData from 'world-atlas/countries-110m.json'
import type { GeoData } from '../../data/types'
import { fmtDur } from './chartkit'

type Coordinate = [number, number]
type MapPoint = GeoData['regions'][number] & { coordinate: Coordinate; x: number; y: number }

const topo = worldData as unknown as { objects: { countries: unknown } }
const land = feature(topo as never, topo.objects.countries as never) as never

// IANA timezone centroids. These are deliberately coarse: hq_geo never stores
// IP/GPS, and the map must not imply person-level precision for kid accounts.
const TIMEZONE_COORDS: Record<string, Coordinate> = {
  'Asia/Qatar': [51.18, 25.35], 'Asia/Riyadh': [46.68, 24.71], 'Asia/Jakarta': [106.85, -6.2],
  'Asia/Dubai': [55.27, 25.2], 'Asia/Bahrain': [50.56, 26.07], 'Asia/Kuwait': [47.98, 29.37],
  'Asia/Muscat': [58.41, 23.59], 'Asia/Singapore': [103.82, 1.35], 'Asia/Kuala_Lumpur': [101.69, 3.14],
  'Asia/Manila': [120.98, 14.6], 'Asia/Bangkok': [100.5, 13.75], 'Asia/Tokyo': [139.69, 35.68],
  'Asia/Seoul': [126.98, 37.57], 'Asia/Kolkata': [77.21, 28.61], 'Asia/Shanghai': [121.47, 31.23],
  'Europe/London': [-.13, 51.51], 'Europe/Paris': [2.35, 48.86], 'Europe/Berlin': [13.41, 52.52],
  'Europe/Amsterdam': [4.9, 52.37], 'Europe/Madrid': [-3.7, 40.42], 'Europe/Rome': [12.5, 41.9],
  'America/New_York': [-74.01, 40.71], 'America/Chicago': [-87.63, 41.88],
  'America/Denver': [-104.99, 39.74], 'America/Los_Angeles': [-118.24, 34.05],
  'America/Toronto': [-79.38, 43.65], 'America/Sao_Paulo': [-46.63, -23.55],
  'Australia/Sydney': [151.21, -33.87], 'Australia/Perth': [115.86, -31.95],
  'Africa/Cairo': [31.24, 30.04], 'Africa/Johannesburg': [28.05, -26.2], 'Africa/Nairobi': [36.82, -1.29],
  UTC: [0, 18], 'Etc/UTC': [0, 18],
}

const PREFIX_CENTERS: Record<string, Coordinate> = {
  Asia: [92, 28], Europe: [14, 50], America: [-82, 24], Australia: [134, -25],
  Africa: [22, 4], Pacific: [-152, -8], Atlantic: [-30, 12], Indian: [74, -12],
}

function coordinateFor(tz: string): Coordinate | null {
  if (TIMEZONE_COORDS[tz]) return TIMEZONE_COORDS[tz]
  const prefix = tz.split('/')[0]
  const base = PREFIX_CENTERS[prefix]
  if (!base) return null
  // Stable, small separation for unknown zones sharing a continent centroid.
  const hash = Array.from(tz).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  return [base[0] + ((hash % 17) - 8) * 1.25, base[1] + (((hash >>> 4) % 11) - 5) * .8]
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setWidth(Math.round(node.getBoundingClientRect().width))
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export function PortfolioWorldMap({ geo, height = 230 }: { geo: GeoData; height?: number }) {
  const [ref, width] = useWidth()
  const model = useMemo(() => {
    if (width < 40) return null
    const projection = geoEqualEarth().fitExtent([[8, 8], [width - 8, height - 10]], land)
    const path = geoPath(projection)
    const points = geo.regions.map(region => {
      const coordinate = coordinateFor(region.tz)
      const projected = coordinate ? projection(coordinate) : null
      return coordinate && projected ? { ...region, coordinate, x: projected[0], y: projected[1] } : null
    }).filter((point): point is MapPoint => !!point)
    const maxSeconds = Math.max(1, ...points.map(point => point.seconds))
    const hub = points[0]
    const arcs = hub ? points.slice(1).map(point => {
      const bend = Math.max(18, Math.abs(point.x - hub.x) * .18)
      return `M${hub.x.toFixed(1)},${hub.y.toFixed(1)} Q${((hub.x + point.x) / 2).toFixed(1)},${(Math.min(hub.y, point.y) - bend).toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`
    }) : []
    return { path, points, arcs, maxSeconds, landPath: path(land) ?? '', graticulePath: path(geoGraticule10()) ?? '' }
  }, [geo, height, width])

  return (
    <div ref={ref} className="pf-worldmap" style={{ height }}>
      {model && (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Live usage regions by timezone">
          <defs>
            <radialGradient id="pf-map-ocean" cx="50%" cy="44%" r="62%"><stop offset="0" stopColor="var(--acc)" stopOpacity=".065" /><stop offset="1" stopColor="var(--acc)" stopOpacity="0" /></radialGradient>
            <filter id="pf-map-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="pf-link-glow" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>
          <rect width={width} height={height} rx="13" fill="url(#pf-map-ocean)" />
          <path d={model.graticulePath} fill="none" stroke="var(--bd)" strokeWidth=".6" opacity=".65" />
          <path d={model.landPath} fill="color-mix(in srgb, var(--acc) 9%, var(--bg3))" stroke="var(--bd2)" strokeWidth=".7" />
          <g fill="none" stroke="var(--acc)" strokeWidth="5" strokeOpacity=".14" filter="url(#pf-link-glow)">
            {model.arcs.map((arc, index) => <path d={arc} key={`glow-${index}`} />)}
          </g>
          <g className="pf-map-links" fill="none" stroke="var(--acc)" strokeWidth="1.8" strokeOpacity=".72" strokeLinecap="round">
            {model.arcs.map((arc, index) => <path d={arc} pathLength={1} key={`link-${index}`} />)}
          </g>
          {model.points.map((point, index) => {
            const radius = 4 + 7 * Math.sqrt(point.seconds / model.maxSeconds)
            const label = point.tz.split('/').pop()!.replace(/_/g, ' ')
            return (
              <g key={point.tz} transform={`translate(${point.x},${point.y})`}>
                <circle r={radius + 7} fill={index === 0 ? 'var(--mag)' : 'var(--acc)'} opacity=".08" />
                <circle r={radius} fill={index === 0 ? 'var(--mag)' : 'var(--acc)'} opacity=".92" filter="url(#pf-map-glow)"><title>{`${label} · ${fmtDur(point.seconds)} · ${point.users} ${point.users === 1 ? 'person' : 'people'}`}</title></circle>
                {index < 4 && <g transform={`translate(${radius + 6},${index % 2 ? 12 : -8})`}><text fontSize="9.5" fontWeight="700" fill="var(--tx)">{label}</text><text y="11" fontSize="8.5" fill="var(--tx3)">{fmtDur(point.seconds)} · {point.users} {point.users === 1 ? 'person' : 'people'}</text></g>}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
