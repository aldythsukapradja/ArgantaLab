import { useSyncExternalStore } from 'react';
import { VOLVE_DAYS } from './catalog';
import type { ChangeSummary, ContentSource, DeckDoc, MaterialContent, Revision, SlideBlock } from './types';

/**
 * Fieldcraft content store — the source of truth for editable course material.
 *
 * The rule that makes PowerPoint round-trip tractable: **content JSON is the
 * truth, a .pptx is only a view of it.** Revisions therefore store content
 * (a few kB), never the binary — the deck is regenerated on demand. That keeps
 * history cheap and lets the web editor and PowerPoint be peers rather than one
 * being a lossy copy of the other.
 *
 * `catalog.ts` is no longer read directly by the compilers; it seeds revision 1.
 */

export const CONTENT_AUTHOR = 'ArgantaEnergy';
const KEY = 'fieldcraft-content-v1';
/** Full docs are kept per revision. Small, but not unbounded — prune the tail. */
const MAX_FULL_REVISIONS = 30;

export type ContentState = Record<string, MaterialContent>;

export type ContentStore = {
  load(): ContentState | null;
  save(state: ContentState): void;
};

export const localContentStore: ContentStore = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as ContentState) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
  },
};

let store: ContentStore = localContentStore;
export function setContentStore(next: ContentStore) {
  store = next;
  state = hydrate(store.load());
  emit();
}

/* ── Seeding ────────────────────────────────────────────────────────────── */

/** Stable slide identity, embedded in the .pptx so an import can match exactly. */
export function slideId(dayNumber: number, index: number): string {
  return `d${dayNumber}s${String(index + 1).padStart(2, '0')}`;
}

/** Presentations are the deck-shaped materials; one per day. */
export function deckMaterialIds(): Array<{ materialId: string; dayId: string; dayNumber: number }> {
  return VOLVE_DAYS.flatMap((d) =>
    d.materials.filter((m) => m.kind === 'Presentation').map((m) => ({
      materialId: m.id, dayId: d.id, dayNumber: d.number,
    })),
  );
}

function seedDeck(materialId: string): DeckDoc | null {
  const day = VOLVE_DAYS.find((d) => d.materials.some((m) => m.id === materialId));
  if (!day) return null;
  return {
    materialId,
    dayId: day.id,
    slides: day.slides.map((s, i) => ({
      id: slideId(day.number, i),
      kind: 'structured' as const,
      // Carry the teaching layout through the seed, or every slide renders as a
      // generic concept page and the six-beat rhythm disappears from the deck.
      layout: s.layout,
      eyebrow: s.eyebrow,
      title: s.title,
      body: s.body,
      bullets: s.bullets ? [...s.bullets] : undefined,
      note: s.note,
    })),
  };
}

function seedMaterial(materialId: string): MaterialContent | null {
  const doc = seedDeck(materialId);
  if (!doc) return null;
  const rev: Revision = {
    id: 'rev-1', n: 1, parent: null, source: 'seed', author: CONTENT_AUTHOR,
    at: 0, note: 'Course baseline',
  };
  return { materialId, revisions: [rev], current: rev.id, docs: { [rev.id]: doc } };
}

function hydrate(raw: ContentState | null): ContentState {
  const out: ContentState = {};
  deckMaterialIds().forEach(({ materialId }) => {
    const stored = raw?.[materialId];
    const seeded = seedMaterial(materialId);
    if (!seeded) return;
    if (stored && Array.isArray(stored.revisions) && stored.revisions.length && stored.docs?.[stored.current]) {
      out[materialId] = stored;
    } else {
      out[materialId] = seeded;
    }
  });
  return out;
}

let state: ContentState = hydrate(store.load());
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function snapshot() { return state; }

function commit(next: ContentState) {
  state = next;
  store.save(state);
  emit();
}

export function useContent(): ContentState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function getMaterialContent(materialId: string): MaterialContent | undefined {
  return state[materialId];
}

/** The deck as it stands right now — what the presenter and compilers render. */
export function getDeck(materialId: string): DeckDoc | undefined {
  const mc = state[materialId];
  return mc ? mc.docs[mc.current] : undefined;
}

export function getRevisionDoc(materialId: string, revisionId: string): DeckDoc | undefined {
  return state[materialId]?.docs[revisionId];
}

export function listRevisions(materialId: string): Revision[] {
  return [...(state[materialId]?.revisions ?? [])].sort((a, b) => b.n - a.n);
}

