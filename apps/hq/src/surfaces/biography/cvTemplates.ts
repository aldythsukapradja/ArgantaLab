/**
 * CV MAKER — five role templates over one master profile.
 *
 * A template is a TAG FILTER + a BOOST ORDER, nothing more. That keeps the whole
 * thing deterministic and inspectable today: you can see exactly why a bullet
 * made the cut. `composeCv` is a pure function of (profile, template, overrides)
 * — it is THE seam. When @arganta/ai lands, an LLM tailor replaces this one
 * function and no UI changes.
 *
 * Rule that matters: an entry is never dropped from the two most recent roles.
 * A CV with a hole in the last four years reads as evasive, so those keep their
 * strongest bullet even when no tag matches.
 */
import type { Profile, Tag, ExperienceEntry, MasterSection, SectionKind } from './biography'

export type CvTemplateId =
  | 'senior-geologist' | 'senior-data-scientist' | 'lead-geologist'
  | 'head-geology' | 'head-digital-petroleum'

export type CvTemplate = {
  id: CvTemplateId
  label: string
  angle: string                 // one line, shown on the template card
  headline: string
  summary: string
  includeTags: Tag[]
  boostTags: Tag[]
  maxBulletsPerEntry: number
  /** Roles shown in full. The rest condense into one "Earlier career" line —
   *  a 15-year record cannot spell out every role and still print on one page,
   *  and a recruiter reads the recent ones anyway. */
  maxRoles: number
  sectionOrder: SectionKind[]
  sidebar: ('education' | 'skills' | 'awards' | 'publications')[]
  maxPublications: number
  /** The sidebar is the page's height budget — an 11-item award list alone
   *  pushes the CV onto a second, near-empty page. */
  maxAwards: number
}

