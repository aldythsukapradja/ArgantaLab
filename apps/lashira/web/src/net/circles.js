// Circle roster for the in-game circle SELECTOR (Settings → Circle sync). The
// base `circles` table is owner-only under RLS, so a member who doesn't own a
// circle can't SELECT it directly — this goes through the list_my_circles()
// definer RPC (migration_lashira_my_circles.sql) instead.
//
// SAFE: never throws, returns [] on any failure (offline / migration not
// deployed / guest) so Settings gracefully shows "just this circle".
import { supabase, hasSupabase } from './supabase.js';

export async function listMyCircles() {
  if (!hasSupabase || !supabase) return [];
  try {
    const { data, error } = await supabase.rpc('list_my_circles');
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((r) => ({
      id: r.circle_id,
      name: r.name || 'Circle',
      kind: r.kind || 'friends',
      emoji: r.emoji || '👥',
      isOwner: !!r.is_owner,
      memberCount: r.member_count || 0,
    }));
  } catch (e) {
    console.warn('[circles] list_my_circles unavailable:', e?.message || e);
    return [];
  }
}
