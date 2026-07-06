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
  return { update: () => {}, sendState: () => {}, leave: () => {} };
}

export function joinFarmPresence({ circleId, profile, hero, onPeers, onFarmState }) {
  if (!hasSupabase || !supabase || !circleId || !profile || profile.guest) return noopPresence();
  const selfId = String(profile.id || '').trim();
  if (!selfId) return noopPresence();

  let subscribed = false;
  let closed = false;
  let current = {
    id: selfId,
    name: profile.displayName || 'Farmer',
    tile: [12, 12],
    facing: 'South',
    mounted: false,
    heroSpec: hero?.spec || null,
    updatedAt: Date.now(),
  };
  let pendingState = null;

  const channel = supabase.channel(`farm:${circleId}`, {
    config: { presence: { key: selfId } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    onPeers(collectPeers(channel, selfId));
  });
  channel.on('broadcast', { event: 'farm-state' }, ({ payload }) => {
    if (!payload || payload.sourceId === selfId) return;
    onFarmState?.(payload);
  });
  const subscribe = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) supabase.realtime?.setAuth?.(token);
    } catch { /* keep presence best-effort */ }
    if (closed) return;
    channel.subscribe((status) => {
      if (closed) return;
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        channel.track(current);
        if (pendingState) {
          channel.send({ type: 'broadcast', event: 'farm-state', payload: pendingState });
          pendingState = null;
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        subscribed = false;
      }
    });
  };
  subscribe();

  return {
    update(patch = {}) {
      current = { ...current, ...patch, updatedAt: Date.now() };
      if (subscribed) channel.track(current);
    },
    sendState(payload = {}) {
      const next = {
        ...payload,
        sourceId: selfId,
        updatedAt: payload.updatedAt || Date.now(),
      };
      if (subscribed) channel.send({ type: 'broadcast', event: 'farm-state', payload: next });
      else pendingState = next;
    },
    leave() {
      closed = true;
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    },
  };
}
