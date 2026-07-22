"use client";

// ─── ArgantaStudio Soul characters ───────────────────────────────────────────
//
// Persistent identity entities (the moat: same character across generations).
// A character carries a trigger token + LoRA/IP-Adapter ref + seed images; when
// one is "active", fabric.generateImage injects its token into the prompt and
// stamps character_id on the run — so every generation is linked to its Soul.
//
// Same backend split as the run store: Supabase PostgREST when creds present,
// else localStorage. Bytes (seed refs) are URLs, never inline in Postgres.

const ENV = (typeof process !== 'undefined' && process.env) ? process.env : {};
const SB_URL = (ENV.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const charCloudReady =
  !!SB_URL && !!SB_KEY && !SB_URL.includes('placeholder') && !SB_URL.includes('your-supabase');

const LS_KEY = 'arganta_studio_characters_v1';
const ACTIVE_KEY = 'arganta_studio_active_character_v1';

const listeners = new Set();
export function subscribeCharacters(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) { try { fn(); } catch { /* noop */ } } }

// ─── localStorage backend ────────────────────────────────────────────────────
function lsRead() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsWrite(chars) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(chars)); } catch { /* quota */ }
  emit();
}

// ─── Supabase backend ────────────────────────────────────────────────────────
async function sbFetch(path, options = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `char-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/** Turn a display name into a stable trigger token, e.g. "Aria Vale" → "ar_aria_vale". */
export function tokenFromName(name) {
  const slug = (name || 'soul').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
  return `ar_${slug || 'soul'}`;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listCharacters() {
  if (charCloudReady) {
    try { return await sbFetch('characters?order=updated_at.desc'); }
    catch (e) { console.warn('[characters] cloud list failed, local:', e.message); }
  }
  return lsRead();
}

export async function createCharacter(fields) {
  const now = new Date().toISOString();
  const char = {
    id: newId(),
    name: fields.name || 'Untitled Soul',
    brand: fields.brand || null,
    trigger_token: fields.trigger_token || tokenFromName(fields.name),
    lora_ref: fields.lora_ref || null,
    seed_refs: fields.seed_refs || [],
    notes: fields.notes || null,
    created_at: now,
    updated_at: now,
  };
  if (charCloudReady) {
    try { const [row] = await sbFetch('characters', { method: 'POST', body: JSON.stringify(char) }); emit(); return row || char; }
    catch (e) { console.warn('[characters] cloud create failed, local:', e.message); }
  }
  const chars = lsRead(); chars.unshift(char); lsWrite(chars); return char;
}

export async function updateCharacter(id, patch) {
  const next = { ...patch, updated_at: new Date().toISOString() };
  if (charCloudReady) {
    try { await sbFetch(`characters?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(next), prefer: 'return=minimal' }); emit(); return; }
    catch (e) { console.warn('[characters] cloud update failed, local:', e.message); }
  }
  const chars = lsRead(); const i = chars.findIndex((c) => c.id === id);
  if (i >= 0) { chars[i] = { ...chars[i], ...next }; lsWrite(chars); }
}

export async function deleteCharacter(id) {
  if (charCloudReady) {
    try { await sbFetch(`characters?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' }); emit(); }
    catch (e) { console.warn('[characters] cloud delete failed, local:', e.message); }
  }
  lsWrite(lsRead().filter((c) => c.id !== id));
  if (getActiveCharacterId() === id) setActiveCharacter(null);
}

// ─── active character (drives prompt injection in the fabric) ────────────────

export function getActiveCharacterId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_KEY) || null;
}

export function setActiveCharacter(id) {
  if (typeof window === 'undefined') return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
  emit();
}

/** Resolve the active character object (or null). Cheap localStorage read;
 *  falls back to a cloud fetch only when cloud-backed and not cached. */
export async function getActiveCharacter() {
  const id = getActiveCharacterId();
  if (!id) return null;
  const all = await listCharacters();
  return all.find((c) => c.id === id) || null;
}
