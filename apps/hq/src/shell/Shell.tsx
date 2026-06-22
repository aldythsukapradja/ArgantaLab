import { Rail } from './Rail'
import { CommandBar } from './CommandBar'
import { useHQ } from './store'
import { cloudEnabled } from '../data'
import { Pulse } from '../surfaces/Pulse'
import { Portfolio } from '../surfaces/Portfolio'
import { Features } from '../surfaces/Features'
import { Economy } from '../surfaces/Economy'
import { Audience } from '../surfaces/Audience'
import { Placeholder } from '../surfaces/Placeholder'

function Content() {
  const { surface } = useHQ()
  switch (surface) {
    case 'pulse': return <Pulse />
    case 'portfolio': return <Portfolio />
    case 'features': return <Features />
    case 'audience': return <Audience />
    case 'economy': return <Economy />
    default: return <Placeholder id={surface} />
  }
}

export function Shell() {
  return (
    <div className="hq-app">
      <Rail />
      <main className="hq-main">
        <div className="hq-topbar"><CommandBar /></div>
        {!cloudEnabled && (
          <div style={{ margin: '0 18px', padding: '7px 11px', borderRadius: 10, fontSize: 11.5,
            background: 'var(--warn-bg)', color: 'var(--warn)' }}>
            Demo data — add the real Supabase URL + anon key to apps/hq/.env.local for live ArgantaLab numbers.
          </div>
        )}
        <div className="hq-content"><Content /></div>
      </main>
    </div>
  )
}
