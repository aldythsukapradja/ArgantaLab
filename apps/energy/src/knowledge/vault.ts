// Runtime vault = baked kb.json ▸ user/extracted layer (precedence user ▸ generated).
// User layer persists in localStorage 'ae_kb_user' (size is small — 77 baked notes +
// a handful of accepted extractions). recomputeLinks runs over the MERGED set so
// user notes get real wikilinks/backlinks and appear in Explorer + Graph immediately.
import kb from '../data/kb.json';
import ledger from '../data/data.json';
import type { VaultNote, KnowledgeBase } from './types';
import { recomputeLinks } from './links';

const USER_KEY = 'ae_kb_user';

export function loadUserNotes(): VaultNote[] {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as VaultNote[]) : [];
  } catch { return []; }
}

export function saveUserNotes(notes: VaultNote[]): void {
  try { localStorage.setItem(USER_KEY, JSON.stringify(notes)); } catch { /* quota / private mode */ }
}

const baked = kb as unknown as KnowledgeBase;

export const BAKED_FOLDERS = baked.folders;

/** Merge baked + user notes (user overrides same id), then recompute links over the union. */
export function mergeVault(userNotes: VaultNote[]): VaultNote[] {
  const byId = new Map<string, VaultNote>();
  for (const n of baked.notes) byId.set(n.id, structuredCloneNote(n));
  for (const u of userNotes) byId.set(u.id, structuredCloneNote(u)); // precedence: user ▸ generated
  const merged = [...byId.values()];
  recomputeLinks(merged);
  return merged;
}

// Notes carry precomputed links/backlinks in the baked JSON; clone so recompute is idempotent
// and never mutates the imported module objects.
function structuredCloneNote(n: VaultNote): VaultNote {
  return { ...n, links: [...(n.links ?? [])], backlinks: [...(n.backlinks ?? [])], tags: [...(n.tags ?? [])], evidence: [...(n.evidence ?? [])] };
}

// ── Evidence ledger lookup: source_id (volumePath) → sha256 (data.json ledger). ──
type LedgerRow = { path: string; sha256: string; size: number };
const ledgerIndex = new Map<string, LedgerRow>();
for (const r of (ledger as { ledger: LedgerRow[] }).ledger) ledgerIndex.set(r.path, r);

export function resolveEvidence(sourceId: string): { sha256: string; size: number } | null {
  // exact first, then suffix/prefix (source_ids are volume paths; some notes cite a folder root)
  const exact = ledgerIndex.get(sourceId);
  if (exact) return { sha256: exact.sha256, size: exact.size };
  for (const [path, r] of ledgerIndex) {
    if (path.startsWith(sourceId) || sourceId.startsWith(path)) return { sha256: r.sha256, size: r.size };
  }
  return null;
}
