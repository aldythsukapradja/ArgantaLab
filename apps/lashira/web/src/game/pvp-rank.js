// Circle PvP rank — thin RPC wrappers around migration_lashira_pvp.sql.
// Trust model: the DOWNED player reports their own KO (matches the monster-hit
// precedent — fine within a trusted family/friend circle; see pvp-concept.md §4).
import { supabase, hasSupabase } from '../net/supabase.js';

// Called by the player who just got KO'd. Increments the winner's wins + the
// caller's losses in one RPC (see pvp_record_ko in the migration).
export async function recordPvpKo({ circleId, winnerId }) {
  if (!hasSupabase || !supabase || !circleId || !winnerId) return false;
  try {
    const { error } = await supabase.rpc('pvp_record_ko', { p_circle: circleId, p_winner: winnerId });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[pvp] record_ko failed:', err?.message || err);
    return false;
  }
}

// Full circle rank board, sorted wins desc (tiebreak win-rate, then streak) —
// the ordering the concept doc specifies. Guests/no-cloud → empty (no session).
export async function listPvpRank(circleId) {
  if (!hasSupabase || !supabase || !circleId) return [];
  try {
    const { data, error } = await supabase
      .from('pvp_rank')
      .select('profile_id, wins, losses, streak, updated_at')
      .eq('circle_id', circleId);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    rows.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const ra = a.wins / Math.max(1, a.wins + a.losses), rb = b.wins / Math.max(1, b.wins + b.losses);
      if (rb !== ra) return rb - ra;
      return (b.streak || 0) - (a.streak || 0);
    });
    return rows;
  } catch (err) {
    console.warn('[pvp] list rank failed:', err?.message || err);
    return [];
  }
}
