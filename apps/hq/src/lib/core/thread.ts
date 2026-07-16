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

export interface ThreadSummary {
  id: string; title: string; updatedAt: string
  /** Both are undefined until migration_core_projects.sql is applied — the
   * drawer treats that as "this deployment has no pinning/projects yet" rather
   * than inventing defaults that would silently mis-sort the list. */
  pinned?: boolean
  projectId?: string | null
  snippet?: string | null
}

export async function listRecentThreads(limit = 50): Promise<ThreadSummary[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('core_threads_recent', { p_limit: limit })
  if (error) { console.warn('[core_threads_recent]', error.message); return [] }
  return (data || []).map((r: any) => ({ id: r.id, title: r.title, updatedAt: r.updated_at, pinned: r.pinned, projectId: r.project_id }))
}

// ── C5-B3 · Drawer v2 (needs migration_core_projects.sql) ─────────────────
// Every function here degrades to a falsy/empty result when the migration
// hasn't been applied, so the drawer can ASK the DB what it supports instead of
// assuming. `projectsSupported` is the single probe the UI uses to decide
// between the full drawer and the honest "run the migration" note — no feature
// flag to forget to flip.

export interface CoreProject { id: string; name: string; emoji: string | null; context: string | null; updatedAt: string }

/** Why the drawer can't show projects — so the UI names the ACTUAL cause
 * instead of blaming the migration for what is really an offline session. */
export type ProjectsSupport = 'ok' | 'offline' | 'needs-migration'

let projectsSupportedCache: ProjectsSupport | null = null
export async function projectsSupported(): Promise<ProjectsSupport> {
  if (projectsSupportedCache !== null) return projectsSupportedCache
  if (!cloudEnabled) { projectsSupportedCache = 'offline'; return 'offline' }
  const { error } = await supabase.rpc('core_projects_recent', { p_limit: 1 })
  // An 'operator only' raise means the RPC EXISTS and we simply aren't allowed —
  // a permission problem, not a missing migration, and it must not be reported
  // as "run the migration". Only a missing function means unsupported.
  projectsSupportedCache = (!error || !/does not exist|schema cache/i.test(error.message)) ? 'ok' : 'needs-migration'
  return projectsSupportedCache
}

export async function listProjects(): Promise<CoreProject[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('core_projects_recent', { p_limit: 50 })
  if (error) { console.warn('[core_projects_recent]', error.message); return [] }
  return (data || []).map((r: any) => ({ id: r.id, name: r.name, emoji: r.emoji, context: r.context, updatedAt: r.updated_at }))
}

export async function createProject(name: string, emoji?: string, context?: string): Promise<string | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('core_project_create', { p_name: name, p_emoji: emoji ?? null, p_context: context ?? null })
  if (error) { console.warn('[core_project_create]', error.message); return null }
  return data as string
}

export async function deleteProject(id: string): Promise<boolean> {
  return rpcOk('core_project_delete', { p_id: id })
}
export async function renameThread(id: string, title: string): Promise<boolean> {
  return rpcOk('core_thread_rename', { p_id: id, p_title: title })
}
export async function setThreadPinned(id: string, pinned: boolean): Promise<boolean> {
  return rpcOk('core_thread_set_pinned', { p_id: id, p_pinned: pinned })
}
export async function setThreadProject(id: string, projectId: string | null): Promise<boolean> {
  return rpcOk('core_thread_set_project', { p_id: id, p_project_id: projectId })
}
export async function deleteThread(id: string): Promise<boolean> {
  return rpcOk('core_thread_delete', { p_id: id })
}

/** Full-text-ish search over titles AND message bodies. Falls back to null when
 * the migration isn't applied, so the caller can keep title-only filtering
 * rather than showing an empty result that looks like "nothing matched". */
export async function searchThreads(query: string): Promise<ThreadSummary[] | null> {
  if (!cloudEnabled || !query.trim()) return null
  const { data, error } = await supabase.rpc('core_threads_search', { p_query: query.trim(), p_limit: 30 })
  if (error) { return null }
  return (data || []).map((r: any) => ({ id: r.id, title: r.title, updatedAt: r.updated_at, pinned: r.pinned, projectId: r.project_id, snippet: r.snippet }))
}

async function rpcOk(fn: string, args: Record<string, unknown>): Promise<boolean> {
  if (!cloudEnabled) return false
  const { error } = await supabase.rpc(fn, args)
  if (error) { console.warn(`[${fn}]`, error.message); return false }
  return true
}

export async function loadMessages(threadId: string): Promise<CoreMessage[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('core_messages_for_thread', { p_thread_id: threadId })
  if (error) { console.warn('[core_messages_for_thread]', error.message); return [] }
  return (data || []).map((r: any) => messageFromRow(r) as CoreMessage)
}

/** Persists one message via the row-mapping contract. Best-effort — a failed
 * save is logged, never thrown (the conversation already happened in memory;
 * losing persistence for one message shouldn't crash the turn).
 *
 * core_message.run_id foreign-keys to agent_runs, but that row is only
 * written once a real model call resolves (runtime.ts's logAgentRun runs
 * partway through coreCallModel — some honest-degrade paths, e.g. no
 * tools-capable model reachable at all, or a client-side abort, return before
 * it does). Passing a runId with no matching row trips the FK constraint and
 * silently drops the WHOLE message (caught live: a stopped turn's reply
 * vanished on reload). Retry once with runId:null on exactly that constraint
 * — still truthful, since there genuinely is no logged run behind it. */
export async function appendMessage(m: {
  id: string; threadId: string; role: CoreMessage['role']; content?: string
  blocks?: Record<string, unknown>[]; toolCalls?: Record<string, unknown>[]; runId?: string | null
}): Promise<void> {
  if (!cloudEnabled) return
  const row = messageToRow({ ...m, blocks: m.blocks ?? [], toolCalls: m.toolCalls ?? [], runId: m.runId ?? null, createdAt: new Date().toISOString() })
  const { error } = await supabase.rpc('core_message_append', { message: row })
  if (!error) return
  if (row.run_id && error.message.includes('core_message_run_id_fkey')) {
    const { error: retryErr } = await supabase.rpc('core_message_append', { message: { ...row, run_id: null } })
    if (retryErr) console.warn('[core_message_append retry]', retryErr.message)
    return
  }
  console.warn('[core_message_append]', error.message)
}
