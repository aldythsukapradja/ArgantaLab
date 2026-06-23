import { useState } from 'react'
import { Star, RefreshCw, Sparkles, Activity, BarChart3 } from 'lucide-react'
import { useHQ } from '../../../shell/store'
import { live } from '../../../data/live'
import { Empty } from '../../../components/Empty'
import { fmtCount, type Kind } from '../artifact'
import { builderConfig } from '../config'
import type { BuilderData } from '../useBuilderData'
import type { Recommendation } from '../../../data/algorithm'
import { Badge, TrendChip, HealthDot } from '../shared/ui'

export function AnalyticsPage({ kind, data }: { kind: Kind; data: BuilderData }) {
  const cfg = builderConfig(kind)
  const { analyticsFocus } = useHQ()
  const { ranked, featured, recommendations, byId, reload } = data
  const [busy, setBusy] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(analyticsFocus)

  const featuredIds = new Set(featured.map(f => f.id))

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusy(id); await fn(); reload(); setBusy(null)
  }
  const promote = (id: string) => act(() => live.setFeatured(kind, id, true), id)
  const refresh = (id: string) => { useHQ.getState().openStudio(id) }
  const archive = (id: string) => act(() => live.archiveArtifact(kind, id), id)
  const remove = (id: string) => {
    if (!confirm('Delete this artifact permanently?')) return
    act(() => live.deleteArtifact(kind, id), id)
  }

  // Aggregate activity (computed from available signals; richer once telemetry lands)
  const totalPlays = ranked.reduce((s, r) => s + r.plays, 0)
  const rated = ranked.filter(r => r.rating_count)
  const avgRating = rated.length ? (rated.reduce((s, r) => s + (r.rating_avg ?? 0), 0) / rated.length).toFixed(2) : '—'
  const totalShares = ranked.reduce((s, r) => s + (r.share_count ?? 0), 0)

  if (ranked.length === 0) {
    return <Empty icon={<BarChart3 />} title="No analytics yet">
      Publish {cfg.nounPlural.toLowerCase()} to start collecting engagement data and recommendations.
    </Empty>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="spread">
        <div>
          <div className="h1">{cfg.noun} Analytics</div>
          <div className="sub">Deterministic engagement ranking · featured curation · recommendations</div>
        </div>
        <button className="chip" onClick={reload} style={{ gap: 5 }}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid">
        <Kpi label="Total plays" value={fmtCount(totalPlays)} icon="▶" />
        <Kpi label="Avg rating" value={avgRating === '—' ? '—' : `${avgRating}★`} icon="★" />
        <Kpi label="Shares" value={fmtCount(totalShares)} icon="↗" />
        <Kpi label="Published" value={String(ranked.length)} icon="◆" />
      </div>

      {/* Featured Curator */}
      <Region icon={<Star size={14} />} title="Featured Curator" note={`${featured.length}/4 slots · auto-ranked by engagement score`}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>{cfg.noun}</th>
                <th>Badge</th>
                <th style={{ textAlign: 'right' }}>Plays</th>
                <th style={{ textAlign: 'right' }}>Rating</th>
                <th style={{ textAlign: 'right' }}>Trend</th>
                <th>Why featured</th>
              </tr>
            </thead>
            <tbody>
              {featured.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 700, color: 'var(--acc-text)' }}>{f.featuredRank}</td>
                  <td>
                    <span style={{ marginRight: 6 }}>{byId.get(f.id)?.emoji}</span>
                    <b>{f.title}</b>
                  </td>
                  <td><Badge kind={f.badge} /></td>
                  <td style={{ textAlign: 'right' }}>{fmtCount(f.plays)}</td>
                  <td style={{ textAlign: 'right' }}>{f.rating_avg != null ? `${f.rating_avg}★` : '—'}</td>
                  <td style={{ textAlign: 'right' }}><TrendChip pct={f.trendPct} dir={f.trend} /></td>
                  <td style={{ color: 'var(--tx2)', fontSize: 11.5, maxWidth: 220, whiteSpace: 'normal' }}>{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Region>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Region icon={<Sparkles size={14} />} title="Recommendations" note="System insights from hard data">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {recommendations.map((r, i) => (
              <RecoCard
                key={`${r.kind}-${r.artifact.id}-${i}`} reco={r}
                emoji={byId.get(r.artifact.id)?.emoji ?? cfg.accentEmoji}
                busy={busy === r.artifact.id}
                onPromote={() => promote(r.artifact.id)}
                onRefresh={() => refresh(r.artifact.id)}
                onArchive={() => archive(r.artifact.id)}
                onDelete={() => remove(r.artifact.id)}
              />
            ))}
          </div>
        </Region>
      )}

      {/* Leaderboard */}
      <Region icon={<Activity size={14} />} title="Leaderboard" note="All published, ranked by engagement score">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th></th>
                <th>{cfg.noun}</th>
                <th style={{ textAlign: 'right' }}>Score</th>
                <th style={{ textAlign: 'right' }}>Plays</th>
                <th style={{ textAlign: 'right' }}>Rating</th>
                <th style={{ textAlign: 'right' }}>Trend</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer', background: focus === r.id ? 'var(--acc-soft)' : undefined }}
                  onClick={() => setFocus(focus === r.id ? null : r.id)}>
                  <td style={{ fontWeight: 600 }}>{r.rank}</td>
                  <td><HealthDot health={r.health} /></td>
                  <td>
                    <span style={{ marginRight: 6 }}>{byId.get(r.id)?.emoji}</span>
                    {r.title}
                    {featuredIds.has(r.id) && <Star size={11} fill="var(--acc)" color="var(--acc)" style={{ marginLeft: 6, verticalAlign: -1 }} />}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}>{fmtCount(Math.round(r.score))}</td>
                  <td style={{ textAlign: 'right' }}>{fmtCount(r.plays)}</td>
                  <td style={{ textAlign: 'right' }}>{r.rating_avg != null ? `${r.rating_avg}★` : '—'}</td>
                  <td style={{ textAlign: 'right' }}><TrendChip pct={r.trendPct} dir={r.trend} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {!featuredIds.has(r.id) && (
                      <button className="chip" style={{ padding: '3px 8px', fontSize: 11 }}
                        disabled={busy === r.id}
                        onClick={e => { e.stopPropagation(); promote(r.id) }}>
                        <Star size={11} /> Feature
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Region>

      {/* Per-artifact detail */}
      {focus && byId.get(focus) && (
        <Region icon={<BarChart3 size={14} />} title="Score breakdown" note={byId.get(focus)!.title}>
          <ScoreBreakdown id={focus} ranked={ranked} />
        </Region>
      )}
    </div>
  )
}

