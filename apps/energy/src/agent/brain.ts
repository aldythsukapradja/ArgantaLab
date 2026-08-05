// agent/brain.ts — the ScopeBrain: gazetteer knowledge, injected into the bus.
//
// src/store.ts holds a Scope and knows nothing about petroleum geology. This is
// the piece that teaches it: which levels a selection implies, and which
// combinations contradict each other. Installed once via `installScopeBrain`
// after the gazetteer loads, so the store stays plain-Node testable.

import type { GazIndex } from './gazetteer.ts';
import { ancestryOf, toRef } from './gazetteer.ts';
import type { GazKind, Ref, Scope, ScopeBrain, ScopeConflict, ScopeLevel } from './types.ts';
import { conflict, getLevel } from './scope.ts';

/** Gazetteer kind → the scope level it fills. Kinds with no level (company,
 *  formation) are simply not scope-bearing; they are still answerable. */
const KIND_LEVEL: Partial<Record<GazKind, ScopeLevel>> = {
  region: 'region',
  country: 'country',
  province: 'province',
  basin: 'basin',
  'petroleum-system': 'petroleumSystem',
  'assessment-unit': 'assessmentUnit',
  'basin-cycle': 'cycle',
  play: 'play',
  field: 'field',
  reservoir: 'reservoir',
  well: 'well',
  wellbore: 'wellbore',
};

export function levelForKind(kind: GazKind): ScopeLevel | null {
  return KIND_LEVEL[kind] ?? null;
}

/** Every ancestor id of a node, at any depth — the containment test. */
function ancestorIds(index: GazIndex, id: string, limit = 64): Set<string> {
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length && out.size < limit) {
    const next: string[] = [];
    for (const current of frontier) {
      const node = index.byId.get(current);
      for (const edge of node?.parents ?? []) {
        if (out.has(edge.id)) continue;
        out.add(edge.id);
        next.push(edge.id);
      }
    }
    frontier = next;
  }
  return out;
}

export function makeScopeBrain(index: GazIndex): ScopeBrain {
  // Containment is asked on every scope write; cache it per node.
  const ancestorCache = new Map<string, Set<string>>();
  const ancestorsFor = (id: string) => {
    let set = ancestorCache.get(id);
    if (!set) { set = ancestorIds(index, id); ancestorCache.set(id, set); }
    return set;
  };

  return {
    ancestorsOf(level: ScopeLevel, ref: Ref): Partial<Record<ScopeLevel, Ref>> {
      const node = index.byId.get(ref.id);
      if (!node) return {};
      const out: Partial<Record<ScopeLevel, Ref>> = {};
      // ancestryOf takes the NEAREST assertion per kind, which is what keeps
      // Volve Norwegian rather than inheriting the North Sea Graben's majority
      // (UK) shareholder. See gazetteer.ts for why that mattered.
      for (const ancestor of ancestryOf(index, node)) {
        const ancestorLevel = levelForKind(ancestor.kind);
        if (!ancestorLevel || ancestorLevel === level) continue;
        out[ancestorLevel] = toRef(ancestor);
      }
      return out;
    },

    conflictsIn(scope: Scope): ScopeConflict[] {
      const out: ScopeConflict[] = [];
      const set = (level: ScopeLevel) => getLevel(scope, level);

      // Every finer level is checked against every coarser one it should sit
      // inside. A province genuinely spans borders, so basin-vs-country is
      // checked in the direction that is actually a contradiction: the basin
      // must list the country among its members, not be exclusive to it.
      const CONTAINMENT: [ScopeLevel, ScopeLevel[]][] = [
        ['wellbore', ['well', 'field', 'basin', 'country']],
        ['well', ['field', 'basin', 'country']],
        ['reservoir', ['field']],
        ['field', ['basin', 'country', 'region']],
        ['assessmentUnit', ['petroleumSystem', 'basin']],
        ['petroleumSystem', ['basin']],
        ['cycle', ['basin']],
        ['basin', ['country', 'region']],
        ['country', ['region']],
      ];

      for (const [childLevel, parentLevels] of CONTAINMENT) {
        const child = set(childLevel);
        if (!child) continue;
        const ancestors = ancestorsFor(child.id);
        for (const parentLevel of parentLevels) {
          const parent = set(parentLevel);
          if (!parent) continue;
          if (ancestors.has(parent.id)) continue;
          // A derived level is a consequence, not a choice. Picking Norway + Kutei
          // Basin is ONE mistake; also reporting "Kutei is not in Europe" (Europe
          // having been auto-filled from Norway) just doubles the noise and offers
          // the user a chip that cannot meaningfully be relaxed.
          if (scope.derived[parentLevel]) continue;
          // Only claim a contradiction when the child actually asserts a parent
          // of that kind. Silence is not disagreement — a field with no basin
          // edge is unlocated, not misplaced.
          const asserts = [...ancestors].some((id) => index.byId.get(id)?.kind === parent.kind);
          if (!asserts) continue;
          out.push(conflict(
            childLevel,
            parentLevel,
            `${child.name} is not in ${parent.name}`,
          ));
        }
      }
      return out;
    },
  };
}
