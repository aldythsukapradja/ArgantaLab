// Arena realtime (MP-0) — Supabase Realtime channel per map.
// Every message is an INTENT ({type, ...}) so Phase-6 server authority can
// later validate the same payloads instead of peers trusting each other.
// Combat referee rule for MP-0: the VICTIM applies damage to itself and
// broadcasts its own hp (client-authoritative placeholder, isolated here).
import { supabase } from './account.js';

export function joinArena({ mapKey = 'arena:chonsa', me, onPeers, onEvent }) {
  const channel = supabase.channel(mapKey, {
    config: { presence: { key: me.characterId }, broadcast: { self: false } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const peers = {};
    for (const [key, metas] of Object.entries(state)) {
      if (key === me.characterId) continue;
      peers[key] = metas[metas.length - 1];
    }
    onPeers(peers);
  });
  channel.on('broadcast', { event: 'intent' }, ({ payload }) => {
    if (payload?.from !== me.characterId) onEvent(payload);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        characterId: me.characterId,
        name: me.name,
        accountType: me.accountType,
        spec: me.spec,
        tile: me.tile,
        facing: me.facing,
        hp: me.hp,
      });
    }
  });

  function send(type, data = {}) {
    channel.send({
      type: 'broadcast',
      event: 'intent',
      payload: { type, from: me.characterId, ts: Date.now(), ...data },
    });
  }

  return {
    send,
    updatePresence: (patch) => channel.track({ ...patch }),
    leave: () => supabase.removeChannel(channel),
  };
}
