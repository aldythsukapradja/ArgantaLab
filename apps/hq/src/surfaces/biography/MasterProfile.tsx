/**
 * MASTER PROFILE — the complete, editable record. LinkedIn-grade completeness,
 * everything in bullets, everything editable in place.
 *
 * This is the ONLY place the founder's story is authored. CV Maker, Intro Deck
 * and Journey Timeline are pure reads of what happens here.
 *
 * Editing model: direct manipulation, no modals. Click any text → edit. Hover a
 * section or row → its tools appear in the margin. Nothing is behind a form.
 */
import { useMemo, useState } from 'react'
import {
  Plus, Trash2, Star, ChevronUp, ChevronDown, Mail, Phone, MapPin, Link2, Tag as TagIcon, ShieldAlert,
} from 'lucide-react'
import {
  useBio, newId, companyName, TAG_LABEL,
  type MasterSection, type SectionKind, type Tag, type Bullet,
} from './biography'
import { Editable, LogoChip, RowTools, ToolBtn } from './parts'

const ALL_TAGS = Object.keys(TAG_LABEL) as Tag[]

function TagPicker({ tags, onChange }: { tags: Tag[]; onChange: (t: Tag[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="bio-tagwrap">
      <button type="button" className="bio-tool" title="Tags — these drive the CV Maker" onClick={() => setOpen(o => !o)}>
        <TagIcon size={12} />
      </button>
      {open && (
        <>
          <div className="bio-tagback" onClick={() => setOpen(false)} />
          <div className="bio-tagmenu">
            <div className="bio-tagmenu-hd">Tags decide which CVs keep this line</div>
            {ALL_TAGS.map(t => (
              <button
                key={t} type="button"
                className={'bio-tagopt' + (tags.includes(t) ? ' on' : '')}
                onClick={() => onChange(tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t])}
              >{TAG_LABEL[t]}</button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}

function BulletList({ bullets, onEdit, onAdd, onDelete, onTags }: {
  bullets: Bullet[]
  onEdit: (id: string, v: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onTags: (id: string, t: Tag[]) => void
}) {
  return (
    <ul className="bio-bullets">
      {bullets.map(bl => (
        <li key={bl.id} className="bio-bullet">
          <Editable value={bl.text} onCommit={v => (v ? onEdit(bl.id, v) : onDelete(bl.id))} placeholder="Write a bullet…" multiline />
          <RowTools>
            <TagPicker tags={bl.tags} onChange={t => onTags(bl.id, t)} />
            <ToolBtn label="Delete bullet" danger onClick={() => onDelete(bl.id)}><Trash2 size={12} /></ToolBtn>
          </RowTools>
          {bl.tags.length > 0 && (
            <span className="bio-tagrow">{bl.tags.map(t => <em key={t}>{TAG_LABEL[t]}</em>)}</span>
          )}
        </li>
      ))}
      <li><button type="button" className="bio-add-inline" onClick={onAdd}><Plus size={11} /> bullet</button></li>
    </ul>
  )
}

export function MasterProfile() {
  const { profiles, activeId, edit } = useBio()
  const p = useMemo(() => profiles.find(x => x.id === activeId)!, [profiles, activeId])
  const twin = p.kind === 'twin'

  const moveSection = (i: number, d: -1 | 1) => edit(pr => {
    const j = i + d
    if (j < 0 || j >= pr.master.length) return
    const [s] = pr.master.splice(i, 1); pr.master.splice(j, 0, s)
  })

  const addSection = (kind: SectionKind) => edit(pr => {
    const id = newId('sec')
    const title = { about: 'About', experience: 'Experience', education: 'Education', skills: 'Skills', awards: 'Awards', publications: 'Publications', projects: 'Projects', custom: 'New section' }[kind]
    const base: any = { kind, id, title }
    if (kind === 'about' || kind === 'custom') base.bullets = []
    else if (kind === 'skills') base.groups = []
    else if (kind === 'awards') base.items = []
    else base.entries = []
    pr.master.push(base as MasterSection)
  })

  const sec = (id: string, fn: (s: any) => void) => edit(pr => {
    const s = pr.master.find(x => x.id === id); if (s) fn(s)
  })

  return (
    <div className="bio-master">
      <header className="bio-idcard">
        <div className="bio-idphoto">
          <img src={p.identity.photo} alt={p.identity.name} />
        </div>
        <div className="bio-idmain">
          <Editable className="bio-idname" value={p.identity.name} onCommit={v => edit(pr => { pr.identity.name = v })} placeholder="Name" />
          <Editable className="bio-idhead" value={p.identity.headline} onCommit={v => edit(pr => { pr.identity.headline = v })} placeholder="Headline" multiline />
          <Editable className="bio-idtag" value={p.identity.tagline ?? ''} onCommit={v => edit(pr => { pr.identity.tagline = v })} placeholder="Tagline…" multiline />
          <div className="bio-idmeta">
            {!twin && <span><Mail size={11} /><Editable value={p.identity.email ?? ''} onCommit={v => edit(pr => { pr.identity.email = v })} placeholder="email" /></span>}
            {!twin && <span><Phone size={11} /><Editable value={p.identity.phone ?? ''} onCommit={v => edit(pr => { pr.identity.phone = v })} placeholder="phone" /></span>}
            <span><MapPin size={11} /><Editable value={p.identity.location} onCommit={v => edit(pr => { pr.identity.location = v })} placeholder="location" /></span>
            {p.identity.links.map(l => (
              <span key={l.id}>
                <Link2 size={11} />
                <Editable value={l.label} onCommit={v => edit(pr => { const x = pr.identity.links.find(y => y.id === l.id); if (x) x.label = v })} />
                <ToolBtn label="Delete link" danger onClick={() => edit(pr => { pr.identity.links = pr.identity.links.filter(y => y.id !== l.id) })}><Trash2 size={10} /></ToolBtn>
              </span>
            ))}
            <button type="button" className="bio-add-inline" onClick={() => edit(pr => { pr.identity.links.push({ id: newId('ln'), label: 'Link', url: '' }) })}><Plus size={11} /> link</button>
          </div>
        </div>
      </header>

      {twin && p.publicRules && (
        <section className="bio-rules">
          <div className="bio-rules-hd"><ShieldAlert size={13} /> Non-negotiables — the public persona contract</div>
          <ul>{p.publicRules.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <div className="bio-rules-src">Canon · knowledge-base/brand/arganta-creator-handoff.md</div>
        </section>
      )}

      {p.master.map((s, i) => (
        <div key={s.id} style={{ display: 'contents' }}>
        {/* Everything above this line is who he is; everything below is how the
            persona is operated. Mixing them is what made the twin read like a
            campaign instead of a person. */}
        {s.playbook && !p.master[i - 1]?.playbook && (
          <div className="bio-divider">
            <span>Brand playbook</span>
            <p>Operating canon for the persona — not part of the profile, and excluded from the LinkedIn copy.</p>
          </div>
        )}
        <section className={'bio-sec' + (s.playbook ? ' bio-sec-play' : '')} id={`sec-${s.id}`}>
          <div className="bio-sec-rail">
            <ToolBtn label="Move up" onClick={() => moveSection(i, -1)}><ChevronUp size={13} /></ToolBtn>
            <ToolBtn label="Move down" onClick={() => moveSection(i, 1)}><ChevronDown size={13} /></ToolBtn>
            <ToolBtn label="Delete section" danger onClick={() => edit(pr => { pr.master = pr.master.filter(x => x.id !== s.id) })}><Trash2 size={13} /></ToolBtn>
          </div>

          <Editable className="bio-sec-hd" value={s.title} onCommit={v => sec(s.id, x => { x.title = v })} />

          {(s.kind === 'about' || s.kind === 'custom') && (
            <BulletList
              bullets={s.bullets}
              onEdit={(id, v) => sec(s.id, x => { const b = x.bullets.find((y: Bullet) => y.id === id); if (b) b.text = v })}
              onAdd={() => sec(s.id, x => x.bullets.push({ id: newId('b'), text: '', tags: [] }))}
              onDelete={id => sec(s.id, x => { x.bullets = x.bullets.filter((y: Bullet) => y.id !== id) })}
              onTags={(id, t) => sec(s.id, x => { const b = x.bullets.find((y: Bullet) => y.id === id); if (b) b.tags = t })}
            />
          )}

          {s.kind === 'experience' && (
            <div className="bio-exps">
              {s.entries.map((e, ei) => (
                <article className={'bio-exp' + (e.highlight ? ' on' : '')} key={e.id}>
                  <div className="bio-exp-hd">
                    <LogoChip src={twin ? undefined : e.logo} name={companyName(e, p)} brand={e.brand} size={34} />
                    <div className="bio-exp-titles">
                      <Editable className="bio-exp-role" value={e.role} onCommit={v => sec(s.id, x => { x.entries[ei].role = v })} placeholder="Role" />
                      <div className="bio-exp-sub">
                        <Editable className="bio-exp-co" value={twin ? (e.companyAlias ?? e.company) : e.company}
                          onCommit={v => sec(s.id, x => { if (twin) x.entries[ei].companyAlias = v; else x.entries[ei].company = v })} />
                        <span className="bio-dot">·</span>
                        <Editable value={e.place} onCommit={v => sec(s.id, x => { x.entries[ei].place = v })} placeholder="Place" />
                        {e.team && <><span className="bio-dot">·</span><Editable value={e.team} onCommit={v => sec(s.id, x => { x.entries[ei].team = v })} /></>}
                      </div>
                    </div>
                    <Editable className="bio-exp-yrs" value={e.years} onCommit={v => sec(s.id, x => { x.entries[ei].years = v })} />
                    <RowTools>
                      <ToolBtn label="Feature on deck & timeline" on={!!e.highlight} onClick={() => sec(s.id, x => { x.entries[ei].highlight = !x.entries[ei].highlight })}><Star size={12} /></ToolBtn>
                      <ToolBtn label="Move up" onClick={() => sec(s.id, x => { if (ei > 0) { const [m] = x.entries.splice(ei, 1); x.entries.splice(ei - 1, 0, m) } })}><ChevronUp size={12} /></ToolBtn>
                      <ToolBtn label="Move down" onClick={() => sec(s.id, x => { if (ei < x.entries.length - 1) { const [m] = x.entries.splice(ei, 1); x.entries.splice(ei + 1, 0, m) } })}><ChevronDown size={12} /></ToolBtn>
                      <ToolBtn label="Delete role" danger onClick={() => sec(s.id, x => { x.entries = x.entries.filter((y: any) => y.id !== e.id) })}><Trash2 size={12} /></ToolBtn>
                    </RowTools>
                  </div>
                  <BulletList
                    bullets={e.bullets}
                    onEdit={(id, v) => sec(s.id, x => { const b = x.entries[ei].bullets.find((y: Bullet) => y.id === id); if (b) b.text = v })}
                    onAdd={() => sec(s.id, x => x.entries[ei].bullets.push({ id: newId('b'), text: '', tags: [] }))}
                    onDelete={id => sec(s.id, x => { x.entries[ei].bullets = x.entries[ei].bullets.filter((y: Bullet) => y.id !== id) })}
                    onTags={(id, t) => sec(s.id, x => { const b = x.entries[ei].bullets.find((y: Bullet) => y.id === id); if (b) b.tags = t })}
                  />
                </article>
              ))}
              <button type="button" className="bio-add" onClick={() => sec(s.id, x => x.entries.unshift({
                id: newId('exp'), role: 'Role', company: 'Company', place: 'Place', years: 'Year — Year', bullets: [{ id: newId('b'), text: '', tags: [] }],
              }))}><Plus size={13} /> Add role</button>
            </div>
          )}

          {s.kind === 'education' && (
            <div className="bio-edus">
              {s.entries.map((e, ei) => (
                <div className="bio-edu" key={e.id}>
                  <LogoChip src={twin ? undefined : e.logo} name={e.school} brand={e.brand} size={30} />
                  <div>
                    <Editable className="bio-edu-school" value={e.school} onCommit={v => sec(s.id, x => { x.entries[ei].school = v })} />
                    <div className="bio-edu-sub">
                      <Editable value={`${e.degree} ${e.field}`} onCommit={v => sec(s.id, x => { const [d, ...f] = v.split(' '); x.entries[ei].degree = d; x.entries[ei].field = f.join(' ') })} />
                      <span className="bio-dot">·</span><Editable value={e.place} onCommit={v => sec(s.id, x => { x.entries[ei].place = v })} />
                    </div>
                    {e.note && <Editable className="bio-edu-note" value={e.note} onCommit={v => sec(s.id, x => { x.entries[ei].note = v })} />}
                  </div>
                  <Editable className="bio-exp-yrs" value={e.years} onCommit={v => sec(s.id, x => { x.entries[ei].years = v })} />
                  <RowTools><ToolBtn label="Delete" danger onClick={() => sec(s.id, x => { x.entries = x.entries.filter((y: any) => y.id !== e.id) })}><Trash2 size={12} /></ToolBtn></RowTools>
                </div>
              ))}
              <button type="button" className="bio-add" onClick={() => sec(s.id, x => x.entries.push({ id: newId('edu'), school: 'School', degree: 'Degree', field: 'Field', place: 'Place', years: 'Year' }))}><Plus size={13} /> Add education</button>
            </div>
          )}

          {s.kind === 'skills' && (
            <div className="bio-skills">
              {s.groups.map((g, gi) => (
                <div className="bio-skgrp" key={g.id}>
                  <Editable className="bio-skgrp-hd" value={g.label} onCommit={v => sec(s.id, x => { x.groups[gi].label = v })} />
                  <div className="bio-pills">
                    {g.items.map((it, ii) => (
                      <span className="bio-pill" key={ii}>
                        <Editable value={it} onCommit={v => sec(s.id, x => { if (v) x.groups[gi].items[ii] = v; else x.groups[gi].items.splice(ii, 1) })} />
                      </span>
                    ))}
                    <button type="button" className="bio-add-inline" onClick={() => sec(s.id, x => x.groups[gi].items.push('New skill'))}><Plus size={11} /></button>
                  </div>
                  <RowTools><ToolBtn label="Delete group" danger onClick={() => sec(s.id, x => { x.groups = x.groups.filter((y: any) => y.id !== g.id) })}><Trash2 size={12} /></ToolBtn></RowTools>
                </div>
              ))}
              <button type="button" className="bio-add" onClick={() => sec(s.id, x => x.groups.push({ id: newId('sk'), label: 'Group', items: [] }))}><Plus size={13} /> Add skill group</button>
            </div>
          )}

          {s.kind === 'awards' && (
            <ul className="bio-awards">
              {s.items.map((a, ai) => (
                <li key={a.id}>
                  <span className="bio-gold" />
                  <div>
                    <Editable value={a.text} onCommit={v => sec(s.id, x => { x.items[ai].text = v })} multiline />
                    {a.detail && <Editable className="bio-award-detail" value={a.detail} onCommit={v => sec(s.id, x => { x.items[ai].detail = v })} multiline />}
                  </div>
                  <Editable className="bio-award-yr" value={a.year ?? ''} onCommit={v => sec(s.id, x => { x.items[ai].year = v })} placeholder="year" />
                  <RowTools><ToolBtn label="Delete" danger onClick={() => sec(s.id, x => { x.items = x.items.filter((y: any) => y.id !== a.id) })}><Trash2 size={12} /></ToolBtn></RowTools>
                </li>
              ))}
              <li><button type="button" className="bio-add-inline" onClick={() => sec(s.id, x => x.items.push({ id: newId('aw'), text: 'New award' }))}><Plus size={11} /> award</button></li>
            </ul>
          )}

          {s.kind === 'publications' && (
            <ul className="bio-pubs">
              {s.entries.map((pb, pi) => (
                <li key={pb.id}>
                  <div className="bio-pub-main">
                    <Editable className="bio-pub-title" value={pb.title} onCommit={v => sec(s.id, x => { x.entries[pi].title = v })} multiline />
                    <div className="bio-pub-sub">
                      <Editable value={pb.venue} onCommit={v => sec(s.id, x => { x.entries[pi].venue = v })} />
                      {pb.year && <><span className="bio-dot">·</span><Editable value={pb.year} onCommit={v => sec(s.id, x => { x.entries[pi].year = v })} /></>}
                      {pb.url && <a href={pb.url} target="_blank" rel="noreferrer" className="bio-pub-link"><Link2 size={10} /> link</a>}
                    </div>
                  </div>
                  <RowTools>
                    <TagPicker tags={pb.tags} onChange={t => sec(s.id, x => { x.entries[pi].tags = t })} />
                    <ToolBtn label="Delete" danger onClick={() => sec(s.id, x => { x.entries = x.entries.filter((y: any) => y.id !== pb.id) })}><Trash2 size={12} /></ToolBtn>
                  </RowTools>
                </li>
              ))}
              <li><button type="button" className="bio-add-inline" onClick={() => sec(s.id, x => x.entries.push({ id: newId('pub'), title: 'Title', venue: 'Venue', tags: ['publication'] }))}><Plus size={11} /> publication</button></li>
            </ul>
          )}

          {s.kind === 'projects' && (
            <div className="bio-projects">
              {s.entries.map((pj, pi) => (
                <div className="bio-project" key={pj.id}>
                  <Editable className="bio-project-name" value={pj.name} onCommit={v => sec(s.id, x => { x.entries[pi].name = v })} />
                  <Editable className="bio-project-desc" value={pj.desc} onCommit={v => sec(s.id, x => { x.entries[pi].desc = v })} multiline />
                  <RowTools>
                    <TagPicker tags={pj.tags} onChange={t => sec(s.id, x => { x.entries[pi].tags = t })} />
                    <ToolBtn label="Delete" danger onClick={() => sec(s.id, x => { x.entries = x.entries.filter((y: any) => y.id !== pj.id) })}><Trash2 size={12} /></ToolBtn>
                  </RowTools>
                </div>
              ))}
              <button type="button" className="bio-add" onClick={() => sec(s.id, x => x.entries.push({ id: newId('pr'), name: 'Project', desc: '', tags: [] }))}><Plus size={13} /> Add project</button>
            </div>
          )}
        </section>
        </div>
      ))}

      <div className="bio-addsec">
        <span>Add section</span>
        {(['experience', 'education', 'skills', 'awards', 'publications', 'projects', 'custom'] as SectionKind[]).map(k => (
          <button key={k} type="button" onClick={() => addSection(k)}>{k === 'custom' ? 'custom' : k}</button>
        ))}
      </div>
    </div>
  )
}
