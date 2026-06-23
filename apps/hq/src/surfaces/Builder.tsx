import { Hammer, Gamepad2 } from 'lucide-react'
import { useHQ } from '../shell/store'
import { GameBuilder } from './GameBuilder'
import { AppBuilder } from './AppBuilder'

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
      {builderTab === 'app'  && <AppBuilder />}
    </div>
  )
}
