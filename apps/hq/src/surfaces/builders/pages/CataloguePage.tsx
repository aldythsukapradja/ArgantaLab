import { useState, useMemo } from 'react'
import { Plus, Search, RefreshCw } from 'lucide-react'
import { useHQ } from '../../../shell/store'
import { cloudEnabled } from '../../../lib/supabase'
import { Empty, Loading } from '../../../components/Empty'
import { builderConfig } from '../config'
import { openFullscreen, toSignals, type Kind } from '../artifact'
import type { RankedArtifact } from '../../../data/algorithm'
import type { BuilderData } from '../useBuilderData'
import { ArtifactCard } from '../shared/ArtifactCard'

export function CataloguePage({ kind, data }: { kind: Kind; data: BuilderData }) {
  const cfg = builderConfig(kind)
  const { openStudio, openAnalytics } = useHQ()
  const [query, setQuery] = useState('')
  const { artifacts, byId, ranked, featured, circles, user, loading, reload } = data

  const rankedMap = useMemo(() => new Map(ranked.map(r => [r.id, r])), [ranked])
  const featuredMap = useMemo(() => new Map(featured.map(f => [f.id, f])), [featured])

  const q = query.trim().toLowerCase()
  const match = (id: string) => {
    if (!q) return true
    const a = byId.get(id)
    return !!a && (a.title.toLowerCase().includes(q) || (a.category ?? '').toLowerCase().includes(q))
  }

  const published = ranked.filter(r => match(r.id))
  const allGrid = published.filter(r => !featuredMap.has(r.id))
  const drafts = artifacts.filter(a => a.visibility !== 'public' && match(a.id))

  const defaultCircle = circles[0] ?? null
  const play = (id: string) => {
    const a = byId.get(id); if (!a?.html) return
    openFullscreen(kind, a.html, { user, circle: defaultCircle })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="spread">
        <div>
          <div className="h1">{cfg.noun} Catalogue</div>
          <div className="sub">Published {cfg.nounPlural.toLowerCase()} from KinetikCircle — featured slate is curated by Analytics</div>
        </div>
        <div className="row">
          <div className="row" style={{ gap: 6, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--bd2)', background: 'var(--bg)' }}>
            <Search size={13} color="var(--tx3)" />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${cfg.nounPlural.toLowerCase()}…`}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: 150, fontSize: 12.5 }}
            />
          </div>
          <button className="chip" onClick={reload} title="Refresh"><RefreshCw size={13} /></button>
          <button
            className="chip"
            style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)', gap: 6 }}
            onClick={() => openStudio(null)}
          >
            <Plus size={13} /> New {cfg.noun}
          </button>
        </div>
      </div>

      {!cloudEnabled && (
        <div className="insight warn" style={{ borderRadius: 'var(--r-md)' }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>Connect Supabase to publish {cfg.nounPlural.toLowerCase()}. Published HTML is saved and consumable by other apps.</div>
        </div>
      )}

      {loading && <Loading label={`Loading ${cfg.noun.toLowerCase()} catalogue…`} />}

      {!loading && artifacts.length === 0 && (
        <Empty icon={<cfg.Icon />} title={`No ${cfg.nounPlural.toLowerCase()} yet`}>
          Hit <b>New {cfg.noun}</b> to open the Studio, copy a starter prompt into Claude, paste the result, and publish.
        </Empty>
      )}

      {/* Featured slate */}
      {featured.length > 0 && (
        <Section label="⭐ Featured" note="Auto-curated by the ranking engine">
          <Grid>
            {featured.filter(f => match(f.id)).map(f => (
              <ArtifactCard
                key={f.id} item={f} emoji={byId.get(f.id)?.emoji ?? cfg.accentEmoji} badge={f.badge}
                onPlay={() => play(f.id)} onEdit={() => openStudio(f.id)}
                onAnalytics={() => openAnalytics(f.id)}
                onFullscreen={() => play(f.id)}
              />
            ))}
          </Grid>
        </Section>
      )}

      {/* All published */}
      {allGrid.length > 0 && (
        <Section label={`All ${cfg.nounPlural} · ${allGrid.length}`}>
          <Grid>
            {allGrid.map(r => (
              <ArtifactCard
                key={r.id} item={r} emoji={byId.get(r.id)?.emoji ?? cfg.accentEmoji}
                onPlay={() => play(r.id)} onEdit={() => openStudio(r.id)}
                onAnalytics={() => openAnalytics(r.id)}
                onFullscreen={() => play(r.id)}
              />
            ))}
          </Grid>
        </Section>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <Section label={`Drafts · ${drafts.length}`}>
          <Grid>
            {drafts.map(a => {
              const r: RankedArtifact = rankedMap.get(a.id) ?? {
                ...toSignals(a), score: 0, rank: 0, trendPct: 0, trend: 'flat', health: 'safe',
                breakdown: { plays: 0, rating: 0, confidence: 0, shares: 0, longevity: 0, freshnessBoost: 1, total: 0 },
              }
              return (
                <ArtifactCard
                  key={a.id} item={r} emoji={a.emoji} draft
                  onPlay={() => play(a.id)} onEdit={() => openStudio(a.id)}
                  onAnalytics={() => openAnalytics(a.id)}
                  onFullscreen={() => play(a.id)}
                />
              )
            })}
          </Grid>
        </Section>
      )}
    </div>
  )
}

function Section({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div className="row" style={{ gap: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        {note && <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>· {note}</span>}
      </div>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      {children}
    </div>
  )
}
