/**
 * Export for Core — serialize a profile to the markdown that becomes the ground
 * truth for downstream content (the Arganta Instagram knowledge base).
 *
 * Deliberately verbose and human-readable: this file is read by an LLM AND by
 * the founder, and it is the thing that stops content drifting from the record.
 * Twin profiles export ALIASES only — never the real employer names.
 */
import { companyName, type Profile } from './biography'
import { scrubTwin } from './twinText'

/**
 * Copy for LinkedIn — the profile as a person, ready to paste field by field.
 *
 * Not the same thing as the Core export: this is plain text with LinkedIn's own
 * section names, and it drops every `playbook` section — content pillars and
 * launch plans are not biography, and pasting them into a profile would read as
 * a campaign rather than a career. Twin text still goes through the scrub.
 */
export function profileToLinkedIn(p: Profile): string {
  const twin = p.kind === 'twin'
  const T = (s: string) => (twin ? scrubTwin(s) : s)
  const id = p.identity
  const L: string[] = []
  const rule = () => L.push('', '─'.repeat(52), '')

  L.push('NAME', id.name, '')
  L.push('HEADLINE', T(id.headline), '')
  if (id.tagline) L.push('TAGLINE', T(id.tagline), '')
  L.push('LOCATION', id.location, '')
  if (!twin && id.email) L.push('CONTACT', id.email + (id.phone ? ` · ${id.phone}` : ''), '')

  const sections = p.master.filter(s => !s.playbook)

  for (const s of sections) {
    rule()
    if (s.kind === 'about') {
      L.push('ABOUT', '')
      s.bullets.forEach(b => L.push(T(b.text), ''))
    }
    if (s.kind === 'experience') {
      L.push('EXPERIENCE', '')
      s.entries.forEach(e => {
        L.push(T(`${e.role}`))
        L.push(T(`${companyName(e, p)} · ${e.years}`))
        L.push(T(`${e.place}${e.team ? ` · ${e.team}` : ''}`), '')
        e.bullets.forEach(b => L.push('• ' + T(b.text)))
        L.push('')
      })
    }
    if (s.kind === 'education') {
      L.push('EDUCATION', '')
      s.entries.forEach(e => {
        L.push(T(`${e.school}`))
        L.push(T(`${e.degree}, ${e.field} · ${e.years}`))
        if (e.note) L.push(T(e.note))
        L.push('')
      })
    }
    if (s.kind === 'skills') {
      L.push('SKILLS', '')
      s.groups.forEach(g => g.items.forEach(i => L.push(T(i))))
      L.push('')
    }
    if (s.kind === 'projects') {
      L.push('PROJECTS', '')
      s.entries.forEach(e => L.push(T(`${e.name} — ${e.desc}`), ''))
    }
    if (s.kind === 'publications') {
      L.push('PUBLICATIONS', '')
      s.entries.forEach(e => {
        L.push(T(e.title))
        L.push(T(`${e.venue}${e.year ? ` · ${e.year}` : ''}`) + (e.url ? `\n${e.url}` : ''), '')
      })
    }
    if (s.kind === 'awards') {
      L.push('HONORS & AWARDS', '')
      s.items.forEach(a => {
        L.push(T(a.text) + (a.year ? ` · ${a.year}` : ''))
        if (a.detail) L.push(T(a.detail))
        L.push('')
      })
    }
    if (s.kind === 'custom') {
      L.push(s.title.toUpperCase(), '')
      s.bullets.forEach(b => L.push(T(b.text), ''))
    }
  }
  return L.join('\n').replace(/\n{3,}/g, '\n\n')
}

export function profileToMarkdown(p: Profile): string {
  const twin = p.kind === 'twin'
  const L: string[] = []
  const id = p.identity
  // Belt AND braces: the twin's seed is already de-identified, but a hand-edited
  // line could reintroduce an employer name — and this file feeds a PUBLIC feed.
  const T = (s: string) => (twin ? scrubTwin(s) : s)

  L.push('---')
  L.push(`title: ${id.name} — Profile (${twin ? 'public twin' : 'real record'})`)
  L.push(`date: ${new Date().toISOString().slice(0, 10)}`)
  L.push('type: reference')
  L.push('status: generated')
  L.push('source: Circle HQ · Biography Studio')
  L.push('---', '')
  L.push(`# ${id.name}`, '')
  L.push(`> ${id.headline}`, '')
  if (id.tagline) L.push(`_${id.tagline}_`, '')
  L.push(`**Location:** ${id.location}`)
  if (!twin && id.email) L.push(`**Email:** ${id.email}`)
  if (!twin && id.phone) L.push(`**Phone:** ${id.phone}`)
  L.push('')

  if (twin && p.publicRules?.length) {
    L.push('## Non-negotiables', '')
    p.publicRules.forEach(r => L.push(`- ${r}`))
    L.push('')
  }

  p.master.forEach(s => {
    L.push(`## ${s.title}`, '')
    if (s.kind === 'about' || s.kind === 'custom') {
      s.bullets.forEach(b => L.push(`- ${T(b.text)}`))
    }
    if (s.kind === 'experience') {
      s.entries.forEach(e => {
        L.push(T(`### ${e.era ? `Era ${e.era} — ` : ''}${e.role}${e.era ? '' : ` — ${companyName(e, p)}`}`))
        L.push(`_${[e.team, companyName(e, p), e.place, e.years].filter(Boolean).join(' · ')}_`, '')
        // The era's brand line is the payoff a post is written around — it
        // belongs in the knowledge base, not just on the slide.
        if (e.eraLine) L.push(`> ${T(e.eraLine)}`, '')
        e.bullets.forEach(b => L.push(`- ${T(b.text)}`))
        L.push('')
      })
    }
    if (s.kind === 'education') s.entries.forEach(e => L.push(T(`- **${e.degree} ${e.field}** — ${e.school}, ${e.place} (${e.years})${e.note ? ` · ${e.note}` : ''}`)))
    if (s.kind === 'skills') s.groups.forEach(g => L.push(T(`- **${g.label}:** ${g.items.join(' · ')}`)))
    if (s.kind === 'awards') s.items.forEach(a => L.push(T(`- ${a.text}${a.year ? ` (${a.year})` : ''}${a.detail ? ` — ${a.detail}` : ''}`)))
    // Titles stay verbatim (the papers are public record); only the venue can
    // name the employer, so it goes through the same scrub.
    if (s.kind === 'publications') s.entries.forEach(e => L.push(`- ${e.title} — ${T(e.venue)}${e.year ? `, ${e.year}` : ''}${e.url ? ` · ${e.url}` : ''}`))
    if (s.kind === 'projects') s.entries.forEach(e => L.push(T(`- **${e.name}** — ${e.desc}`)))
    L.push('')
  })

  L.push('## Numbers', '')
  p.deckStats.forEach(s => L.push(`- **${s.value}** ${s.label}`))
  L.push('')

  return L.join('\n')
}
