// Bottom-nav icon set — designed as ONE family: 24px grid, 1.9 stroke,
// round caps/joins. Each icon takes `active`; when active it gains a soft
// duotone fill (the crisp iOS "selected" feel) while staying the same shape.
import type { SVGProps } from 'react'

type P = { active?: boolean } & SVGProps<SVGSVGElement>

const svg = (p: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p,
})
const fo = (active?: boolean) => (active ? 0.16 : 0)

export const NavToday = ({ active, ...p }: P) => (
  <svg {...svg(p)}>
    <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity={fo(active)} />
    <path d="M12 7.4v4.6l3.1 1.9" fill="none" />
  </svg>
)

export const NavCalendar = ({ active, ...p }: P) => (
  <svg {...svg(p)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3.6" fill="currentColor" fillOpacity={fo(active)} />
    <path d="M3.5 9.6h17M8 3.2v3.6M16 3.2v3.6" fill="none" />
  </svg>
)

export const NavMoments = ({ active, ...p }: P) => (
  <svg {...svg(p)}>
    <path
      d="M20.3 5.1a5.1 5.1 0 0 0-7.25 0L12 6.16l-1.05-1.06A5.1 5.1 0 1 0 3.7 12.3l1.05 1.06L12 20.7l7.25-7.34 1.05-1.06a5.1 5.1 0 0 0 0-7.2z"
      fill="currentColor"
      fillOpacity={active ? 0.2 : 0}
    />
  </svg>
)

export const NavApps = ({ active, ...p }: P) => (
  <svg {...svg(p)}>
    <rect x="3.8" y="3.8" width="7" height="7" rx="2.3" fill="currentColor" fillOpacity={fo(active)} />
    <rect x="13.2" y="3.8" width="7" height="7" rx="2.3" fill="currentColor" fillOpacity={fo(active)} />
    <rect x="3.8" y="13.2" width="7" height="7" rx="2.3" fill="currentColor" fillOpacity={fo(active)} />
    <rect x="13.2" y="13.2" width="7" height="7" rx="2.3" fill="currentColor" fillOpacity={fo(active)} />
  </svg>
)

export const NavMe = ({ active, ...p }: P) => (
  <svg {...svg(p)}>
    <circle cx="12" cy="8.2" r="3.7" fill="currentColor" fillOpacity={fo(active)} />
    <path d="M5.6 20c0-3.7 2.9-6.4 6.4-6.4s6.4 2.7 6.4 6.4" fill="currentColor" fillOpacity={fo(active)} />
  </svg>
)
