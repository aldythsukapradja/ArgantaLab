import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft, ArrowRight, Award, BookMarked, BookOpen, CalendarDays, Check,
  ChevronLeft, ChevronRight, CirclePlay, ClipboardCheck, Clock3, Compass,
  Download, FileCheck2, FileText, Filter, Flag, FolderOpen, GraduationCap, Grid2X2,
  Layers3, Library, ListChecks, LockKeyhole, Medal, MonitorPlay, MoreHorizontal, Play,
  Presentation, RotateCcw, Search, ShieldCheck, Sparkles, Target, Trophy, Users, WandSparkles,
  X, Zap,
} from 'lucide-react';
import { FIELDCRAFT_COURSES, VOLVE_DAYS } from './catalog';
import type {
  CourseDay, CourseTab, DayScore, FieldcraftCourse, FieldcraftTab, Material,
  QuestionScope, QuizAttempt,
} from './types';
import { DAY_MAX, RUBRIC_MAX } from './types';
import { questionsFor } from './questions';
import { MISSIONS, missionsForDay } from './missions';
import {
  buildLearnerRecord, buildMaterialDoc, buildOfflinePack, COURSE_VERSION, docToMarkdown,
  downloadText, slugify,
} from './materials';
import {
  addTeam, bestAttempt, clearReturnTo, competencyProfile, gradeAttempt, isMissionComplete, leaderboard,
  missionStepsDone, PASS_MARK, pointsPossible, recordAttempt, removeTeam, renameTeam,
  setDayIndex as persistDay, setFinalUnlocked, setTeamScore, startMission, teamTotal, useSession,
} from './session';
import './fieldcraft.css';

type Surface = 'platform' | 'course' | 'trainer';
type WorkspaceId = CourseDay['workspace'];

const PLATFORM_TABS: Array<{ id: FieldcraftTab; label: string; icon: typeof GraduationCap }> = [
  { id: 'home', label: 'Home', icon: Grid2X2 },
  { id: 'catalog', label: 'Catalog', icon: Library },
  { id: 'pathways', label: 'Pathways', icon: Compass },
  { id: 'live', label: 'Live', icon: MonitorPlay },
  { id: 'passport', label: 'Passport', icon: Award },
  { id: 'studio', label: 'Studio', icon: WandSparkles },
];

const COURSE_TABS: Array<{ id: CourseTab; label: string; icon: typeof BookOpen }> = [
  { id: 'overview', label: 'Overview', icon: Grid2X2 },
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'labs', label: 'Labs', icon: Zap },
  { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
  { id: 'resources', label: 'Resources', icon: FolderOpen },
];

const MODE_ICON = {
  Brief: Flag, Theory: BookOpen, Demo: MonitorPlay, Lab: Zap,
  Challenge: Trophy, Assessment: ClipboardCheck, Break: Clock3,
} as const;

const MATERIAL_ICON = {
  Presentation, 'Instructor guide': BookMarked, 'Learner workbook': FileText,
  'Challenge pack': Trophy, Reference: Library, Assessment: ClipboardCheck,
} as const;

/** Days 1-4 carry a daily check; day 5 is the final exam. */
const dayScope = (dayNumber: number): QuestionScope => `day${dayNumber}` as QuestionScope;

function ProgressRing({ value }: { value: number }) {
  return <div className="fc-ring" style={{ '--fc-progress': `${value * 3.6}deg` } as CSSProperties}><span>{value}%</span></div>;
}

function CourseCard({ course, onOpen }: { course: FieldcraftCourse; onOpen: (course: FieldcraftCourse) => void }) {
  const coming = course.status === 'coming-soon';
  return (
    <article className={`fc-course-card ${course.status}`} style={{ '--course-accent': course.accent } as CSSProperties}>
      <div className="fc-course-cover">
        <div className="fc-contours" />
        <span className="fc-course-mark"><GraduationCap size={18} /></span>
        <span className="fc-course-status">{coming ? 'IN DEVELOPMENT' : 'FLAGSHIP · LIVE'}</span>
        <div className="fc-cover-copy"><small>{course.lifecycle}</small><b>{course.title}</b><span>{course.subtitle}</span></div>
      </div>
      <div className="fc-course-body">
        <p>{course.description}</p>
        <div className="fc-course-meta"><span><Clock3 size={12} />{course.duration}</span><span><Layers3 size={12} />{course.modules} modules</span><span><Zap size={12} />{course.labs} labs</span></div>
        <div className="fc-course-tags">{course.tags.slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}</div>
        <div className="fc-course-foot"><span><Award size={13} />{course.credential}</span><button onClick={() => onOpen(course)}>{coming ? 'Preview' : 'Open course'}<ArrowRight size={13} /></button></div>
      </div>
    </article>
  );
}

function DaySpine({ active, onSelect, compact = false }: { active: number; onSelect: (i: number) => void; compact?: boolean }) {
  return (
    <div className={`fc-day-spine ${compact ? 'compact' : ''}`}>
      {VOLVE_DAYS.map((day, i) => (
        <button key={day.id} className={active === i ? 'active' : ''} onClick={() => onSelect(i)} style={{ '--day': day.color } as CSSProperties}>
          <span className="fc-day-number">{day.number}</span>
          <span className="fc-day-copy"><small>DAY {String(day.number).padStart(2, '0')} · {day.lifecycle}</small><b>{day.verb}</b>{!compact && <em>{day.title}</em>}</span>
          {i < VOLVE_DAYS.length - 1 && <span className="fc-day-line" />}
        </button>
      ))}
    </div>
  );
}

function Presenter({ day, onClose }: { day: CourseDay; onClose: () => void }) {
  const [slide, setSlide] = useState(0);
  const [notes, setNotes] = useState(true);
  const current = day.slides[slide];
  const go = (delta: number) => setSlide((n) => (n + delta + day.slides.length) % day.slides.length);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  return (
    <div className="fc-presenter" role="dialog" aria-modal="true" aria-label={`${day.title} presentation`}>
      <header><span className="fc-presenter-brand"><GraduationCap size={17} />ARGANTA <b>FIELDCRAFT</b></span><span>DAY {day.number} · {day.verb}</span><div><button onClick={() => setNotes((v) => !v)} className={notes ? 'active' : ''}><BookMarked size={14} />Notes</button><button onClick={onClose}><X size={15} />Exit</button></div></header>
      <div className="fc-presenter-body">
        <aside>
          {day.slides.map((s, i) => <button key={s.title} className={i === slide ? 'active' : ''} onClick={() => setSlide(i)}><small>{String(i + 1).padStart(2, '0')}</small><span>{s.eyebrow}</span><b>{s.title}</b></button>)}
        </aside>
        <main>
          <div className="fc-slide" style={{ '--day': day.color } as CSSProperties}>
            <div className="fc-slide-grid" />
            <span className="fc-slide-eyebrow">{current.eyebrow}</span>
            <h1>{current.title}</h1>
            <p>{current.body}</p>
            {current.bullets && <div className="fc-slide-bullets">{current.bullets.map((b, i) => <span key={b}><i>{String(i + 1).padStart(2, '0')}</i>{b}</span>)}</div>}
            <footer><span>THE VOLVE MISSION · FROM DISCOVERY TO DECISION</span><b>{slide + 1} / {day.slides.length}</b></footer>
          </div>
          {notes && <div className="fc-speaker-note"><BookMarked size={14} /><div><b>Facilitator note</b><p>{current.note}</p></div></div>}
          <div className="fc-presenter-nav"><button onClick={() => go(-1)}><ChevronLeft size={18} /></button><span>{slide + 1} of {day.slides.length}</span><button onClick={() => go(1)}><ChevronRight size={18} /></button></div>
        </main>
      </div>
    </div>
  );
}

