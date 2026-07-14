// Reusable karaoke / real-time speech-highlight engine — pure, framework-free.
// Auto-derives word timing from TEXT + a clip DURATION (no VTT, no ASR): a
// linguistic weight model distributes the clip across words, with pause bonuses
// after punctuation. Accepts explicit timings too, so it upgrades to real
// forced-alignment later without changing callers.
//
// Reused by: Cinema (WS1), and any surface that plays narration (agent replies,
// Video Builder, Music Studio, product tours). Depends on nothing.

export interface KWord {
  text: string
  phrase: number   // phrase index this word belongs to
  start: number    // normalized 0..1 across the whole text
  end: number      // normalized 0..1
}

export interface Karaoke {
  phrases: string[][] // words grouped into phrases (for phrase-window display)
  words: KWord[]      // flat, in order, with normalized [start,end)
  text: string
}

export interface KaraokeResolution {
  phrase: number       // active phrase index (-1 if none)
  word: number         // active word index within words[] (-1 if none)
  wordInPhrase: number // active word index within its phrase
  wordProgress: number // 0..1 through the active word
}

// Weight = spoken "cost" of a word. Longer words take longer; punctuation adds a
// pause the ear expects. Tuned to feel natural for calm narration (JM/KF).
function wordWeight(raw: string): number {
  const core = raw.replace(/[^\p{L}\p{N}]/gu, '')
  let w = Math.max(1, core.length) + 1.7 // base + inter-word gap
  if (/[,;:—-]$/.test(raw)) w += 2.2      // short pause
  if (/[.!?…]$/.test(raw)) w += 4.0       // sentence pause
  return w
}

// Split into phrases on sentence/clause punctuation, then words. One idea per
// phrase window keeps the on-screen line short and Apple-keynote-clean.
export function splitPhrases(text: string, maxWords = 12): string[][] {
  const clean = (text || '').trim()
  if (!clean) return []
  const clauses = clean.split(/(?<=[.!?;:])\s+|(?<=,)\s+/).filter(Boolean)
  const out: string[][] = []
  for (const clause of clauses) {
    const words = clause.trim().split(/\s+/).filter(Boolean)
    for (let i = 0; i < words.length; i += maxWords) out.push(words.slice(i, i + maxWords))
  }
  return out
}

export function buildKaraoke(text: string, maxWordsPerPhrase = 12): Karaoke {
  const phrases = splitPhrases(text, maxWordsPerPhrase)
  const flat: { text: string; phrase: number; w: number }[] = []
  phrases.forEach((words, pi) => words.forEach(t => flat.push({ text: t, phrase: pi, w: wordWeight(t) })))
  const total = flat.reduce((s, x) => s + x.w, 0) || 1
  let acc = 0
  const words: KWord[] = flat.map(x => {
    const start = acc / total
    acc += x.w
    return { text: x.text, phrase: x.phrase, start, end: acc / total }
  })
  return { phrases, words, text }
}

// Resolve which word/phrase is speaking at normalized progress (0..1). Pure —
// call it from a timeupdate handler, a rAF loop, or a scrubber.
export function resolveAt(k: Karaoke, progress: number): KaraokeResolution {
  const words = k.words
  if (!words.length) return { phrase: -1, word: -1, wordInPhrase: -1, wordProgress: 0 }
  const p = Math.max(0, Math.min(0.999999, Number.isFinite(progress) ? progress : 0))
  let idx = words.findIndex(w => p < w.end)
  if (idx === -1) idx = words.length - 1
  const w = words[idx]
  const span = Math.max(1e-6, w.end - w.start)
  const wordProgress = Math.max(0, Math.min(1, (p - w.start) / span))
  const wordInPhrase = idx - words.findIndex(x => x.phrase === w.phrase)
  return { phrase: w.phrase, word: idx, wordInPhrase, wordProgress }
}
