// C5 · Vault → memory_chunk sync. The Vault is local-first (localStorage,
// storage.ts) — there is no server-side access to it, so this runs in the
// browser: chunk each note's body, embed each chunk (media-proxy's CF
// bge-base-en-v1.5, C2), upsert into memory_chunk. Explicit/manual action
// (VaultSettings "Sync to Core memory" button) rather than automatic on
// every load — keeps embedding calls (and their neuron cost) predictable,
// not a surprise background job.
import type { VaultNote } from './types'
import { embedTextViaGateway } from '../lib/mediaGateway'
import { supabase, cloudEnabled } from '../lib/supabase'

export interface NoteChunk { ref: string; content: string }

// bge-base-en-v1.5 has a real token ceiling; this char budget keeps a chunk
// comfortably inside it after tokenization overhead without needing a real
// tokenizer just to estimate length.
export const MAX_CHUNK_CHARS = 1600

/** One chunk per note if it fits; otherwise packed paragraph-by-paragraph so
 * a chunk never splits mid-paragraph. Each chunk is prefixed with the note's
 * title/product/type — retrieval quality suffers badly on bare body text
 * with no context of what the note even is. Empty-body notes produce zero
 * chunks (nothing meaningful to embed). */
export function chunkNoteBody(note: VaultNote): NoteChunk[] {
  const header = `${note.fm.title} — ${note.fm.product} ${note.fm.type}\n\n`
  const body = note.body.trim()
  if (!body) return []

  const full = header + body
  if (full.length <= MAX_CHUNK_CHARS) return [{ ref: note.id, content: full }]

  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const packed: string[] = []
  let current = header
  for (const p of paras) {
    if (current.length + p.length + 2 > MAX_CHUNK_CHARS && current !== header) {
      packed.push(current.trim())
      current = header
    }
    current += p + '\n\n'
  }
  if (current.trim() !== header.trim()) packed.push(current.trim())

  // A single giant paragraph with no blank-line breaks can still exceed the
  // budget on its own — hard-wrap it rather than shipping one huge chunk.
  const final: string[] = []
  for (const c of packed) {
    if (c.length <= MAX_CHUNK_CHARS) { final.push(c); continue }
    for (let i = 0; i < c.length; i += MAX_CHUNK_CHARS) final.push(header + c.slice(i, i + MAX_CHUNK_CHARS))
  }

  return final.map((content, i) => ({ ref: final.length > 1 ? `${note.id}#${i + 1}` : note.id, content }))
}

export interface SyncResult {
  notesProcessed: number
  chunksEmbedded: number
  chunksSkipped: number
  costUsd: number
  errors: string[]
}

/** Re-embeds the whole Vault. Deletes each note's prior chunks first
 * (memory_chunk_upsert is insert-only) so an edited or shortened note never
 * leaves stale duplicates behind. Best-effort per note — one note's failure
 * doesn't stop the rest; failures are collected in `errors`, not thrown. */
export async function syncVaultToMemory(
  notes: Record<string, VaultNote>,
  onProgress?: (done: number, total: number) => void,
): Promise<SyncResult> {
  const result: SyncResult = { notesProcessed: 0, chunksEmbedded: 0, chunksSkipped: 0, costUsd: 0, errors: [] }
  if (!cloudEnabled) { result.errors.push('offline — Supabase not connected'); return result }

  const list = Object.values(notes)
  for (let i = 0; i < list.length; i++) {
    const note = list[i]
    onProgress?.(i, list.length)
    const chunks = chunkNoteBody(note)

    const { error: delErr } = await supabase.rpc('memory_chunk_delete_by_ref', { p_source: 'vault', p_ref: note.id })
    if (delErr) { result.errors.push(`${note.id}: delete failed — ${delErr.message}`); continue }
    if (!chunks.length) { result.notesProcessed++; continue }

    for (const chunk of chunks) {
      const e = await embedTextViaGateway({ text: chunk.content })
      if (!e) { result.chunksSkipped++; result.errors.push(`${note.id}: embedding unavailable`); continue }
      const { error } = await supabase.rpc('memory_chunk_upsert', {
        chunk: { source: 'vault', ref: chunk.ref, content: chunk.content, data_class: 'internal', embedding: e.embedding },
      })
      if (error) { result.errors.push(`${chunk.ref}: upsert failed — ${error.message}`); continue }
      result.chunksEmbedded++
      result.costUsd += e.costUsd
    }
    result.notesProcessed++
  }
  onProgress?.(list.length, list.length)
  return result
}