function MaterialPreview({ material, day, onClose, onPresent }: { material: Material; day: CourseDay; onClose: () => void; onPresent: () => void }) {
  const Icon = MATERIAL_ICON[material.kind];
  const doc = useMemo(() => buildMaterialDoc(material, day), [material, day]);
  const [showInstructor, setShowInstructor] = useState(false);
  const visible = doc.sections.filter((s) => !s.instructorOnly || showInstructor);
  const withheld = doc.sections.filter((s) => s.instructorOnly).length;

  return (
    <div className="fc-modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <div className="fc-material-modal" role="dialog" aria-modal="true">
        <header><span style={{ '--day': day.color } as CSSProperties}><Icon size={18} /></span><div><small>{material.kind.toUpperCase()} · DAY {day.number} · v{doc.version}</small><b>{material.title}</b></div><button onClick={onClose}><X size={16} /></button></header>
        <div className="fc-material-preview">
          <div className="fc-doc" style={{ '--day': day.color } as CSSProperties}>
            <div className="fc-doc-band" />
            <header><span>ARGANTA FIELDCRAFT</span><h2>{doc.title}</h2><small>{doc.subtitle}</small></header>
            {visible.map((s) => (
              <section key={s.heading} className={s.instructorOnly ? 'instructor' : ''}>
                <h3>{s.heading}{s.instructorOnly && <em><LockKeyhole size={10} />INSTRUCTOR</em>}</h3>
                {s.body && s.body.split('\n').map((line) => <p key={line}>{line}</p>)}
                {s.items && <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>}
                {s.rows && <dl>{s.rows.map(([a, b]) => <div key={a + b}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>}
                {s.steps && <ol>{s.steps.map((st) => <li key={st.title}><b>{st.title}</b><span>{st.detail}</span><i>Capture: {st.capture}</i></li>)}</ol>}
                {s.qa && <ol className="fc-doc-qa">{s.qa.map((item) => <li key={item.q}><b>{item.q}</b><span>{item.a}</span><i>{item.why}</i></li>)}</ol>}
                {s.note && <aside><BookMarked size={11} />{s.note}</aside>}
              </section>
            ))}
            {withheld > 0 && !showInstructor && (
              <button className="fc-doc-reveal" onClick={() => setShowInstructor(true)}>
                <LockKeyhole size={13} />Reveal {withheld} instructor-only section{withheld === 1 ? '' : 's'}
              </button>
            )}
            <footer>THE VOLVE MISSION · COURSE VERSION {doc.version}</footer>
          </div>
          <div className="fc-material-info">
            <span className="fc-ready"><Check size={12} />{material.status}</span>
            <h3>Compiled from the course source</h3>
            <p>This material is generated from Day {day.number}’s slides, run of show, missions and question bank — so it cannot drift from what you deliver.</p>
            <dl><div><dt>Format</dt><dd>{material.kind}</dd></div><div><dt>Contents</dt><dd>{material.meta}</dd></div><div><dt>Sections</dt><dd>{doc.sections.length}</dd></div><div><dt>Course version</dt><dd>Volve Mission · {doc.version}</dd></div></dl>
            <div className="fc-modal-actions">
              {material.kind === 'Presentation' && <button className="primary" onClick={onPresent}><Play size={14} />Start presentation</button>}
              <button onClick={() => downloadText(`${slugify(material.title)}.md`, docToMarkdown(doc))}><Download size={14} />Export material</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SCOPE_LABEL: Record<QuestionScope, string> = {
  day1: 'Day 1 · Discover knowledge check',
  day2: 'Day 2 · Describe & Design knowledge check',
  day3: 'Day 3 · Deliver knowledge check',
  day4: 'Day 4 · Operate knowledge check',
  final: 'Foundation final exam',
};

/** Sit an assessment, then review every question against its explanation. */
function QuizRunner({ scope, onClose }: { scope: QuestionScope; onClose: () => void }) {
  const questions = useMemo(() => questionsFor(scope), [scope]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [confirming, setConfirming] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const current = questions[index];

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const submit = () => {
    const attempt = gradeAttempt(scope, questions, answers);
    recordAttempt(attempt);
    setResult(attempt);
    setConfirming(false);
  };

  if (!questions.length) return null;

  if (result) {
    const pct = Math.round((result.correct / result.total) * 100);
    return (
      <div className="fc-quiz" role="dialog" aria-modal="true" aria-label={`${SCOPE_LABEL[scope]} result`}>
        <header>
          <span className="fc-quiz-brand"><ClipboardCheck size={16} />{SCOPE_LABEL[scope]}</span>
          <button onClick={onClose}><X size={15} />Close</button>
        </header>
        <div className="fc-quiz-result">
          <div className={`fc-result-card ${result.passed ? 'pass' : 'fail'}`}>
            <span>{result.passed ? <Medal size={26} /> : <MoreHorizontal size={26} />}</span>
            <b>{pct}%</b>
            <small>{result.correct} of {result.total} correct</small>
            <em>{result.passed ? 'PASSED' : `NOT YET — ${Math.round(PASS_MARK * 100)}% REQUIRED`}</em>
          </div>
          <div className="fc-result-review">
            <h3>Review</h3>
            {questions.map((q, i) => {
              const chosen = result.answers[q.id];
              const right = chosen === q.answer;
              return (
                <article key={q.id} className={right ? 'right' : 'wrong'}>
                  <header><i>{String(i + 1).padStart(2, '0')}</i><b>{q.stem}</b><em>{right ? <Check size={13} /> : <X size={13} />}</em></header>
                  <ul>
                    {q.options.map((opt, oi) => (
                      <li key={opt} className={oi === q.answer ? 'key' : oi === chosen ? 'chose' : ''}>
                        <span>{String.fromCharCode(65 + oi)}</span>{opt}
                      </li>
                    ))}
                  </ul>
                  <p><b>Why.</b> {q.explanation}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-quiz" role="dialog" aria-modal="true" aria-label={SCOPE_LABEL[scope]}>
      <header>
        <span className="fc-quiz-brand"><ClipboardCheck size={16} />{SCOPE_LABEL[scope]}</span>
        <span className="fc-quiz-progress">{answeredCount} of {questions.length} answered</span>
        <button onClick={onClose}><X size={15} />Exit</button>
      </header>
      <div className="fc-quiz-body">
        <nav className="fc-quiz-palette" aria-label="Question navigator">
          {questions.map((q, i) => (
            <button
              key={q.id}
              className={`${i === index ? 'active' : ''} ${answers[q.id] !== undefined ? 'done' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Question ${i + 1}${answers[q.id] !== undefined ? ', answered' : ''}`}
            >{i + 1}</button>
          ))}
        </nav>
        <main>
          <span className="fc-quiz-count">QUESTION {index + 1} OF {questions.length}</span>
          <h2>{current.stem}</h2>
          <div className="fc-quiz-options">
            {current.options.map((opt, oi) => (
              <button
                key={opt}
                className={answers[current.id] === oi ? 'chosen' : ''}
                aria-pressed={answers[current.id] === oi}
                onClick={() => setAnswers((a) => ({ ...a, [current.id]: oi }))}
              ><span>{String.fromCharCode(65 + oi)}</span>{opt}</button>
            ))}
          </div>
          <footer className="fc-quiz-nav">
            <button onClick={() => setIndex((n) => Math.max(0, n - 1))} disabled={index === 0}><ChevronLeft size={15} />Previous</button>
            {index < questions.length - 1
              ? <button className="primary" onClick={() => setIndex((n) => n + 1)}>Next<ChevronRight size={15} /></button>
              : <button className="primary" onClick={() => (answeredCount === questions.length ? submit() : setConfirming(true))}><Check size={15} />Submit</button>}
          </footer>
          {confirming && (
            <div className="fc-quiz-confirm" role="alert">
              <p>{questions.length - answeredCount} question{questions.length - answeredCount === 1 ? '' : 's'} unanswered. Unanswered questions are marked incorrect.</p>
              <div>
                <button onClick={() => setConfirming(false)}>Keep working</button>
                <button className="primary" onClick={submit}>Submit anyway</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Instructor-facing team scoring against the published 40/20/20/20 rubric. */
function CompetitionControls({ dayId, dayLabel, onClose }: { dayId: string; dayLabel: string; onClose: () => void }) {
  const session = useSession();
  const [name, setName] = useState('');
  const criteria: Array<{ key: keyof DayScore; label: string }> = [
    { key: 'workflow', label: 'WORKFLOW' }, { key: 'evidence', label: 'EVIDENCE' },
    { key: 'decision', label: 'DECISION' }, { key: 'quiz', label: 'QUIZ + TEAM' },
  ];
  return (
    <div className="fc-modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <div className="fc-scoring-modal" role="dialog" aria-modal="true" aria-label="Competition controls">
        <header>
          <div><small>COMPETITION CONTROLS</small><b>{dayLabel}</b></div>
          <button onClick={onClose}><X size={16} /></button>
        </header>
        <div className="fc-scoring-table">
          <div className="fc-scoring-head"><span>TEAM</span>{criteria.map((c) => <span key={c.key}>{c.label}<i>/{RUBRIC_MAX[c.key]}</i></span>)}<span>DAY</span><span>TOTAL</span><span /></div>
          {session.teams.map((team) => {
            const score = team.scores[dayId] ?? { workflow: 0, evidence: 0, decision: 0, quiz: 0 };
            const dayTotal = score.workflow + score.evidence + score.decision + score.quiz;
            return (
              <div className="fc-scoring-row" key={team.id}>
                <label>
                  <i style={{ background: team.color }} />
                  <input value={team.name} onChange={(e) => renameTeam(team.id, e.target.value)} aria-label={`${team.name} name`} />
                </label>
                {criteria.map((c) => (
                  <input
                    key={c.key} type="number" min={0} max={RUBRIC_MAX[c.key]} value={score[c.key]}
                    aria-label={`${team.name} ${c.label}`}
                    onChange={(e) => setTeamScore(team.id, dayId, { [c.key]: Number(e.target.value) } as Partial<DayScore>)}
                  />
                ))}
                <span className="fc-scoring-day">{dayTotal}<i>/{DAY_MAX}</i></span>
                <span className="fc-scoring-total">{teamTotal(team)}</span>
                <button onClick={() => removeTeam(team.id)} aria-label={`Remove ${team.name}`}><X size={13} /></button>
              </div>
            );
          })}
        </div>
        <footer>
          <form onSubmit={(e) => { e.preventDefault(); addTeam(name); setName(''); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a team" aria-label="New team name" />
            <button type="submit" disabled={!name.trim()}>Add team</button>
          </form>
          <span>{pointsPossible(session)} pts scored across the cohort</span>
        </footer>
      </div>
    </div>
  );
}

export function Fieldcraft({ onOpenWorkspace }: { onOpenWorkspace: (id: WorkspaceId) => void }) {
  const [tab, setTab] = useState<FieldcraftTab>('home');
  const [surface, setSurface] = useState<Surface>('platform');
  const [course, setCourse] = useState<FieldcraftCourse>(FIELDCRAFT_COURSES[0]);
  const [courseTab, setCourseTab] = useState<CourseTab>('overview');
  const session = useSession();
  const dayIndex = session.dayIndex;
  const setDayIndex = persistDay;
  const [presenting, setPresenting] = useState(false);
  const [material, setMaterial] = useState<Material | null>(null);
  const [quiz, setQuiz] = useState<QuestionScope | null>(null);
  const [scoring, setScoring] = useState(false);
  const activeDay = VOLVE_DAYS[dayIndex];

  // Coming back from a mission should land on the Labs board, not on Home.
  useEffect(() => {
    if (session.returnTo !== 'labs') return;
    setCourse(FIELDCRAFT_COURSES[0]);
    setCourseTab('labs');
    setSurface('course');
    clearReturnTo();
  }, [session.returnTo]);

  const allMaterials = useMemo(() => VOLVE_DAYS.flatMap((d) => d.materials.map((m) => ({ material: m, day: d }))), []);
  const openCourse = (next: FieldcraftCourse) => { setCourse(next); setCourseTab('overview'); setSurface('course'); };
  const openTrainer = (index = dayIndex) => { setDayIndex(index); setSurface('trainer'); };
  const goPlatform = (next: FieldcraftTab = 'home') => { setSurface('platform'); setTab(next); };

  const shellHeader = (
    <>
      <header className="fc-header">
        <div className="fc-heading"><span><GraduationCap size={17} /></span><div><b>Fieldcraft</b><small>Learn the workflow · Work the evidence · Prove the decision</small></div></div>
        <div className="fc-header-context"><span className="fc-live-dot" />Training platform <b>· 2 courses</b></div>
        <div className="fc-header-actions"><button><Search size={14} /><span>Search</span></button><button><Users size={14} /><span>Cohort</span></button><span className="fc-faculty">AF</span></div>
      </header>
      {surface === 'platform' && <nav className="fc-tabs" aria-label="Fieldcraft"><div>{PLATFORM_TABS.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><item.icon size={13} />{item.label}{item.id === 'studio' && <i>FACULTY</i>}</button>)}</div></nav>}
    </>
  );

  return (
    <div className="fc-shell">
      {shellHeader}
      {surface === 'platform' && (
        <div className="fc-scroll">
          {tab === 'home' && <Home onOpenCourse={() => openCourse(FIELDCRAFT_COURSES[0])} onTrainer={() => openTrainer(0)} onCatalog={() => setTab('catalog')} />}
          {tab === 'catalog' && <Catalog onOpen={openCourse} />}
          {tab === 'pathways' && <Pathways onOpen={openCourse} />}
          {tab === 'live' && <Live onTrainer={openTrainer} />}
          {tab === 'passport' && <Passport />}
          {tab === 'studio' && <Studio onOpen={openCourse} />}
        </div>
      )}
      {surface === 'course' && <CourseWorkspace course={course} tab={courseTab} setTab={setCourseTab} dayIndex={dayIndex} setDayIndex={setDayIndex} onBack={() => goPlatform('catalog')} onTrainer={() => openTrainer(dayIndex)} onPresent={() => setPresenting(true)} onOpenWorkspace={onOpenWorkspace} onMaterial={(m) => setMaterial(m)} onQuiz={setQuiz} />}
      {surface === 'trainer' && <TrainerConsole dayIndex={dayIndex} setDayIndex={setDayIndex} onBack={() => { setSurface('course'); setCourse(FIELDCRAFT_COURSES[0]); }} onPresent={() => setPresenting(true)} onOpenWorkspace={onOpenWorkspace} onMaterial={(m) => setMaterial(m)} allMaterials={allMaterials} onScoring={() => setScoring(true)} onAllMaterials={() => { setCourse(FIELDCRAFT_COURSES[0]); setCourseTab('resources'); setSurface('course'); }} />}
      {presenting && <Presenter day={activeDay} onClose={() => setPresenting(false)} />}
      {material && <MaterialPreview material={material} day={activeDay} onClose={() => setMaterial(null)} onPresent={() => { setMaterial(null); setPresenting(true); }} />}
      {quiz && <QuizRunner scope={quiz} onClose={() => setQuiz(null)} />}
      {scoring && <CompetitionControls dayId={activeDay.id} dayLabel={`Day ${activeDay.number} · ${activeDay.verb}`} onClose={() => setScoring(false)} />}
    </div>
  );
}

function Home({ onOpenCourse, onTrainer, onCatalog }: { onOpenCourse: () => void; onTrainer: () => void; onCatalog: () => void }) {
  return (
    <div className="fc-page fc-home">
      <section className="fc-hero">
        <div className="fc-hero-map"><div className="fc-contours" /><span className="fc-coordinate">58.44°N · 1.89°E</span><div className="fc-hero-copy"><span className="fc-kicker"><Sparkles size={12} />FLAGSHIP FIELD EXPERIENCE</span><h1>The Volve Mission</h1><h2>From Discovery to Decision</h2><p>One real North Sea field. Every upstream lifecycle. Five days of evidence, workspaces and decisions.</p><div className="fc-hero-actions"><button className="primary" onClick={onTrainer}><MonitorPlay size={16} />Open trainer console</button><button onClick={onOpenCourse}><BookOpen size={16} />View course</button></div></div><div className="fc-field-seal"><span>FIELD</span><b>VOLVE</b><small>NORTH SEA</small></div></div>
        <aside className="fc-ready-panel"><div className="fc-ready-top"><span><ShieldCheck size={15} />DELIVERY STATUS</span><b>Course ready</b></div><div className="fc-ready-score"><ProgressRing value={92} /><div><b>92%</b><span>material readiness</span></div></div><div className="fc-ready-list"><span><Check size={13} />5 day agendas</span><span><Check size={13} />30 presentation slides</span><span><Check size={13} />8 guided labs</span><span><Check size={13} />20 trainer resources</span><span className="review"><MoreHorizontal size={13} />Final exam in review</span></div><button onClick={onTrainer}><CirclePlay size={15} />Launch Day 1</button></aside>
      </section>

      <section className="fc-metric-row"><div><b>2</b><span>COURSES</span><small>1 flagship · 1 in development</small></div><div><b>5</b><span>LIFECYCLE DAYS</span><small>40 guided training hours</small></div><div><b>8</b><span>REAL APP LABS</span><small>Existing engines and evidence</small></div><div><b>1</b><span>PASSPORT</span><small>Foundation credential</small></div></section>

      <section className="fc-section"><div className="fc-section-head"><div><span>THE FIELD JOURNEY</span><h3>Five days. One connected decision.</h3></div><button onClick={onOpenCourse}>Open full syllabus<ArrowRight size={13} /></button></div><DaySpine active={0} onSelect={onTrainer} /></section>

      <section className="fc-home-grid">
        <div className="fc-panel fc-continue"><div className="fc-panel-head"><span><CirclePlay size={14} />CONTINUE</span><small>Instructor view</small></div><div className="fc-continue-body"><span className="fc-big-day">01</span><div><small>DAY 1 · EXPLORATION</small><h3>Discover · Frame the opportunity</h3><p>Evidence maturity, petroleum systems, risk and volume.</p><div className="fc-progress-bar"><i style={{ width: '68%' }} /></div><span>Presentation and demo route prepared</span></div></div><footer><button onClick={onTrainer}><Play size={14} />Resume trainer setup</button><button onClick={onOpenCourse}>Course outline</button></footer></div>
        <div className="fc-panel fc-next-course"><div className="fc-panel-head"><span><Compass size={14} />NEXT IN CATALOG</span><small>Author pilot</small></div><div className="fc-mini-cover"><div className="fc-contours" /><span>EXPLORATION VERTICAL PASSPORT</span><h3>Basin to Prospect</h3><p>Built by the Founding Exploration Instructor through Studio.</p></div><footer><span><Clock3 size={12} />In development</span><button onClick={onCatalog}>Preview course<ArrowRight size={13} /></button></footer></div>
      </section>
    </div>
  );
}

function Catalog({ onOpen }: { onOpen: (c: FieldcraftCourse) => void }) {
  return <div className="fc-page"><section className="fc-page-title"><div><span>COURSE CATALOG</span><h1>Learn through real field decisions.</h1><p>Flagship programs, vertical passports and focused workflow masterclasses—all connected to ArgantaEnergy.</p></div><button><Filter size={14} />Filters</button></section><div className="fc-catalog-tools"><label><Search size={15} /><input placeholder="Search courses, skills or instructors" /></label><div><button className="active">All</button><button>Flagships</button><button>Verticals</button><button>Live</button><button>Coming soon</button></div></div><section className="fc-course-grid">{FIELDCRAFT_COURSES.map((c) => <CourseCard key={c.id} course={c} onOpen={onOpen} />)}<article className="fc-add-course"><span><WandSparkles size={22} /></span><h3>Build the next Fieldcraft course</h3><p>Start from a reviewed vertical or masterclass template in Studio.</p><button>Create in Studio<ArrowRight size={13} /></button></article></section></div>;
}

function Pathways({ onOpen }: { onOpen: (c: FieldcraftCourse) => void }) {
  return <div className="fc-page"><section className="fc-page-title"><div><span>LEARNING PATHWAYS</span><h1>Build capability across the lifecycle.</h1><p>Courses accumulate into role-ready, evidence-backed passports.</p></div></section><section className="fc-pathway-hero"><div className="fc-pathway-copy"><span className="fc-kicker"><Target size={12} />FOUNDATION PATHWAY</span><h2>Integrated Geoscience Fieldcraft</h2><p>Start broad with the Volve Mission, then deepen through vertical passports.</p><button onClick={() => onOpen(FIELDCRAFT_COURSES[0])}>Start with Volve<ArrowRight size={13} /></button></div><div className="fc-pathway-map"><span className="done"><Check size={13} />Volve Mission</span><i /><span className="next">Exploration</span><i /><span>Field Development</span><i /><span>Well Delivery</span><i /><span>Reservoir Management</span></div></section><section className="fc-section"><div className="fc-section-head"><div><span>PROFICIENCY LADDER</span><h3>Progress is tied to demonstrated evidence.</h3></div></div><div className="fc-levels">{[['L1','Awareness','Recognize concepts and evidence'],['L2','Practitioner','Execute a guided workflow'],['L3','Advanced','Select methods and defend decisions'],['L4','Expert','Integrate, govern and mentor']].map(([l,t,d],i)=><div className={i<2?'active':''} key={l}><span>{l}</span><b>{t}</b><small>{d}</small></div>)}</div></section></div>;
}

function Live({ onTrainer }: { onTrainer: (i?: number) => void }) {
  const [active, setActive] = useState(0);
  return <div className="fc-page"><section className="fc-page-title"><div><span>FIELDCRAFT LIVE</span><h1>Run the entire classroom from one place.</h1><p>Agenda, presentation, demonstrations, teams, scoring and materials stay connected to the course version.</p></div><button className="fc-primary-btn" onClick={() => onTrainer(active)}><MonitorPlay size={14} />Open trainer console</button></section><section className="fc-live-status"><div><span className="fc-live-dot" /><small>UPCOMING COHORT</small><h3>Volve Mission · Enterprise Pilot</h3><p>Doha · 18 participants · 5 teams</p></div><dl><div><dt>START</dt><dd>18 Aug 2026</dd></div><div><dt>COURSE PACK</dt><dd>v1.0 · Synced</dd></div><div><dt>ROOM CHECK</dt><dd className="good">Ready</dd></div></dl><button onClick={() => onTrainer(active)}>Prepare session<ArrowRight size={13} /></button></section><section className="fc-section"><div className="fc-section-head"><div><span>FIVE-DAY AGENDA</span><h3>Select a day to prepare or launch.</h3></div></div><DaySpine active={active} onSelect={setActive} /><div className="fc-day-brief" style={{ '--day': VOLVE_DAYS[active].color } as CSSProperties}><span>DAY {active+1}</span><div><small>{VOLVE_DAYS[active].lifecycle}</small><h3>{VOLVE_DAYS[active].verb} · {VOLVE_DAYS[active].title}</h3><p>{VOLVE_DAYS[active].question}</p></div><button onClick={() => onTrainer(active)}><Play size={14} />Open day</button></div></section></div>;
}

/* The evidence portfolio is the mission outputs, plus the capstone behind the exam. */
const PORTFOLIO: Array<{ label: string; missionId?: string }> = [
  { label: 'Exploration Gate Card', missionId: 'm-d1-screen' },
  { label: 'Development Case Card', missionId: 'm-d2-compare' },
  { label: 'Well Gate Card', missionId: 'm-d3-slot' },
  { label: 'Reservoir Action Card', missionId: 'm-d4-action' },
  { label: 'Integrated Field Decision' },
];

const COMPETENCY_LABEL: Array<[keyof ReturnType<typeof competencyProfile>, string]> = [
  ['evidence', 'Evidence & provenance'],
  ['exploration', 'Exploration framing'],
  ['field-development', 'Field development'],
  ['well-delivery', 'Well delivery'],
  ['reservoir-management', 'Reservoir management'],
  ['integrated', 'Integrated decisions'],
];

function Passport() {
  const session = useSession();
  const profile = competencyProfile(session);
  const measured = COMPETENCY_LABEL.map(([key]) => profile[key]).filter((v): v is number => typeof v === 'number');
  const overall = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : 0;
  const earned = VOLVE_DAYS.map((d) => {
    if (d.number === 5) return bestAttempt(session, 'final')?.passed === true;
    return bestAttempt(session, dayScope(d.number))?.passed === true;
  });
  return <div className="fc-page"><section className="fc-page-title"><div><span>FIELDCRAFT PASSPORT</span><h1>Achievement with evidence behind it.</h1><p>Competencies, artifacts and credentials remain connected to the exact course and assessment versions.</p></div><button onClick={()=>downloadText(`fieldcraft-passport-${slugify(session.cohort)}.md`, buildLearnerRecord(session))}><Download size={14} />Export record</button></section><section className="fc-passport-grid"><div className="fc-passport-card"><div className="fc-passport-glow" /><header><span><Award size={19} /></span><div><small>ARGANTA FIELDCRAFT PASSPORT</small><b>Integrated Geoscience · Foundation</b></div></header><div className="fc-passport-person"><span>AF</span><div><small>LEARNER</small><h2>Fieldcraft Candidate</h2><p>{session.cohort}</p></div></div><div className="fc-stamp-row">{VOLVE_DAYS.map((d,i)=><span key={d.id} className={earned[i]?'earned':''} style={{'--day':d.color} as CSSProperties}><b>{d.verb.split(' ')[0]}</b><small>{earned[i]?'EARNED':'PENDING'}</small></span>)}</div><footer><span>Credential criteria · v1.0</span><b>{Math.round(PASS_MARK*100)}% PASS STANDARD</b></footer></div><div className="fc-competency-panel"><header><div><small>COMPETENCY PROFILE</small><h3>Foundation progress</h3></div><ProgressRing value={overall} /></header>{COMPETENCY_LABEL.map(([key,label])=>{const v=profile[key];return <div className="fc-skill" key={key}><span>{label}</span><b>{typeof v==='number'?`${v}%`:'—'}</b><i><em style={{width:`${v??0}%`}} /></i></div>})}
    <p className="fc-competency-note">{measured.length?'Derived from submitted assessments.':'Sit a knowledge check to build this profile.'}</p>
    <button><ShieldCheck size={14} />Verification preview</button></div></section><section className="fc-section"><div className="fc-section-head"><div><span>EVIDENCE PORTFOLIO</span><h3>Artifacts collected through the field journey.</h3></div></div><div className="fc-artifacts">{PORTFOLIO.map(({label,missionId})=>{
    const held = missionId ? isMissionComplete(session,missionId) : bestAttempt(session,'final')?.passed === true;
    return <div className={held?'done':''} key={label}><span>{held?<Check size={14}/>:<LockKeyhole size={14}/>}</span><div><b>{label}</b><small>{held?'Submitted · evidence linked':missionId?'Complete the guided mission':'Unlocks after the final exam'}</small></div></div>;
  })}</div></section></div>;
}

function Studio({ onOpen }: { onOpen: (c: FieldcraftCourse) => void }) {
  return <div className="fc-page"><section className="fc-page-title"><div><span>FIELDCRAFT STUDIO</span><h1>Turn expertise into a governed course.</h1><p>Build lessons, app missions, question banks and live cohorts without editing the product code.</p></div><button className="fc-primary-btn"><WandSparkles size={14} />New course</button></section><section className="fc-studio-metrics"><div><b>2</b><span>COURSES</span><small>1 live · 1 draft</small></div><div><b>30</b><span>LESSON BLOCKS</span><small>Reusable content</small></div><div><b>20</b><span>MATERIALS</span><small>19 ready · 1 review</small></div><div><b>6</b><span>REVIEW ITEMS</span><small>Needs faculty action</small></div></section><section className="fc-studio-grid"><div className="fc-panel"><div className="fc-panel-head"><span><Library size={14} />COURSES</span><button><MoreHorizontal size={14} /></button></div>{FIELDCRAFT_COURSES.map((c)=><button className="fc-studio-course" key={c.id} onClick={() => onOpen(c)} style={{'--course-accent':c.accent} as CSSProperties}><span><GraduationCap size={15}/></span><div><b>{c.title}</b><small>{c.status === 'coming-soon'?'Draft · author pilot':'Published · v1.0'}</small></div><em>{c.modules} modules</em><ArrowRight size={13}/></button>)}</div><div className="fc-panel fc-author-flow"><div className="fc-panel-head"><span><WandSparkles size={14} />EXPLORATION AUTHOR PILOT</span><small>4 / 7 complete</small></div>{['Course outcomes','Module spine','Theory & presentations','App missions','Question bank','Faculty review','Publish version'].map((s,i)=><div className={i<4?'done':i===4?'active':''} key={s}><span>{i<4?<Check size={12}/>:i+1}</span><b>{s}</b><small>{i<4?'Complete':i===4?'Next action':'Pending'}</small></div>)}</div></section><section className="fc-section"><div className="fc-section-head"><div><span>REUSABLE COURSE FACTORY</span><h3>Everything the next instructor needs.</h3></div></div><div className="fc-tool-grid">{[[Layers3,'Outline builder','Modules and outcomes'],[Presentation,'Content library','Decks, media and notes'],[Zap,'App mission builder','Routes, steps and evidence'],[ListChecks,'Question bank','Blueprints and feedback'],[FileCheck2,'Review queue','Technical and assessment QA'],[Users,'Live cohorts','Agenda, teams and reports']].map(([Icon,t,d])=><div key={String(t)}><span><Icon size={17}/></span><b>{String(t)}</b><small>{String(d)}</small></div>)}</div></section></div>;
}

function CourseWorkspace({ course, tab, setTab, dayIndex, setDayIndex, onBack, onTrainer, onPresent, onOpenWorkspace, onMaterial, onQuiz }: { course: FieldcraftCourse; tab: CourseTab; setTab: (t: CourseTab)=>void; dayIndex:number; setDayIndex:(i:number)=>void; onBack:()=>void; onTrainer:()=>void; onPresent:()=>void; onOpenWorkspace:(id:WorkspaceId)=>void; onMaterial:(m:Material)=>void; onQuiz:(s:QuestionScope)=>void }) {
  const day = VOLVE_DAYS[dayIndex];
  const coming = course.status === 'coming-soon';
  return <div className="fc-course-shell"><header className="fc-course-nav"><button onClick={onBack}><ArrowLeft size={14} />Catalog</button><div><small>{course.lifecycle}</small><b>{course.title} · {course.subtitle}</b></div><span className="fc-course-nav-spacer"/><button><MoreHorizontal size={15}/></button>{!coming&&<button className="primary" onClick={onTrainer}><MonitorPlay size={14}/>Trainer console</button>}</header><nav className="fc-course-tabs">{COURSE_TABS.map((item)=><button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><item.icon size={13}/>{item.label}</button>)}</nav><div className="fc-course-scroll">
    {tab==='overview'&&<><section className="fc-course-hero" style={{'--course-accent':course.accent} as CSSProperties}><div className="fc-contours"/><span className="fc-course-status">{coming?'INSTRUCTOR AUTHOR PILOT':'FLAGSHIP · ENTERPRISE READY'}</span><div><small>{course.lifecycle}</small><h1>{course.title}</h1><h2>{course.subtitle}</h2><p>{course.description}</p><div className="fc-course-hero-actions">{coming?<button className="primary"><WandSparkles size={15}/>Open author draft</button>:<><button className="primary" onClick={()=>setTab('learn')}><Play size={15}/>Open Day {dayIndex+1}</button><button onClick={onPresent}><Presentation size={15}/>Start presentation</button></>}</div></div><aside><dl><div><dt>DURATION</dt><dd>{course.duration}</dd></div><div><dt>LEVEL</dt><dd>{course.level}</dd></div><div><dt>DELIVERY</dt><dd>{course.delivery.join(' · ')}</dd></div><div><dt>CREDENTIAL</dt><dd>{course.credential}</dd></div></dl></aside></section>{!coming&&<section className="fc-section"><div className="fc-section-head"><div><span>COURSE SYLLABUS</span><h3>One decision thread across five lifecycle days.</h3></div></div><DaySpine active={dayIndex} onSelect={(i)=>{setDayIndex(i);setTab('learn')}}/></section>}</>}
    {tab==='learn'&&!coming&&<DayLearn day={day} onPresent={onPresent} onOpenWorkspace={onOpenWorkspace}/>}
    {tab==='labs'&&!coming&&<Labs days={VOLVE_DAYS} onOpenWorkspace={onOpenWorkspace}/>}
    {tab==='assessments'&&!coming&&<Assessments onQuiz={onQuiz}/>}
    {tab==='resources'&&!coming&&<Resources days={VOLVE_DAYS} onMaterial={(m,d)=>{setDayIndex(d.number-1);onMaterial(m)}}/>}
    {coming&&tab!=='overview'&&<div className="fc-coming"><span><Compass size={24}/></span><h2>Exploration course workspace</h2><p>The Founding Exploration Instructor will assemble this course through Studio using the existing Exploration workflow groups.</p><button><WandSparkles size={14}/>Open author pilot</button></div>}
  </div></div>;
}

function DayLearn({ day, onPresent, onOpenWorkspace }: { day: CourseDay; onPresent:()=>void; onOpenWorkspace:(id:WorkspaceId)=>void }) {
  return <div className="fc-day-page"><header style={{'--day':day.color} as CSSProperties}><span>DAY {String(day.number).padStart(2,'0')} · {day.lifecycle}</span><h1>{day.verb} · {day.title}</h1><p>{day.question}</p><div><button className="primary" onClick={onPresent}><Presentation size={14}/>Start presentation</button><button onClick={()=>onOpenWorkspace(day.workspace)}><MonitorPlay size={14}/>Open workspace</button></div></header><div className="fc-day-layout"><main><section className="fc-panel"><div className="fc-panel-head"><span><CalendarDays size={14}/>TODAY'S AGENDA</span><small>08:30–16:30</small></div><div className="fc-agenda">{day.schedule.map((s,i)=>{const Icon=MODE_ICON[s.mode];return <div className={s.mode.toLowerCase()} key={`${s.time}-${i}`}><time>{s.time}</time><span><Icon size={13}/></span><div><b>{s.label}</b><small>{s.detail}</small></div><em>{s.mode}</em></div>})}</div></section></main><aside><section className="fc-panel fc-mission-card"><div className="fc-panel-head"><span><Target size={14}/>MISSION OUTPUT</span></div><span className="fc-mission-icon" style={{background:day.color}}><Flag size={18}/></span><h3>{day.outcome}</h3><p>Technical workflow, evidence quality, decision rationale and team communication are scored.</p><dl><div><dt>WORKFLOW</dt><dd>40 pts</dd></div><div><dt>EVIDENCE</dt><dd>20 pts</dd></div><div><dt>DECISION</dt><dd>20 pts</dd></div><div><dt>QUIZ + TEAM</dt><dd>20 pts</dd></div></dl></section><section className="fc-panel"><div className="fc-panel-head"><span><FolderOpen size={14}/>DAY MATERIALS</span><small>{day.materials.length} ready</small></div><div className="fc-quick-materials">{day.materials.map((m)=>{const Icon=MATERIAL_ICON[m.kind];return <button key={m.id}><span><Icon size={14}/></span><div><b>{m.title}</b><small>{m.meta}</small></div><ArrowRight size={12}/></button>})}</div></section></aside></div></div>;
}

function Labs({ days, onOpenWorkspace }: { days: CourseDay[]; onOpenWorkspace:(id:WorkspaceId)=>void }) {
  const session = useSession();
  const completed = MISSIONS.filter((m)=>isMissionComplete(session,m.id)).length;
  const launch = (missionId: string, workspace: WorkspaceId) => { startMission(missionId); onOpenWorkspace(workspace); };
  return <div className="fc-subpage fc-labs-page"><section className="fc-page-title"><div><span>GUIDED APP MISSIONS</span><h1>Practice inside the real lifecycle workspaces.</h1><p>Every lab pins a data scope, walks ordered steps and captures evidence as you work.</p></div><span className="fc-labs-count">{completed} / {MISSIONS.length} COMPLETE</span></section>
    <div className="fc-mission-grid">{days.slice(0,4).flatMap((d)=>missionsForDay(d.id).map((m)=>{
      const stepIds = m.steps.map((s)=>s.id);
      const done = missionStepsDone(session, m.id, stepIds);
      const complete = isMissionComplete(session, m.id);
      const started = !!session.missions[m.id];
      return <article key={m.id} className={complete?'complete':''} style={{'--day':d.color} as CSSProperties}>
        <header><small>DAY {m.dayNumber} · {d.lifecycle}</small>{complete?<em className="fc-mission-done"><Check size={11}/>COMPLETE</em>:started?<em>{done}/{m.steps.length}</em>:null}</header>
        <h3>{m.title}</h3>
        <p>{m.brief}</p>
        <div className="fc-mission-meta"><span><Target size={11}/>{m.scope}</span></div>
        <div className="fc-mission-bar"><i style={{width:`${(done/m.steps.length)*100}%`}}/></div>
        <div className="fc-mission-foot"><span><Flag size={11}/>{m.output}</span><button onClick={()=>launch(m.id,m.workspace)}><MonitorPlay size={13}/>{complete?'Review':started?'Resume':'Start'}<ArrowRight size={12}/></button></div>
      </article>;
    }))}</div></div>;
}

function Assessments({ onQuiz }: { onQuiz: (scope: QuestionScope) => void }) {
  const session = useSession();
  const finalBest = bestAttempt(session, 'final');
  return <div className="fc-subpage"><section className="fc-page-title"><div><span>ASSESSMENTS</span><h1>Measure judgment, not slide completion.</h1><p>Questions use real field artifacts and remain tied to a reviewed assessment blueprint.</p></div></section><div className="fc-assessment-grid"><article className="fc-panel"><div className="fc-panel-head"><span><ClipboardCheck size={14}/>DAILY CHECKS</span><small>4 × 10 MCQs</small></div>{VOLVE_DAYS.slice(0,4).map((d,i)=>{
    const scope = dayScope(d.number);
    const best = bestAttempt(session, scope);
    const count = questionsFor(scope).length;
    return <div className="fc-assessment-row" key={d.id}><span style={{background:d.color}}>{i+1}</span><div><b>{d.verb} knowledge check</b><small>{count} questions · {Math.round(PASS_MARK*100)}% pass · explanations on review</small></div>{best ? <em className={best.passed?'ready':'review'}>{Math.round((best.correct/best.total)*100)}%</em> : <em className="draft">Not sat</em>}<button onClick={()=>onQuiz(scope)} aria-label={`${best?'Retake':'Start'} ${d.verb} knowledge check`}>{best?<RotateCcw size={13}/>:<ArrowRight size={13}/>}</button></div>;
  })}</article><article className="fc-final-card"><span><Medal size={22}/></span><small>FOUNDATION FINAL EXAM</small><h2>{questionsFor('final').length} scenario-led questions</h2><p>75 minutes · {Math.round(PASS_MARK*100)}% pass · two attempts after remediation</p><dl><div><dt>Evidence &amp; provenance</dt><dd>7</dd></div><div><dt>Exploration</dt><dd>9</dd></div><div><dt>Field development</dt><dd>12</dd></div><div><dt>Well delivery</dt><dd>9</dd></div><div><dt>Reservoir management</dt><dd>9</dd></div><div><dt>Integrated decisions</dt><dd>4</dd></div></dl>
    {finalBest && <div className="fc-final-result"><b>{Math.round((finalBest.correct/finalBest.total)*100)}%</b><span>{finalBest.passed?'Passed':'Not yet passed'} · {finalBest.correct}/{finalBest.total}</span></div>}
    {session.finalUnlocked
      ? <button className="primary" onClick={()=>onQuiz('final')}><Play size={14}/>{finalBest?'Retake final exam':'Start final exam'}</button>
      : <button onClick={()=>setFinalUnlocked(true)}><LockKeyhole size={14}/>Instructor unlock required</button>}
  </article></div></div>;
}

const RESOURCE_ROW_H = 44;

/** Rows per page are derived from the space the table actually has, so the library
 *  stays a single-viewport canvas without ever dropping a material off the bottom. */
function useFittedRows(ref: React.RefObject<HTMLDivElement | null>, total: number) {
  const [perPage, setPerPage] = useState(8);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (window.matchMedia('(max-width: 820px)').matches) { setPerPage(Math.max(1, total)); return; }
      const body = el.clientHeight - 32; // table header row
      setPerPage(Math.max(4, Math.floor(body / RESOURCE_ROW_H)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [ref, total]);
  return perPage;
}

function Resources({ days, onMaterial }: { days:CourseDay[]; onMaterial:(m:Material,d:CourseDay)=>void }) {
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [page, setPage] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () => days.flatMap((d) => d.materials.map((m) => ({ d, m }))).filter(({ d }) => dayFilter === 'all' || d.number === dayFilter),
    [days, dayFilter],
  );
  const perPage = useFittedRows(tableRef, rows.length);
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pageCount - 1);
  const shown = rows.slice(current * perPage, current * perPage + perPage);
  const from = rows.length ? current * perPage + 1 : 0;

  useEffect(() => { setPage(0); }, [dayFilter]);

  return <div className="fc-subpage fc-resource-page"><section className="fc-page-title"><div><span>COURSE LIBRARY</span><h1>Every delivery material in one place.</h1><p>Presentations, guides, workbooks, challenge packs and assessments are pinned to the approved course version.</p></div><button onClick={()=>downloadText(`volve-mission-offline-pack-v${COURSE_VERSION}.md`, buildOfflinePack())}><Download size={14}/>Export offline pack</button></section>
    <div className="fc-resource-filters" role="group" aria-label="Filter materials by day">
      <button className={dayFilter==='all'?'active':''} onClick={()=>setDayFilter('all')} aria-pressed={dayFilter==='all'}>All days</button>
      {days.map((d)=><button key={d.id} className={dayFilter===d.number?'active':''} onClick={()=>setDayFilter(d.number)} aria-pressed={dayFilter===d.number} style={{'--day':d.color} as CSSProperties}><i/>Day {d.number}</button>)}
      <span className="fc-resource-count">{rows.length} material{rows.length===1?'':'s'}</span>
    </div>
    <div className="fc-resource-table" ref={tableRef}><header><span>MATERIAL</span><span>TYPE</span><span>DAY</span><span>STATUS</span><span/></header>{shown.map(({d,m})=>{const Icon=MATERIAL_ICON[m.kind];return <button key={m.id} onClick={()=>onMaterial(m,d)}><span><i style={{color:d.color}}><Icon size={15}/></i><div><b>{m.title}</b><small>{m.meta}</small></div></span><span>{m.kind}</span><span>Day {d.number}</span><span><em className={m.status.toLowerCase()}>{m.status}</em></span><span><ArrowRight size={13}/></span></button>})}</div>
    <div className="fc-resource-pager"><span>Showing <b>{from}–{current*perPage+shown.length}</b> of <b>{rows.length}</b></span><div><button onClick={()=>setPage((p)=>Math.max(0,p-1))} disabled={current===0} aria-label="Previous page"><ChevronLeft size={14}/></button><span className="fc-pager-index">{current+1} / {pageCount}</span><button onClick={()=>setPage((p)=>Math.min(pageCount-1,p+1))} disabled={current>=pageCount-1} aria-label="Next page"><ChevronRight size={14}/></button></div></div>
  </div>;
}

function TrainerConsole({ dayIndex, setDayIndex, onBack, onPresent, onOpenWorkspace, onMaterial, allMaterials, onScoring, onAllMaterials }: { dayIndex:number; setDayIndex:(i:number)=>void; onBack:()=>void; onPresent:()=>void; onOpenWorkspace:(id:WorkspaceId)=>void; onMaterial:(m:Material)=>void; allMaterials:Array<{material:Material;day:CourseDay}>; onScoring:()=>void; onAllMaterials:()=>void }) {
  const day = VOLVE_DAYS[dayIndex];
  const session = useSession();
  const board = leaderboard(session);
  const possible = pointsPossible(session);
  const ready = day.materials.filter((m) => m.status === 'Ready').length;
  return (
    <div className="fc-trainer-shell">
      <header className="fc-trainer-top">
        <button onClick={onBack}><ArrowLeft size={14} />Course</button>
        <div><span className="fc-live-dot" /><small>TRAINER CONSOLE · VOLVE MISSION</small><b>Day {day.number} · {day.verb}</b></div>
        <span />
        <button><Users size={14} />18 learners</button>
        <button className="primary" onClick={onPresent}><Play size={14} />Start presentation</button>
      </header>
      <div className="fc-trainer-body">
        <aside className="fc-trainer-days">
          <span>FIVE-DAY COURSE</span>
          {VOLVE_DAYS.map((d, i) => (
            <button key={d.id} className={i === dayIndex ? 'active' : ''} onClick={() => setDayIndex(i)} style={{ '--day': d.color } as CSSProperties}>
              <i>{d.number}</i><div><small>{d.lifecycle}</small><b>{d.verb}</b></div>
              {i < dayIndex ? <Check size={13} /> : i === dayIndex ? <span className="fc-live-dot" /> : <LockKeyhole size={12} />}
            </button>
          ))}
          <div className="fc-pack-state"><ShieldCheck size={16} /><div><b>Offline pack ready</b><small>v1.0 · verified today</small></div></div>
        </aside>
        <main>
          <section className="fc-trainer-hero" style={{ '--day': day.color } as CSSProperties}>
            <div><small>DAY {String(day.number).padStart(2, '0')} · {day.lifecycle}</small><h1>{day.verb} · {day.title}</h1><p>{day.question}</p></div>
            <dl><div><dt>SESSION</dt><dd>08:30–16:30</dd></div><div><dt>MATERIALS</dt><dd>{ready}/{day.materials.length} ready</dd></div><div><dt>OUTPUT</dt><dd>{day.outcome.split(' · ')[0]}</dd></div></dl>
          </section>
          <section className="fc-trainer-grid">
            <div className="fc-panel fc-run-sheet">
              <div className="fc-panel-head"><span><CalendarDays size={14} />RUN OF SHOW</span><small>Click any block to cue</small></div>
              {day.schedule.map((s, i) => {
                const Icon = MODE_ICON[s.mode];
                const action = s.mode === 'Demo' || s.mode === 'Lab' ? (
                  <em onClick={(e) => { e.stopPropagation(); onOpenWorkspace(day.workspace); }}>Open workspace</em>
                ) : s.mode === 'Theory' ? (
                  <em onClick={(e) => { e.stopPropagation(); onPresent(); }}>Cue slides</em>
                ) : <ChevronRight size={13} />;
                return <button className={s.mode.toLowerCase()} key={`${s.time}-${i}`}><time>{s.time}</time><span><Icon size={13} /></span><div><b>{s.label}</b><small>{s.detail}</small></div>{action}</button>;
              })}
            </div>
            <aside>
              <section className="fc-panel">
                <div className="fc-panel-head"><span><Presentation size={14} />MATERIALS</span><small>{day.materials.length}</small></div>
                <div className="fc-trainer-materials">
                  {day.materials.map((m) => {
                    const Icon = MATERIAL_ICON[m.kind];
                    return <button key={m.id} onClick={() => onMaterial(m)}><span><Icon size={14} /></span><div><b>{m.title}</b><small>{m.meta}</small></div><em className={m.status.toLowerCase()}>{m.status}</em></button>;
                  })}
                </div>
                <button className="fc-all-materials" onClick={onAllMaterials}><FolderOpen size={14} />All {allMaterials.length} course materials</button>
              </section>
              <section className="fc-panel fc-scoreboard">
                <div className="fc-panel-head"><span><Trophy size={14} />LIVE SCOREBOARD</span><small>{possible} pts possible</small></div>
                {board.length
                  ? board.map((team, i) => {
                    const today = team.scores[day.id];
                    const todayTotal = today ? today.workflow + today.evidence + today.decision + today.quiz : 0;
                    return <div key={team.id}><b>{i + 1}</b><i style={{ background: team.color }} /><span>{team.name}</span><strong>{team.total}</strong><em>{todayTotal ? `+${todayTotal}` : '—'}</em></div>;
                  })
                  : <div className="fc-scoreboard-empty"><span>No teams yet</span></div>}
                <button onClick={onScoring}>Open competition controls<ArrowRight size={12} /></button>
              </section>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
