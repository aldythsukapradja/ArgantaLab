// Stroke-based inline icons (inherit color + size). Kept here so the nav and
// pages share one visual language; the "live" motion is applied by callers (GSAP).
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P): P => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', ...p })

export const IconToday = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
export const IconCalendar = (p: P) => (<svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>)
export const IconHeart = (p: P) => (<svg {...base(p)}><path d="M12 20s-7-4.4-9.2-8.6C1.1 8.1 3 5 6 5c1.9 0 3.2 1.1 4 2.3C10.8 6.1 12.1 5 14 5c3 0 4.9 3.1 3.2 6.4C19 15.6 12 20 12 20z" /></svg>)
export const IconApps = (p: P) => (<svg {...base(p)}><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></svg>)
export const IconMe = (p: P) => (<svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>)

export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>)
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>)
export const IconChevronL = (p: P) => (<svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>)
export const IconSwitch = (p: P) => (<svg {...base(p)}><path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" /></svg>)
export const IconSun = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="4.4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></svg>)
export const IconMoon = (p: P) => (<svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>)
export const IconDiamond = (p: P) => (<svg {...base(p)}><path d="M6 3h12l3 6-9 12L3 9z" /><path d="M3 9h18M9 3 7.5 9 12 21l4.5-12L15 3" /></svg>)
export const IconComment = (p: P) => (<svg {...base(p)}><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>)
export const IconTag = (p: P) => (<svg {...base(p)}><path d="M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1.3" /></svg>)
export const IconPhoto = (p: P) => (<svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m4 18 5-4 4 3 3-2 4 3" /></svg>)
export const IconHistory = (p: P) => (<svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4M12 8v4l3 2" /></svg>)
export const IconUserPlus = (p: P) => (<svg {...base(p)}><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.6 3.1-5.8 7-5.8M17 11v6M14 14h6" /></svg>)

export const APP_ICON: Record<string, (p: P) => JSX.Element> = {
  padel: (p) => (<svg {...base(p)}><circle cx="12" cy="9" r="6" /><path d="M12 15v6M9 21h6" /><circle cx="12" cy="9" r="2.2" /></svg>),
  vault: (p) => (<svg {...base(p)}><rect x="4" y="5" width="16" height="14" rx="3" /><circle cx="12" cy="12" r="3" /><path d="M12 12v3" /></svg>),
  travel: (p) => (<svg {...base(p)}><path d="M2 16l20-7-7 13-2-6-6-2 0 0z" /></svg>),
  game: (p) => (<svg {...base(p)}><rect x="2" y="7" width="20" height="10" rx="5" /><path d="M7 12h3M8.5 10.5v3" /><circle cx="16" cy="11" r="1" /><circle cx="18" cy="14" r="1" /></svg>),
  grocery: (p) => (<svg {...base(p)}><path d="M3 4h2l2.4 12.4a1 1 0 0 0 1 .8h8.2a1 1 0 0 0 1-.8L20 8H6" /><circle cx="9" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></svg>),
  cinema: (p) => (<svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 9h18M8 5v4M16 5v4M8 19v-4M16 19v-4" /></svg>),
  store: (p) => (<svg {...base(p)}><path d="M4 9V5h16v4M4 9l1 11h14l1-11M4 9h16M9 13h6" /></svg>),
}
