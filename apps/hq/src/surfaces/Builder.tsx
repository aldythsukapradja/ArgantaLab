import { Hammer, Gamepad2 } from 'lucide-react'

export function Builder() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="h1">Builder</div>
        <div className="sub">Scaffold new apps and games into the portfolio — deterministic first, LLM-authored later</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        {[
          { Icon: Hammer, name: 'App Builder', desc: 'Intent → AppManifest → reusable engine → a KinetikCircle-native app that auto-registers in Portfolio.' },
          { Icon: Gamepad2, name: 'Game Builder', desc: 'ArgantaLab wizard matrix → self-contained HTML + a real row in the games table and Storage.' },
        ].map(({ Icon, name, desc }) => (
          <div key={name} className="card" style={{ padding: 16, opacity: 0.85 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <Icon size={17} color="var(--acc)" />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</span>
              <span className="pill pill-mut" style={{ marginLeft: 'auto' }}>Planned</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.55 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
