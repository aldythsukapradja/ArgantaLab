// Session singleton for the shared farm — ONE live session per user per circle.
//
// Pure module (no supabase import, no vite env) so tests/sync-harness.mjs can
// import and battle-test the EXACT logic the game ships.
//
// Rule: every tab boots with a random sessionId + bootTs and broadcasts a
// `session-claim`. When a tab sees a claim for ITS OWN userId from a different
// sessionId, both sides apply the same deterministic comparison — newest boot
// wins (the fresh login kicks the previous one, per product requirement), with
// sessionId as tiebreak so simultaneous boots still resolve to exactly one
// survivor. The loser leaves the channel, freezes saves, and shows an overlay.

/** True if session a beats session b. Deterministic total order. */
export function sessionWins(a, b) {
  const ta = Number(a?.bootTs) || 0;
  const tb = Number(b?.bootTs) || 0;
  if (ta !== tb) return ta > tb;
  return String(a?.sessionId || '') > String(b?.sessionId || '');
}

/** Random session id (browser + node). */
export function newSessionId() {
  try { return globalThis.crypto.randomUUID(); } catch { /* older runtimes */ }
  return 'sid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Attach the singleton protocol to an already-created (not yet subscribed)
 * Supabase Realtime channel.
 *   me       = { userId, sessionId, bootTs }
 *   onKicked = called ONCE when a newer session for the same user appears;
 *              the caller must leave the channel + freeze saves.
 * Returns { announce } — call announce() every time the channel (re)reaches
 * SUBSCRIBED so late/parallel joiners hear the claim.
 */
export function attachSessionSingleton(channel, { userId, sessionId, bootTs, onKicked }) {
  const me = { userId, sessionId, bootTs };
  let kicked = false;

  channel.on('broadcast', { event: 'session-claim' }, ({ payload }) => {
    if (kicked || !payload || payload.userId !== userId || payload.sessionId === sessionId) return;
    if (sessionWins(payload, me)) {
      kicked = true;
      onKicked?.(payload);
    } else {
      // I win — re-announce so the losing session hears me and dies.
      announce();
    }
  });

  function announce() {
    if (kicked) return;
    try {
      channel.send({ type: 'broadcast', event: 'session-claim', payload: { ...me } });
    } catch { /* channel closing — nothing to announce to */ }
  }

  return { announce, isKicked: () => kicked };
}

/**
 * Presence de-dupe for composite keys (`userId:sessionId`): group metas by
 * userId, keep only the winning session per user, drop my own user entirely.
 * Returns the winning meta per OTHER user.
 */
export function winningPeers(presenceState, selfUserId) {
  const byUser = new Map();
  for (const metas of Object.values(presenceState || {})) {
    const latest = Array.isArray(metas) ? metas[metas.length - 1] : null;
    const uid = latest?.id;
    if (!uid || uid === selfUserId) continue;
    const prev = byUser.get(uid);
    if (!prev || sessionWins(latest, prev)) byUser.set(uid, latest);
  }
  return [...byUser.values()];
}
