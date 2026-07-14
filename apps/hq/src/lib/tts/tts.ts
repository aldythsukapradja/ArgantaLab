// Tiered TTS router — mirrors @arganta/media-core's maturity model, simplified
// to THREE tiers. Routing walks DOWN, never silently up to a paid provider.
//
//   Tier 1  experiment  — browser Web Speech (SpeechSynthesis). Free, instant,
//                         speaks aloud for live experimentation. No baked file.
//   Tier 2  economical  — a cheap hosted TTS API. Returns audio bytes. NOT wired.
//   Tier 3  premium     — ElevenLabs (via MCP / server). Studio quality.
//                         Approval-gated. NOT wired.
//
// The Cinema editor uses Tier 1 today; Tiers 2–3 return a `deferred` descriptor
// the production pipeline fulfils. Voice map: JM = calm adult male, KF = warm
// adult female (the only two recorded voices).

export type TtsTier = 'experiment' | 'economical' | 'premium'
export type TtsVoice = 'JM' | 'KF'

export interface TtsRequest {
  text: string
  voice: TtsVoice
  tier: TtsTier
  approved?: boolean // required for premium
}

export interface TtsResult {
  status: 'spoken' | 'deferred' | 'failed'
  runtime: 'browser' | 'api' | 'mcp'
  provider: string
  tier: TtsTier
  cost: number
  audio?: Blob          // present when a tier produces bytes (2/3, later)
  descriptor?: unknown  // for deferred tiers — what the pipeline must run
  error?: string
}

export const TTS_TIERS: { id: TtsTier; label: string; provider: string; wired: boolean; note: string }[] = [
  { id: 'experiment', label: 'Experiment', provider: 'Browser Web Speech', wired: true, note: 'Free · instant preview · no file' },
  { id: 'economical', label: 'Economical', provider: 'Cheap hosted TTS', wired: false, note: 'Low cost · returns audio · not wired' },
  { id: 'premium', label: 'Premium', provider: 'ElevenLabs', wired: false, note: 'Studio quality · approval-gated' },
]

let cachedVoices: SpeechSynthesisVoice[] = []
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    if (typeof speechSynthesis === 'undefined') return resolve([])
    const now = speechSynthesis.getVoices()
    if (now.length) { cachedVoices = now; return resolve(now) }
    const handler = () => { cachedVoices = speechSynthesis.getVoices(); resolve(cachedVoices) }
    speechSynthesis.addEventListener('voiceschanged', handler, { once: true })
    setTimeout(() => resolve(cachedVoices), 500) // some browsers never fire the event
  })
}

// pick the best English voice matching the JM/KF gender intent
function pickVoice(voices: SpeechSynthesisVoice[], voice: TtsVoice): SpeechSynthesisVoice | undefined {
  const en = voices.filter(v => /^en(-|_|$)/i.test(v.lang))
  const pool = en.length ? en : voices
  const female = /female|samantha|victoria|karen|moira|tessa|zira|susan|fiona|serena/i
  const male = /male|daniel|alex|fred|david|george|arthur|oliver|tom|guy/i
  const want = voice === 'KF' ? female : male
  return pool.find(v => want.test(v.name)) || pool.find(v => (voice === 'KF' ? female : male).test(v.voiceURI)) || pool[0]
}

export interface SpeakHandle { cancel: () => void; done: Promise<void> }

/** Tier 1 — speak the text aloud in the browser. Returns a cancel handle. */
export async function speakBrowser(text: string, voice: TtsVoice): Promise<SpeakHandle> {
  if (typeof speechSynthesis === 'undefined') {
    return { cancel: () => {}, done: Promise.reject(new Error('Web Speech unavailable')) }
  }
  const voices = await loadVoices()
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice(voices, voice)
  if (v) u.voice = v
  u.rate = 0.98; u.pitch = voice === 'KF' ? 1.06 : 0.96
  const done = new Promise<void>((resolve) => { u.onend = () => resolve(); u.onerror = () => resolve() })
  speechSynthesis.speak(u)
  return { cancel: () => speechSynthesis.cancel(), done }
}

/** The router. Tier 1 speaks; Tiers 2–3 return a deferred descriptor for now. */
export async function synthesize(req: TtsRequest): Promise<TtsResult> {
  const base = { tier: req.tier, cost: 0 } as const
  if (req.tier === 'experiment') {
    try {
      const h = await speakBrowser(req.text, req.voice)
      await h.done
      return { ...base, status: 'spoken', runtime: 'browser', provider: 'Browser Web Speech' }
    } catch (e) {
      return { ...base, status: 'failed', runtime: 'browser', provider: 'Browser Web Speech', error: String(e) }
    }
  }
  if (req.tier === 'premium' && !req.approved) {
    return { ...base, status: 'failed', runtime: 'mcp', provider: 'ElevenLabs', error: 'approval_required' }
  }
  // economical + premium: not wired — hand a descriptor to the production pipeline
  return {
    ...base,
    status: 'deferred',
    runtime: req.tier === 'premium' ? 'mcp' : 'api',
    provider: req.tier === 'premium' ? 'ElevenLabs' : 'Cheap hosted TTS',
    descriptor: { text: req.text, voice: req.voice, tier: req.tier },
  }
}
