// Claude's sunburst logomark in Anthropic clay (#D97757). Inline SVG — no
// external asset, so it stays embeddable + CSP-clean. Ported verbatim from
// apps/hq/src/surfaces/core/ClaudeMark.tsx (same duplication rationale as
// bridge/client.ts — apps/energy is not a workspace member of apps/hq).
const RAYS = 12;

export function ClaudeMark({ size = 14, color = '#D97757' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none', display: 'block' }}>
      <g stroke={color} strokeWidth={2.1} strokeLinecap="round">
        {Array.from({ length: RAYS }).map((_, i) => {
          const a = (i / RAYS) * Math.PI * 2;
          const x1 = 12 + Math.cos(a) * 3.2;
          const y1 = 12 + Math.sin(a) * 3.2;
          const x2 = 12 + Math.cos(a) * 9;
          const y2 = 12 + Math.sin(a) * 9;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
    </svg>
  );
}