export const CV_TEMPLATES: CvTemplate[] = [
  {
    id: 'senior-geologist',
    label: 'Senior Geologist',
    angle: 'The full-strength technical CV',
    headline: 'Senior Geologist · Reservoir Management & Field Development',
    summary: 'Senior petroleum geologist with 15+ years across giant carbonate and clastic fields in Qatar and Indonesia. Focal point for reservoir management, geomodeling and FDP maturation on four major developments, with 60+ horizontal wells stewarded and 20+ publications.',
    includeTags: ['geology', 'geomodeling', 'reservoir-mgmt', 'fdp', 'operations', 'geomechanics', 'publication', 'innovation'],
    boostTags: ['geology', 'geomodeling', 'reservoir-mgmt'],
    maxBulletsPerEntry: 3,
    maxRoles: 4,
    sectionOrder: ['about', 'experience'],
    sidebar: ['education', 'skills', 'awards', 'publications'],
    maxPublications: 4,
    maxAwards: 5,
  },
  {
    id: 'senior-data-scientist',
    label: 'Senior Data Scientist',
    angle: 'Fifteen years of applied data science on subsurface data',
    headline: 'Senior Data Scientist · Subsurface AI/ML & Decision Intelligence',
    summary: 'Data scientist grown inside the subsurface: 15 years applying statistical modelling, machine learning and business intelligence to some of the world’s largest oil and gas datasets. Inventor of a six-product applied-ML family and product owner of agentic-AI systems in daily industrial operation — recognized by the CEO for maturing the company’s first agentic AI; 30+ automation tools shipped.',
    includeTags: ['data', 'ml', 'ai', 'bi', 'software', 'innovation', 'publication', 'leadership'],
    boostTags: ['data', 'ml', 'ai', 'bi', 'software'],
    maxBulletsPerEntry: 3,
    maxRoles: 4,
    sectionOrder: ['about', 'experience', 'projects'],
    sidebar: ['skills', 'education', 'awards', 'publications'],
    maxPublications: 3,
    maxAwards: 5,
  },
  {
    id: 'lead-geologist',
    label: 'Lead Geologist',
    angle: 'Senior IC plus focal-point leadership and well delivery',
    headline: 'Lead Geologist · Reservoir Management, Well Delivery & Development',
    summary: 'Lead-level geologist combining deep technical mastery with focal-point leadership: FDP maturation of 80+ wells from Conceptual to Pre-FEED, geosteering leadership across ERD campaigns, and multi-rig operations in swamp and offshore environments.',
    includeTags: ['geology', 'geomodeling', 'reservoir-mgmt', 'operations', 'fdp', 'leadership', 'innovation', 'geomechanics'],
    boostTags: ['reservoir-mgmt', 'operations', 'leadership'],
    maxBulletsPerEntry: 3,
    maxRoles: 4,
    sectionOrder: ['about', 'experience'],
    sidebar: ['education', 'skills', 'awards', 'publications'],
    maxPublications: 4,
    maxAwards: 5,
  },
  {
    id: 'head-geology',
    label: 'Head of Geology',
    angle: 'Discipline leadership, FDP ownership, standards and mentoring',
    headline: 'Head of Geology · Discipline Leadership & Field Development',
    summary: 'Geoscience leader with 15+ years across NOC, IOC and JV environments, four major field development plans, and a record of raising team capability — in-house trainer, field-trip facilitator, 20+ publications, and consistent top-tier performance ratings at two supermajors.',
    includeTags: ['leadership', 'fdp', 'training', 'innovation', 'reservoir-mgmt', 'geology', 'geomodeling', 'ai'],
    boostTags: ['leadership', 'fdp', 'training', 'innovation'],
    maxBulletsPerEntry: 3,
    maxRoles: 4,
    sectionOrder: ['about', 'experience'],
    sidebar: ['education', 'skills', 'awards', 'publications'],
    maxPublications: 3,
    maxAwards: 6,
  },
  {
    id: 'head-digital-petroleum',
    label: 'Head of Digital Petroleum',
    angle: 'Digital transformation exec — product owner of agentic AI',
    headline: 'Head of Digital Petroleum · Subsurface AI, Data & Transformation',
    summary: 'Digital-petroleum leader who bridges the reservoir and the algorithm: architect of a 20-workflow reservoir-management ecosystem, inventor of six applied-ML products, and product owner of the first subsurface agentic AI at a giant offshore operator — matured to production, recognized by the CEO and VP Digital Solutions, and presented to QatarEnergy VIPs. Proven at turning geoscience workflows into adopted digital products.',
    includeTags: ['ai', 'ml', 'bi', 'software', 'data', 'leadership', 'innovation', 'training', 'publication'],
    boostTags: ['ai', 'ml', 'bi', 'leadership', 'innovation'],
    maxBulletsPerEntry: 3,
    maxRoles: 4,
    sectionOrder: ['about', 'experience', 'projects'],
    sidebar: ['skills', 'education', 'awards', 'publications'],
    maxPublications: 3,
    maxAwards: 5,
  },
]

export const templateById = (id: CvTemplateId) =>
  CV_TEMPLATES.find(t => t.id === id) ?? CV_TEMPLATES[0]

/** Per-template manual overrides: bulletId → forced on/off. */
export type CvOverrides = Record<string, boolean>

export type CvEntry = ExperienceEntry & { picked: { id: string; text: string }[] }
export type CvDoc = {
  headline: string
  summary: string
  entries: CvEntry[]
  /** Roles beyond maxRoles — rendered as one condensed "Earlier career" line. */
  earlier: ExperienceEntry[]
  sections: MasterSection[]           // in template order, minus experience/about
  sidebar: MasterSection[]
  publications: MasterSection | null
}

const scoreBullet = (tags: string[], tpl: CvTemplate) =>
  tags.reduce((n, t) => n + (tpl.boostTags.includes(t as Tag) ? 2 : 0), 0)

/**
 * THE SEAM. Pure: no store access, no side effects. Swap the body for an LLM
 * call and every caller keeps working.
 */
