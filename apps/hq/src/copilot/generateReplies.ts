import { supabase, cloudEnabled } from '../lib/supabase'
import { synthesize, type TtsVoice } from '../lib/tts/tts'

// ─────────────────────────────────────────────────────────────────────────
// Reply-audio generation pass (operator-only, run on demand).
//
// For every enabled command whose reply_audio_path is null, synthesize the
// reply_text through the Cloudflare Aura-1 tier (tts.ts → media-proxy) using
// that row's reply_voice (JM/KF), upload the mp3 to the voice-replies bucket,
// and write the path back onto the row. Run once; cached forever; re-run
// after editing reply_text/reply_voice (clear the path first to force a
// re-gen — the control tab's "Regenerate" button does this per row). Honest:
// rows that fail to synthesize are left with a null path and simply fall
// back to browser speech at play time.
// ─────────────────────────────────────────────────────────────────────────

export interface GenerateResult {
  attempted: number
  generated: number
  failed: number
  skipped: number
  errors: string[]
}

interface Pending { id: string; intent_id: string; reply_text: string; reply_voice: string | null }

async function synthesizeAndStore(row: Pending): Promise<{ ok: true } | { ok: false; skipped: boolean; error?: string }> {
  const voice = (row.reply_voice === 'KF' ? 'KF' : 'JM') as TtsVoice
  const tts = await synthesize({ text: row.reply_text, voice, tier: 'economical' })
  if (tts.status !== 'spoken' || !tts.audio) return { ok: false, skipped: true } // gateway unreachable → leave null

  const path = `${row.intent_id}.mp3`
  const { error: upErr } = await supabase.storage
    .from('voice-replies')
    .upload(path, tts.audio, { upsert: true, contentType: tts.audio.type || 'audio/mpeg' })
  if (upErr) return { ok: false, skipped: false, error: upErr.message }

  const { error: updErr } = await supabase
    .from('hq_voice_command')
    .update({ reply_audio_path: path })
    .eq('id', row.id)
  if (updErr) return { ok: false, skipped: false, error: updErr.message }

  return { ok: true }
}

/** Bulk pass: every enabled row missing cached audio. */
export async function generateReplyAudio(
  onProgress?: (done: number, total: number, label: string) => void,
): Promise<GenerateResult> {
  const result: GenerateResult = { attempted: 0, generated: 0, failed: 0, skipped: 0, errors: [] }
  if (!cloudEnabled) { result.errors.push('cloud disabled'); return result }

  const { data, error } = await supabase
    .from('hq_voice_command')
    .select('id, intent_id, reply_text, reply_voice, reply_audio_path')
    .eq('enabled', true)
    .is('reply_audio_path', null)
  if (error) { result.errors.push(error.message); return result }

  const pending = (data ?? []).filter((r): r is Pending & { reply_audio_path: null } => !!r.reply_text?.trim())
  const total = pending.length

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i]
    onProgress?.(i, total, row.intent_id)
    result.attempted++
    try {
      const outcome = await synthesizeAndStore(row)
      if (!outcome.ok) {
        if (outcome.skipped) result.skipped++
        else { result.failed++; result.errors.push(`${row.intent_id}: ${outcome.error}`) }
        continue
      }
      result.generated++
    } catch (e) {
      result.failed++
      result.errors.push(`${row.intent_id}: ${(e as Error)?.message}`)
    }
  }
  onProgress?.(total, total, 'done')
  return result
}

/** Regenerate a single row's cached reply — used by the control tab's per-row
 *  "Regenerate" button (e.g. after editing reply_text or reply_voice). */
export async function regenerateReplyAudio(intentId: string): Promise<{ ok: boolean; error?: string }> {
  if (!cloudEnabled) return { ok: false, error: 'cloud disabled' }
  const { data, error } = await supabase
    .from('hq_voice_command')
    .select('id, intent_id, reply_text, reply_voice')
    .eq('intent_id', intentId)
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'not found' }
  if (!data.reply_text?.trim()) return { ok: false, error: 'no reply text' }

  const outcome = await synthesizeAndStore(data as Pending)
  if (!outcome.ok) return { ok: false, error: outcome.skipped ? 'gateway unavailable' : outcome.error }
  return { ok: true }
}
