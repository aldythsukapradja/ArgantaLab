// OpenAI / Codex logomark — the six-fold hexagonal "knot" blossom, simplified to
// an inline stroked path in OpenAI teal (#10A37F). Recognizable-by-silhouette,
// not pixel-exact (same rule as ProviderLogo), so it stays asset-free + CSP
// clean. Used wherever the Codex brain is surfaced (tab, model pill, capsule).
export function OpenAIMark({ size = 14, color = '#10A37F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none', display: 'block' }}>
      <g fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {/* Hexagonal blossom silhouette */}
        <path d="M12 2.6 L19.9 7.3 L19.9 16.7 L12 21.4 L4.1 16.7 L4.1 7.3 Z" />
        {/* Interlace hint — the knot's three-fold crossings */}
        <path d="M12 2.6 V12 L19.9 16.7 M12 12 L4.1 16.7 M12 12 L19.9 7.3" opacity={0.55} />
      </g>
    </svg>
  )
}
