/**
 * JOURNEY — the founder journey as an autoplaying cinematic slide deck.
 *
 * v3 replaced the scroll-scrub version. Three reasons, in order of importance:
 * the founder asked for slides with autoplay; a scroll runway inside HQ's own
 * scrolling shell needed real surgery to stop cropping (`--jt-vh`) and still
 * fought the pane; and a story that plays itself is what you want when you hand
 * someone a laptop. Scroll position is not a narrative — a timeline is.
 *
 * Still GSAP, still no timeline library, but ScrollTrigger is gone entirely:
 * one tween drives the rail, the year and the journey line off a slide index.
 *
 * Profile-agnostic by construction: chapters derive from the active profile's
 * experience entries, so Aldhyt, the Arganta twin and any future AI-influencer
 * persona render through the identical component. Photos are optional — without
 * them the era line and the year carry the chapter typographically.
 *
 * Autoplay etiquette: pauses on hover, on any manual nav (10s), and whenever the
 * document is hidden — a deck that keeps talking to an empty room is a bug.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { Pause, Play, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useBio, companyName, type Profile, type ExperienceEntry } from './biography'
import { LogoChip } from './parts'

const SLIDE_MS = 7000
const RESUME_MS = 10000

const firstYear = (y: string) => parseInt(y.match(/\d{4}/)?.[0] ?? '0', 10)

type Chapter = ExperienceEntry & { year: number }

function chapters(p: Profile): Chapter[] {
  const exp = (p.master.find(s => s.kind === 'experience') as any)?.entries ?? []
  return [...exp]
    .map((e: ExperienceEntry) => ({ ...e, year: firstYear(e.years) }))
    .sort((a: Chapter, b: Chapter) => a.year - b.year)
}

const reduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** The honest fallback: same story, no motion, no autoplay. */
function StaticSpine({ p, ch }: { p: Profile; ch: Chapter[] }) {
  return (
    <div className="jt-static">
      <h2>{p.identity.name} — the journey</h2>
      <ol>
        {ch.map(e => (
          <li key={e.id}>
            <LogoChip src={p.kind === 'twin' ? undefined : e.logo} name={companyName(e, p)} brand={e.brand} size={32} />
            <div>
              <b>{e.role}</b>
              <span>{companyName(e, p)} · {e.place}</span>
              {e.eraLine && <i className="jt-static-line">{e.eraLine}</i>}
              <ul>{e.bullets.slice(0, 2).map(b => <li key={b.id}>{b.text}</li>)}</ul>
            </div>
            <i>{e.years}</i>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function JourneyTimeline() {
  const { profiles, activeId } = useBio()
  const p = useMemo(() => profiles.find(x => x.id === activeId)!, [profiles, activeId])
  const ch = useMemo(() => chapters(p), [p])
  const twin = p.kind === 'twin'
  const still = reduced()

  // [hero, ...chapters, finale]
  const total = ch.length + 2
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [paused, setPaused] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const yearRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<SVGPathElement>(null)
  const idleRef = useRef<number>()
  const prevIdx = useRef(0)

  const y0 = ch[0]?.year ?? 2010
  const y1 = ch[ch.length - 1]?.year ?? new Date().getFullYear()

  /** The year shown behind a given slide: hero = first, finale = last. */
  const yearAt = useCallback((i: number) => {
    if (i === 0) return y0
    if (i === total - 1) return y1
    return ch[i - 1]?.year ?? y0
  }, [ch, total, y0, y1])

  const go = useCallback((n: number, manual = false) => {
    setIdx(() => ((n % total) + total) % total)
    if (manual) {
      // A manual nav means someone is driving — stop talking over them, then
      // pick the story back up if they go quiet.
      setPaused(true)
      window.clearTimeout(idleRef.current)
      idleRef.current = window.setTimeout(() => setPaused(false), RESUME_MS)
    }
  }, [total])

  // Autoplay. Never runs against a hidden document or a reduced-motion request.
  useEffect(() => {
    if (still || !playing || paused) return
    const t = window.setTimeout(() => setIdx(i => (i + 1) % total), SLIDE_MS)
    return () => window.clearTimeout(t)
  }, [idx, playing, paused, total, still])

  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    onVis()
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => () => window.clearTimeout(idleRef.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1, true) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1, true) }
      else if (e.key === ' ') { e.preventDefault(); setPlaying(v => !v) }
      else if (e.key.toLowerCase() === 'f') rootRef.current?.requestFullscreen?.().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, go])

  // The line's dash must match its real length, or "draw to here" lies.
  useLayoutEffect(() => {
    const line = lineRef.current
    if (still || !line) return
    const len = line.getTotalLength()
    gsap.set(line, { strokeDasharray: len, strokeDashoffset: len })
  }, [still, ch.length])

  // Everything the slide index means, in one place: the rail slides, the year
  // counts, the line draws to this chapter, the content arrives.
  //
  // Deliberately NOT wrapped in gsap.context(): its cleanup calls revert(),
  // which restores pre-tween inline styles. With `idx` in the deps that fires on
  // every slide change — snapping the rail back to zero before each transition.
  // Tweens here are meant to persist; they are killed on unmount instead.
  useLayoutEffect(() => {
    if (still || !ch.length) return
    const dir = idx >= prevIdx.current ? 1 : -1
    const from = yearAt(prevIdx.current)
    const to = yearAt(idx)
    prevIdx.current = idx

    gsap.to(railRef.current, {
      xPercent: (-100 / total) * idx,
      duration: .7, ease: 'power3.inOut', overwrite: true,
    })

    if (lineRef.current) {
      const len = lineRef.current.getTotalLength()
      gsap.to(lineRef.current, {
        strokeDashoffset: len * (1 - idx / Math.max(1, total - 1)),
        duration: .7, ease: 'power3.inOut', overwrite: true,
      })
    }

    const counter = { v: from }
    gsap.to(counter, {
      v: to, duration: .7, ease: 'power3.inOut', overwrite: true,
      onUpdate: () => { if (yearRef.current) yearRef.current.textContent = String(Math.round(counter.v)) },
    })

    // The active slide's content arrives just after the rail lands.
    const panel = rootRef.current?.querySelector(`[data-slide="${idx}"]`)
    if (panel) {
      gsap.fromTo(panel.querySelectorAll('.jt-rise'),
        { y: 20, opacity: 0, x: 26 * dir },
        { y: 0, opacity: 1, x: 0, duration: .55, stagger: .06, ease: 'power3.out', delay: .12, overwrite: true })
      gsap.fromTo(panel.querySelectorAll('.jt-photo'),
        { y: 34, opacity: 0, rotate: (i: number) => (i % 2 ? 4 : -3) },
        { y: 0, opacity: 1, duration: .8, stagger: .06, ease: 'power2.out', delay: .15, overwrite: true })
    }

    rootRef.current?.querySelectorAll('.jt-node').forEach((n, i) => {
      gsap.to(n, { scale: i === idx ? 1.5 : 1, duration: .4, ease: 'back.out(2)', overwrite: true })
    })
  }, [idx, still, ch.length, total, yearAt])

  // Kill only on unmount — a slide deck's transforms are supposed to persist.
  useEffect(() => () => {
    gsap.killTweensOf([railRef.current, lineRef.current])
    if (rootRef.current) gsap.killTweensOf(rootRef.current.querySelectorAll('.jt-rise, .jt-photo, .jt-node'))
  }, [])

  if (!ch.length) return <div className="jt-empty">Add a role in Master Profile — the journey draws itself from your record.</div>
  if (still) return <div className="bio-journey"><StaticSpine p={p} ch={ch} /></div>

  const running = playing && !paused

  return (
    <div
      className="bio-journey" ref={rootRef}
      style={{ '--accent': p.deck.accent } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { window.clearTimeout(idleRef.current); setPaused(document.hidden) }}
    >
      <div className="jt-grain" aria-hidden />
      <div className="jt-year" ref={yearRef} aria-hidden>{y0}</div>

      <div className="jt-rail" ref={railRef} style={{ width: `${total * 100}%` }}>
        {/* opening card */}
        <section className="jt-slide jt-hero" data-slide={0} style={{ width: `${100 / total}%` }}>
          <div className="jt-photo-ring jt-rise"><img src={p.identity.photo} alt="" /></div>
          <h1 className="jt-rise jt-hero-name">{p.identity.name}</h1>
          <p className="jt-rise jt-hero-line">{p.journey?.openerTagline ?? p.identity.headline}</p>
          <div className="jt-rise jt-hero-meta">{p.identity.location}</div>
        </section>

        {ch.map((e, i) => (
          <article className="jt-slide jt-ch" data-slide={i + 1} key={e.id} style={{ width: `${100 / total}%` }}>
            <div className="jt-ch-text">
              <div className="jt-rise jt-ch-co">
                <LogoChip src={twin ? undefined : e.logo} name={companyName(e, p)} brand={e.brand} size={44} />
                <div>
                  <b>{companyName(e, p)}</b>
                  <span>{e.place}</span>
                </div>
              </div>
              {e.team && <div className="jt-rise jt-ch-era">{e.era ? `Era ${e.era} — ` : ''}{e.team}</div>}
              <h2 className="jt-rise jt-ch-role">{e.role}</h2>
              <div className="jt-rise jt-ch-yrs">{e.years}</div>
              {e.eraLine && <p className="jt-rise jt-ch-line">{e.eraLine}</p>}
              <ul className="jt-ch-bullets">
                {e.bullets.slice(0, 3).map(b => <li className="jt-rise" key={b.id}>{b.text}</li>)}
              </ul>
            </div>

            <div className="jt-ch-media">
              {e.media?.photos?.length ? (
                e.media.photos.map((src, n) => (
                  <figure className="jt-photo" key={src} style={{ '--n': n } as React.CSSProperties}>
                    <img src={src} alt="" loading="lazy" />
                  </figure>
                ))
              ) : (
                <figure className="jt-photo jt-photo-ghost" style={{ '--n': 0 } as React.CSSProperties}>
                  <LogoChip src={twin ? undefined : e.logo} name={companyName(e, p)} brand={e.brand} size={92} />
                  <figcaption>{e.media?.caption ?? e.team ?? companyName(e, p)}</figcaption>
                </figure>
              )}
            </div>
          </article>
        ))}

        {/* finale */}
        <section className="jt-slide jt-finale" data-slide={total - 1} style={{ width: `${100 / total}%` }}>
          <h2 className="jt-rise">Now</h2>
          <div className="jt-stats">
            {p.deckStats.map(s => (
              <div className="jt-rise" key={s.id}><b>{s.value}</b><span>{s.label}</span></div>
            ))}
          </div>
          <p className="jt-rise jt-finale-line">
            {twin
              ? 'The tools changed. The mission did not.'
              : 'Fifteen years modelling what no one can see — now building the systems that decide with it.'}
          </p>
        </section>
      </div>

      {/* the journey line — draws to the chapter you are standing in */}
      <svg className="jt-line" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden>
        <path ref={lineRef} d="M 0 42 C 180 8, 320 56, 500 30 S 820 8, 1000 34"
          fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
          style={{ strokeDasharray: 1200, strokeDashoffset: 1200 }} />
      </svg>

      <button className="jt-zone jt-prev" onClick={() => go(idx - 1, true)} aria-label="Previous"><ChevronLeft size={22} /></button>
      <button className="jt-zone jt-next" onClick={() => go(idx + 1, true)} aria-label="Next"><ChevronRight size={22} /></button>

      {/* era rail — the spine you can click */}
      <div className="jt-eras">
        <button className={'jt-era' + (idx === 0 ? ' on' : '')} onClick={() => go(0, true)} title="Start">
          <span className="jt-node" data-node={0} /><em>{y0}</em>
        </button>
        {ch.map((e, i) => (
          <button key={e.id} className={'jt-era' + (idx === i + 1 ? ' on' : '')} onClick={() => go(i + 1, true)} title={e.team ?? e.role}>
            <span className="jt-node" data-node={i + 1} />
            <em>{e.year}</em>
          </button>
        ))}
        <button className={'jt-era' + (idx === total - 1 ? ' on' : '')} onClick={() => go(total - 1, true)} title="Now">
          <span className="jt-node" data-node={total - 1} /><em>Now</em>
        </button>
      </div>

      {/* autoplay progress — restarts with each slide, freezes when paused */}
      <div className="jt-bar" aria-hidden>
        <i key={idx} className={running ? 'run' : ''} style={{ animationDuration: `${SLIDE_MS}ms` }} />
      </div>

      <div className="jt-ctl">
        <button onClick={() => setPlaying(v => !v)} title={playing ? 'Pause (Space)' : 'Play (Space)'} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button onClick={() => rootRef.current?.requestFullscreen?.().catch(() => {})} title="Fullscreen (F)" aria-label="Fullscreen">
          <Maximize2 size={13} />
        </button>
        <span className="jt-count">{idx + 1} / {total}</span>
      </div>
    </div>
  )
}
