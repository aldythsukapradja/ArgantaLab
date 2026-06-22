import { Rail } from './Rail'
import { Topbar } from './Topbar'
import { useHQ } from './store'
import { cloudEnabled } from '../lib/supabase'
import { Data } from '../surfaces/Data'
import { Pulse } from '../surfaces/Pulse'
import { Portfolio } from '../surfaces/Portfolio'
import { Audience } from '../surfaces/Audience'
import { Builder } from '../surfaces/Builder'

function Surface() {
  const { surface } = useHQ()
  switch (surface) {
    case 'data': return <Data />
    case 'pulse': return <Pulse />
    case 'portfolio': return <Portfolio />
    case 'audience': return <Audience />
    case 'builder': return <Builder />
  }
}

export function Shell({ who = 'Operator', authed = false }: { who?: string; authed?: boolean }) {
  return (
    <div className="hq">
      <Rail who={who} />
      <div className="main">
        <Topbar canSignOut={authed} />
        {!cloudEnabled && (
          <div className="banner">
            Offline preview — add <span className="src" style={{ background: 'transparent', padding: 0 }}>VITE_SUPABASE_URL</span> + anon key to <span className="src" style={{ background: 'transparent', padding: 0 }}>apps/hq/.env.local</span> and sign in to load live data.
          </div>
        )}
        <div className="content">
          <div className="content-in"><Surface /></div>
        </div>
      </div>
    </div>
  )
}
