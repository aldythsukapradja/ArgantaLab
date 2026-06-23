import { LayoutGrid, Wrench, BarChart3 } from 'lucide-react'
import { useHQ, type BuilderSub } from '../../shell/store'
import type { Kind } from './artifact'
import { useBuilderData } from './useBuilderData'
import { CataloguePage } from './pages/CataloguePage'
import { StudioPage } from './pages/StudioPage'
import { AnalyticsPage } from './pages/AnalyticsPage'

const TABS: { id: BuilderSub; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'catalogue', label: 'Catalogue', Icon: LayoutGrid },
  { id: 'studio', label: 'Studio', Icon: Wrench },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
]

/**
 * One shell, two builders. `kind` is the only difference — Catalogue, Studio
 * and Analytics are fully shared and read their specifics from builderConfig.
 */
export function BuilderShell({ kind }: { kind: Kind }) {
  const { builderSub, setBuilderSub } = useHQ()
  const data = useBuilderData(kind)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={builderSub === id ? 'on' : ''} onClick={() => setBuilderSub(id)}>
            <Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            {label}
          </button>
        ))}
      </div>

      {builderSub === 'catalogue' && <CataloguePage kind={kind} data={data} />}
      {builderSub === 'studio' && <StudioPage kind={kind} data={data} />}
      {builderSub === 'analytics' && <AnalyticsPage kind={kind} data={data} />}
    </div>
  )
}

export function GameBuilder() { return <BuilderShell kind="game" /> }
export function AppBuilder() { return <BuilderShell kind="app" /> }
