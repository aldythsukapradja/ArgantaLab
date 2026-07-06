import { supabase, hasSupabase } from '../net/supabase.js';
import { argantaKin } from '../data/arganta-kins.js';

export async function loadAcquiredKins(profile) {
  if (!hasSupabase || !supabase || !profile || profile.guest) return [];
  try {
    const { data, error } = await supabase.rpc('nexus_roster', { p_person: null });
    if (error) {
      console.warn('[farm] ArgantaLab Kin roster unavailable:', error.message);
      return [];
    }
    return ((Array.isArray(data) ? data : [])).map((row) => {
      const def = argantaKin(row.kin_key);
      if (!def) return null;
      return {
        id: `arganta:${row.id}`,
        kinKey: row.kin_key,
        render: def.render,
        assetKey: def.assetKey,
        name: row.nickname || def.name,
        world: row.world_key || def.world,
        habitat: def.habitat,
        element: def.element,
        aptitude: ['lif', 'wld', 'won'].includes(def.world) ? 'water' : 'harvest',
        rarity: def.rarity,
        color: def.color,
        count: row.count ?? 1,
        happiness: row.happiness ?? 70,
        growth: row.growth || 'baby',
        task: null,
        source: 'argantalab',
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn('[farm] ArgantaLab Kin roster failed:', err?.message || err);
    return [];
  }
}
