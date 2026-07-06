import { supabase, hasSupabase } from '../net/supabase.js';

function collectPeers(channel, selfId) {
  const state = channel.presenceState();
  const peers = [];
  for (const metas of Object.values(state || {})) {
    const latest = Array.isArray(metas) ? metas[metas.length - 1] : null;
    if (latest?.id && latest.id !== selfId) peers.push(latest);
  }
  return peers;
}

function noopPresence() {
  return { update: () => {}, leave: () => {} };
}

export function joinFarmPresence({ circleId, profile, hero, onPeers }) {
  if (!hasSupabase || !supabase || !circleId || !profile || profile.guest) return noopPresence();
  const selfId = String(profile.id || '').trim();
  if (!selfId) return noopPresence();

  let subscribed = false;
  let current = {
    id: selfId,
    name: profile.displayName || 'Farmer',
    tile: [12, 12],
    facing: 'South',
    mounted: false,
    heroSpec: hero?.spec || null,
    updatedAt: Date.now(),
  };

  const channel = supabase.channel(`farm:${circleId}`, {
    config: { presence: { key: selfId } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    onPeers(collectPeers(channel, selfId));
  });
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      channel.track(current);
    }
  });

  return {
    update(patch = {}) {
      current = { ...current, ...patch, updatedAt: Date.now() };
      if (subscribed) channel.track(current);
    },
    leave() {
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    },
  };
}
