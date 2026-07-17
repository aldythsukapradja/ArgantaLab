// Voice Registry (S1) — the CENTRAL home for Arganta's voices. Copilot control
// (52 commands) and Cinema (46 scenes) should resolve voices BY ID from here
// instead of hard-coding JM/KF. Sovereign-only: engines are a browser preset or
// (later) local ComfyUI TTS — never a paid engine by default.
//
// Non-destructive foundation: this module is additive. The seeded defaults mean
// it works fully OFFLINE and before migration_audio_media.sql is run; the cloud
// loader upgrades it when signed in. Wiring Cinema/Copilot to read from here is
// a later, supervised step (it touches two working surfaces) — see Phase S1.
import { supabase, cloudEnabled } from './supabase'

export interface VoiceProfile {
  id: string
  name: string
  engine: 'browser' | 'comfy-tts'
  accent?: string
  gender?: 'male' | 'female' | 'neutral'
  samplePath?: string | null
  params: { rate?: number; pitch?: number; browserVoiceHint?: string }
  sort: number
}

// Seed = the two sovereign assistant voices. 'jarvis' is a STYLE (calm British
// RP assistant), NOT a clone of any actor's performance.
export const SEED_VOICES: VoiceProfile[] = [
  { id: 'jarvis', name: 'JM · Jarvis', engine: 'browser', accent: 'en-GB', gender: 'male', params: { rate: 0.98, pitch: 0.92, browserVoiceHint: 'en-GB male' }, sort: 1 },
  { id: 'lady', name: 'KF · Lady', engine: 'browser', accent: 'en-GB', gender: 'female', params: { rate: 1.0, pitch: 1.05, browserVoiceHint: 'en-GB female' }, sort: 2 },
]

export async function loadVoiceProfiles(): Promise<VoiceProfile[]> {
  if (!cloudEnabled) return SEED_VOICES
  try {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return SEED_VOICES
    const { data, error } = await supabase.from('voice_profile').select('*').order('sort', { ascending: true })
    if (error || !data?.length) return SEED_VOICES
    return data.map((r: any) => ({
      id: r.id, name: r.name, engine: r.engine, accent: r.accent, gender: r.gender,
      samplePath: r.sample_path, params: r.params ?? {}, sort: r.sort ?? 0,
    }))
  } catch { return SEED_VOICES }
}

export function voiceById(voices: VoiceProfile[], id: string): VoiceProfile | undefined {
  return voices.find(v => v.id === id)
}

/** Sovereign tier-0 audition: speak a line via the browser SpeechSynthesis in
 * the profile's voice. Zero cost, zero deps — the fallback every voice always
 * has. Local ComfyUI TTS (Phase O4) will slot in above this per profile. */
export function auditionVoice(text: string, profile: VoiceProfile): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.rate = profile.params.rate ?? 1
  u.pitch = profile.params.pitch ?? 1
  const voices = window.speechSynthesis.getVoices()
  const hint = profile.params.browserVoiceHint?.toLowerCase() || profile.accent?.toLowerCase() || ''
  const match = voices.find(v => (v.lang?.toLowerCase().includes('en-gb') && (
    profile.gender === 'female' ? /female|zira|hazel|libby|sonia/i.test(v.name)
      : profile.gender === 'male' ? /male|george|ryan|daniel/i.test(v.name) : true))) ||
    voices.find(v => v.lang?.toLowerCase().includes('en-gb')) ||
    voices.find(v => hint && v.name.toLowerCase().includes(hint))
  if (match) u.voice = match
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
