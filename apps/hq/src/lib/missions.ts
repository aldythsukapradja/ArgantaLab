// Bridge mission history. The Arganta Bridge persists every Claude Code / Codex
// mission to the Supabase `mission` table (service-role write, operator read —
// see supabase/migration_missions.sql). This reads them back so the HQ rail can
// show per-engine history the way ThreadsRail shows Sovereign chats.
import { supabase, cloudEnabled } from './supabase'

export interface MissionActivity { type: string; label?: string; text?: string; at: string }

export interface MissionRow {
  id: string
  goal: string
  status: 'running' | 'done' | 'failed'
  engine: string            // 'claude' | 'codex'
  activity: MissionActivity[]
  result: string | null
  costUsd: number
  createdAt: string
  updatedAt: string
}

function mapRow(r: any): MissionRow {
  return {
    id: r.id,
    goal: r.goal ?? '',
    status: (r.status as MissionRow['status']) ?? 'done',
    engine: r.engine ?? 'claude',
    activity: Array.isArray(r.activity) ? r.activity : [],
    result: r.result ?? null,
    costUsd: Number(r.cost_usd ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  }
}

/** Recent missions for one engine, newest first. List view — omits the heavy
 * `activity` jsonb (loadMission fetches that on demand). */
export async function listMissions(engine: string, limit = 80): Promise<MissionRow[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase
    .from('mission')
    .select('id,goal,status,engine,result,cost_usd,created_at,updated_at')
    .eq('engine', engine)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(mapRow)
}

/** One mission with its full activity trail — for the read-only transcript. */
export async function loadMission(id: string): Promise<MissionRow | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase
    .from('mission')
    .select('id,goal,status,engine,activity,result,cost_usd,created_at,updated_at')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapRow(data)
}
