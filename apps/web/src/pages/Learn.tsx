import { useState, useRef } from 'react'
import { useAppStore } from '@store/appStore'
import { LESSONS, moduleItems, CARMETA, LEARN_EXTRAS, SAMPLE, DEMO_SLIDES, lineChart, barChart, donutChart, tabLessons } from '@/data'
import { isCinematic, cinematicForTab } from '@/data/cinematic'
import CinematicPlayer from '@components/learn/CinematicPlayer'
import CinematicWorldMap from '@components/learn/CinematicWorldMap'

/* ── icons ── */
const BackIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
const NextIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
const PlayIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const LockIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const StarIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const InfoIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>

/* ── artwork ── */
function SlideArt({ emoji }: { emoji: string }) {
  return (
    <div className="art">
      <div className="sky" />
      <div className="em">{emoji}</div>
    </div>
  )
}

/* ============================================================
   COVERFLOW – module selector
   ============================================================ */
function Coverflow({ tab }: { tab: string }) {
  const { go, completedLessons, requireAuth } = useAppStore()
  const items = moduleItems(tab)
  const [idx, setIdx] = useState(0)
  const meta = CARMETA[tab as keyof typeof CARMETA] ?? { e: '📖', t: 'Learn', s: 'Choose a module' }

  const lessons = tabLessons(tab)
  const totalLessons = lessons.length
  const doneLessons = lessons.filter(([id]) => completedLessons.includes(id)).length

  const handleStart = (item: { id: string }) => {
    const id = item.id
    if (!requireAuth('to start learning')) return
    if (id === 'pitch') { go({ lessonId: 'launch/pitch' }); return }
    if (id === 'demo') { go({ lessonId: 'launch/demo' }); return }
    if (id.startsWith('lab/') || id.startsWith('mindmap/')) { go({ lessonId: id }); return }
    if (LESSONS[id]) go({ lessonId: id })
  }

  return (
    <div className="screen show">
      <div className="show-head">
        <div className="kicker"><span className="live" />&nbsp;{meta.t}</div>
        <h1 className="h-title">{tab.charAt(0).toUpperCase() + tab.slice(1)} <span className="g">Quest</span></h1>
        <p className="lead">{meta.s}</p>
        {totalLessons > 0 && (
          <div className="show-prog">
            <span style={{ fontSize: 12, color: 'var(--t2)', whiteSpace: 'nowrap' }}>{doneLessons}/{totalLessons} done</span>
            <div className="xpbar" style={{ flex: 1 }}>
              <i style={{ width: `${(doneLessons / totalLessons) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="coverflow">
        <button className="cf-arrow" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}><BackIcon /></button>
        <div className="cf-stage">
          {items.map((item, i) => {
            const offset = i - idx
            const abs = Math.abs(offset)
            if (abs > 2) return null
            const isActive = i === idx
            const lesson = LESSONS[item.id]
            const isDone = lesson && completedLessons.includes(item.id)
            const prereqsMet = !lesson?.lock || lesson.lock.every(p => completedLessons.includes(p))
            const locked = !prereqsMet

            return (
              <div
                key={item.id}
                className={`cf-card${isActive ? ' active' : ''}${locked ? ' locked' : ''}`}
                style={{
                  transform: `translate(-50%,-50%) translateX(${offset * 58}%) scale(${isActive ? 1 : 0.86 - abs * 0.04})`,
                  zIndex: 10 - abs,
                  opacity: abs > 1 ? 0.45 : abs === 1 ? 0.72 : 1,
                }}
                onClick={() => !isActive && setIdx(i)}
              >
                <div className="cf-num">{item.l.num}</div>
                <div className="cf-ic">
                  {locked ? <LockIcon /> : <span style={{ fontSize: 28 }}>📖</span>}
                </div>
                <h2>{item.l.title}</h2>
                <p>{item.l.blurb}</p>
                <div className="cf-meta">
                  {isDone
                    ? <span className="donechip"><CheckIcon /> Completed</span>
                    : item.l.xp ? <span className="xpchip">+{item.l.xp} XP</span> : null}
                </div>
                {!locked && (
                  <button className="btn btn-primary cf-start" onClick={() => handleStart(item)}>
                    {isDone ? <><CheckIcon /> Review</> : <><PlayIcon /> Start</>}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button className="cf-arrow" onClick={() => setIdx(i => Math.min(items.length - 1, i + 1))} disabled={idx === items.length - 1}><NextIcon /></button>
      </div>

      <div className="dots">
        {items.map((_, i) => <i key={i} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} />)}
      </div>
    </div>
  )
}

/* ============================================================
   LESSON DECK
   ============================================================ */
function LessonDeck({ lessonKey }: { lessonKey: string }) {
  const { go, lessonStep, completeLesson, addXp } = useAppStore()
  const lesson = LESSONS[lessonKey]
  if (!lesson) return null

  const slides = lesson.slides
  const step = Math.min(lessonStep, slides.length - 1)
  const slide = slides[step]
  const isLast = step === slides.length - 1

  const prev = () => go({ step: step - 1 })
  const next = () => {
    if (isLast) { completeLesson(lessonKey); addXp(lesson.xp ?? 40); go({ lessonId: null }) }
    else go({ step: step + 1 })
  }

  // Detect slide type
  const isObjectSlide = !Array.isArray(slide) && typeof slide === 'object'
  const isArraySlide = Array.isArray(slide)

  // Object slide: {ic, t, an, re} — has analogy/real pair
  const objectSlide = isObjectSlide ? (slide as { ic: string; t: string; an: string; re: string }) : null
  // Array slide: [icon, title, text] — launch-style
  const arraySlide = isArraySlide ? (slide as [string, string, string]) : null

  return (
    <div className="screen" style={{ justifyContent: 'space-between', paddingTop: 8 }}>
      <div className="deck-head">
        <button className="icon-btn" onClick={() => go({ lessonId: null })}><BackIcon /></button>
        <div className="now">{lesson.title}<small>Step {step + 1} of {slides.length}</small></div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>Lesson {lesson.num}</span>
      </div>

      <div className="deck-body">
        {objectSlide ? (
          <div className="deck-slide rich">
            <div className="rich-top">
              <div className="rich-ic">{objectSlide.ic}</div>
              <div className="tt">
                <div className="n">Step {step + 1}</div>
                <h2>{objectSlide.t}</h2>
              </div>
            </div>
            <div className="relate">
              <div className="rcard a">
                <div className="rh">🧩 Analogy</div>
                <p>{objectSlide.an}</p>
              </div>
              <div className="rcard r">
                <div className="rh">⚙️ Real Life</div>
                <p>{objectSlide.re}</p>
              </div>
            </div>
          </div>
        ) : arraySlide ? (
          <div className="deck-slide">
            <SlideArt emoji={arraySlide[0]} />
            <div className="n">Step {step + 1}</div>
            <h2>{arraySlide[1]}</h2>
            <p>{arraySlide[2]}</p>
          </div>
        ) : null}
      </div>

      <div className="dots">
        {slides.map((_: unknown, i: number) => <i key={i} className={i === step ? 'on' : ''} />)}
      </div>

      <div className="deck-nav">
        <button className="btn btn-ghost" onClick={prev} disabled={step === 0}><BackIcon /> Back</button>
        <button className="btn btn-primary" onClick={next}>
          {isLast ? <><CheckIcon /> Finish +{lesson.xp} XP</> : <>Next <NextIcon /></>}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   INTERACTIVES
   ============================================================ */
function PromptBuilder() {
  const [role, setRole] = useState('a teacher')
  const [task, setTask] = useState('explain gravity to a 10-year-old')
  const [ctx, setCtx] = useState('use a simple analogy')
  const prompt = `You are ${role}. Please ${task}. ${ctx}.`
  return (
    <div className="panel">
      <h3 className="pt">Prompt Builder</h3>
      <div className="field"><label>Role</label><input value={role} onChange={e => setRole(e.target.value)} placeholder="a teacher" /></div>
      <div className="field"><label>Task</label><input value={task} onChange={e => setTask(e.target.value)} placeholder="explain gravity..." /></div>
      <div className="field"><label>Context</label><input value={ctx} onChange={e => setCtx(e.target.value)} placeholder="use a simple analogy" /></div>
      <div className="result-box" style={{ borderColor: 'var(--accent)' }}>
        <strong style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '.06em' }}>YOUR PROMPT</strong>
        <p style={{ marginTop: 6 }}>{prompt}</p>
      </div>
      <div className="insight" style={{ marginTop: 12 }}>
        <div className="h"><InfoIcon /> Tip</div>
        <p>Great prompts have a <b>role</b>, a <b>task</b>, and <b>context</b>. The more specific, the better!</p>
      </div>
    </div>
  )
}

function StatsExplorer() {
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all')
  const rows = filter === 'all' ? SAMPLE : SAMPLE.filter(r => filter === 'win' ? r.win === 1 : r.win === 0)
  return (
    <div className="panel">
      <h3 className="pt">Game Stats Explorer</h3>
      <div className="field">
        <label>Filter</label>
        <select value={filter} onChange={e => setFilter(e.target.value as 'all' | 'win' | 'loss')}>
          <option value="all">All Matches</option>
          <option value="win">Wins Only</option>
          <option value="loss">Losses Only</option>
        </select>
      </div>
      <table className="data">
        <thead><tr><th>#</th><th>Weapon</th><th>Coins</th><th>Deaths</th><th>Result</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>M{r.m}</td>
              <td>{r.weapon}</td>
              <td>{r.coins}</td>
              <td>{r.deaths}</td>
              <td style={{ color: r.win ? 'var(--green)' : 'var(--danger)', fontWeight: 700 }}>{r.win ? 'Win' : 'Loss'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="insight" style={{ marginTop: 12 }}>
        <div className="h"><InfoIcon /> Insight</div>
        <p>Filtering is how dashboards work — pick exactly what you need to see!</p>
      </div>
    </div>
  )
}

function ChartMagic() {
  const [type, setType] = useState<'line' | 'bar' | 'donut'>('line')
  const charts = { line: lineChart(), bar: barChart(), donut: donutChart() }
  return (
    <div className="panel">
      <h3 className="pt">Chart Magic</h3>
      <div className="field">
        <label>Chart Type</label>
        <select value={type} onChange={e => setType(e.target.value as 'line' | 'bar' | 'donut')}>
          <option value="line">Line Chart – trends over time</option>
          <option value="bar">Bar Chart – compare values</option>
          <option value="donut">Donut Chart – show proportions</option>
        </select>
      </div>
      <div className="chart-card" dangerouslySetInnerHTML={{ __html: charts[type] }} />
      <div className="insight" style={{ marginTop: 12 }}>
        <div className="h"><InfoIcon /> Why charts?</div>
        <p>Numbers in a table are hard to read. Charts make patterns <b>visible instantly</b>.</p>
      </div>
    </div>
  )
}

function Dashboard() {
  const kpis = [
    { v: '638', l: 'Wellheads' }, { v: '26', l: 'Formations' },
    { v: '99.1%', l: 'Uptime' }, { v: '312K', l: 'Barrels/day' },
  ]
  return (
    <div className="panel">
      <h3 className="pt">Boss Dashboard – Al Shaheen Field</h3>
      <div className="kpis">
        {kpis.map(k => <div key={k.l} className="kpi"><div className="v">{k.v}</div><div className="l">{k.l}</div></div>)}
      </div>
      <div className="chart-card" dangerouslySetInnerHTML={{ __html: barChart() }} />
      <div className="insight" style={{ marginTop: 12 }}>
        <div className="h"><InfoIcon /> Real Data</div>
        <p>Baba monitors 638 real wellheads in Qatar. This is the kind of dashboard he uses every day.</p>
      </div>
    </div>
  )
}

function PredictBot() {
  const [score, setScore] = useState(750)
  const pred = score > 800 ? 'WIN' : score > 500 ? 'MAYBE WIN' : 'LIKELY LOSS'
  const col = score > 800 ? 'var(--green)' : score > 500 ? 'var(--gold)' : 'var(--danger)'
  return (
    <div className="panel">
      <h3 className="pt">Predict-O-Bot</h3>
      <div className="field">
        <label>Player Score: {score}</label>
        <input type="range" className="slider" min={0} max={1000} value={score} onChange={e => setScore(+e.target.value)} />
      </div>
      <div className="result-box" style={{ textAlign: 'center' }}>
        <div className="gauge" style={{ color: col }}>{pred}</div>
        <p style={{ color: 'var(--t2)', marginTop: 6, fontSize: 13 }}>Confidence: {Math.round(Math.abs(score - 500) / 5)}%</p>
      </div>
      <div className="insight" style={{ marginTop: 12 }}>
        <div className="h"><InfoIcon /> How AI predicts</div>
        <p>AI looks at past data to find patterns. High scores → usually wins. It is never 100% sure!</p>
      </div>
    </div>
  )
}

/* ============================================================
   PRACTICAL LAB + MINDMAP
   ============================================================ */
function PracticalLab({ tab, mode }: { tab: string; mode: 'lab' | 'mindmap' }) {
  const { go } = useAppStore()
  const extra = LEARN_EXTRAS[tab as keyof typeof LEARN_EXTRAS]
  if (!extra) return <div className="panel"><p>No lab for this tab yet.</p></div>

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', gap: 14 }}>
      <div className="deck-head">
        <button className="icon-btn" onClick={() => go({ lessonId: null })}><BackIcon /></button>
        <div className="now">{mode === 'lab' ? extra.lab.title : extra.map.title}</div>
      </div>
      {mode === 'lab' ? (
        <div className="panel" style={{ height: 'auto', maxWidth: '100%' }}>
          <h3 className="pt">🔬 {extra.lab.title}</h3>
          <div className="task-list">
            {(extra.lab.tasks as [string, string][]).map(([label, detail], i) => (
              <div key={i} className="task">
                <div className="dot">{i + 1}</div>
                <div><b>{label}</b><span>{detail}</span></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ height: 'auto', maxWidth: '100%' }}>
          <h3 className="pt">🗺️ {extra.map.title}</h3>
          <div className="mindmap">
            <div className="mind-center">{extra.map.center}</div>
            {(extra.map.nodes as [string, string][]).map(([label, detail]) => (
              <div key={label} className="mind-node"><b>{label}</b><span>{detail}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   PITCH STUDIO
   ============================================================ */
function PitchStudio() {
  const { pitchScript, savePitchScript, addToast, go } = useAppStore()
  const [txt, setTxt] = useState(pitchScript)
  const wc = txt.trim().split(/\s+/).filter(Boolean).length
  return (
    <div className="screen" style={{ justifyContent: 'flex-start', gap: 14 }}>
      <div className="deck-head">
        <button className="icon-btn" onClick={() => go({ lessonId: null })}><BackIcon /></button>
        <div className="now">Pitch Studio<small>Write your 30-second pitch</small></div>
      </div>
      <div className="panel" style={{ height: 'auto', maxWidth: '100%' }}>
        <div className="field">
          <label>My app pitch ({wc} / 60 words)</label>
          <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={6}
            placeholder="My app is called... It helps kids... The coolest thing about it is..." style={{ resize: 'vertical' }} />
        </div>
        <div className="insight">
          <div className="h"><InfoIcon /> Formula</div>
          <p><b>My app is called</b> ___ · <b>It helps</b> ___ · <b>The coolest thing is</b> ___.</p>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
          onClick={() => { savePitchScript(txt); addToast('Pitch saved!', '🎤') }}>
          <CheckIcon /> Save Pitch
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   DEMO STAGE
   ============================================================ */
function DemoStage() {
  const { go } = useAppStore()
  const [demoIdx, setDemoIdx] = useState(0)
  const slide = DEMO_SLIDES[demoIdx] as { t: string; s: string; logo?: boolean; demo?: boolean }
  const isLast = demoIdx === DEMO_SLIDES.length - 1
  return (
    <div className="screen" style={{ justifyContent: 'space-between', paddingTop: 8 }}>
      <div className="deck-head">
        <button className="icon-btn" onClick={() => go({ lessonId: null })}><BackIcon /></button>
        <div className="now">Demo Stage<small>Step {demoIdx + 1} / {DEMO_SLIDES.length}</small></div>
      </div>
      <div className="deck-body">
        <div className="deck-slide">
          <SlideArt emoji={slide.demo ? '🎮' : slide.logo ? '🚀' : '📊'} />
          <div className="n">Stage {demoIdx + 1}</div>
          <h2>{slide.t}</h2>
          <p>{slide.s}</p>
        </div>
      </div>
      <div className="dots">{DEMO_SLIDES.map((_: unknown, i: number) => <i key={i} className={i === demoIdx ? 'on' : ''} />)}</div>
      <div className="deck-nav">
        <button className="btn btn-ghost" onClick={() => setDemoIdx(i => Math.max(0, i - 1))} disabled={demoIdx === 0}><BackIcon /> Back</button>
        <button className="btn btn-primary" onClick={() => isLast ? go({ lessonId: null }) : setDemoIdx(i => i + 1)}>
          {isLast ? <><StarIcon /> Done!</> : <>Next <NextIcon /></>}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   INTERACTIVE WRAPPER
   ============================================================ */
function Interactive({ id }: { id: string }) {
  const lesson = LESSONS[id]
  const { go } = useAppStore()
  if (!lesson?.interactive) return null
  return (
    <div className="screen" style={{ justifyContent: 'flex-start', gap: 14 }}>
      <div className="deck-head">
        <button className="icon-btn" onClick={() => go({ lessonId: null })}><BackIcon /></button>
        <div className="now">{lesson.title} – Interactive<small>Try it yourself</small></div>
      </div>
      {lesson.interactive === 'promptBuilder' && <PromptBuilder />}
      {lesson.interactive === 'statsExplorer' && <StatsExplorer />}
      {lesson.interactive === 'chartMagic' && <ChartMagic />}
      {lesson.interactive === 'dashboard' && <Dashboard />}
      {lesson.interactive === 'predictBot' && <PredictBot />}
    </div>
  )
}

/* ============================================================
   MAIN LEARN PAGE
   ============================================================ */
export default function Learn({ tab }: { tab: string }) {
  const { lessonId } = useAppStore()

  if (!lessonId) {
    if (cinematicForTab(tab).length > 0) return <CinematicWorldMap tab={tab} />
    return <Coverflow tab={tab} />
  }

  if (isCinematic(lessonId)) return <CinematicPlayer lessonId={lessonId} />

  if (lessonId === 'launch/pitch') return <PitchStudio />
  if (lessonId === 'launch/demo') return <DemoStage />

  if (lessonId.startsWith('lab/')) {
    const labTab = lessonId.replace('lab/', '')
    return <PracticalLab tab={labTab} mode="lab" />
  }
  if (lessonId.startsWith('mindmap/')) {
    const mmTab = lessonId.replace('mindmap/', '')
    return <PracticalLab tab={mmTab} mode="mindmap" />
  }

  const lesson = LESSONS[lessonId]
  if (!lesson) return <Coverflow tab={tab} />

  if (lesson.interactive) return <Interactive id={lessonId} />

  return <LessonDeck lessonKey={lessonId} />
}
