import { replyAudioUrl } from './registry'
import { speakBrowser } from '../lib/tts/tts'

// ─────────────────────────────────────────────────────────────────────────
// Spoken replies — Jarvis confirms each command out loud.
//
// Two tiers, "browser instant, Aura on top":
//   • If a cached Cloudflare-Aura mp3 exists for this command (reply_audio_path,
//     generated once via the media-proxy gateway), play that — crisp, consistent
//     Jarvis voice, zero per-play cost.
//   • Otherwise speak the text with the browser's SpeechSynthesis — instant,
//     offline, no network. Always available as the floor.
//
// The reply is fire-and-forget but returns a rough duration estimate so the
// caller (useVoice) can gate phrase-matching while Jarvis talks — otherwise
// "Opening Lashira" spoken aloud could be re-heard by the mic as a command.
// ─────────────────────────────────────────────────────────────────────────

let muted = false
export function setReplyMuted(v: boolean) { muted = v }
export function isReplyMuted() { return muted }

let currentAudio: HTMLAudioElement | null = null

/** Rough spoken length (ms) for a line, used to gate the mic. ~2.8 words/sec. */
function estimateSpeechMs(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(700, Math.round((words / 2.8) * 1000) + 350)
}

/**
 * Speak a command's confirmation. Returns the estimated speaking duration in
 * ms (0 if muted/empty) so the caller can suppress re-matching for that long.
 */
export function speakReply(text: string, audioPath: string | null): number {
  if (muted || !text.trim()) return 0

  // stop any overlapping reply first
  if (currentAudio) { currentAudio.pause(); currentAudio = null }

  const url = replyAudioUrl(audioPath)
  if (url) {
    try {
      const audio = new Audio(url)
      currentAudio = audio
      audio.onended = () => { if (currentAudio === audio) currentAudio = null }
      void audio.play().catch(() => { void speakBrowser(text, 'JM') }) // autoplay/cache miss → browser floor
      return estimateSpeechMs(text)
    } catch {
      // fall through to browser tier
    }
  }

  void speakBrowser(text, 'JM').catch(() => {})
  return estimateSpeechMs(text)
}

export function cancelReply() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
