import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { useAppStore } from '@store/appStore'
import {
  listKids, loadKidDashboard, masteryGrid, computeGaps, bloomDistribution,
  competencyScores, currentStreak, weekActiveDays, avgMinutesPerDay, stageOf,
  type KidDashboard, type Gap, type GapReason,
} from '@lib/parentDash'
import type { CloudProfile } from '@lib/cloudAuth'
import { isOnline } from '@lib/cloudAuth'
import { getMyDiamonds, grantDiamonds, adjustKidDiamonds } from '@lib/rewards'
import { cloudEnabled } from '@lib/supabase'
import { nivoTheme } from '@lib/nivoTheme'
import { useCountUp, fmt } from '@lib/useCountUp'
import { CompetencyRadar, BloomBar, InterestBar, ActivityCalendar, TrajectoryLine } from '@components/parent/charts'

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
function StatCard({ value, label, suffix = '', prefix = '', na = false }: { value: number; label: string; suffix?: string; prefix?: string; na?: boolean }) {
  const n = useCountUp(value)
  return <div className="par-kpi"><b>{na ? '—' : `${prefix}${fmt(n)}${suffix}`}</b><span>{label}</span></div>
}
function kidGlyph(k: { name: string; photo: string | null }) {
  return k.photo ? <img src={k.photo} alt="" className="pk-photo" /> : <span className="pk-init">{(k.name?.[0] ?? '?').toUpperCase()}</span>
}
function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Build an empty-but-valid dashboard from a kid's basic profile, so the page
// renders the SAME full frame whether or not telemetry exists yet.
function emptyDashboard(k: CloudProfile): KidDashboard {
  return {
    kid: { id: k.id, name: k.display_name, photo: k.photo_url ?? null, dob: k.dob ?? null,
      lastSeen: k.last_seen ?? null, diamonds: k.diamonds ?? 0, xp: k.xp ?? 0, level: k.level ?? 1 },
    mastery: [], daily: [], bloom: {}, competency: {}, interest: {}, recentRewards: [],
    generatedAt: new Date().toISOString(),
  }
}

