// use-scope-entry.ts — let a vertical follow the global scope (agent D1).
//
// The five lifecycle shells each hold their own `SearchEntry` scope in local
// state. That is why an agent turn could navigate to Exploration and still leave
// it showing Viking Graben while the chat said Kutei Basin: the shell never
// heard about it.
//
// This is the missing reader, shared by every vertical so they cannot drift —
// the same shape as `use-view-mode.ts`, one line per shell. The store's Scope is
// the source of truth; this translates it into the SearchEntry the shells (and
// the dossiers beneath them) already speak.

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useStore } from '../store';
import { loadSearchIndex, type SearchEntry } from './cockpit-search';
import type { Ref, ScopeLevel } from '../agent/types';

/** Gazetteer id → the id the shipped search index uses for the same thing. */
function searchIdFor(ref: Ref): string | null {
  const tail = ref.id.slice(ref.id.lastIndexOf(':') + 1);
  switch (ref.kind) {
    case 'basin': return `province:${tail}`;
    case 'assessment-unit': return `au:${tail}`;
    case 'field': return `arganta:master-data--Field:${tail}`;
    case 'wellbore': return `arganta:master-data--Wellbore:${tail}`;
    case 'company': return `arganta:master-data--Organisation:${tail}`;
    // Countries are keyed by name upstream, and wells/cycles/formations have no
    // search-index entry at all — both fall back to the name match below.
    default: return null;
  }
}

/** Resolve a scope Ref to the SearchEntry the verticals consume. */
export function refToSearchEntry(ref: Ref, index: SearchEntry[]): SearchEntry | null {
  const byId = searchIdFor(ref);
  if (byId) {
    const hit = index.find((entry) => entry.id === byId);
    if (hit) return hit;
  }
  const name = ref.name.toLowerCase();
  return index.find((entry) => entry.name.toLowerCase() === name) ?? null;
}

/**
 * Follow the global scope at whichever of `levels` is deepest and present.
 *
 * `levels` is the vertical's own emphasis (GLOBAL-SCOPE-FILTER-SPINE §3.3):
 * Exploration follows country/basin/assessment-unit, Field Development follows
 * the field, Reservoir Management the field, Drilling the field.
 *
 * Deliberately one-way and additive: the shell keeps its own state and its own
 * scope bar, and simply adopts the global scope when it changes. Nothing is
 * ripped out, so a vertical that has not adopted this yet keeps working.
 */
export function useScopeEntry(levels: ScopeLevel[], setScope: Dispatch<SetStateAction<SearchEntry | null>>) {
  const scope = useStore((s) => s.scope);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadSearchIndex().then((loaded) => { if (alive) setIndex(loaded); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!index) return;
    // Deepest requested level wins — the agent sets the whole chain, and a
    // vertical wants the finest thing it can render.
    let ref: Ref | undefined;
    for (const level of levels) {
      const group = scope.where[level as 'country'] ?? scope.geology[level as 'basin']
        ?? scope.accum[level as 'field'] ?? scope.wells[level as 'well'];
      if (group) ref = group;
    }
    if (!ref || ref.id === lastId.current) return;
    const entry = refToSearchEntry(ref, index);
    if (!entry) return;
    lastId.current = ref.id;
    setScope(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, index]);
}
