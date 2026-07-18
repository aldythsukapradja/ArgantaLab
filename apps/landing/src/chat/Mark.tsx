// The Arganta Twin-Peaks A — the app's heartbeat. Geometry follows the v2 brand
// mark (two interlocked A's, star at the younger apex, ember on the raised one).
// Breathes slowly at rest; quickens while the assistant thinks (F1 §2.4).
export function Mark({ size = 44, breathe = 'slow' }: { size?: number; breathe?: 'slow' | 'fast' | 'off' }) {
  const cls = breathe === 'off' ? 'ac-mark' : `ac-mark ac-mark--${breathe === 'fast' ? 'fast' : 'breathe'}`
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ac-ember" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#DCA254" />
          <stop offset="1" stopColor="#8F6B3C" />
        </linearGradient>
      </defs>
      {/* the standing A (soft ink) */}
      <path d="M22 96 L52 28 L82 96" stroke="var(--ink-soft, #3A3D45)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {/* the raised A (ember) */}
      <path d="M50 96 L74 42 L102 96" stroke="url(#ac-ember)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {/* star at the younger apex */}
      <circle cx="74" cy="34" r="4.5" fill="url(#ac-ember)" />
    </svg>
  )
}
