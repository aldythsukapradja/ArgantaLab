import { useHQ, type CommandTab } from '../../shell/store'
import { Lobby } from './Lobby'
import { Office } from './Office'
import { Treasury } from './Treasury'
import { CoverageXray, OpsCockpit, LegalRegister, GuildBoard, BridgeRollup } from './Cockpits'
import type { OfficeId } from '../../data/graph/types'

const COCKPIT: Partial<Record<OfficeId, React.ReactNode>> = {
  bridge: <BridgeRollup />,
  operations: <OpsCockpit />,
  technology: <CoverageXray />,
  legal: <LegalRegister />,
  roster: <GuildBoard />,
}

const TABS: { id: CommandTab; label: string }[] = [
  { id: 'lobby', label: 'Lobby' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'operations', label: 'Operations' },
  { id: 'technology', label: 'Technology' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'legal', label: 'Legal' },
  { id: 'roster', label: 'The Guild' },
]

export function Command() {
  const { commandTab, setCommandTab } = useHQ()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Command</div>
          <div className="sub">The org cockpit — one North Star, six offices, rendered from one product ontology</div>
        </div>
        <div className="seg">
          {TABS.map(t => (
            <button key={t.id} className={commandTab === t.id ? 'on' : ''} onClick={() => setCommandTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      {commandTab === 'lobby' && <Lobby />}
      {commandTab === 'treasury' && <Treasury />}
      {commandTab !== 'lobby' && commandTab !== 'treasury' && <Office id={commandTab} cockpit={COCKPIT[commandTab]} />}
    </div>
  )
}
