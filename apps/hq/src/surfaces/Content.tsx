import { useState } from 'react'
import { BarChart3, PenSquare } from 'lucide-react'
import { ContentAnalytics } from './content/Analytics'
import { ContentStudio } from './content/Studio'

type Tab = 'analytics' | 'studio'

export function Content() {
  const [tab, setTab] = useState<Tab>('analytics')
  const tabs: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
    { id: 'analytics', label: 'Coverage', Icon: BarChart3 },
    { id: 'studio', label: 'Studio', Icon: PenSquare },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Learn Builder</div>
          <div className="sub">Author the learning curriculum & track its coverage — operator only</div>
        </div>
        <div className="seg">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'analytics' ? <ContentAnalytics /> : <ContentStudio />}
    </div>
  )
}
