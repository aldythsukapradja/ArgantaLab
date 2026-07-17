/**
 * The COMPLETE record as a printable A4 document.
 *
 * The CV Maker prints a fixed 1-page artifact (`.a4-page`); the master record is
 * variable-length, so it prints as a FLOW (`.a4-flow`) and lets the browser
 * paginate — with break-inside guards so no role or award is ever split across
 * a page boundary. Without this the Master tab's Export PDF prints a blank
 * sheet: @media print hides #root, and only #print-root survives.
 */
import { companyName, type Profile } from './biography'

export function MasterPrint({ p }: { p: Profile }) {
  const id = p.identity

  return (
    <article className="a4-flow">
      <header className="cv-hd">
        <div className="cv-hd-photo"><img src={id.photo} alt="" /></div>
        <div className="cv-hd-main">
          <h1>{id.name}</h1>
          <div className="cv-hd-role">{id.headline}</div>
          <div className="cv-hd-meta">
            {[id.email, id.phone, id.location].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}
            {id.links.filter(l => l.url).map(l => <span key={l.id}>{l.label}</span>)}
          </div>
        </div>
      </header>

      {id.tagline && <p className="mp-tagline">{id.tagline}</p>}

      {/* Brand ops are not biography — a printed profile that lists content
          pillars is not a CV. They stay on screen and in the Core export. */}
      {p.master.filter(s => !s.playbook).map(s => (
        <section className="mp-sec" key={s.id}>
          <h2>{s.title}</h2>

          {(s.kind === 'about' || s.kind === 'custom') && (
            <ul className="mp-bullets">{s.bullets.map(b => <li key={b.id}>{b.text}</li>)}</ul>
          )}

          {s.kind === 'experience' && s.entries.map(e => (
            <div className="mp-exp" key={e.id}>
              <div className="mp-exp-hd">
                <b>{e.role}</b>
                <span className="mp-exp-co">{companyName(e, p)}</span>
                <span className="mp-exp-yrs">{e.years}</span>
              </div>
              <div className="mp-exp-meta">{[e.team, e.place].filter(Boolean).join(' · ')}</div>
              <ul className="mp-bullets">{e.bullets.map(b => <li key={b.id}>{b.text}</li>)}</ul>
            </div>
          ))}

          {s.kind === 'education' && s.entries.map(e => (
            <div className="mp-row" key={e.id}>
              <div><b>{e.degree} {e.field}</b> — {e.school}{e.note ? <i> · {e.note}</i> : null}</div>
              <span className="mp-exp-yrs">{e.years}</span>
            </div>
          ))}

          {s.kind === 'skills' && s.groups.map(g => (
            <div className="mp-skgrp" key={g.id}><b>{g.label}:</b> {g.items.join(' · ')}</div>
          ))}

          {s.kind === 'awards' && (
            <ul className="mp-awards">
              {s.items.map(a => (
                <li key={a.id}>{a.text}{a.year ? ` (${a.year})` : ''}{a.detail ? <i> — {a.detail}</i> : null}</li>
              ))}
            </ul>
          )}

          {s.kind === 'publications' && (
            <ul className="mp-bullets">
              {s.entries.map(e => <li key={e.id}><i>{e.title}</i> — {e.venue}{e.year ? `, ${e.year}` : ''}</li>)}
            </ul>
          )}

          {s.kind === 'projects' && (
            <ul className="mp-bullets">
              {s.entries.map(e => <li key={e.id}><b>{e.name}</b> — {e.desc}</li>)}
            </ul>
          )}
        </section>
      ))}

      {/* The non-negotiables are the persona's operating contract, not part of
          his biography — they stay on screen and in the Core export. A printed
          profile that lists its own brand rules is not a profile. */}
    </article>
  )
}
