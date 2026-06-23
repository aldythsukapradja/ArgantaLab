import { Hammer, Gamepad2 } from 'lucide-react'
import { useHQ } from '../shell/store'
import { GameBuilder } from './GameBuilder'

export function Builder() {
  const { builderTab, setBuilderTab } = useHQ()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tab switcher */}
      <div className="seg">
        <button
          className={builderTab === 'game' ? 'on' : ''}
          onClick={() => setBuilderTab('game')}
        >
          <Gamepad2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Game Builder
        </button>
        <button
          className={builderTab === 'app' ? 'on' : ''}
          onClick={() => setBuilderTab('app')}
        >
          <Hammer size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          App Builder
        </button>
      </div>

      {builderTab === 'game' && <GameBuilder />}
      {builderTab === 'app'  && <AppBuilderPlanned />}
    </div>
  )
}

function AppBuilderPlanned() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="h1">App Builder</div>
        <div className="sub">Scaffold KinetikCircle-native apps that auto-register in Portfolio</div>
      </div>
      <div className="card" style={{ padding: 16, opacity: 0.8 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <Hammer size={17} color="var(--acc)" />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>App Builder</span>
          <span className="pill pill-mut" style={{ marginLeft: 'auto' }}>Planned</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.55 }}>
          Intent → AppManifest → reusable engine → a KinetikCircle-native app that auto-registers in Portfolio.
        </div>
      </div>
    </div>
  )
}
