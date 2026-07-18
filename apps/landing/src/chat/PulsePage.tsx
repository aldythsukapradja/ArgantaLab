// The Pulse — a scrollable deep-dive per kid, grounded in the exact kid_dashboard
// RPC ArgantaLab's own "Grown-ups" (Family Pulse) page reads. This delivers the
// core of that page — streak, weekly activity, overall mastery, depth-of-thinking
// (Bloom) bar, top opportunities, recent rewards — in the chat's own visual
// language. It is NOT a 1:1 pixel port of FamilyPulse.tsx (that page also carries
// Nivo radar charts, cup competitions and diamond-granting tools that belong to
// the guardian dashboard, not a chat card) — this is the honest, useful subset.
import { useEffect, useMemo, useState } from 'react'
import { myKids, fetchKidDashboard, type KidDashboard } from './data'

const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'create'] as const
const BLOOM_LABEL: Record<string, string> = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', create: 'Create' }

function streakOf(daily: KidDashboard['daily']): number {
  const active = new Set(daily.filter(d => d.items > 0).map(d => d.day))
  let n = 0; const d = new Date()
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  if (!active.has(iso(d))) d.setDate(d.getDate() - 1)
  while (active.has(iso(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}
function weekActive(daily: KidDashboard['daily']): number {
  const cutoff = Date.now() - 7 * 864e5
  return daily.filter(d => d.items > 0 && new Date(d.day).getTime() >= cutoff).length
}
function avgMinutes(daily: KidDashboard['daily']): number {
  const cutoff = Date.now() - 30 * 864e5
  const recent = daily.filter(d => d.items > 0 && new Date(d.day).getTime() >= cutoff)
  if (!recent.length) return 0
  return Math.round(recent.reduce((a, d) => a + d.minutes, 0) / recent.length)
}
function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function PulsePage({ scope: _scope }: { scope: string[] }) {
  const [kids, setKids] = useState<{ id: string; name: string; photo: string | null }[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dash, setDash] = useState<KidDashboard | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => { myKids().then(ks => { setKids(ks); setActiveId(ks?.[0]?.id ?? null) }) }, [])
  useEffect(() => {
    if (!activeId) { setDash(null); return }
    let on = true
    fetchKidDashboard(activeId).then(d => { if (on) { setDash(d); setFailed(d === null) } })
    return () => { on = false }
  }, [activeId])

  if (kids === null) return <div className="ac-acard ac-pulse-load">Loading the pulse…</div>
  if (!kids.length) return <div className="ac-acard">No kids linked yet — once they are, their pulse shows up here.</div>

  const streak = dash ? streakOf(dash.daily) : 0
  const active7 = dash ? weekActive(dash.daily) : 0
  const avgMin = dash ? avgMinutes(dash.daily) : 0
  const bloomTotal = dash ? Object.values(dash.bloom).reduce((a, n) => a + n, 0) : 0

  return (
    <div className="ac-pulse">
      {kids.length > 1 && (
        <div className="ac-pulse-tabs">
          {kids.map(k => <button key={k.id} className={'ac-pulse-tab' + (k.id === activeId ? ' on' : '')} onClick={() => setActiveId(k.id)}>{k.name}</button>)}
        </div>
      )}

      {failed ? <div className="ac-acard">Couldn’t reach {kids.find(k => k.id === activeId)?.name}’s data just now.</div> : !dash ? (
        <div className="ac-acard ac-pulse-load">Loading…</div>
      ) : (
        <>
          <div className="ac-pulse-kpis">
            <div className="ac-pulse-kpi"><b>{streak}</b><span>day streak</span></div>
            <div className="ac-pulse-kpi"><b>{active7}/7</b><span>active this week</span></div>
            <div className="ac-pulse-kpi"><b>{avgMin}m</b><span>avg / day</span></div>
            <div className="ac-pulse-kpi"><b>{dash.kid.diamonds.toLocaleString()}</b><span>💎 diamonds</span></div>
          </div>

          {bloomTotal > 0 && (
            <div className="ac-acard">
              <div className="ac-pulse-label">Depth of thinking</div>
              <div className="ac-bloom">
                {BLOOM_ORDER.map(b => {
                  const n = dash.bloom[b] ?? 0
                  const pct = Math.round((n / bloomTotal) * 100)
                  return (
                    <div key={b} className="ac-bloom-row">
                      <span className="ac-bloom-lbl">{BLOOM_LABEL[b]}</span>
                      <div className="ac-bloom-track"><i style={{ width: `${pct}%` }} /></div>
                      <span className="ac-bloom-pct">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {dash.mastery.length > 0 && (() => {
            const weak = [...dash.mastery].filter(m => m.mastery < 0.6).sort((a, b) => a.mastery - b.mastery).slice(0, 4)
            if (!weak.length) return null
            return (
              <div className="ac-acard">
                <div className="ac-pulse-label">Where to help next</div>
                <div className="ac-gaps">
                  {weak.map((m, i) => (
                    <div key={i} className="ac-gap-row">
                      <span className="ac-gap-skill">{m.skill}</span>
                      <div className="ac-bar" style={{ margin: 0, flex: 1 }}><i style={{ width: `${Math.round(m.mastery * 100)}%` }} /></div>
                      <span className="ac-gap-pct">{Math.round(m.mastery * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {dash.recentRewards.length > 0 && (
            <div className="ac-acard">
              <div className="ac-pulse-label">Recent</div>
              <div className="ac-rewards">
                {dash.recentRewards.slice(0, 4).map((r, i) => (
                  <div key={i} className="ac-reward-row">
                    <span>{r.reason || (r.kind === 'starter' ? 'Starter gift' : 'Reward')}</span>
                    <span className="ac-reward-meta">+{r.amount.toLocaleString()}💎 · {timeAgo(r.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {streak === 0 && active7 === 0 && (
            <div className="ac-acard">{kids.find(k => k.id === activeId)?.name} hasn’t practised yet — once they do, their pulse fills in right here.</div>
          )}
        </>
      )}
    </div>
  )
}
