import { useEffect, useState } from 'react'
import { FileText, Presentation as PresentIcon, Printer, X, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { officeById } from '../../../data/graph/agents'
import { buildDailyBriefing } from '../../../data/reports/daily'
import type { Report, Section } from '../../../data/reports/types'
import { ChartView } from '../../../components/charts'
import { SourceBadge } from '../SourceBadge'
import { HealthDot } from '../HealthDot'

const toneColor = (t?: 'ok' | 'warn' | 'bad' | 'mut') =>
  t === 'ok' ? 'var(--ok)' : t === 'warn' ? 'var(--warn)' : t === 'bad' ? 'var(--bad)' : t === 'mut' ? 'var(--tx3)' : 'var(--tx)'

// ── one section ─────────────────────────────────────────────────────────────
export function SectionView({ s }: { s: Section }) {
  if (s.kind === 'kpiRow') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {s.items.map((k, i) => (
          <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: toneColor(k.tone), marginTop: 3 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>
    )
  }
  if (s.kind === 'headline') {
    return (
      <div className={'insight ' + (s.tone === 'ok' ? 'ok' : s.tone === 'bad' ? 'warn' : 'tl')} style={{ alignItems: 'flex-start' }}>
        <ArrowRight size={15} />
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--tx3)' }}>{s.label}</div>
          <div style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 3px' }}>{s.text}</div>
          {s.sub && <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5 }}>{s.sub}</div>}
        </div>
      </div>
    )
  }
  if (s.kind === 'chiefLines') {
    return (
      <div>
        <div className="row" style={{ gap: 8, fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>{s.title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {s.lines.map(l => (
            <div key={l.office} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div style={{ marginTop: 3 }}><HealthDot health={l.health} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{l.chief}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{l.headline}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 3 }}>
                  <b style={{ color: 'var(--tx)' }}>{l.action}</b> <span style={{ color: 'var(--tx3)' }}>↳ ladders to <span className="src">{l.laddersTo}</span></span>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flex: 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{l.metricLabel}</span>
                <SourceBadge source={l.badge} small />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (s.kind === 'consults') {
    return (
      <div>
        <div className="row" style={{ gap: 8, fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 12 }}>priority: Trust &gt; North Star &gt; Retention &gt; Money</div>
        {s.items.length === 0 && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Nothing waiting on you.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {s.items.map(c => {
            const pill = c.status === 'answered' ? 'pill-ok' : c.status === 'blocked' ? 'pill-bad' : 'pill-mut'
            return (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, borderLeft: '2px solid var(--bd2)', paddingLeft: 12 }}>
                <div className="spread">
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{officeById(c.from).chief} → {officeById(c.to).chief}</span>
                  <span className={'pill ' + pill} style={{ fontSize: 9.5 }}>{c.status}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5 }}>{c.note}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  if (s.kind === 'chart') {
    return (
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
        <ChartView data={s.chart} />
      </div>
    )
  }
  return <div style={{ fontSize: 11.5, color: 'var(--tx3)', lineHeight: 1.5 }}>{s.text}</div>
}

// ── whole report ────────────────────────────────────────────────────────────
export function ReportView({ report, onPresent }: { report: Report; onPresent: () => void }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{report.title}</div>
          {report.subtitle && <div style={{ fontSize: 11.5, color: 'var(--tx2)', maxWidth: 560, marginTop: 3, lineHeight: 1.5 }}>{report.subtitle}</div>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill pill-mut" style={{ fontSize: 10 }}>{report.livePct}% live</span>
          <button className="chip" onClick={onPresent} style={{ gap: 6, cursor: 'pointer' }}><PresentIcon size={13} /> Present</button>
          <button className="chip" onClick={() => window.print()} style={{ gap: 6, cursor: 'pointer' }}><Printer size={13} /> Export</button>
        </div>
      </div>
      {report.sections.map(s => <SectionView key={s.id} s={s} />)}
    </div>
  )
}

// ── present as slides ───────────────────────────────────────────────────────
function Present({ report, onClose }: { report: Report; onClose: () => void }) {
  const slides = report.sections
  const [i, setI] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setI(v => Math.min(slides.length - 1, v + 1))
      else if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length, onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', zIndex: 80, display: 'grid', placeItems: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(900px,96vw)', height: 'min(560px,88vh)', background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="spread" style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
          <div className="row" style={{ gap: 8 }}><FileText size={14} /><span style={{ fontSize: 13, fontWeight: 700 }}>{report.title}</span></div>
          <button onClick={onClose} aria-label="Close" style={{ cursor: 'pointer', color: 'var(--tx2)' }}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <SectionView s={slides[i]} />
        </div>
        <div className="spread" style={{ padding: '12px 20px', borderTop: '1px solid var(--bd)' }}>
          <button className="chip" disabled={i === 0} onClick={() => setI(v => Math.max(0, v - 1))} style={{ gap: 5, cursor: 'pointer', opacity: i === 0 ? 0.4 : 1 }}><ChevronLeft size={13} /> Prev</button>
          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{i + 1} / {slides.length}</span>
          <button className="chip" disabled={i === slides.length - 1} onClick={() => setI(v => Math.min(slides.length - 1, v + 1))} style={{ gap: 5, cursor: 'pointer', opacity: i === slides.length - 1 ? 0.4 : 1 }}>Next <ChevronRight size={13} /></button>
        </div>
      </div>
    </div>
  )
}

// ── entry: the Bridge "Briefings & Reports" hub (R1 = daily brief) ───────────
export function DailyBrief() {
  const [open, setOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const report = buildDailyBriefing()
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}><FileText size={14} /> Briefings &amp; Reports</div>
        <button className="chip" onClick={() => setOpen(o => !o)} style={{ gap: 6, cursor: 'pointer', background: open ? 'var(--bg3)' : 'var(--acc)', color: open ? 'var(--tx)' : '#fff', borderColor: open ? 'var(--bd2)' : 'var(--acc)' }}>
          {open ? 'Hide' : 'Daily brief'}
        </button>
      </div>
      {!open && <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5 }}>On-demand C-level briefing — the North Star, the one thing today, the six chief headlines, and what needs your Bridge to resolve. Present or export it.</div>}
      {open && <ReportView report={report} onPresent={() => setPresent(true)} />}
      {present && <Present report={report} onClose={() => setPresent(false)} />}
    </div>
  )
}
