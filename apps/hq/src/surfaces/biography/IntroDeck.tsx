/**
 * INTRO DECK — the introduction you show an investor, composed from the master
 * profile. There is no deck data: edit the CV, the deck moves. Slides are
 * derived, never authored.
 *
 * Keys: ← → move · F fullscreen · Esc exits fullscreen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Mail, Phone, MapPin } from 'lucide-react'
import { useBio, companyName, type Profile } from './biography'
import { LogoChip } from './parts'

type Slide = { id: string; kind: string; render: () => JSX.Element }

function useSlides(p: Profile): Slide[] {
  return useMemo(() => {
    const twin = p.kind === 'twin'
    const exp = (p.master.find(s => s.kind === 'experience') as any)?.entries ?? []
    const featured = exp.filter((e: any) => e.highlight)
    const awards = (p.master.find(s => s.kind === 'awards') as any)?.items ?? []
    const projects = (p.master.find(s => s.kind === 'projects') as any)?.entries ?? []
    const canonModel = p.master.find(s => s.id === 'canon-mental-model') as any
    const arganta = projects.find((x: any) => /arganta/i.test(x.name))

    const S: Slide[] = []

    S.push({ id: 'title', kind: 'title', render: () => (
      <div className="dk-title">
        <div className="dk-photo"><img src={p.identity.photo} alt="" /></div>
        <h1>{p.identity.name}</h1>
        <p className="dk-head">{p.identity.headline}</p>
        <div className="dk-loc"><MapPin size={12} /> {p.identity.location}</div>
      </div>
    ) })

    S.push({ id: 'stats', kind: 'stats', render: () => (
      <div className="dk-pad">
        <h2 className="dk-h2">In numbers</h2>
        <div className="dk-stats">
          {p.deckStats.map(s => (
            <div className="dk-stat" key={s.id}><b>{s.value}</b><span>{s.label}</span></div>
          ))}
        </div>
      </div>
    ) })

    // The twin's record IS its eras, so its journey slide shows five
    // transformations with their brand lines; the real profile shows employers.
    S.push({ id: 'journey', kind: 'journey', render: () => (
      <div className="dk-pad">
        <h2 className="dk-h2">The journey</h2>
        <div className="dk-track">
          {[...exp].reverse().map((e: any, i: number) => (
            <div className={'dk-stop' + (e.era ? ' dk-stop-era' : '')} key={e.id} style={{ '--i': i } as React.CSSProperties}>
              <LogoChip src={twin ? undefined : e.logo} name={companyName(e, p)} brand={e.brand} size={40} />
              <b>{e.era ? e.team : companyName(e, p)}</b>
              <span>{e.role}</span>
              <em>{e.years}</em>
              {e.eraLine && <i className="dk-stop-line">{e.eraLine}</i>}
            </div>
          ))}
        </div>
      </div>
    ) })

    if (featured.length) S.push({ id: 'now', kind: 'now', render: () => (
      <div className="dk-pad">
        <h2 className="dk-h2">Now</h2>
        <div className="dk-now">
          {featured.map((e: any) => (
            <div className="dk-card" key={e.id}>
              <div className="dk-card-hd">
                <LogoChip src={twin ? undefined : e.logo} name={companyName(e, p)} brand={e.brand} size={34} />
                <div><b>{e.role}</b><span>{companyName(e, p)} · {e.years}</span></div>
              </div>
              <ul>{e.bullets.slice(0, 3).map((b: any) => <li key={b.id}>{b.text}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    ) })

    if (projects.length) S.push({ id: 'builds', kind: 'builds', render: () => (
      <div className="dk-pad">
        <h2 className="dk-h2">What I build</h2>
        <div className="dk-builds">
          {projects.map((pr: any) => (
            <div className="dk-build" key={pr.id}><b>{pr.name}</b><span>{pr.desc}</span></div>
          ))}
        </div>
      </div>
    ) })

    if (awards.length) S.push({ id: 'awards', kind: 'awards', render: () => (
      <div className="dk-pad">
        <h2 className="dk-h2">Recognition</h2>
        <ul className="dk-awards">
          {awards.slice(0, 7).map((a: any) => (
            <li key={a.id}><span className="dk-gold" /><div><b>{a.text}</b>{a.detail && <em>{a.detail}</em>}</div>{a.year && <i>{a.year}</i>}</li>
          ))}
        </ul>
      </div>
    ) })

    if (canonModel || arganta) S.push({ id: 'core', kind: 'core', render: () => (
      <div className="dk-pad dk-core">
        <h2 className="dk-h2">{twin ? 'Arganta Core' : 'Beyond the CV'}</h2>
        {canonModel ? (
          <div className="dk-chain">
            {'Geology · systems thinking · geomodelling · automation · business intelligence · statistical modelling · machine learning · digital products · agentic AI · Arganta Core'
              .split(' · ').map((step, i) => (
                <span className="dk-chain-step" key={step} style={{ '--i': i } as React.CSSProperties}>{step}</span>
              ))}
          </div>
        ) : (
          <p className="dk-lead">{arganta?.desc}</p>
        )}
        <p className="dk-note">A continuous evolution — not an abrupt career change.</p>
      </div>
    ) })

    S.push({ id: 'contact', kind: 'contact', render: () => (
      <div className="dk-title dk-contact">
        <h2 className="dk-h2">Let’s talk</h2>
        <div className="dk-contacts">
          {p.identity.email && <a href={`mailto:${p.identity.email}`}><Mail size={14} /> {p.identity.email}</a>}
          {p.identity.phone && <span><Phone size={14} /> {p.identity.phone}</span>}
          {p.identity.links.filter(l => l.url).map(l => <a key={l.id} href={l.url} target="_blank" rel="noreferrer">{l.label}</a>)}
        </div>
      </div>
    ) })

    return S
  }, [p])
}

export function IntroDeck() {
  const { profiles, activeId } = useBio()
  const p = useMemo(() => profiles.find(x => x.id === activeId)!, [profiles, activeId])
  const slides = useSlides(p)
  const [i, setI] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const clamp = useCallback((n: number) => Math.max(0, Math.min(slides.length - 1, n)), [slides.length])
  useEffect(() => { setI(n => clamp(n)) }, [clamp])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setI(n => clamp(n + 1)) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setI(n => clamp(n - 1)) }
      if (e.key.toLowerCase() === 'f') wrapRef.current?.requestFullscreen?.().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clamp])

  const s = slides[i]

  return (
    <div className="bio-deck" ref={wrapRef} style={{ '--accent': p.deck.accent } as React.CSSProperties}>
      <div className="dk-stage" key={s.id}>{s.render()}</div>

      <button className="dk-zone dk-prev" onClick={() => setI(n => clamp(n - 1))} aria-label="Previous"><ChevronLeft size={20} /></button>
      <button className="dk-zone dk-next" onClick={() => setI(n => clamp(n + 1))} aria-label="Next"><ChevronRight size={20} /></button>

      <div className="dk-dots">
        {slides.map((sl, n) => (
          <button key={sl.id} className={'dk-dot' + (n === i ? ' on' : '')} onClick={() => setI(n)} aria-label={sl.kind} />
        ))}
      </div>
      <button className="dk-full" onClick={() => wrapRef.current?.requestFullscreen?.().catch(() => {})} title="Fullscreen (F)"><Maximize2 size={13} /></button>
      <div className="dk-count">{i + 1} / {slides.length}</div>
    </div>
  )
}