export function currentRevision(materialId: string): Revision | undefined {
  const mc = state[materialId];
  return mc?.revisions.find((r) => r.id === mc.current);
}

/* ── Diff ───────────────────────────────────────────────────────────────── */

const FIELDS: Array<keyof SlideBlock> = ['eyebrow', 'title', 'body', 'bullets', 'note'];

function sameField(a: SlideBlock, b: SlideBlock, f: keyof SlideBlock): boolean {
  const x = a[f];
  const y = b[f];
  if (Array.isArray(x) || Array.isArray(y)) {
    return JSON.stringify(x ?? []) === JSON.stringify(y ?? []);
  }
  return (x ?? '') === (y ?? '');
}

/** Slide-level, field-aware diff — what the history panel and import preview show. */
export function diffDecks(before: DeckDoc | undefined, after: DeckDoc): ChangeSummary {
  const prev = before?.slides ?? [];
  const next = after.slides;
  const prevById = new Map(prev.map((s) => [s.id, s]));
  const nextById = new Map(next.map((s) => [s.id, s]));
  const details: ChangeSummary['details'] = [];

  next.forEach((s) => {
    const old = prevById.get(s.id);
    if (!old) { details.push({ slideId: s.id, kind: 'added', title: s.title ?? s.opaqueLabel ?? s.id }); return; }
    const fields = FIELDS.filter((f) => !sameField(old, s, f)).map(String);
    if (old.kind !== s.kind) fields.push('kind');
    if (fields.length) details.push({ slideId: s.id, kind: 'edited', title: s.title ?? s.opaqueLabel ?? s.id, fields });
  });
  prev.forEach((s) => {
    if (!nextById.has(s.id)) details.push({ slideId: s.id, kind: 'removed', title: s.title ?? s.opaqueLabel ?? s.id });
  });

  const commonBefore = prev.filter((s) => nextById.has(s.id)).map((s) => s.id);
  const commonAfter = next.filter((s) => prevById.has(s.id)).map((s) => s.id);
  const reordered = commonBefore.join('|') !== commonAfter.join('|');

  return {
    added: details.filter((d) => d.kind === 'added').length,
    removed: details.filter((d) => d.kind === 'removed').length,
    edited: details.filter((d) => d.kind === 'edited').length,
    reordered,
    details,
  };
}

export function summarise(s: ChangeSummary): string {
  const bits: string[] = [];
  if (s.added) bits.push(`${s.added} added`);
  if (s.removed) bits.push(`${s.removed} removed`);
  if (s.edited) bits.push(`${s.edited} edited`);
  if (s.reordered) bits.push('reordered');
  return bits.length ? bits.join(' · ') : 'No changes';
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/**
 * Record a new revision. Returns null when nothing actually changed, so a
 * no-op save never pollutes the history a trainer has to read.
 */
export function commitRevision(
  materialId: string,
  doc: DeckDoc,
  opts: { source: ContentSource; note?: string; at: number },
): Revision | null {
  const mc = state[materialId];
  if (!mc) return null;
  const before = mc.docs[mc.current];
  const summary = diffDecks(before, doc);
  if (!summary.details.length && !summary.reordered) return null;

  const n = Math.max(...mc.revisions.map((r) => r.n)) + 1;
  const rev: Revision = {
    id: `rev-${n}`, n, parent: mc.current, source: opts.source, author: CONTENT_AUTHOR,
    at: opts.at, note: opts.note ?? summarise(summary), summary,
  };

  const revisions = [...mc.revisions, rev];
  const docs = { ...mc.docs, [rev.id]: doc };

  // Prune the oldest full docs but keep their revision entries, so the timeline
  // stays complete even when the payload has aged out.
  const keep = new Set(revisions.slice(-MAX_FULL_REVISIONS).map((r) => r.id));
  keep.add(revisions[0].id);
  Object.keys(docs).forEach((id) => { if (!keep.has(id)) delete docs[id]; });

  commit({ ...state, [materialId]: { ...mc, revisions, docs, current: rev.id } });
  return rev;
}

/** Restoring is itself a revision — history is append-only, never rewritten. */
export function restoreRevision(materialId: string, revisionId: string, at: number): Revision | null {
  const mc = state[materialId];
  const doc = mc?.docs[revisionId];
  if (!mc || !doc) return null;
  const target = mc.revisions.find((r) => r.id === revisionId);
  return commitRevision(materialId, structuredClone(doc), {
    source: 'restore', at, note: `Restored revision ${target?.n ?? revisionId}`,
  });
}

export function resetContent() {
  commit(hydrate(null));
}
