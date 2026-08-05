// agent/scope.ts — pure Scope algebra. No React, no store, no data files.
//
// The store (src/store.ts) holds a Scope and delegates every transformation
// here, so scope behaviour is testable with `node scripts/test-agent-bus.mjs`
// and identical whether the change came from a scope bar, a chat turn, a ⌘K
// command or a deserialised URL.
//
// Three rules from GLOBAL-SCOPE-FILTER-SPINE §1, enforced here and nowhere else:
//   1. Scope is a set of optional levels, not a strict path.
//   2. Selecting deep auto-fills ancestors (which is what makes a faceted set
//      feel like a chain).
//   3. Contradictions are SURFACED, never silently dropped.

import type {
  Ref, Scope, ScopeBrain, ScopeConflict, ScopeFacets, ScopeGroup, ScopeLevel, ScopePatch,
} from './types.ts';
import { LEVEL_GROUP, SCOPE_LEVELS } from './types.ts';

/** A fresh, empty scope. Never share a frozen literal — callers mutate copies. */
export function emptyScope(): Scope {
  return { where: {}, geology: {}, accum: {}, wells: {}, facets: {}, derived: {}, conflicts: [] };
}

export function cloneScope(scope: Scope): Scope {
  return {
    where: { ...scope.where },
    geology: { ...scope.geology },
    accum: { ...scope.accum },
    wells: { ...scope.wells },
    facets: { ...scope.facets },
    derived: { ...scope.derived },
    conflicts: scope.conflicts.slice(),
  };
}

type Slots = Record<ScopeGroup, Record<string, Ref | undefined>>;

export function getLevel(scope: Scope, level: ScopeLevel): Ref | undefined {
  const group = LEVEL_GROUP[level];
  return (scope as unknown as Slots)[group][level];
}

/** Immutable single-level write. Does not auto-fill; use `applyPatch` for that. */
export function withLevel(scope: Scope, level: ScopeLevel, ref: Ref | null): Scope {
  const next = cloneScope(scope);
  writeLevel(next, level, ref);
  if (ref) delete next.derived[level];
  return next;
}

function writeLevel(scope: Scope, level: ScopeLevel, ref: Ref | null): void {
  const group = LEVEL_GROUP[level];
  const slots = (scope as unknown as Slots)[group];
  if (ref) slots[level] = ref;
  else delete slots[level];
}

/** Levels currently set, in canonical (coarse → fine) order. */
export function activeLevels(scope: Scope): ScopeLevel[] {
  return SCOPE_LEVELS.filter((level) => !!getLevel(scope, level));
}

export function isEmptyScope(scope: Scope): boolean {
  return activeLevels(scope).length === 0 && Object.keys(scope.facets).length === 0;
}

/** The deepest level set — what "it" refers to when the user says "show me its fields". */
export function focusLevel(scope: Scope): ScopeLevel | null {
  const active = activeLevels(scope);
  return active.length ? active[active.length - 1] : null;
}

export function focusRef(scope: Scope): Ref | null {
  const level = focusLevel(scope);
  return level ? getLevel(scope, level) ?? null : null;
}

/**
 * Merge a sparse patch into a scope.
 *
 * Auto-fill contract (rule 2): ancestors implied by an explicitly-chosen level
 * are written ONLY into slots that are empty or themselves derived. An explicit
 * user choice is never overwritten — if it disagrees with the implied ancestor
 * that is a real contradiction and rule 3 requires it be surfaced, not resolved.
 *
 * Descendants are deliberately NOT cleared when an ancestor changes. Picking
 * Norway while Kutei Basin is in scope leaves both set and raises a conflict,
 * which is what the spine asks for: the bar flags it and offers to relax one.
 */