export function composeCv(profile: Profile, tpl: CvTemplate, overrides: CvOverrides = {}): CvDoc {
  const find = <K extends SectionKind>(k: K) => profile.master.find(s => s.kind === k)
  const expSection = find('experience')
  const all = expSection && expSection.kind === 'experience' ? expSection.entries : []

  const entries: CvEntry[] = all.map((e, i) => {
    const scored = e.bullets
      .map(bl => {
        const forced = overrides[bl.id]
        const matches = bl.tags.some(t => tpl.includeTags.includes(t))
        const on = forced === undefined ? matches : forced
        return { bl, on, score: scoreBullet(bl.tags, tpl) }
      })
      .filter(x => x.on)
      .sort((a, x) => x.score - a.score)

    let picked = scored.slice(0, tpl.maxBulletsPerEntry).map(x => ({ id: x.bl.id, text: x.bl.text }))
    // The two most recent roles always speak — a gap there reads as evasive.
    if (!picked.length && i < 2 && e.bullets.length) picked = [{ id: e.bullets[0].id, text: e.bullets[0].text }]
    return { ...e, picked }
  }).filter(e => e.picked.length > 0)

  // The oldest roles condense rather than disappear — the record stays honest
  // (no unexplained gap) and the page stays printable.
  const kept = entries.slice(0, tpl.maxRoles)
  const earlier: ExperienceEntry[] = entries.slice(tpl.maxRoles)

  const pubs = find('publications')
  const publications = pubs && pubs.kind === 'publications'
    ? { ...pubs, entries: pubs.entries
        .filter(p => p.tags.some(t => tpl.includeTags.includes(t)))
        .slice(0, tpl.maxPublications) }
    : null

  const awardsSec = find('awards')
  const awards = awardsSec && awardsSec.kind === 'awards'
    ? { ...awardsSec, items: awardsSec.items.slice(0, tpl.maxAwards) }
    : null

  const pick = (k: SectionKind): MasterSection | null =>
    (k === 'publications' ? publications : k === 'awards' ? awards : find(k)) ?? null

  const sections = tpl.sectionOrder
    .filter(k => k !== 'experience' && k !== 'about')
    .map(pick).filter(Boolean) as MasterSection[]

  const sidebar = tpl.sidebar.map(pick).filter(Boolean) as MasterSection[]

  return { headline: tpl.headline, summary: tpl.summary, entries: kept, earlier, sections, sidebar, publications }
}

/** Plain-text export — for pasting into ATS boxes and job portals. */
export function cvToText(profile: Profile, doc: CvDoc, twin: boolean): string {
  const id = profile.identity
  const L: string[] = [id.name, doc.headline]
  L.push([id.email, id.phone, id.location].filter(Boolean).join(' · '), '')
  L.push('SUMMARY', doc.summary, '')
  L.push('EXPERIENCE')
  doc.entries.forEach(e => {
    const co = twin && e.companyAlias ? e.companyAlias : e.company
    L.push(`${e.role} — ${co} · ${e.place} · ${e.years}`)
    e.picked.forEach(p => L.push(`  - ${p.text}`))
    L.push('')
  })
  if (doc.earlier.length) {
    L.push('EARLIER CAREER')
    doc.earlier.forEach(e => {
      const co = twin && e.companyAlias ? e.companyAlias : e.company
      L.push(`  ${e.role} — ${co} · ${e.years}`)
    })
    L.push('')
  }
  doc.sidebar.forEach(s => {
    L.push(s.title.toUpperCase())
    if (s.kind === 'education') s.entries.forEach(e => L.push(`  ${e.degree} ${e.field} — ${e.school}, ${e.years}`))
    if (s.kind === 'skills') s.groups.forEach(g => L.push(`  ${g.label}: ${g.items.join(', ')}`))
    if (s.kind === 'awards') s.items.forEach(a => L.push(`  - ${a.text}${a.year ? ` (${a.year})` : ''}`))
    if (s.kind === 'publications') s.entries.forEach(p => L.push(`  - ${p.title} — ${p.venue}${p.year ? `, ${p.year}` : ''}`))
    L.push('')
  })
  return L.join('\n')
}
