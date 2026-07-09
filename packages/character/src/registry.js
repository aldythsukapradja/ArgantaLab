// @arganta/character — the canonical character-appearance registry.
//
// A "spec" is the compositor loadout (the SAME shape Kingdom's Character Lab
// saves and LashiraBloom's hero.js/loadPlayerResources reads): each visual slot
// is { cat, id, palette }, plus a mount + a path. Circle HQ owns a small set of
// NAMED preset specs — the canonical looks the games fall back to or reuse:
//   • default-farmer  → LashiraBloom's placeholder avatar when you have no hero.
//   • hero-starter    → the look a brand-new Kingdom character starts from.
//   • npc-*           → shared NPC looks both games can dress a villager in.
//
// The player's OWN hero (built in the Character Lab, stored on kingdom_characters)
// is unchanged and always wins — the registry only governs the shared/default
// looks, so HQ becomes the single source of truth for those without touching a
// single player's personal build.

export const REGISTRY_VERSION = 1;

// The editable slots and which art categories feed each one. Data-driven so the
// HQ editor can render a control per slot without hard-coding the list (mirrors
// apps/kingdom/web/src/lab/CharacterLab.jsx SLOT_DEFS).
export const SLOT_CATALOG = [
  { key: 'body', cat: 'body', label: 'Body / skin', group: 'Body', required: true },
  { key: 'face', cat: 'face', label: 'Face', group: 'Head', required: true },
  { key: 'hair', cat: 'hair', label: 'Hair', group: 'Head', optional: true },
  { key: 'helmet', cat: 'helmet', label: 'Helmet', group: 'Head', optional: true },
  { key: 'facedec', cat: 'facedec', label: 'Face deco', group: 'Head', optional: true },
  { key: 'hairdec', cat: 'hairdec', label: 'Hair deco', group: 'Head', optional: true },
  { key: 'coat', cat: 'coat', label: 'Armor / coat', group: 'Body', optional: true },
  { key: 'shoes', cat: 'shoes', label: 'Shoes', group: 'Body', optional: true },
  { key: 'mantle', cat: 'mantle', label: 'Mantle', group: 'Body', optional: true },
  { key: 'neck', cat: 'neck', label: 'Necklace', group: 'Body', optional: true },
  { key: 'weapon', cat: 'sword', label: 'Weapon', group: 'Weapon', optional: true, cats: ['sword', 'spear', 'bow', 'fan'] },
  { key: 'shield', cat: 'shield', label: 'Shield', group: 'Weapon', optional: true },
];

export const SLOT_KEYS = SLOT_CATALOG.map((s) => s.key);
export const PATHS = ['warrior', 'rogue', 'poet', 'mage'];

const slot = (cat, id, palette = null) => ({ cat, id, palette });

// One canonical preset = { id, name, role, note, spec }. The spec's visual slots
// match SLOT_CATALOG; mountOn/mountId + path round out the compositor loadout.
export const CHARACTER_DEFAULTS = {
  version: REGISTRY_VERSION,
  presets: {
    'default-farmer': {
      id: 'default-farmer',
      name: 'Default Farmer',
      role: 'fallback',
      note: "LashiraBloom shows this when the player hasn't built a Kingdom hero yet.",
      spec: {
        body: slot('body', 0),
        face: slot('face', 0),
        hair: slot('hair', 0),
        coat: slot('coat', 2),
        mountOn: false,
        mountId: 0,
        path: 'poet',
      },
    },
    'hero-starter': {
      id: 'hero-starter',
      name: 'Hero Starter',
      role: 'kingdom-starter',
      note: 'The look a brand-new Kingdom Heroes character starts from before customising.',
      spec: {
        body: slot('body', 0),
        face: slot('face', 0),
        hair: slot('hair', 0),
        coat: slot('coat', 2),
        mountOn: false,
        mountId: 0,
        path: 'warrior',
      },
    },
    'npc-villager': {
      id: 'npc-villager',
      name: 'Villager',
      role: 'npc',
      note: 'A neutral townsfolk look shared across the ArgantaLab worlds.',
      spec: {
        body: slot('body', 1),
        face: slot('face', 0),
        hair: slot('hair', 1),
        coat: slot('coat', 2),
        mountOn: false,
        mountId: 0,
        path: 'poet',
      },
    },
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Deep-merge an operator OVERRIDE (small, human-diffable) over the defaults.
// Unknown preset ids are ADDED — HQ operators can define brand-new canonical
// looks, not just tweak the seeded three.
export function mergeRegistry(override = {}) {
  const out = { version: REGISTRY_VERSION, presets: {} };
  for (const [id, p] of Object.entries(CHARACTER_DEFAULTS.presets)) {
    out.presets[id] = { ...p, spec: { ...p.spec } };
  }
  const ov = isObj(override) ? override : {};
  for (const [id, patch] of Object.entries(ov.presets || {})) {
    if (patch == null) { delete out.presets[id]; continue; } // null => operator removed it
    const base = out.presets[id] || { id, name: id, role: 'custom', note: '', spec: {} };
    out.presets[id] = {
      ...base,
      ...patch,
      id,
      spec: { ...(base.spec || {}), ...(isObj(patch.spec) ? patch.spec : {}) },
    };
  }
  return out;
}

export function listPresets(registry = CHARACTER_DEFAULTS) {
  return Object.values(registry.presets || {});
}

export function getPreset(registry, id) {
  return (registry?.presets || {})[id] || null;
}

// The spec a game hands to the compositor. Guaranteed to have body + face.
export function specForPreset(registry, id) {
  const p = getPreset(registry, id);
  return p ? p.spec : CHARACTER_DEFAULTS.presets['default-farmer'].spec;
}

// Advisory validation (mirrors combat's validateTuning contract): NaN/shape
// problems are hard errors; a missing optional look is just a warning.
export function validateRegistry(override = {}) {
  const errors = [];
  const warnings = [];
  const reg = mergeRegistry(override);
  for (const p of Object.values(reg.presets)) {
    const s = p.spec || {};
    if (!s.body || s.body.id == null) errors.push(`${p.id}: missing body`);
    if (!s.face || s.face.id == null) errors.push(`${p.id}: missing face`);
    for (const [k, sel] of Object.entries(s)) {
      if (sel && typeof sel === 'object' && 'id' in sel && !Number.isFinite(Number(sel.id))) {
        errors.push(`${p.id}.${k}: id is not a number`);
      }
    }
    if (p.path && !PATHS.includes(p.path)) warnings.push(`${p.id}: unknown path "${p.path}"`);
  }
  if (!reg.presets['default-farmer']) warnings.push('no "default-farmer" preset — LashiraBloom placeholder will fall back to package defaults');
  return { ok: errors.length === 0, errors, warnings };
}
