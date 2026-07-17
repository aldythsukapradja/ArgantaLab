/**
 * CV MAKER — five role templates, one master profile, print-perfect A4.
 *
 * The template rail picks an angle; composeCv() does the tailoring; the page is
 * the real print artifact (210×297mm at 96dpi = 794×1123px), so what you see is
 * literally what prints.
 *
 * Print: the page is rendered into #print-root (a body-level portal) and
 * @media print hides every other body child. The visibility:hidden trick leaves
 * layout boxes in flow and shreds pagination in Chromium — don't reach for it.
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Copy, Check, Sparkles, Eye, EyeOff } from 'lucide-react'
import { useBio, companyName, type Profile } from './biography'
import { CV_TEMPLATES, composeCv, cvToText, templateById, type CvTemplateId, type CvOverrides, type CvDoc } from './cvTemplates'
import { LogoChip } from './parts'

function A4Page({ profile, doc, twin }: { profile: Profile; doc: CvDoc; twin: boolean }) {
  const id = profile.identity
  return (
    <article className="a4-page">
      <header className="cv-hd">
        <div className="cv-hd-photo"><img src={id.photo} alt="" /></div>
        <div className="cv-hd-main">
          <h1>{id.name}</h1>
          <div className="cv-hd-role">{doc.headline}</div>
          <div className="cv-hd-meta">
            {[id.email, id.phone, id.location].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}
            {id.links.filter(l => l.url).map(l => <span key={l.id}>{l.label}</span>)}
          </div>
        </div>
      </header>

      <div className="cv-body">
        <main className="cv-main">
          <section className="cv-sec">
            <h2>Summary</h2>
            <p className="cv-summary">{doc.summary}</p>
          </section>

          <section className="cv-sec">
            <h2>Experience</h2>
            {doc.entries.map(e => (
              <div className="cv-exp" key={e.id}>
                <div className="cv-exp-hd">
                  <LogoChip src={twin ? undefined : e.logo} name={companyName(e, profile)} brand={e.brand} size={20} />
                  <b>{e.role}</b>
                  <span className="cv-exp-co">{companyName(e, profile)}</span>
                  <span className="cv-exp-yrs">{e.years}</span>
                </div>
                <div className="cv-exp-meta">{[e.team, e.place].filter(Boolean).join(' · ')}</div>
                <ul>{e.picked.map(b => <li key={b.id}>{b.text}</li>)}</ul>
              </div>
            ))}

            {doc.earlier.length > 0 && (
              <div className="cv-earlier">
                <b>Earlier career</b>
                {doc.earlier.map(e => (
                  <div key={e.id}>
                    <span>{e.role} — {companyName(e, profile)}</span>
                    <span className="cv-exp-yrs">{e.years}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {doc.sections.map(s => (
            <section className="cv-sec" key={s.id}>
              <h2>{s.title}</h2>
              {s.kind === 'publications' && <ul className="cv-list">{s.entries.map(p => <li key={p.id}><i>{p.title}</i> — {p.venue}{p.year ? `, ${p.year}` : ''}</li>)}</ul>}
              {s.kind === 'projects' && <ul className="cv-list">{s.entries.map(p => <li key={p.id}><b>{p.name}</b> — {p.desc}</li>)}</ul>}
              {s.kind === 'awards' && <ul className="cv-list">{s.items.map(a => <li key={a.id}>{a.text}{a.year ? ` (${a.year})` : ''}</li>)}</ul>}
            </section>
          ))}
        </main>

        <aside className="cv-side">
          {doc.sidebar.map(s => (
            <section className="cv-sec" key={s.id}>
              <h2>{s.title}</h2>
              {s.kind === 'education' && s.entries.map(e => (
                <div className="cv-edu" key={e.id}>
                  <b>{e.degree} {e.field}</b>
                  <span>{e.school}</span>
                  <span className="cv-muted">{e.place} · {e.years}</span>
                  {e.note && <span className="cv-muted">{e.note}</span>}
                </div>
              ))}
              {s.kind === 'skills' && s.groups.map(g => (
                <div className="cv-skgrp" key={g.id}>
                  <b>{g.label}</b>
                  <span>{g.items.join(' · ')}</span>
                </div>
              ))}
              {s.kind === 'awards' && <ul className="cv-awards">{s.items.map(a => <li key={a.id}>{a.text}{a.year ? <em> {a.year}</em> : null}</li>)}</ul>}
              {s.kind === 'publications' && <ul className="cv-list cv-list-tight">{s.entries.map(p => <li key={p.id}>{p.title} — <i>{p.venue}</i></li>)}</ul>}
            </section>
          ))}
        </aside>
      </div>
    </article>
  )
}

export function CvMaker() {
  const { profiles, activeId } = useBio()
  const p = useMemo(() => profiles.find(x => x.id === activeId)!, [profiles, activeId])
  const twin = p.kind === 'twin'
  const [tplId, setTplId] = useState<CvTemplateId>('senior-geologist')
  const [ov, setOv] = useState<Record<CvTemplateId, CvOverrides>>({} as any)
  const [copied, setCopied] = useState(false)
  const [tuning, setTuning] = useState(false)

  const tpl = templateById(tplId)
  const overrides = ov[tplId] ?? {}
  const doc = useMemo(() => composeCv(p, tpl, overrides), [p, tpl, overrides])
  const bulletCount = doc.entries.reduce((n, e) => n + e.picked.length, 0)

  const toggle = (bid: string, on: boolean) =>
    setOv(o => ({ ...o, [tplId]: { ...(o[tplId] ?? {}), [bid]: !on } }))

  const copy = async () => {
    await navigator.clipboard.writeText(cvToText(p, doc, twin))
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }

  const printRoot = typeof document !== 'undefined' ? document.getElementById('print-root') : null

  return (
    <div className="bio-cv">
      <aside className="bio-cv-rail">
        <div className="bio-rail-hd">Target role</div>
        {CV_TEMPLATES.map(t => {
          const d = composeCv(p, t, ov[t.id] ?? {})
          const n = d.entries.reduce((a, e) => a + e.picked.length, 0)
          return (
            <button key={t.id} type="button" className={'bio-tplcard' + (t.id === tplId ? ' on' : '')} onClick={() => setTplId(t.id)}>
              <b>{t.label}</b>
              <span>{t.angle}</span>
              <em>{n} bullets · {d.entries.length} roles</em>
            </button>
          )
        })}
        <div className="bio-ai-soon"><Sparkles size={11} /> AI tailor — coming soon</div>
      </aside>

      <div className="bio-cv-stage">
        <div className="bio-cv-bar">
          <span className="bio-cv-count">{bulletCount} bullets selected from {p.master.find(s => s.kind === 'experience')?.kind === 'experience' ? (p.master.find(s => s.kind === 'experience') as any).entries.reduce((n: number, e: any) => n + e.bullets.length, 0) : 0}</span>
          <div className="bio-cv-acts">
            <button type="button" className={'bio-btn' + (tuning ? ' on' : '')} onClick={() => setTuning(t => !t)}>
              {tuning ? <EyeOff size={13} /> : <Eye size={13} />} Tune bullets
            </button>
            <button type="button" className="bio-btn" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy text'}</button>
            <button type="button" className="bio-btn bio-btn-go" onClick={() => window.print()}><Printer size={13} /> Export PDF</button>
          </div>
        </div>

        <div className="bio-cv-scroll">
          <div className="bio-a4-wrap"><A4Page profile={p} doc={doc} twin={twin} /></div>

          {tuning && (
            <div className="bio-tune">
              <div className="bio-tune-hd">Every bullet in the master — tick what this CV should say</div>
              {(p.master.find(s => s.kind === 'experience') as any)?.entries.map((e: any) => (
                <div className="bio-tune-grp" key={e.id}>
                  <div className="bio-tune-role">{e.role} · {companyName(e, p)} · {e.years}</div>
                  {e.bullets.map((b: any) => {
                    const on = doc.entries.find(x => x.id === e.id)?.picked.some(x => x.id === b.id) ?? false
                    return (
                      <label className={'bio-tune-row' + (on ? ' on' : '')} key={b.id}>
                        <input type="checkbox" checked={on} onChange={() => toggle(b.id, on)} />
                        <span>{b.text}</span>
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The print artifact — body-level so @media print can hide everything else. */}
      {printRoot && createPortal(<div className="bio-print"><A4Page profile={p} doc={doc} twin={twin} /></div>, printRoot)}
    </div>
  )
}
