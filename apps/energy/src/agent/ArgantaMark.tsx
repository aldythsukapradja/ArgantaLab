// ArgantaMark — the Core/Lite tier's own mark, alongside ClaudeMark/OpenAIMark
// in the Frontier picker. A static SVG, not the full animated CosmoAgentOrb
// (canvas + requestAnimationFrame) — that component is built for one 64px hero
// spot, not for instantiating repeatedly at 13px in a model-picker capsule.
// Same teal/blue palette as the orb (#0FB5A6/#2563eb) so it reads as the same
// product family without the animation cost.
export function ArgantaMark({ size = 14, color = '#0FB5A6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none', display: 'block' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="1.6" opacity="0.35" />
      <circle cx="12" cy="12" r="4.6" fill={color} opacity="0.9" />
      <circle cx="12" cy="4.2" r="1.5" fill={color} />
      <circle cx="18.5" cy="15.8" r="1.5" fill={color} opacity="0.75" />
      <circle cx="5.5" cy="15.8" r="1.5" fill={color} opacity="0.6" />
    </svg>
  );
}