export function applyPatch(
  scope: Scope,
  patch: ScopePatch,
  opts: { brain?: ScopeBrain | null; autofill?: boolean; reroot?: boolean } = {},
): Scope {
  const { brain = null, autofill = true, reroot = false } = opts;
  const next = cloneScope(scope);

  if (patch.facets) {
    next.facets = { ...next.facets, ...patch.facets };
    for (const [key, value] of Object.entries(patch.facets)) {
      if (value === undefined || value === null || value === '') {
        delete (next.facets as Record<string, unknown>)[key];
      }
    }
  }

  // Explicit writes first, so auto-fill can see the whole intended selection.
  const explicit: ScopeLevel[] = [];
  for (const level of SCOPE_LEVELS) {
    if (!(level in patch)) continue;
    const ref = patch[level] ?? null;
    writeLevel(next, level, ref);
    delete next.derived[level];
    if (ref) explicit.push(level);
  }

  if (autofill && brain) {
    // Deepest explicit level wins for any ancestor both would fill: a chosen
    // field's country is more specific evidence than a chosen basin's.
    //
    // EVERY explicit level is consulted, not just the ones in this patch. Saying
    // "viking graben" while Volve is already in scope must not re-derive the
    // country from the basin's majority shareholder (the UK) when the field
    // sitting in scope plainly asserts Norway.
    const explicitAll = SCOPE_LEVELS.filter((level) => getLevel(next, level) && !next.derived[level]);
    for (const level of explicitAll) {
      const ref = getLevel(next, level);
      if (!ref) continue;
      const ancestors = brain.ancestorsOf(level, ref);
      for (const [key, value] of Object.entries(ancestors)) {
        const ancestorLevel = key as ScopeLevel;
        if (!value) continue;
        if (explicitAll.includes(ancestorLevel)) continue;   // chosen outright — leave alone
        const current = getLevel(next, ancestorLevel);
        if (current && !next.derived[ancestorLevel]) continue; // earlier explicit choice — leave alone
        writeLevel(next, ancestorLevel, value);
        next.derived[ancestorLevel] = true;
      }
    }
  }

  next.conflicts = brain ? brain.conflictsIn(next) : [];

  // Re-root: the newest selection wins and contradictory older ones are dropped.
  //
  // Rule 3 (surface, never drop) governs the SCOPE BAR, where the user has
  // deliberately picked two things and deserves to be told they disagree. A
  // conversational turn is different: saying "volve" after "kutei basin" means
  // "now show me Volve", not "Volve inside Kutei" — accumulating a contradiction
  // there would be pedantry, so the agent passes reroot and the older, narrower
  // selection is released.
  if (reroot && next.conflicts.length) {
    const chosen = new Set(SCOPE_LEVELS.filter((level) => level in patch && patch[level]));
    let dropped = false;
    for (const conflict of next.conflicts) {
      const victim = chosen.has(conflict.level) ? conflict.against
        : chosen.has(conflict.against) ? conflict.level : null;
      if (!victim || chosen.has(victim)) continue;
      writeLevel(next, victim, null);
      delete next.derived[victim];
      dropped = true;
    }
    if (dropped) {
      const survivors: ScopePatch = {};
      for (const level of SCOPE_LEVELS) {
        if (getLevel(next, level) && !next.derived[level]) survivors[level] = getLevel(next, level)!;
      }
      for (const level of Object.keys(next.derived) as ScopeLevel[]) {
        writeLevel(next, level, null);
        delete next.derived[level];
      }
      return applyPatch(next, survivors, { brain, autofill });
    }
  }
  return next;
}

/** Drop one level. Any ancestor that exists only because of it is dropped too. */
export function clearLevel(scope: Scope, level: ScopeLevel, brain?: ScopeBrain | null): Scope {
  const next = cloneScope(scope);
  writeLevel(next, level, null);
  delete next.derived[level];

  // Re-derive from scratch: keep every explicit level, recompute derived ones.
  const explicitLevels = SCOPE_LEVELS.filter((l) => getLevel(next, l) && !next.derived[l]);
  for (const derivedLevel of Object.keys(next.derived) as ScopeLevel[]) {
    writeLevel(next, derivedLevel, null);
    delete next.derived[derivedLevel];
  }
  const patch: ScopePatch = {};
  for (const l of explicitLevels) patch[l] = getLevel(next, l) ?? null;
  return applyPatch(next, patch, { brain, autofill: true });
}

export function clearScope(scope: Scope, keepFacets = false): Scope {
  const next = emptyScope();
  if (keepFacets) next.facets = { ...scope.facets };
  return next;
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

export interface ScopeChip {
  level: ScopeLevel;
  ref: Ref;
  /** Auto-filled rather than chosen — the Scope Bar renders these greyed. */
  derived: boolean;
  conflicted: boolean;
}

export function scopeChips(scope: Scope): ScopeChip[] {
  const conflicted = new Set(scope.conflicts.flatMap((c) => [c.level, c.against]));
  return activeLevels(scope).map((level) => ({
    level,
    ref: getLevel(scope, level)!,
    derived: !!scope.derived[level],
    conflicted: conflicted.has(level),
  }));
}

/** "Indonesia › Kutei Basin › Badak" — for card headlines and log lines. */
export function scopeLabel(scope: Scope, sep = ' › '): string {
  return scopeChips(scope).map((chip) => chip.ref.name).join(sep);
}

// ── URL serialisation (spine §2: "every scope is shareable and reproducible") ──

export function serializeScope(scope: Scope): string {
  const parts: string[] = [];
  for (const chip of scopeChips(scope)) {
    if (chip.derived) continue;                       // ancestors re-derive on load
    parts.push(`${chip.level}=${encodeURIComponent(chip.ref.id)}`);
  }
  for (const [key, value] of Object.entries(scope.facets)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`f.${key}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}

/** Inverse of `serializeScope`. `lookup` resolves an id back to a Ref; a level
 *  whose id no longer exists is dropped rather than faked. */
export function parseScope(
  serialized: string,
  lookup: (id: string) => Ref | null,
  brain?: ScopeBrain | null,
): Scope {
  const patch: ScopePatch = {};
  const facets: ScopeFacets = {};
  for (const part of serialized.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const raw = decodeURIComponent(part.slice(eq + 1));
    if (key.startsWith('f.')) {
      const facetKey = key.slice(2);
      const numeric = /^year(From|To)$/.test(facetKey);
      (facets as Record<string, unknown>)[facetKey] = numeric ? Number(raw) : raw;
      continue;
    }
    if (!(SCOPE_LEVELS as string[]).includes(key)) continue;
    const ref = lookup(raw);
    if (ref) patch[key as ScopeLevel] = ref;
  }
  if (Object.keys(facets).length) patch.facets = facets;
  return applyPatch(emptyScope(), patch, { brain, autofill: true });
}

// ── Conflict helper shared by the real brain and its tests ───────────────────

/** Standard message shape so every conflict reads the same in the bar. */
export function conflict(
  level: ScopeLevel,
  against: ScopeLevel,
  message: string,
): ScopeConflict {
  return { level, against, message, relax: [level, against] };
}
