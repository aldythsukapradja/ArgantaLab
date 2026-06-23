import { supabase, cloudEnabled } from './supabase'
import { bloomFor, competencyFor } from './taxonomy'
import type { Item } from '@/data/learn'

// Fire-and-forget telemetry. Every answered item becomes one immutable row in
// learn_event via the log_learn_event RPC, which ALSO updates skill_mastery +
// daily_summary server-side (single cloud source of truth). Never throws — a
// telemetry failure must never interrupt play.

export function logLearnEvent(item: Item, correct: boolean, timeMs: number) {
  if (!cloudEnabled) return
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return // guests aren't tracked
    supabase.rpc('log_learn_event', {
      p_item_id: item.id,
      p_world: item.world,
      p_skill: item.skill,
      p_stage: item.stage,
      p_interaction: item.type,
      p_bloom: bloomFor(item.type),
      p_competency: competencyFor(item.world, item.skill),
      p_difficulty: item.difficulty ?? 2,
      p_correct: correct,
      p_time_ms: Math.max(0, Math.min(600000, Math.round(timeMs))) || 0,
      p_xp: correct ? (item.xp ?? 10) : 0,
    }).then(() => {}, () => {})
  }, () => {})
}
