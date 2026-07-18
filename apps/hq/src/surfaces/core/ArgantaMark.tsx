// Arganta brand logomark — gradient "A" tile (brand gradient from icon.svg).
// Extracted so the Sovereign brain tab, the fullscreen title and anywhere else
// can share one source. `size` scales the whole tile. The gradient id is
// suffixed per-size so multiple instances on one page never collide.
export function ArgantaMark({ size = 26 }: { size?: number }) {
  const gid = `argMarkG${size}`
  return (
    <span className="core-brand-mark" aria-hidden style={{ display: 'inline-flex', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
        <rect width="26" height="26" rx="7" fill={`url(#${gid})`} />
        <path d="M7.6 18.4 L13 7 L18.4 18.4 M9.7 14.2 H16.3" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#6366F1" /><stop offset="1" stopColor="#FF3D72" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  )
}
