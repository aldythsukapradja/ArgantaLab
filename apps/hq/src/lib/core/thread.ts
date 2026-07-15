// C3 · Arganta Core thread persistence — thin wrapper over the C2 RPCs
// (migration_arganta_core.sql), translated through @arganta/agent's frozen
// row-mapping contract (thread.js messageToRow/messageFromRow) so this file
// can't silently drift from what C1 froze.
import { messageToRow, messageFromRow } from '@arganta/agent'
import { supabase, cloudEnabled } from '../supabase'

export interface CoreMessage {
  id: string; threadId: string; role: 'user' | 'assistant' | 'tool' | 'system'
  content: string; blocks: Record<string, unknown>[]; toolCalls: Record<string, unknown>[]
  runId: string | null; createdAt: string
}

export async function createThread(title = 'New thread'): Promise<string | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('core_thread_create', { p_title: title })
  if (error) { console.warn('[core_thread_create]', error.message); return null }
  return data as string
}

export async function listRecentThreads(limit = 50): Promise<{ id: string; title: string; updatedAt: string }[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('core_threads_recent', { p_limit: limit })
  if (error) { console.warn('[core_threads_recent]', error.message); return [] }
  return (data || []).map((r: any) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }))
}

export async function loadMessages(threadId: string): Promise<CoreMessage[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('core_messages_for_thread', { p_thread_id: threadId })
  if (error) { console.warn('[core_messages_for_thread]', error.message); return [] }
  return (data || []).map((r: any) => messageFromRow(r) as CoreMessage)
}

/** Persists one message via the row-mapping contract. Best-effort — a failed
 * save is logged, never thrown (the conversation already happened in memory;
 * losing persistence for one message shouldn't crash the turn). */
export async function appendMessage(m: {
  id: string; threadId: string; role: CoreMessage['role']; content?: string
  blocks?: Record<string, unknown>[]; toolCalls?: Record<string, unknown>[]; runId?: string | null
}): Promise<void> {
  if (!cloudEnabled) return
  const row = messageToRow({ ...m, blocks: m.blocks ?? [], toolCalls: m.toolCalls ?? [], runId: m.runId ?? null, createdAt: new Date().toISOString() })
  const { error } = await supabase.rpc('core_message_append', { message: row })
  if (error) console.warn('[core_message_append]', error.message)
}
