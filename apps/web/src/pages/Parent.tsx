import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import {
  listKids, loadKidDashboard, masteryGrid, computeGaps, bloomDistribution,
  competencyScores, currentStreak, weekActiveDays, avgMinutesPerDay, stageOf,
  type KidDashboard, type Gap, type GapReason,
} from '@lib/parentDash'
import type { CloudProfile } from '@lib/cloudAuth'
import { isOnline } from '@lib/cloudAuth'
import { getMyDiamonds, grantDiamonds } from '@lib/rewards'
import { cloudEnabled } from '@lib/supabase'
import { nivoTheme } from '@lib/nivoTheme'
import { useCountUp, fmt } from '@lib/useCountUp'
import { CompetencyRadar, BloomBar, InterestBar, ActivityCalendar, TrajectoryLine } from '@components/parent/charts'

// Maps each play-world to its real Cambridge subject — the "kids see games,
// parents see curriculum" bridge.
const SUBJECT: Record<string, string> = {
  NUM: 'Mathematics', WRD: 'English', WON: 'Science',
  LOG: 'Computing & Digital Literacy', WLD: 'Humanities', LIF: 'Wellbeing & Life Skills',
}

const GAP_META: Record<GapReason, { label: string; emoji: string; color: string; tip: string }> = {
  frustrated: { label: 'Struggling', emoji: '😣', color: '#FF5D5D', tip: 'Drop the difficulty — short, winnable sets rebuild confidence.' },
  weak:       { label: 'Needs work', emoji: '📉', color: '#FFA23A', tip: 'A few daily reps will lift this fastest.' },
  decaying:   { label: 'Fading',     emoji: '🌫️', color: '#7C9CF5', tip: 'Spaced review is due — resurface it tomorrow.' },
  depth:      { label: 'Go deeper',  emoji: '🧠', color: '#A855F7', tip: 'Mix in analyse/create challenges, not just recall.' },
  untouched:  { label: 'Not started', emoji: '🌱', color: '#3DE08A', tip: 'Unlock this strand with a first gentle lesson.' },
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return <div className="par-bar"><i style={{ width: `${pct}%`, background: color }} /></div>
}

// One animated KPI tile (GSAP count-up).
function StatCard({ value, label, suffix = '', prefix = '' }: { value: number; label: string; suffix?: string; prefix?: string }) {
  const n = useCountUp(value)
  return <div className="par-kpi"><b>{prefix}{fmt(n)}{suffix}</b><span>{label}</span></div>
}

function kidGlyph(k: { name: string; photo: string | null }) {
  if (k.photo) return <img src={k.photo} alt="" className="pk-photo" />
  return <span className="pk-init">{(k.name?.[0] ?? '?').toUpperCase()}</span>
}

