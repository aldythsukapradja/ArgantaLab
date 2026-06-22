import { useEffect, useState } from 'react'
import { GraduationCap, Plus } from 'lucide-react'
import { live } from '../data/live'
import type { SchemaInsights } from '../data/types'
import { Empty, Loading } from '../components/Empty'
import { compact } from '../lib/format'

export function Portfolio() {
  const [i, setI] = useState<SchemaInsights | null | undefined>(undefined)
  useEffect(() => { live.schemaInsights().then((d) => setI(d)) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="h1">Portfolio</div>
        <div className="sub">Apps with real data in Supabase today — others appear automatically as they emit events</div>
      </div>

      {i === undefined && <Loading label="Loading app health…" />}
      {i === null && <Empty title="No live connection">Portfolio reads the same live aggregates as Pulse. Connect Supabase and sign in to populate it.</Empty>}

      {i && (
        <>
          <div className="card" style={{ padding: 16 }}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <div className="row">
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--mag)', display: 'grid', placeItems: 'center' }}>
                  <GraduationCap size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>ArgantaLab</div>
                  <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>Kids learning super-app · live</div>
                </div>
              </div>
              <span className="pill pill-tl">Connected</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
              {[
                ['Learners', i.learners, 'profiles'],
                ['Active 7d', i.activeLearners7d, 'item_attempts'],
                ['Games', i.gamesTotal, 'games'],
                ['Live content', i.itemsLive, 'items'],
                ['Circles', i.circles, 'circles'],
              ].map(([l, v, src]) => (
                <div key={l as string} style={{ background: 'var(--bg2)', borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--tx2)' }}>{l as string}</div>
                  <div style={{ fontSize: 19, fontWeight: 600, margin: '2px 0' }}>{compact(v as number)}</div>
                  <div className="src" style={{ background: 'transparent', padding: 0, fontSize: 10 }}>{src as string}</div>
                </div>
              ))}
            </div>
          </div>

          <Empty icon={<Plus />} title="Connect more apps">
            KinetikCircle mini-apps surface here the moment they write rows to <span className="src">hq_event</span>.
            One manifest, zero dashboard changes.
          </Empty>
        </>
      )}
    </div>
  )
}
