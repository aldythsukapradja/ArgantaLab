// React bindings for the karaoke engine. `useKaraoke` samples an <audio> element
// on a rAF loop that is GATED on playing + tab-visible (no idle CPU burn), and
// falls back to the audio's own progress when paused. `<KaraokeLine>` renders the
// word-by-word highlight. Both are reusable anywhere narration plays.
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildKaraoke, resolveAt, type KaraokeResolution } from './karaoke'

export function useKaraoke(
  audio: HTMLAudioElement | null,
  text: string,
  playing: boolean,
  maxWordsPerPhrase = 12,
): { karaoke: ReturnType<typeof buildKaraoke>; res: KaraokeResolution } {
  const karaoke = useMemo(() => buildKaraoke(text, maxWordsPerPhrase), [text, maxWordsPerPhrase])
  const [res, setRes] = useState<KaraokeResolution>({ phrase: -1, word: -1, wordInPhrase: -1, wordProgress: 0 })
  const raf = useRef(0)

  useEffect(() => {
    const sample = () => {
      const d = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
      const p = d ? (audio!.currentTime / d) : 0
      setRes(resolveAt(karaoke, p))
    }
    sample() // paint immediately on scene/pause change
    if (!playing) return
    const loop = () => {
      if (document.hidden) { raf.current = requestAnimationFrame(loop); return }
      sample()
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [audio, karaoke, playing])

  return { karaoke, res }
}

export function KaraokeLine({
  audio, text, playing, className = '', maxWordsPerPhrase = 12, showUpcoming = true,
}: {
  audio: HTMLAudioElement | null
  text: string
  playing: boolean
  className?: string
  maxWordsPerPhrase?: number
  showUpcoming?: boolean
}) {
  const { karaoke, res } = useKaraoke(audio, text, playing, maxWordsPerPhrase)
  const phrases = karaoke.phrases
  const activePhrase = res.phrase >= 0 ? res.phrase : 0
  const words = phrases[activePhrase] ?? []
  // index of the active word within this phrase
  const active = res.phrase === activePhrase ? res.wordInPhrase : -1

  return (
    <div className={'kara ' + className} aria-live="off">
      <div className="kara-line">
        {words.map((w, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'upcoming'
          if (!showUpcoming && state === 'upcoming') return <span key={i} className="kara-word upcoming">{w}</span>
          return <span key={i} className={'kara-word ' + state}>{w}</span>
        })}
      </div>
      {phrases.length > 1 && <span className="kara-idx">{activePhrase + 1}/{phrases.length}</span>}
    </div>
  )
}
