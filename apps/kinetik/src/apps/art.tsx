// Bespoke SVG art for native apps — racket/bolt for padel formats, a top-down
// padel court figure for the court picker, and a generic hero motif slot.
export function Racket({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10" cy="8.5" rx="6.6" ry="7" />
      <path d="M7.4 14.6 4.8 21" />
      <path d="M5.6 6.5h8.8M5 9.6h10M9 2.1v12.6M12.6 2.6v12" opacity="0.65" />
    </svg>
  )
}

export function Bolt({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="m13 2-9 12h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  )
}

/** Top-down padel court — net + service lines. Inherits currentColor. */
export function PadelCourt({ w = 46 }: { w?: number }) {
  return (
    <svg viewBox="0 0 48 30" width={w} height={(w * 30) / 48} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="45" height="27" rx="3.5" />
      <line x1="24" y1="1.5" x2="24" y2="28.5" strokeWidth={1.8} />
      <line x1="1.5" y1="15" x2="46.5" y2="15" strokeDasharray="2.4 2.4" opacity="0.8" />
      <line x1="12" y1="1.5" x2="12" y2="28.5" opacity="0.75" />
      <line x1="36" y1="1.5" x2="36" y2="28.5" opacity="0.75" />
    </svg>
  )
}
