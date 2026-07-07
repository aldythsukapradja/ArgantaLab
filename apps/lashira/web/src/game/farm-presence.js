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
  const broadcastPeers = new Map();
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

  // Supabase allows only ONE channel per topic per client. React StrictMode
  // (mount → cleanup → remount) and Vite HMR can leave a stale `farm:<circle>`
  // channel behind; a new channel on the same topic then never reaches
  // SUBSCRIBED. Sweep any pre-existing channel on this topic first so ours is
  // the only one. (The presence effect is also keyed on stable identity so it
  // no longer re-subscribes when the hero loads mid-session.)
  const topic = `farm:${circleId}`;
  try {
    for (const ch of supabase.getChannels?.() || []) {
      if (ch.topic === topic || ch.topic === `realtime:${topic}`) supabase.removeChannel(ch);
    }
  } catch { /* best-effort */ }

  const channel = supabase.channel(topic, {
    config: { presence: { key: selfId }, broadcast: { self: false } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const peers = collectPeers(channel, selfId);
    for (const peer of peers) if (peer?.id) broadcastPeers.set(String(peer.id), peer);
    onPeers([...broadcastPeers.values()]);
  });
  channel.on('broadcast', { event: 'player-state' }, ({ payload }) => {
    if (!payload?.id || payload.id === selfId) return;
    broadcastPeers.set(String(payload.id), payload);
    onPeers([...broadcastPeers.values()]);
  });
  channel.on('broadcast', { event: 'farm-state' }, ({ payload }) => {
    if (!payload || payload.sourceId === selfId) return;
    onFarmState?.(payload);
  });
  // Subscribe SYNCHRONOUSLY — this is the exact pattern Kingdom Heroes' joinArena
  // uses, and it's why Kingdom syncs flawlessly. The previous version awaited
  // supabase.auth.getSession() BEFORE channel.subscribe(); under React StrictMode
  // (mount → cleanup → remount) the cleanup set closed=true during that await, so
  // subscribe() was skipped and the channel was removed — leaving ZERO live
  // channels and total sync silence. Refreshing the realtime auth token is now a
  // non-blocking best-effort that never gates the subscribe.
  supabase.auth.getSession()
    .then(({ data }) => {
      const token = data?.session?.access_token;
      if (token && !closed) supabase.realtime?.setAuth?.(token);
    })
    .catch(() => { /* keep presence best-effort */ });

  channel.subscribe((status) => {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      channel.track(current);
      channel.send({ type: 'broadcast', event: 'player-state', payload: current });
      if (pendingState) {
        channel.send({ type: 'broadcast', event: 'farm-state', payload: pendingState });
        pendingState = null;
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      subscribed = false;
    }
  });

  return {
    update(patch = {}) {
      current = { ...current, ...patch, updatedAt: Date.now() };
      if (subscribed) {
        channel.track(current);
        channel.send({ type: 'broadcast', event: 'player-state', payload: current });
      }
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
