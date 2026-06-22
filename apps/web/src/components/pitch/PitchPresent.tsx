import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { PITCH_SLIDES, TEMPLATE_BY_KEY, type PitchDeck } from '@lib/pitch'

const SLIDE_EMOJI: Record<string, string> = {
  title: '🎮', idea: '💡', play: '🕹️', best: '🌟', learned: '🧠', cta: '🚀',
}
const PARTICLE: Record<string, string> = { stars: '⭐', sparkles: '✨', energy: '⚡', bubbles: '🫧', leaves: '🍃' }

// The full-screen cinematic pitch player, shared by the Pitch Studio and the
// Ship showcase. GSAP drives both the per-slide reveal and the floating particles.
export default function PitchPresent({ deck, onExit }: { deck: PitchDeck; onExit: () => void }) {
  const t = TEMPLATE_BY_KEY[deck.template]
  const [i, setI] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const slide = PITCH_SLIDES[i]
  const text = deck.slides[slide.key] || slide.hint

  useEffect(() => {
    if (!content.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.pp-emoji', { scale: 0, rotate: -40, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)' })
      gsap.fromTo('.pp-label', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.12 })
      gsap.fromTo('.pp-text', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, delay: 0.24 })
    }, content)
    return () => ctx.revert()
  }, [i])

  useEffect(() => {
    if (!stage.current) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.pp-particle').forEach((p, idx) => {
        gsap.to(p, { y: '-=40', x: `+=${(idx % 2 ? 1 : -1) * 16}`, rotation: idx % 2 ? 20 : -20,
          duration: 3 + (idx % 4), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: idx * 0.2 })
      })
    }, stage)
    return () => ctx.revert()
  }, [])

  const next = () => setI(v => Math.min(5, v + 1))
  const prev = () => setI(v => Math.max(0, v - 1))
  const pe = PARTICLE[t.particle]

  return createPortal(
    <div className="pp-overlay" ref={stage} style={{ background: `linear-gradient(150deg, ${t.c1}, ${t.c2})` }}>
      <div className="pp-particles" aria-hidden>
        {Array.from({ length: 14 }, (_, k) => (
          <span key={k} className="pp-particle" style={{ left: `${(k * 37) % 100}%`, top: `${(k * 53) % 100}%`, fontSize: `${14 + (k % 4) * 6}px`, opacity: 0.5 }}>{pe}</span>
        ))}
      </div>

      <button className="pp-exit" onClick={onExit}>✕</button>

      <div className="pp-content" ref={content} key={i}>
        <span className="pp-emoji">{i === 0 ? t.emoji : SLIDE_EMOJI[slide.key]}</span>
        <div className="pp-label">{slide.label}</div>
        <div className="pp-text">{text}</div>
        {i === 0 && <div className="pp-author">by {deck.author}</div>}
      </div>

      <div className="pp-bar">
        <button className="pp-nav" disabled={i === 0} onClick={prev}>←</button>
        <div className="pp-dots">
          {PITCH_SLIDES.map((s, k) => <span key={s.key} className={`pp-dot${k === i ? ' on' : ''}`} onClick={() => setI(k)} />)}
        </div>
        {i < 5 ? <button className="pp-nav" onClick={next}>→</button> : <button className="pp-nav done" onClick={onExit}>✓</button>}
      </div>
    </div>,
    document.body,
  )
}
