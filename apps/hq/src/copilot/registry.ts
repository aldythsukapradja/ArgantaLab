import { useEffect, useState } from 'react'
import { supabase, cloudEnabled } from '../lib/supabase'
import {
  SEED_INTENTS, specFromRow, type CommandRow, type IntentSpec,
  type CommandCategory, type ActionKind,
} from './intents'

// ─────────────────────────────────────────────────────────────────────────
// Command registry — the DB-backed source of truth for voice/gesture
// commands. Reads hq_voice_command (public read, operator write) and turns
// each row into the same IntentSpec the matcher/cheat-sheet/replies consume.
//
// Fallback ladder (never throws, never leaves the copilot empty):
//   cloud disabled            → SEED_INTENTS
//   query errors / 0 rows     → SEED_INTENTS
//   rows present              → rows (with per-row reply audio path)
//
// So the copilot works identically offline; the DB just lets you add/remove
// commands without a deploy.
// ─────────────────────────────────────────────────────────────────────────

export interface RegistryEntry extends IntentSpec {
  /** Cached Cloudflare-Aura mp3 path in the voice-replies bucket, if generated. */
  replyAudioPath: string | null
}

interface CommandDbRow {
  intent_id: string
  category: string
  label: string
  phrases: string[]
  reply_text: string
  action_kind: string
  action_arg: string | null
  reply_audio_path: string | null
  enabled: boolean
  sort: number
}

const SEED_ENTRIES: RegistryEntry[] = SEED_INTENTS.map(spec => ({ ...spec, replyAudioPath: null }))

function entryFromDbRow(row: CommandDbRow): RegistryEntry {
  const commandRow: CommandRow = {
    id: row.intent_id,
    category: row.category as CommandCategory,
    label: row.label,
    phrases: row.phrases ?? [],
    reply: row.reply_text ?? '',
    actionKind: row.action_kind as ActionKind,
    actionArg: row.action_arg,
  }
  return { ...specFromRow(commandRow), replyAudioPath: row.reply_audio_path }
}

export async function loadCommandRegistry(): Promise<{ entries: RegistryEntry[]; source: 'db' | 'seed' }> {
  if (!cloudEnabled) return { entries: SEED_ENTRIES, source: 'seed' }
  try {
    const { data, error } = await supabase
      .from('hq_voice_command')
      .select('intent_id, category, label, phrases, reply_text, action_kind, action_arg, reply_audio_path, enabled, sort')
      .eq('enabled', true)
      .order('sort', { ascending: true })
    if (error) { console.warn('[copilot registry]', error.message); return { entries: SEED_ENTRIES, source: 'seed' } }
    if (!data || data.length === 0) return { entries: SEED_ENTRIES, source: 'seed' }
    return { entries: (data as CommandDbRow[]).map(entryFromDbRow), source: 'db' }
  } catch (e) {
    console.warn('[copilot registry] threw', (e as Error)?.message)
    return { entries: SEED_ENTRIES, source: 'seed' }
  }
}

/** Public URL for a cached reply mp3, or null. */
export function replyAudioUrl(path: string | null): string | null {
  if (!path || !cloudEnabled) return null
  const { data } = supabase.storage.from('voice-replies').getPublicUrl(path)
  return data?.publicUrl ?? null
}

/**
 * React hook: the live command set. Starts on the seed (so the copilot is
 * usable on first paint) and swaps to the DB set once loaded. `reload()` lets
 * the control tab (P3) refresh after an edit without a full page reload.
 */
export function useCommandRegistry() {
  const [entries, setEntries] = useState<RegistryEntry[]>(SEED_ENTRIES)
  const [source, setSource] = useState<'db' | 'seed'>('seed')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    void loadCommandRegistry().then(result => {
      if (!alive) return
      setEntries(result.entries)
      setSource(result.source)
    })
    return () => { alive = false }
  }, [reloadKey])

  const reload = () => setReloadKey(k => k + 1)
  return { entries, source, reload }
}