// Entry to this page is already gated by the Parent passcode at the grown-up
// switcher — so no separate math gate here.
export default function Parent() {
  const theme = useAppStore(s => s.theme)
  const nv = useMemo(() => nivoTheme(theme), [theme])

  const [kids, setKids] = useState<CloudProfile[] | null>(null)
  const [activeKid, setActiveKid] = useState<string | null>(null)
  const [dash, setDash] = useState<KidDashboard | null>(null)
  const [loadingDash, setLoadingDash] = useState(false)
  const [budget, setBudget] = useState(useAppStore.getState().diamonds)

  // Single source of truth: the real cloud dashboard. No preview/sample mode —
  // every kid shows the same view; missing numbers render as 0 / N-A.
  const view = dash

  // Load the family roster once.
  useEffect(() => {
    let alive = true
    listKids().then(ks => { if (alive) { setKids(ks); setActiveKid(ks[0]?.id ?? null) } })
    getMyDiamonds().then(b => { if (alive && b > 0) setBudget(b) })
    return () => { alive = false }
  }, [])

  // Load the selected kid's dashboard.
  useEffect(() => {
    if (!activeKid) { setDash(null); return }
    let alive = true
    setLoadingDash(true)
    loadKidDashboard(activeKid).then(d => { if (alive) { setDash(d); setLoadingDash(false) } })
    return () => { alive = false }
  }, [activeKid])

  const reloadDash = () => { if (activeKid) loadKidDashboard(activeKid).then(setDash) }

  // ── Derived analytics (memoised per dashboard) ────────────────
  const derived = useMemo(() => {
    if (!view) return null
    const grid = masteryGrid(view)
    const cells = grid.flatMap(g => g.cells)
    const overall = cells.length ? Math.round(cells.reduce((a, c) => a + (c.pct ?? 0), 0) / cells.length) : 0
    return {
      grid, overall,
      streak: currentStreak(view.daily),
      weekDays: weekActiveDays(view.daily),
      avgMin: avgMinutesPerDay(view.daily),
      gaps: computeGaps(view, 6),
      bloom: bloomDistribution(view),
      comp: competencyScores(view),
      stage: stageOf(view.kid.dob),
      totalAnswers: view.daily.reduce((a, d) => a + d.items, 0),
    }
  }, [view])

  // ── Offline / empty states ────────────────────────────────────
  if (!cloudEnabled) return (
    <div className="screen par"><div className="par-empty">
      <span className="par-empty-ic">☁️</span>
      <h2>Connect to the cloud</h2>
      <p>Kid progress analytics sync from the cloud. Sign in online to see each child's skills, gaps and trends.</p>
    </div></div>
  )
  if (kids === null) return <div className="screen par"><div className="par-loading">Loading your family…</div></div>
  if (kids.length === 0) return (
    <div className="screen par"><div className="par-empty">
      <span className="par-empty-ic">👨‍👩‍👧</span>
      <h2>No children yet</h2>
      <p>Add a child from your Profile. Their daily progress will appear here.</p>
    </div></div>
  )

  const kid = view?.kid
  // Kids exist, but the dashboard RPC returned nothing — almost always because
  // the analytics migration hasn't been applied yet.
  const needsSetup = !loadingDash && !dash && (kids?.length ?? 0) > 0

  return (
    <div className="screen par" style={{ justifyContent: 'flex-start', gap: 16, paddingTop: 6 }}>
      {/* header + kid switcher */}
      <div>
        <div className="kicker"><span className="live" />&nbsp;Family Pulse</div>
        <h1 className="h-title" style={{ fontSize: 'clamp(24px,4vw,40px)', marginTop: 8 }}>
          {kid ? <>{kid.name}'s <span className="g">skills</span></> : <>Your <span className="g">children</span></>}
        </h1>
        <p className="lead">Real Cambridge skills underneath the games. Small, frequent drills — here's what's working and where to nudge.</p>
      </div>

      {/* Single selector — every child's real cloud balance & level at a glance */}
      {kids && kids.length > 0 && (
        <div className="par-family" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {kids.map(k => (
            <button key={k.id} onClick={() => setActiveKid(k.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                       border: `1.5px solid ${k.id === activeKid ? 'var(--accent, #6366f1)' : 'var(--border, #2a2a35)'}`,
                       background: k.id === activeKid ? 'color-mix(in srgb, var(--accent,#6366f1) 12%, transparent)' : 'var(--card, rgba(255,255,255,.03))' }}>
              <span className="pk-av" style={{ position: 'relative', flex: '0 0 auto' }}>
                {kidGlyph({ name: k.display_name, photo: k.photo_url ?? null })}
                {isOnline(k.last_seen) && <i className="pk-on" />}
              </span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.display_name}</b>
                <small style={{ color: 'var(--t2, #9aa1ad)', fontSize: 11.5 }}>💎 {fmt(k.diamonds ?? 0)} · Lv {k.level ?? 1}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      {needsSetup && (
        <div className="par-empty soft">
          <span className="par-empty-ic">📊</span>
          <h2>No data yet for {kid?.name ?? kids?.find(k => k.id === activeKid)?.display_name ?? 'this child'}</h2>
          <p>Once they start playing, skills, gaps and trends fill in here. (If this stays empty, the one-time <code>migration_analytics_rewards.sql</code> setup may still need to be applied.)</p>
        </div>
      )}

      {loadingDash && <div className="par-loading">Crunching the numbers…</div>}

      {view && derived && kid && (
        <>
          {/* stat cards */}
          <div className="par-kpis">
            <StatCard value={derived.overall} label="overall readiness" suffix="%" />
            <StatCard value={derived.streak} label="day streak" prefix="🔥 " />
            <StatCard value={derived.weekDays} label="active days / 7" />
            <StatCard value={derived.avgMin} label="avg min / day" />
            <StatCard value={kid.level} label={`${fmt(kid.xp)} XP`} prefix="Lv " />
            <StatCard value={kid.diamonds} label="diamonds" prefix="💎 " />
          </div>

          <div className="par-stage-row">
            <span className="par-stage-pill" style={{ borderColor: derived.stage.color, color: derived.stage.color }}>
              {derived.stage.emoji} {derived.stage.label} · ages {derived.stage.minAge}–{derived.stage.maxAge}
            </span>
            <span className="par-stage-sub">{fmt(derived.totalAnswers)} questions answered all-time</span>
          </div>

          {derived.totalAnswers === 0 ? (
            <div className="par-empty soft">
              <span className="par-empty-ic">🎮</span>
              <h2>No play data yet</h2>
              <p>Once {kid.name} starts playing, skill mastery, depth-of-thinking and daily trends will fill in here.</p>
            </div>
          ) : (
            <>
              {/* analytics grid */}
              <div className="section-label">Skills analytics</div>
              <div className="pc-grid">
                <div className="pc-card">
                  <div className="pc-h"><b>Life-skills balance</b><small>Cambridge Life Competencies · accuracy</small></div>
                  {derived.comp.length >= 3
                    ? <div className="pc-box pc-box-radar"><CompetencyRadar data={derived.comp} theme={nv} /></div>
                    : <div className="pc-thin">Play a little more to map all competencies.</div>}
                </div>

                <div className="pc-card">
                  <div className="pc-h"><b>Depth of thinking</b><small>Bloom's taxonomy · share of answers</small></div>
                  <div className="pc-box"><BloomBar data={derived.bloom} theme={nv} /></div>
                </div>

                <div className="pc-card">
                  <div className="pc-h"><b>Progress trend</b><small>Questions attempted vs correct</small></div>
                  <div className="pc-box"><TrajectoryLine daily={view.daily} theme={nv} /></div>
                </div>

                <div className="pc-card">
                  <div className="pc-h"><b>Where the time goes</b><small>Last 30 days · by world</small></div>
                  {Object.keys(view.interest).length
                    ? <div className="pc-box pc-box-interest"><InterestBar interest={view.interest} theme={nv} /></div>
                    : <div className="pc-thin">No activity in the last 30 days.</div>}
                </div>

                <div className="pc-card pc-wide">
                  <div className="pc-h"><b>Daily rhythm</b><small>Practice consistency · last 4 months</small></div>
                  <div className="pc-box pc-box-cal"><ActivityCalendar daily={view.daily} theme={nv} /></div>
                </div>
              </div>

              {/* gaps */}
              <div className="section-label">What to focus on next</div>
              <div className="par-gaps">
                {derived.gaps.length === 0 && <div className="par-thin">No gaps detected — everything is on track! 🎉</div>}
                {derived.gaps.map((g: Gap, i) => {
                  const m = GAP_META[g.reason]
                  return (
                    <div key={i} className="par-gap" style={{ borderLeftColor: m.color }}>
                      <span className="par-gap-ic" style={{ background: `${m.color}22`, color: m.color }}>{m.emoji}</span>
                      <div className="par-gap-body">
                        <div className="par-gap-top">
                          {g.skill && <b>{g.skill.label}</b>}
                          {g.world && <small className="par-gap-subj">{SUBJECT[g.world.key]}</small>}
                          <span className="par-gap-tag" style={{ color: m.color }}>{m.label}</span>
                        </div>
                        <p className="par-gap-why">{g.why}</p>
                        <p className="par-gap-tip">💡 {m.tip}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* curriculum coverage (always shown) */}
          <div className="section-label">Curriculum coverage</div>
          <div className="par-subjects">
            {derived.grid.map(({ world: w, cells }) => {
              const attempted = cells.filter(c => c.pct !== null)
              const subj = attempted.length ? Math.round(attempted.reduce((a, c) => a + (c.pct ?? 0), 0) / attempted.length) : 0
              return (
                <div key={w.key} className="par-subject" style={{ borderLeftColor: w.color }}>
                  <div className="par-subject-h">
                    <div><b>{SUBJECT[w.key]}</b><small>via {w.name}</small></div>
                    <span className="par-subject-pct" style={{ color: w.color }}>{subj}%</span>
                  </div>
                  <div className="par-strands">
                    {cells.map(c => (
                      <div key={c.skill.key} className="par-strand">
                        <span className="par-strand-name">{c.skill.label}</span>
                        <Bar pct={c.pct ?? 0} color={c.pct === null ? 'var(--border)' : w.color} />
                        <span className="par-strand-pct">{c.pct === null ? '—' : `${c.pct}%`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* rewards */}
          <RewardPanel
            kidId={kid.id}
            kidName={kid.name}
            kidDiamonds={kid.diamonds}
            budget={budget}
            recent={view.recentRewards}
            onGranted={(fromBal) => { setBudget(fromBal); useAppStore.setState({ diamonds: fromBal }); reloadDash() }}
          />
        </>
      )}

      <p className="par-foot">🔒 Diamonds buy only cosmetics — never grades, ranks, or progress. Rewards celebrate effort; they can't buy it.</p>
    </div>
  )
}

// ── Reward panel ────────────────────────────────────────────────
const AMOUNTS = [50, 100, 500, 1000]

function RewardPanel({ kidId, kidName, kidDiamonds, budget, recent, onGranted }: {
  kidId: string; kidName: string; kidDiamonds: number; budget: number
  recent: { amount: number; reason: string | null; kind: string; at: string }[]
  onGranted: (fromBalance: number) => void
}) {
  const [amount, setAmount] = useState(100)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const fireConfetti = () => {
    const r = btnRef.current?.getBoundingClientRect()
    const origin = r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.6 }
    confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin, colors: ['#FFC24B', '#34E5FF', '#4D9FFF', '#FF5EA0', '#3DE08A'] })
  }

  const send = async () => {
    setErr(null); setOkMsg(null)
    if (amount <= 0) { setErr('Pick an amount above zero.'); return }
    if (amount > budget) { setErr("That's more than your diamond budget."); return }
    setBusy(true)
    try {
      const res = await grantDiamonds(kidId, amount, reason.trim())
      fireConfetti()
      setOkMsg(`Sent ${amount.toLocaleString()} 💎 to ${kidName}!`)
      setReason('')
      onGranted(res.fromBalance)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send diamonds.')
    } finally { setBusy(false) }
  }

  return (
    <div className="par-reward">
      <div className="par-reward-h">
        <div>
          <div className="section-label" style={{ margin: 0 }}>Reward {kidName}</div>
          <small className="par-reward-sub">Send diamonds for real-world wins — chores, kindness, effort.</small>
        </div>
        <div className="par-reward-budget">
          <b>💎 {budget.toLocaleString()}</b><span>your budget</span>
        </div>
      </div>

      <div className="par-reward-amounts">
        {AMOUNTS.map(a => (
          <button key={a} className={`par-amt${amount === a ? ' on' : ''}`} onClick={() => setAmount(a)}>{a.toLocaleString()}</button>
        ))}
        <input
          className="par-amt-input" type="number" min={1} value={amount}
          onChange={e => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          aria-label="Custom amount"
        />
      </div>

      <input
        className="par-reason" placeholder="What's it for? (e.g. tidied your room) — optional"
        value={reason} maxLength={80} onChange={e => setReason(e.target.value)}
      />

      <div className="par-reward-foot">
        <span className="par-reward-after">{kidName} has 💎 {kidDiamonds.toLocaleString()} → 💎 {(kidDiamonds + amount).toLocaleString()}</span>
        <button ref={btnRef} className="par-send" onClick={send} disabled={busy || amount <= 0}>
          {busy ? 'Sending…' : `Send ${amount.toLocaleString()} 💎`}
        </button>
      </div>

      {err && <div className="par-reward-msg err">{err}</div>}
      {okMsg && <div className="par-reward-msg ok">{okMsg}</div>}

      {recent.length > 0 && (
        <div className="par-reward-hist">
          <div className="par-hist-label">Recent rewards</div>
          {recent.slice(0, 5).map((r, i) => (
            <div key={i} className="par-hist-row">
              <span className="par-hist-amt">+{r.amount.toLocaleString()} 💎</span>
              <span className="par-hist-reason">{r.reason || (r.kind === 'starter' ? 'Starter pack' : 'Reward')}</span>
              <span className="par-hist-when">{timeAgo(r.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 864e5)
  if (d > 0) return `${d}d ago`
  const h = Math.floor(diff / 36e5)
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 6e4)
  return m > 0 ? `${m}m ago` : 'just now'
}