function ScoreBreakdown({ id, ranked }: { id: string; ranked: BuilderData['ranked'] }) {
  const r = ranked.find(x => x.id === id)
  if (!r) return null
  const parts = [
    { label: 'Recency-weighted plays', value: r.breakdown.plays, color: '#6366f1' },
    { label: 'Quality (rating)', value: r.breakdown.rating, color: '#16a34a' },
    { label: 'Confidence (reviews)', value: r.breakdown.confidence, color: '#0d9488' },
    { label: 'Virality (shares)', value: r.breakdown.shares, color: '#d97706' },
    { label: 'Longevity (days active)', value: r.breakdown.longevity, color: '#a855f7' },
  ]
  const max = Math.max(...parts.map(p => p.value), 1)
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>Total engagement score</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)' }}>{Math.round(r.score)}</span>
      </div>
      {parts.map(p => (
        <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5 }}>
            <span style={{ color: 'var(--tx2)' }}>{p.label}</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--tx)' }}>{p.value}</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(p.value / max) * 100}%`, background: p.color, borderRadius: 99 }} />
          </div>
        </div>
      ))}
      {r.breakdown.freshnessBoost > 1 && (
        <div style={{ fontSize: 11.5, color: '#16a34a' }}>✦ Freshness boost ×{r.breakdown.freshnessBoost} (published this week)</div>
      )}
    </div>
  )
}

function RecoCard({ reco, emoji, busy, onPromote, onRefresh, onArchive, onDelete }: {
  reco: Recommendation; emoji: string; busy: boolean
  onPromote: () => void; onRefresh: () => void; onArchive: () => void; onDelete: () => void
}) {
  const tone = reco.kind === 'underperforming' ? '#dc2626'
    : reco.kind === 'rising_star' ? '#d97706'
    : reco.kind === 'underrated' ? 'var(--acc)' : '#16a34a'
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderLeft: `3px solid ${tone}` }}>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontSize: 18 }}>{reco.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', color: tone, textTransform: 'uppercase' }}>{reco.title}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{emoji} {reco.artifact.title}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5 }}>{reco.message}</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {reco.actions.includes('promote') && (
          <button className="chip" disabled={busy} onClick={onPromote}
            style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)', gap: 4 }}>
            <Star size={11} /> Promote
          </button>
        )}
        {reco.actions.includes('refresh') && <button className="chip" disabled={busy} onClick={onRefresh}>Refresh</button>}
        {reco.actions.includes('archive') && <button className="chip" disabled={busy} onClick={onArchive}>Archive</button>}
        {reco.actions.includes('delete') && (
          <button className="chip" disabled={busy} onClick={onDelete} style={{ color: 'var(--bad)' }}>Delete</button>
        )}
      </div>
    </div>
  )
}

function Region({ icon, title, note, children }: { icon: React.ReactNode; title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ color: 'var(--acc)' }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
        {note && <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>· {note}</span>}
      </div>
      {children}
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="kpi">
      <div className="kpi-l">{icon} {label}</div>
      <div className="kpi-v">{value}</div>
    </div>
  )
}
