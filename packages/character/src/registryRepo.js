// Character registry TRANSPORT — the wire between Circle HQ (publisher) and the
// games (consumers). Mirrors @arganta/combat's tuningRepo exactly: client-agnostic
// (every fn takes a Supabase-like client with .rpc), and SAFE BY DESIGN — every
// read-path failure falls back to package defaults so a game can never brick on a
// bad/absent/newer registry.

import { REGISTRY_VERSION, mergeRegistry, validateRegistry, specForPreset } from './registry.js';

// HQ side — validate the operator's override and write ONE active registry row.
export async function publishCharacterRegistry(client, override, meta = {}) {
  const v = validateRegistry(override);
  if (!v.ok) throw new Error('Invalid registry: ' + v.errors.join('; '));
  const merged = mergeRegistry(override);
  const payload = {
    v: REGISTRY_VERSION,
    override,                                 // operator deltas (small, diffable)
    presetCount: Object.keys(merged.presets).length,
    published_at: new Date().toISOString(),
    note: meta.note || '',
  };
  const { data, error } = await client.rpc('hq_character_publish', { p_config: payload });
  if (error) throw error;
  return { ok: true, warnings: v.warnings, presetCount: payload.presetCount, data };
}

// Game side — load the active registry, merged over defaults. Never throws.
export async function loadActiveRegistry(client) {
  try {
    if (!client || typeof client.rpc !== 'function') return fallback('no-client');
    const { data, error } = await client.rpc('character_registry_active');
    if (error || !data) return fallback(error ? 'rpc-error' : 'no-active');
    const version = Number(data.v ?? data.version ?? 0);
    if (version > REGISTRY_VERSION) return fallback('newer-version'); // forward-compat
    return { source: 'cloud', version, registry: mergeRegistry(data.override || {}) };
  } catch (e) {
    return fallback('exception:' + (e && e.message ? e.message : e));
  }
}

function fallback(reason) {
  return { source: 'defaults', version: REGISTRY_VERSION, registry: mergeRegistry({}), reason };
}

// Game side convenience — load the registry and return a resolver so callers can
// ask for a preset's spec by id (e.g. the LashiraBloom placeholder farmer).
export async function bootCharacterRegistry(client) {
  const r = await loadActiveRegistry(client);
  return {
    ...r,
    specFor: (presetId) => specForPreset(r.registry, presetId),
  };
}