export default function FamilyPulse() {
  const theme = useAppStore(s => s.theme)
  const nv = useMemo(() => nivoTheme(theme), [theme])

  const [kids, setKids] = useState<CloudProfile[] | null>(null)
  const [activeKid, setActiveKid] = useState<string | null>(null)
  const [dash, setDash] = useState<KidDashboard | null>(null)
  const [budget, setBudget] = useState(useAppStore.getState().diamonds)

  useEffect(() => {
    let alive = true
    listKids().then(ks => { if (alive) { setKids(ks); setActiveKid(ks[0]?.id ?? null) } })
    getMyDiamonds().then(b => { if (alive && b > 0) setBudget(b) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!activeKid) { setDash(null); return }
    let alive = true
    loadKidDashboard(activeKid).then(d => { if (alive) setDash(d) })
    return () => { alive = false }
  }, [activeKid])

  const reloadDash = () => { if (activeKid) loadKidDashboard(activeKid).then(setDash) }

  const activeProfile = kids?.find(k => k.id === activeKid) ?? null
  // The view ALWAYS exists: real dashboard, or an empty frame from the profile.
  const view: KidDashboard | null = dash ?? (activeProfile ? emptyDashboard(activeProfile) : null)

  const derived = useMemo(() => {
    if (!view) return null
    const grid = masteryGrid(view)
    const cells = grid.flatMap(g => g.cells)
    const attempted = cells.filter(c => c.pct !== null)
    return {
      grid,
      overall: attempted.length ? Math.round(attempted.reduce((a, c) => a + (c.pct ?? 0), 0) / cells.length) : 0,
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

  if (!cloudEnabled) return (
    <div className="screen par"><div className="par-empty">
      <span className="par-empty-ic">☁️</span><h2>Connect to the cloud</h2>
      <p>Sign in online to see each child's skills, gaps and trends.</p>
    </div></div>
  )
  if (kids === null) return <div className="screen par"><div className="par-loading">Loading your family…</div></div>
  if (kids.length === 0) return (
    <div className="screen par"><div className="par-empty">
      <span className="par-empty-ic">👨‍👩‍👧</span><h2>No children yet</h2>
      <p>Add a child from your Profile and their progress will appear here.</p>
    </div></div>
  )

  const kid = view?.kid
  const hasData = (derived?.totalAnswers ?? 0) > 0

  // Dynamic, data-driven headline (never generic filler).
  let topWorld: string | null = null, topGap: Gap | null = null
  if (derived) {
    let best = -1
    for (const g of derived.grid) {
      const att = g.cells.filter(c => c.pct !== null)
      if (!att.length) continue
      const avg = att.reduce((a, c) => a + (c.pct ?? 0), 0) / att.length
      if (avg > best) { best = avg; topWorld = g.world.key }
    }
    topGap = derived.gaps.find(g => g.reason !== 'untouched') ?? derived.gaps[0] ?? null
  }
  const headline = !kid ? '' : !hasData
    ? `${kid.name} hasn't started yet — a few rounds of NumberDash will light this up.`
    : [
        topWorld ? `strongest in ${SUBJECT[topWorld]}` : null,
        topGap?.skill ? `worth nudging ${topGap.skill.label}` : null,
        derived && derived.streak > 0 ? `on a ${derived.streak}-day streak` : null,
      ].filter(Boolean).length
        ? `${kid.name} is ${[topWorld ? `strongest in ${SUBJECT[topWorld]}` : null, topGap?.skill ? `worth nudging ${topGap.skill.label}` : null, derived && derived.streak > 0 ? `on a ${derived.streak}-day streak` : null].filter(Boolean).join(', ')}.`
        : `${kid.name} is building momentum — keep the daily streak going.`

  return (
    <div className="screen par" style={{ justifyContent: 'flex-start', gap: 14, paddingTop: 6 }}>
      <div>
        <div className="kicker"><span className="live" />&nbsp;Family Pulse</div>
        <h1 className="h-title" style={{ fontSize: 'clamp(24px,4vw,40px)', marginTop: 8 }}>
          {kid ? <>{kid.name}'s <span className="g">pulse</span></> : <>Your <span className="g">children</span></>}
        </h1>
      </div>

      {/* single selector */}
      <div className="par-family" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {kids.map(k => (
          <button key={k.id} onClick={() => setActiveKid(k.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                     border: `1.5px solid ${k.id === activeKid ? 'var(--accent, #6366f1)' : 'var(--border, #2a2a35)'}`,
                     background: k.id === activeKid ? 'color-mix(in srgb, var(--accent,#6366f1) 12%, transparent)' : 'var(--card, rgba(255,255,255,.03))' }}>
            <span className="pk-av" style={{ position: 'relative', flex: '0 0 auto' }}>{kidGlyph({ name: k.display_name, photo: k.photo_url ?? null })}{isOnline(k.last_seen) && <i className="pk-on" />}</span>
            <span style={{ minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.display_name}</b>
              <small style={{ color: 'var(--t2, #9aa1ad)', fontSize: 11.5 }}>💎 {fmt(k.diamonds ?? 0)} · Lv {k.level ?? 1}</small>
            </span>
          </button>
        ))}
      </div>

      {view && derived && kid && (
        <>
          {/* dynamic insight headline */}
          <div style={{ background: 'color-mix(in srgb, var(--accent,#6366f1) 10%, transparent)', borderRadius: 14, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent,#6366f1)' }}>💡 Today's read</div>
            <div style={{ fontSize: 15 }}>{headline}</div>
          </div>

          {/* KPIs — always shown */}
          <div className="par-kpis">
            <StatCard value={derived.overall} label="overall readiness" suffix="%" />
            <StatCard value={derived.streak} label="day streak" prefix="🔥 " />
            <StatCard value={derived.weekDays} label="active days / 7" />
            <StatCard value={derived.avgMin} label="avg min / day" na={!hasData} />
            <StatCard value={kid.level} label={`${fmt(kid.xp)} XP`} prefix="Lv " />
            <StatCard value={kid.diamonds} label="diamonds" prefix="💎 " />
          </div>

          <div className="par-stage-row">
            <span className="par-stage-pill" style={{ borderColor: derived.stage.color, color: derived.stage.color }}>
              {derived.stage.emoji} {derived.stage.label} · ages {derived.stage.minAge}–{derived.stage.maxAge}
            </span>
            <span className="par-stage-sub">{fmt(derived.totalAnswers)} questions answered all-time</span>
          </div>

          {/* insight cards — always shown, with embedded reward flow */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, background: 'var(--pp-tint, rgba(127,127,140,.12))', borderRadius: 999, padding: '5px 12px' }}>💎 your budget · {budget.toLocaleString()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
            <div style={{ background: 'color-mix(in srgb, #3DE08A 14%, transparent)', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1f9d63' }}>👍 Going well</div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>{hasData && topWorld ? `${SUBJECT[topWorld]} is their strongest area.` : 'Play a little to unlock strengths.'}</div>
              <RewardControl kidId={kid.id} kidName={kid.name} budget={budget} mode="give" accent="#1f9d63"
                onDone={(fromBal) => { setBudget(fromBal); useAppStore.setState({ diamonds: fromBal }); reloadDash() }} />
            </div>
            <div style={{ background: 'color-mix(in srgb, #FFA23A 16%, transparent)', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c9760f' }}>🎯 Where to nudge</div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>{hasData && topGap ? `${topGap.skill ? topGap.skill.label : 'Deeper thinking'} — ${GAP_META[topGap.reason].tip}` : 'Suggestions appear after the first session.'}</div>
              <RewardControl kidId={kid.id} kidName={kid.name} budget={budget} mode="givetake" accent="#c9760f"
                onDone={(fromBal) => { setBudget(fromBal); useAppStore.setState({ diamonds: fromBal }); reloadDash() }} />
            </div>
          </div>
          {view.recentRewards.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--t2)', alignItems: 'center' }}>
              <span>🕘 Recent:</span>
              {view.recentRewards.slice(0, 4).map((r, i) => (
                <span key={i}>{r.kind === 'deduct' ? '−' : '+'}{r.amount.toLocaleString()} · {r.reason || (r.kind === 'starter' ? 'Starter' : r.kind === 'deduct' ? 'Adjustment' : 'Reward')} · {timeAgo(r.at)}</span>
              ))}
            </div>
          )}

          {/* analytics — ALL charts always rendered (empty frame until there's data) */}
          <div className="section-label">Skills analytics {!hasData && <span style={{ fontWeight: 400, color: 'var(--t2)', fontSize: 12 }}>· empty until {kid.name} plays</span>}</div>
          <div className="pc-grid">
            <div className="pc-card">
              <div className="pc-h"><b>Life-skills balance</b><small>Cambridge Life Competencies · accuracy</small></div>
              <div className="pc-box pc-box-radar"><CompetencyRadar data={derived.comp} theme={nv} /></div>
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
              <div className="pc-box pc-box-interest"><InterestBar interest={view.interest} theme={nv} /></div>
            </div>
            <div className="pc-card pc-wide">
              <div className="pc-h"><b>Daily rhythm</b><small>Practice consistency · last 4 months</small></div>
              <div className="pc-box pc-box-cal"><ActivityCalendar daily={view.daily} theme={nv} /></div>
            </div>
          </div>

          {/* focus list */}
          <div className="section-label">What to focus on next</div>
          <div className="par-gaps">
            {!hasData && <div className="par-thin">Once {kid.name} plays, the most useful next steps show up here.</div>}
            {hasData && derived.gaps.length === 0 && <div className="par-thin">No gaps detected — everything is on track! 🎉</div>}
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

          {/* curriculum coverage — always */}
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

        </>
      )}

      <p className="par-foot">🔒 Diamonds buy only cosmetics — never grades, ranks, or progress. Rewards celebrate effort; they can't buy it.</p>
    </div>
  )
}

// Compact reward control embedded in an insight card: 50 · 100 · Custom pills,
// then Give (and Take for the "where to nudge" card). Take is clamped at 0.
function RewardControl({ kidId, kidName, budget, mode, accent, onDone }: {
  kidId: string; kidName: string; budget: number; mode: 'give' | 'givetake'; accent: string
  onDone: (fromBalance: number, kidBalance: number) => void
}) {
  const addToast = useAppStore(s => s.addToast)
  const [amount, setAmount] = useState(100)
  const [busy, setBusy] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const apply = async (sign: 1 | -1) => {
    if (amount <= 0) { addToast('Pick an amount above zero', '⚠️'); return }
    setBusy(true)
    try {
      const res = await adjustKidDiamonds(kidId, sign * amount, sign > 0 ? 'reward — effort' : 'adjustment')
      if (sign > 0) {
        const r = btnRef.current?.getBoundingClientRect()
        confetti({ particleCount: 80, spread: 65, startVelocity: 36,
          origin: r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.6 },
          colors: ['#FFC24B', '#34E5FF', '#4D9FFF', '#FF5EA0', '#3DE08A'] })
      }
      addToast(sign > 0 ? `Gave ${amount} 💎 to ${kidName}` : `Took ${amount} 💎 from ${kidName}`, sign > 0 ? '🎁' : '➖')
      onDone(res.fromBalance, res.kidBalance)
    } catch (e) { addToast(e instanceof Error ? e.message : 'Could not update', '⚠️') }
    finally { setBusy(false) }
  }

  const pill = (v: number) => (
    <button onClick={() => setAmount(v)} style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
      border: `1.5px solid ${amount === v ? accent : 'var(--border)'}`, background: amount === v ? `${accent}1f` : 'var(--card)', color: amount === v ? accent : 'inherit' }}>{v}</button>
  )
  const actBtn = (label: string, sign: 1 | -1, danger = false) => (
    <button ref={sign > 0 ? btnRef : undefined} onClick={() => apply(sign)} disabled={busy}
      style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 10, cursor: 'pointer', color: '#fff', border: 'none',
        background: danger ? '#ef4444' : accent, opacity: busy ? 0.6 : 1 }}>{label}</button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {pill(50)}{pill(100)}
      <input type="number" min={1} value={amount} onChange={e => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        aria-label="Custom amount" style={{ width: 70, fontSize: 12, padding: '5px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card)', textAlign: 'center' }} />
      {actBtn(mode === 'give' ? '🎁 Give' : '➕ Give', 1)}
      {mode === 'givetake' && actBtn('➖ Take', -1, true)}
    </div>
  )
}
