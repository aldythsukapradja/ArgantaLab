// Realtime circle presence for the shared farm — Supabase channel `farm:<circleId>`.
//
// Wire protocol (all peers in one circle):
//   presence            key `userId:sessionId`, meta = live player card
//                       (id, name, tile, facing, mounted, heroSpec, actors, bootTs, sessionId)
//   session-claim       session singleton — newest boot per user wins (farm-session.js)
//   player-state        live position/actors heartbeat (owner-simulated kins + mount,
//                       host-simulated animals ride in `actors`)
//   farm-intent         GRANULAR state change (plot/stock/livestock/kin-task/day) —
//                       tiny, instant, per-field; can never clobber concurrent actions
//   state-request       late joiner asks for a snapshot
//   farm-state          snapshot RESPONSE { data, rev } — adopted only if rev is newer
//
// Design notes (learned the hard way — see memory lashirabloom v2.11/v2.12):
//   • subscribe SYNCHRONOUSLY, no explicit realtime.setAuth (SDK handles it; an
//     explicit call tears the socket down), no topic sweeping (removes the LIVE
//     channel under re-runs). This mirrors Kingdom Heroes' proven joinArena.
//   • whole-state broadcasts are ONLY for late-joiner snapshots, never for live
//     changes — live changes are intents, so wall-clock skew can't clobber.
import { supabase, hasSupabase } from '../net/supabase.js';
import { attachSessionSingleton, newSessionId, winningPeers } from './farm-session.js';

function noopPresence() {
  return {
    update: () => {}, sendIntent: () => {}, sendSnapshot: () => {},
    requestState: () => {}, leave: () => {}, sessionId: null,
    debug: () => null,
  };
}

export function joinFarmPresence({ circleId, profile, hero, onPeers, onIntent, onSnapshot, onStateRequest, onKicked }) {
  if (!hasSupabase || !supabase || !circleId || !profile || profile.guest) return noopPresence();
  const selfId = String(profile.id || '').trim();
  if (!selfId) return noopPresence();

  const sessionId = newSessionId();
  const bootTs = Date.now();
  let subscribed = false;
  let closed = false;
  let pendingRequest = false;
  let lastStatus = 'init';
  let lastPeerEventAt = 0; // when we last HEARD anything from a peer
  const peers = new Map(); // userId -> latest winning meta/broadcast

  let current = {
    id: selfId,
    sessionId,
    bootTs,
    name: profile.displayName || 'Farmer',
    tile: [12, 12],
    facing: 'South',
    mounted: false,
    heroSpec: hero?.spec || null,
    updatedAt: Date.now(),
  };

  const channel = supabase.channel(`farm:${circleId}`, {
    config: { presence: { key: `${selfId}:${sessionId}` }, broadcast: { self: false } },
  });

  const die = (claim) => {
    if (closed) return;
    closed = true;
    subscribed = false;
    try { supabase.removeChannel(channel); } catch { /* noop */ }
    onKicked?.(claim);
  };
  const session = attachSessionSingleton(channel, { userId: selfId, sessionId, bootTs, onKicked: die });

  channel.on('presence', { event: 'sync' }, () => {
    if (closed) return;
    const winners = winningPeers(channel.presenceState(), selfId);
    if (winners.length) lastPeerEventAt = Date.now();
    const liveIds = new Set(winners.map((w) => String(w.id)));
    for (const id of [...peers.keys()]) if (!liveIds.has(id)) peers.delete(id); // drop leavers
    for (const w of winners) {
      const prev = peers.get(String(w.id));
      // presence meta can lag a fresher broadcast — keep the newest of the two
      if (!prev || (w.updatedAt || 0) >= (prev.updatedAt || 0)) peers.set(String(w.id), w);
    }
    onPeers([...peers.values()]);
  });
  channel.on('broadcast', { event: 'player-state' }, ({ payload }) => {
    if (closed || !payload?.id || payload.id === selfId) return;
    lastPeerEventAt = Date.now();
    peers.set(String(payload.id), payload);
    onPeers([...peers.values()]);
  });
  channel.on('broadcast', { event: 'farm-intent' }, ({ payload }) => {
    if (closed || !payload?.intent || payload.src === sessionId) return;
    onIntent?.(payload.intent, payload);
  });
  channel.on('broadcast', { event: 'state-request' }, ({ payload }) => {
    if (closed || payload?.src === sessionId) return;
    onStateRequest?.(payload);
  });
  channel.on('broadcast', { event: 'farm-state' }, ({ payload }) => {
    if (closed || !payload || payload.src === sessionId) return;
    onSnapshot?.(payload);
  });

  channel.subscribe((status) => {
    lastStatus = status;
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      session.announce();
      channel.track(current);
      channel.send({ type: 'broadcast', event: 'player-state', payload: current });
      if (pendingRequest) {
        pendingRequest = false;
        channel.send({ type: 'broadcast', event: 'state-request', payload: { src: sessionId, id: selfId } });
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      subscribed = false;
    }
  });

  return {
    sessionId,
    // Live wire diagnostics for the Settings "Circle sync" card — makes the
    // channel's true state visible in the UI so a field failure pinpoints
    // itself (join never happened vs died later vs joined-but-silent).
    debug() {
      let socket = '?';
      try { socket = supabase.realtime?.connectionState?.() || '?'; } catch { /* n/a */ }
      return {
        session: sessionId.slice(0, 6),
        status: lastStatus,
        subscribed,
        socket,
        peers: peers.size,
        lastPeerAgoS: lastPeerEventAt ? Math.round((Date.now() - lastPeerEventAt) / 1000) : -1,
      };
    },
    update(patch = {}) {
      if (closed) return;
      current = { ...current, ...patch, sessionId, bootTs, updatedAt: Date.now() };
      if (subscribed) {
        channel.track(current);
        channel.send({ type: 'broadcast', event: 'player-state', payload: current });
      }
    },
    sendIntent(intent) {
      if (closed || !subscribed || !intent) return;
      channel.send({ type: 'broadcast', event: 'farm-intent', payload: { src: sessionId, id: selfId, intent } });
    },
    sendSnapshot({ data, rev }) {
      if (closed || !subscribed || !data) return;
      channel.send({ type: 'broadcast', event: 'farm-state', payload: { src: sessionId, id: selfId, data, rev: Number(rev) || 0 } });
    },
    requestState() {
      if (closed) return;
      if (subscribed) channel.send({ type: 'broadcast', event: 'state-request', payload: { src: sessionId, id: selfId } });
      else pendingRequest = true;
    },
    leave() {
      closed = true;
      subscribed = false;
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    },
  };
}
