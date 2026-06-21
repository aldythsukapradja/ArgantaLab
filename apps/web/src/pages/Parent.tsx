import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS, STAGES, type World } from '@/data/learn'
import { getMastery } from '@lib/adaptive'
import { earnedBadges } from '@lib/learnProgress'
import { getStreak } from '@lib/streak'
import { getCounters } from '@lib/quests'

// Maps each play-world to its real Cambridge subject — the "kids see games,
// parents see curriculum" bridge.
const SUBJECT: Record<string, string> = {
  NUM: 'Mathematics', WRD: 'English', WON: 'Science',
  LOG: 'Computing & Digital Literacy', WLD: 'Humanities (Geography · History · Economics)', LIF: 'Wellbeing & Life Skills',
}

// A light "grown-ups" gate: a small sum keeps little fingers out of the reports.
function Gate({ onPass }: { onPass: () => void }) {
  const [a] = useState(() => 6 + Math.floor(Math.random() * 7))
  const [b] = useState(() => 7 + Math.floor(Math.random() * 6))
  const [val, setVal] = useState('')
  const ok = Number(val) === a * b
  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}>
      <div className="par-gate">
        <div style={{ fontSize: 40 }}>🧑‍🏫</div>
        <h2>For grown-ups</h2>
        <p>To see your child's progress report, solve: <b>{a} × {b}</b></p>
        <input className="le-input" style={{ maxWidth: 160, textAlign: 'center', margin: '0 auto' }} inputMode="numeric"
          value={val} onChange={e => setVal(e.target.value)} placeholder="answer" />
        <button className="btn btn-primary" disabled={!ok} style={{ justifyContent: 'center', opacity: ok ? 1 : 0.5 }} onClick={onPass}>Enter report →</button>
      </div>
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return <div className="par-bar"><i style={{ width: `${pct}%`, background: color }} /></div>
}

export default function Parent() {
  const { learnerName, level, xp } = useAppStore()
  const [entered, setEntered] = useState(false)
  if (!entered) return <Gate onPass={() => setEntered(true)} />

  const stage = STAGES.find(s => s.key === 'explorer')!
  const streak = getStreak()
  const { weekly } = getCounters()
  const totalBadges = WORLDS.reduce((a, w) => a + earnedBadges(w).size, 0)

  // Subject mastery = average of its strand masteries (curriculum-honest, so the
  // subject % always matches the strand bars beneath it).
  const subjectMastery = (w: World) => Math.round(w.skills.reduce((a, s) => a + getMastery(w.key, s.key), 0) / w.skills.length * 100)
  const overall = Math.round(WORLDS.reduce((a, w) => a + subjectMastery(w), 0) / WORLDS.length)

  // focus = the 3 weakest skills across all worlds
  const allSkills = WORLDS.flatMap(w => w.skills.map(s => ({ world: w, skill: s, m: Math.round(getMastery(w.key, s.key) * 100) })))
  const focus = [...allSkills].sort((x, y) => x.m - y.m).slice(0, 3)

  return (
    <div className="screen par" style={{ justifyContent: 'flex-start', gap: 18, paddingTop: 6 }}>
      <div>
        <div className="kicker"><span className="live" />&nbsp;Grown-up report</div>
        <h1 className="h-title" style={{ fontSize: 'clamp(26px,4vw,42px)', marginTop: 8 }}>{learnerName}'s <span className="g">progress</span></h1>
        <p className="lead">Mapped to <b>Cambridge Primary — {stage.label}</b> (ages {stage.minAge}–{stage.maxAge}). Your child plays games; underneath, every game targets a real curriculum skill.</p>
      </div>

      <div className="par-kpis">
        <div className="par-kpi"><b>{overall}%</b><span>overall readiness</span></div>
        <div className="par-kpi"><b>Lv {level}</b><span>{xp.toLocaleString()} XP</span></div>
        <div className="par-kpi"><b>🔥 {streak}</b><span>day streak</span></div>
        <div className="par-kpi"><b>{totalBadges}</b><span>skills mastered</span></div>
      </div>

      <div className="section-label">Curriculum coverage</div>
      <div className="par-subjects">
        {WORLDS.map(w => {
          const subj = subjectMastery(w)
          return (
            <div key={w.key} className="par-subject" style={{ borderLeftColor: w.color }}>
              <div className="par-subject-h">
                <div>
                  <b>{SUBJECT[w.key]}</b>
                  <small>via {w.name}</small>
                </div>
                <span className="par-subject-pct" style={{ color: w.color }}>{subj}%</span>
              </div>
              <div className="par-strands">
                {w.skills.map(s => {
                  const m = Math.round(getMastery(w.key, s.key) * 100)
                  return (
                    <div key={s.key} className="par-strand">
                      <span className="par-strand-name">{s.label}</span>
                      <Bar pct={m} color={w.color} />
                      <span className="par-strand-pct">{m}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="section-label">This week</div>
      <div className="par-week">
        <div className="par-week-item"><b>{weekly.nodes}</b><span>lessons completed</span></div>
        <div className="par-week-item"><b>{weekly.boss}</b><span>boss challenges</span></div>
        <div className="par-week-item"><b>{weekly.xp.toLocaleString()}</b><span>XP earned</span></div>
      </div>

      <div className="section-label">Suggested focus</div>
      <div className="par-focus">
        {focus.map(f => (
          <div key={f.world.key + f.skill.key} className="par-focus-item" style={{ borderColor: `${f.world.color}55` }}>
            <span className="par-focus-ic" style={{ color: f.world.color }}>{f.world.icon}</span>
            <div><b>{f.skill.label}</b><small>{SUBJECT[f.world.key].split(' ')[0]} · {f.m}% mastered</small></div>
          </div>
        ))}
      </div>

      <p className="par-foot">🔒 Diamonds buy only cosmetics — never grades, ranks, or progress. Every reward here was earned by learning.</p>
    </div>
  )
}
