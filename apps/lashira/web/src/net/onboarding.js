// LashiraBloom — forced first-run onboarding (the "Choose your hero" wizard).
//
// RULE (owner's spec): everyone sets up first. "Set up" means the character is no
// longer in default settings. So the gate fires when the player has NO character
// yet, OR their look is still the seeded default AND they've never completed the
// wizard. Completing the wizard stamps spec.meta.onboardedAt — a real non-default
// field — so it can never loop, even if a player deliberately keeps the default
// look. This honours "not in default settings" while staying robust.
//
// The wizard writes the SAME canonical character every ArgantaLab world reads
// (kingdom_characters + kingdom_character_appearance), reusing Kingdom Heroes'
// own proven create→draft→sync pattern. Brand-new players (the whole point of
// forced onboarding) have no character row yet, and the draft/sync RPCs error in
// that case — so we INSERT the row first (RLS allows profile_id = auth.uid()),
// exactly like Kingdom's claimCharacter, then save + sync the look.
import { supabase, hasSupabase } from './supabase.js';
import { grantStarterOutfit } from './cosmetics.js';
import { PATHS as PATH_ARCHETYPES } from '@arganta/combat';

// The four playable Paths — REAL renamed classes (packages/combat/src/
// progression.js is the source of truth: ids stay warrior/rogue/poet/mage,
// but the displayed names are Guardian/Shadow/Mystic/Arcanist). Built from that
// package instead of a hardcoded copy so onboarding can never drift from it again.
const PATH_FLAVOR = {
  warrior: 'Strong & steady', rogue: 'Quick & clever', poet: 'Kind & charming', mage: 'Curious & magic',
};
export const PATHS_META = Object.values(PATH_ARCHETYPES).map((p) => ({
  id: p.id, label: p.name, icon: p.icon, flavor: PATH_FLAVOR[p.id] || '',
}));
export const DEFAULT_PATH = 'warrior';

// Rides — horses only, three of them (owner's spec: "for mount only make it
// horse, mount 1 2 3"). Ids index data.mounts(); kept as a named constant so the
// exact horse sprites are trivially adjustable if these indices ever move.
export const HORSE_MOUNTS = [
  { id: 1, label: 'Chestnut' },
  { id: 2, label: 'Dapple' },
  { id: 3, label: 'Midnight' },
];

// Skills round out a complete spec (same 3 fixed fx slots the composer uses).
export const DEFAULT_SKILLS = [{ fx: 22 }, { fx: 1 }, { fx: 131 }];

// The seeded default look (matches @arganta/character's default-farmer /
// hero-starter presets: body0 / face0 / hair0 / coat2, no mount, no extras).
export function baseLookSel() {
  return {
    body: { cat: 'body', id: 0, palette: null },
    face: { cat: 'face', id: 0, palette: null },
    hair: { cat: 'hair', id: 0, palette: null },
    coat: { cat: 'coat', id: 2, palette: null },
  };
}

// Is this spec still the untouched default look? Extra slots, a non-default
// body/face/hair/coat, a mount, or the onboarded stamp all mean "customised".
export function isDefaultLook(spec) {
  if (!spec || typeof spec !== 'object') return true;
  if (spec.meta && spec.meta.onboardedAt) return false;
  const idOf = (k, d) => (spec[k] && spec[k].id != null ? spec[k].id : d);
  const baseLook =
    idOf('body', 0) === 0 &&
    idOf('face', 0) === 0 &&
    (spec.hair ? spec.hair.id === 0 : true) &&
    (spec.coat ? spec.coat.id === 2 : true);
  const noExtras =
    !spec.helmet && !spec.weapon && !spec.shield && !spec.mantle &&
    !spec.neck && !spec.facedec && !spec.hairdec;
  const noMount = !spec.mount;
  return baseLook && noExtras && noMount;
}

// ---- guest onboarding (local, since a guest has no server session) ----
const guestKey = (profile) => `lashira_onboard_${profile?.id || 'guest'}`;

export function loadGuestOnboarding(profile) {
  try {
    const raw = localStorage.getItem(guestKey(profile));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function isGuestOnboarded(profile) {
  return !!loadGuestOnboarding(profile);
}
function saveGuestOnboarding(profile, payload) {
  try { localStorage.setItem(guestKey(profile), JSON.stringify(payload)); } catch { /* ignore */ }
}

// The gate. True => show the wizard before the farm.
export function needsOnboarding(hero, profile) {
  if (profile?.guest) return !isGuestOnboarded(profile);
  if (!hero || !hero.character) return true;      // no character row at all
  if (!hero.spec) return true;
  if (hero.spec.meta && hero.spec.meta.onboardedAt) return false;
  return isDefaultLook(hero.spec);
}

// Assemble the canonical compositor spec the wizard produces.
export function buildSpec({ sel, path, mountId }) {
  const spec = { ...sel, skills: DEFAULT_SKILLS, path: path || DEFAULT_PATH };
  if (mountId != null && mountId > 0) spec.mount = { id: mountId };
  spec.meta = { onboardedAt: new Date().toISOString(), source: 'lashira-onboarding' };
  return spec;
}

// Create-or-update the character row (name + path), then save + sync the look.
// Returns { ok } or { ok:false, error } (e.g. nickname taken).
export async function saveOnboarding({ profile, nickname, path, sel, mountId }) {
  const spec = buildSpec({ sel, path, mountId });
  const name = String(nickname || '').trim();

  // Guest — persist locally so the farmer they built actually shows up, and the
  // gate remembers them. No cloud write is possible without a session.
  if (profile?.guest) {
    saveGuestOnboarding(profile, { spec, nickname: name, path, at: Date.now() });
    return { ok: true, spec, local: true };
  }

  if (!hasSupabase || !supabase) return { ok: false, error: 'Offline — try again when connected.' };
  const uid = profile?.id;
  if (!uid) return { ok: false, error: 'Not signed in.' };
  const accountType = profile?.role === 'kid' ? 'kid' : 'adult';

  try {
    // 1) ensure the character row exists with the chosen name + path
    const { data: existing } = await supabase
      .from('kingdom_characters').select('id').eq('profile_id', uid).maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from('kingdom_characters')
        .update({ name, path_id: path }).eq('id', existing.id);
      if (error) {
        if (/name_uq/i.test(error.message)) return { ok: false, error: 'That nickname is already taken.' };
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await supabase.from('kingdom_characters')
        .insert({ profile_id: uid, name, account_type: accountType, path_id: path });
      if (error) {
        if (/name_uq/i.test(error.message)) return { ok: false, error: 'That nickname is already taken.' };
        if (/profile_uq/i.test(error.message)) {
          // race: a row appeared — fall through to name/path update
          await supabase.from('kingdom_characters').update({ name, path_id: path }).eq('profile_id', uid);
        } else {
          return { ok: false, error: error.message };
        }
      }
    }

    // 2) save the look as a draft, then commit it as the synced build
    const { error: e1 } = await supabase.rpc('kingdom_save_character_draft', { p_spec: spec });
    if (e1) return { ok: false, error: e1.message };
    const { error: e2 } = await supabase.rpc('kingdom_sync_character_build');
    if (e2) return { ok: true, spec, warning: 'Saved (sync pending).' };

    // 3) grant the picked outfit free (best-effort — the spec above already
    // carries the look regardless, so a failure here never blocks finishing).
    if (sel?.coat?.id != null) {
      grantStarterOutfit(`coat:${sel.coat.id}`).catch(() => {});
    }
    return { ok: true, spec };
  } catch (e) {
    return { ok: false, error: e?.message || 'Save failed.' };
  }
}
