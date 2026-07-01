// A crisp diamond gem — replaces the 💎 emoji, which renders inconsistently
// (blank boxes) across devices. Inline SVG so it's always sharp and on-brand.
export default function DiamondIcon({ size = 16, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}
      style={{ display: 'inline-block', verticalAlign: '-0.14em', ...style }} aria-label="diamonds" role="img">
      <defs>
        <linearGradient id="dmgic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fe0fa" /><stop offset="1" stopColor="#3aa0e0" />
        </linearGradient>
      </defs>
      <path d="M6 3.2h12l3.6 5.6L12 21.2 2.4 8.8z" fill="url(#dmgic)" stroke="#2b7fbf" strokeWidth="1" strokeLinejoin="round" />
      <path d="M6 3.2l3 5.6h6l3-5.6M2.4 8.8h19.2M12 21.2 9 8.8M12 21.2 15 8.8" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.55" />
    </svg>
  )
}
